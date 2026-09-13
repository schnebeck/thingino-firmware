# Server-side setup: VPN helper server

Not part of the firmware image. These scripts, the service account, and the
authorized_keys entries below need to be set up once, by hand, on any host
the camera can reach over its VPN connection. Nothing here is specific to
one server or one VPN backend:

- **Server-independent**: the camera addresses this host purely through
  `vpn_helper.remote` in its own `thingino.json` (a plain `user@host`
  string). Point it at whatever host you actually run this on.
- **VPN-backend-independent**: the camera side (`petcam-vpn-onconnect`,
  see `package/petcam-tools/files/`) detects the helper becoming reachable
  with a plain TCP probe on port 22 - it does not care whether the route
  came up via OpenVPN, WireGuard, or anything else. This server side is
  equally agnostic: it just needs to be reachable at whatever address the
  camera's VPN client resolves to.

## Prerequisites

- A Linux host reachable from the camera over the VPN, with SSH already
  running there.
- Outbound HTTPS access from this host (needed for the geolocation
  lookup, and for issuing/renewing the TLS certificate if you use the
  internal-CA approach below - see `docs` in this repo, or use your own
  cert source).
- A little disk space for off-site backups. The receive script caps total
  usage at 2GB by default (oldest files deleted first) - raise
  `MAX_BYTES` in `petcam-backup-receive` if you have more room, but check
  `df -h` on this host first if it's shared with other services.
- `curl` (geolocation helper), `tar` (cert pull), a POSIX shell. Nothing
  exotic.

## 1. Create a dedicated, unprivileged service account

Every camera-initiated action on this server is a single fixed command,
enforced by an authorized_keys `command=` restriction - **not** by which
Unix account runs it. Even so, run all of it as a dedicated account with
no other privileges, so a bug in one of these scripts (or a leaked key)
can't reach anything beyond what that account itself owns:

```sh
useradd --system --create-home --home-dir /home/petcamsvc --shell /bin/sh --user-group petcamsvc
mkdir -p /home/petcamsvc/.ssh
chmod 700 /home/petcamsvc/.ssh
chown petcamsvc:petcamsvc /home/petcamsvc/.ssh
```

**Use `/bin/sh` as the shell, not `/usr/sbin/nologin` or `/bin/false`.**
This is the one counter-intuitive part: OpenSSH does not execve a
forced command directly - it runs `<login-shell> -c "<forced-command>"`.
A nologin-style shell ignores the `-c` argument entirely and just prints
its own refusal message, silently breaking every forced command for that
account while pubkey auth still reports success (confusing to debug: the
key is accepted, sshd logs that it selected the right forced command, and
then nothing happens). The account is exactly as restricted either way -
restriction comes from every key below carrying its own `command=`, never
from what the account's shell is - so `/bin/sh` here costs nothing and
avoids that trap.

## 2. Off-site backup receiver

```sh
mkdir -p /srv/petcam-backup/{clips,sounds,emergency}
chown -R petcamsvc:petcamsvc /srv/petcam-backup
```

Copy `petcam-backup-receive` (this directory) to
`/usr/local/sbin/petcam-backup-receive`, `chmod 755`.

## 3. WiFi geolocation helper

Copy `petcam-locate-receive` (this directory) to
`/usr/local/sbin/petcam-locate-receive`, `chmod 755`. It also appends
every lookup's result to `/srv/petcam-backup/locations.jsonl` - a location
history that survives the camera being lost, stolen, or destroyed, since
it never lived only on-device. `tail -f` that file to watch it live, or
just `cat` it for the full history; one compact JSON line per lookup.

## 4. TLS certificate source (optional, only if the camera pulls its cert from here)

`petcam-tls-pull` on the camera runs `tar -C <cert-dir> -chf - fullchain.pem
privkey.pem` against whatever the forced command points at - any
mechanism that produces a `fullchain.pem` + `privkey.pem` pair readable
by `petcamsvc` in one directory works. Point-in-time snapshot of what
that command actually runs (see step 5): it always tars up exactly those
two files from one fixed directory, nothing else, regardless of what the
camera asks for.

This repo includes a small, generic, VPN-independent private CA
(`vpn-ca-issue`) as one way to satisfy that - use it, or plug in anything
else that lands a cert+key pair in a directory. A private CA (rather than
a public one like Let's Encrypt) is the right fit here specifically
because these devices are reachable only inside the VPN, never from the
public internet, so there's no domain to prove ownership of and no
public CA would issue for a bare VPN IP anyway.

**Why a private CA at all, instead of just a self-signed cert per
device**: a self-signed cert makes every device require its own
"add security exception" click-through, forever, on every client that
talks to it, and gives you nothing to revoke/rotate cleanly. A private
CA root gets installed as trusted exactly once per *client* device, and
after that every *server* device's certificate is trusted automatically,
including certs issued to devices you onboard later, and including any
future rotation of an already-trusted device's own certificate.

Setup:

```sh
mkdir -p /etc/vpn-ca
cp vpn-ca-issue /usr/local/sbin/vpn-ca-issue
chmod 755 /usr/local/sbin/vpn-ca-issue

# first issue for the camera - repeat for any other internal device later
VPN_CA_ORG="Your Org Name" /usr/local/sbin/vpn-ca-issue petcam <camera's-VPN-IP>

# petcamsvc (see step 1) needs to read the issued key
chgrp petcamsvc /etc/vpn-ca/issued/petcam/privkey.pem
chmod 640 /etc/vpn-ca/issued/petcam/privkey.pem
chgrp petcamsvc /etc/vpn-ca/issued/petcam
chmod 750 /etc/vpn-ca/issued/petcam

# monthly re-issue (idempotent - only actually renews inside 60 days of
# expiry), re-applying the permission fix every time since vpn-ca-issue
# itself always writes a fresh privkey.pem as owner-only 600
cat > /etc/cron.d/vpn-ca <<'EOF'
0 3 1 * * root /usr/local/sbin/vpn-ca-issue petcam <camera's-VPN-IP> >>/var/log/vpn-ca.log 2>&1 && chgrp petcamsvc /etc/vpn-ca/issued/petcam/privkey.pem && chmod 640 /etc/vpn-ca/issued/petcam/privkey.pem
EOF
```

Then serve `/etc/vpn-ca/ca.crt` to client devices (phones, laptops -
whatever will browse to a camera's HTTPS UI) so they can install it as a
trusted root once. `vpn-ca.conf.example` (this directory) is a working
example vhost for this - adjust the bind address for your own VPN and
web server. This step is about the humans who need a trusted padlock in
a browser, not the camera-to-server automation above; skip it entirely
if nobody ever opens the camera's web UI directly and TLS trust doesn't
matter to you.

If you'd rather not run a private CA at all, anything that produces a
`fullchain.pem` + `privkey.pem` pair works equally well as long as the
permission/ownership contract above (`petcamsvc` group-readable) holds -
a wildcard cert for a domain you control, a public CA's cert if these
devices somehow are internet-reachable, whatever fits your situation.

## 5. Register the three keys

Each key is generated on first use by the camera itself (`dropbearkey -t
ed25519 -f /etc/petcam-<name>.key`) - never shipped in the firmware
image. Get each pubkey from the camera:

```sh
dropbearkey -y -f /etc/petcam-tls-pull.key   | grep ^ssh-
dropbearkey -y -f /etc/petcam-backup.key     | grep ^ssh-
dropbearkey -y -f /etc/petcam-locate.key     | grep ^ssh-
```

Add three lines to `/home/petcamsvc/.ssh/authorized_keys` (create it
`chmod 600`, owned by `petcamsvc`), one per key, each with its own fixed
command and no other privileges:

```
command="tar -C /path/to/certs -chf - fullchain.pem privkey.pem",no-agent-forwarding,no-X11-forwarding,no-port-forwarding,no-pty <tls-pull pubkey>
command="/usr/local/sbin/petcam-backup-receive",no-agent-forwarding,no-X11-forwarding,no-port-forwarding,no-pty <backup pubkey>
command="/usr/local/sbin/petcam-locate-receive",no-agent-forwarding,no-X11-forwarding,no-port-forwarding,no-pty <locate pubkey>
```

Whatever command the camera actually sends is ignored by all three - each
line always and only runs its own fixed command. No shell, no port
forwarding, no other file access; a leaked key yields exactly one narrow
capability and nothing else.

## 6. Point the camera at this server

On the camera, set (via the web UI is not wired up for this yet - use
`jct` directly, or ship it as a camera-profile default in
`configs/cameras/<profile>/thingino.json`):

```sh
jct /etc/thingino.json set vpn_helper.remote "petcamsvc@<this-server's-VPN-IP>"
```

Repo default is an empty string (feature no-ops everywhere it's read)
since this value is inherently deployment-specific - never commit an
actual server address as the shared default.

## 7. Test from the camera

```sh
petcam-tls-pull      # exit 0, installs a cert if one was configured in step 4
petcam-backup-push /etc/hostname sounds test.txt   # exit 0, file lands in /srv/petcam-backup/sounds/
petcam-locate         # exit 0 if location.enabled is true and WiFi scan found APs
```

`petcam-vpn-onconnect` (cron, every minute - see
`S54petcam-vpn-watch-cron`) fires the tls-pull + locate pair automatically
the first minute this server becomes reachable after being down, and
`S51petcam-tls-cron` / `S53petcam-locate-cron` are periodic fallbacks
(6h / 1h) in case that transition is ever missed.

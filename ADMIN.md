# Internal VPN CA + PetCam TLS (2026-09-12)

Reference documentation for this project's own VPN helper server
deployment (10.1.1.1 in what follows) - a worked example of the generic
setup described in
[`backup-server-setup/README.md`](package/petcam-tools/files/backup-server-setup/README.md).
Nothing here is specific to that README's mechanism itself; this is just
what one real deployment of it looks like, including the actual pubkeys
and paths in place today.

A private, internal CA on this server issues certificates for devices
that are only ever reachable inside the VPN (10.1.1.0/24) - not exposed
to the public internet. The camera ("PetCam", tunnel IP 10.1.1.7) is the
first consumer, but this CA is generic and meant to be reused for future
internal VPN devices too.

## History note

An earlier version of this used a real Let's Encrypt certificate for
`petcam.schnebeck.de`, and before that a petcam-specific CA with just a
bare `CN=` (no `O=`), which Android's certificate installer displayed as
"Certificate from null" (it expects an Organization field to build that
label). Both were replaced. The Let's Encrypt cert was removed via
`certbot delete --cert-name petcam.schnebeck.de` - a hostname-based
public cert added no value here since the camera is reached by its VPN
IP, not a hostname that reliably resolves for VPN clients (especially
phones, where OpenVPN-pushed DNS is frequently overridden by the OS's own
DNS-over-TLS setting). The Strato DNS A record for `petcam.schnebeck.de`
still exists but is unused and can be deleted.

## What exists now

**Internal CA** (`/etc/vpn-ca/`)
- `ca.key` / `ca.crt`: ECDSA root CA, self-signed, `O=schnebeck.de,
  CN=Schnebeck VPN CA`, valid 10 years (created once, never rotated -
  rotating it would break trust on every client device that has it
  installed).
- `issued/<name>/fullchain.pem` + `issued/<name>/privkey.pem`: one
  subdirectory per device. Currently only `issued/petcam/` exists, for
  `CN=10.1.1.7` with IP SAN `10.1.1.7`. `fullchain.pem` is the leaf cert
  concatenated with `ca.crt`.
- [`vpn-ca-issue`](package/petcam-tools/files/backup-server-setup/vpn-ca-issue)
  `<name> <ip>`: idempotent issue/renew script, generic - not
  petcam-specific. Only actually (re)issues a leaf cert if missing or
  within 60 days of expiry; running it with a still-valid cert in place
  is a no-op. To add another internal device later: `vpn-ca-issue <name>
  <its-vpn-ip>`, then set up a pull mechanism for it analogous to the
  camera's (see below), or fetch it manually.
- `/etc/cron.d/vpn-ca`: runs `vpn-ca-issue petcam 10.1.1.7` monthly (1st,
  03:00), logs to `/var/log/vpn-ca.log`, then re-applies the petcamsvc
  group-read permission on the freshly issued `privkey.pem` (see service
  account section below - `vpn-ca-issue` itself is generic/untouched and
  always writes it back as owner-only 600, so this fixup runs as a second
  `&&`-chained command on the same cron line rather than living in the
  shared script).

**Service account for all camera-initiated SSH actions (2026-09-13)**
- `petcamsvc`: dedicated system user (`useradd --system --create-home
  --shell /bin/sh --user-group petcamsvc`), no privileges beyond what's
  explicitly granted below. Originally the TLS-pull key lived directly
  under `/root/.ssh/authorized_keys`; moved here alongside the newer
  backup/locate keys (see "Off-site backup + geolocation" below) so
  nothing camera-facing authenticates as root at all anymore.
- **Shell is `/bin/sh`, deliberately not `/usr/sbin/nologin` or
  `/bin/false`.** OpenSSH runs a forced command as `<login-shell> -c
  "<command>"`, not via direct execve - a nologin-style shell swallows
  the `-c` argument and just prints its own refusal message, silently
  breaking every forced command for the account while pubkey auth still
  succeeds (sshd's own log even shows it selected the right forced
  command - only `nologin`'s own log line downstream reveals what
  actually happened). Cost hours to track down once; the account is
  exactly as restricted with `/bin/sh` since every key below carries its
  own `command=` regardless of what the login shell is.
- All three keys live in `/home/petcamsvc/.ssh/authorized_keys` (600,
  owned by petcamsvc):
  ```
  command="tar -C /etc/vpn-ca/issued/petcam -chf - fullchain.pem privkey.pem",no-agent-forwarding,no-X11-forwarding,no-port-forwarding,no-pty ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGsmz/H65dGLSRlF/fgAroTjXo1xAzfsxfbkyrT5Kc8j root@PedCam-tls-pull
  command="/usr/local/sbin/petcam-backup-receive",no-agent-forwarding,no-X11-forwarding,no-port-forwarding,no-pty ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA7fSCAkq28BtRQNeCqb3maK3thuPF6WLL2eUkt3Cm94 root@PedCam-backup
  command="/usr/local/sbin/petcam-locate-receive",no-agent-forwarding,no-X11-forwarding,no-port-forwarding,no-pty ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBhJN4fiWeGkK8zQbMGiux5oIjxnp5E9p4EmiyhTeyhl root@PedCam-locate
  ```
  Whatever command the camera actually sends is ignored by all three -
  each line always and only runs its own fixed command. No shell, no
  port forwarding, no other file access; a leaked key yields exactly one
  narrow capability.
- `/etc/vpn-ca/issued/petcam/` is `750 root:petcamsvc`, `privkey.pem` is
  `640 root:petcamsvc` - group-read only, re-applied after every monthly
  reissue (see the CA cron entry above).
- `/srv/petcam-backup/` (clips/sounds/emergency + `locations.jsonl`, see
  below) is owned outright by `petcamsvc:petcamsvc`.
- Full setup steps, generalized for reuse on a different server or a
  different VPN backend, are in
  [`backup-server-setup/README.md`](package/petcam-tools/files/backup-server-setup/README.md)
  in this repo.

**Off-site backup + WiFi geolocation (2026-09-13)**
- [`petcam-backup-receive`](package/petcam-tools/files/backup-server-setup/petcam-backup-receive):
  forced command for the backup key, validates the client-requested
  relative path against `^(clips|sounds|emergency)/[A-Za-z0-9._-]+$` and
  writes it under `/srv/petcam-backup/`, capping total usage at 2GB
  (oldest files deleted first - this server has only a few GB free,
  shared with other services).
- [`petcam-locate-receive`](package/petcam-tools/files/backup-server-setup/petcam-locate-receive):
  forced command for the locate key, pipes the camera's WiFi-AP JSON
  straight to beaconDB (`https://api.beacondb.net/v1/geolocate`, no API
  key, MLS/Ichnaea-compatible community successor to Mozilla's shut-down
  service) and returns whatever it says. Also appends
  `{"received":<epoch>, "response":<beaconDB JSON>}` to
  `/srv/petcam-backup/locations.jsonl` - a location history that
  survives the camera itself being lost, stolen, or destroyed, since it
  was never only on-device.
- The camera triggers both on a VPN-agnostic schedule
  (`petcam-vpn-onconnect`, cron every minute, fires once per this
  server's down->up transition regardless of which VPN client brought
  the tunnel up - it's a plain TCP probe on port 22, nothing OpenVPN- or
  WireGuard-specific) plus periodic fallbacks (petcam-tls-pull every 6h,
  petcam-locate every 1h).

**CA root download for client devices**
- `/var/www/vpn-ca/ca.crt` (copy of `ca.crt`), served by a
  dedicated Apache vhost bound specifically to `10.1.1.1:80`
  (`/etc/apache2/sites-available/vpn-ca.conf`, enabled - see
  [`vpn-ca.conf.example`](package/petcam-tools/files/backup-server-setup/vpn-ca.conf.example)
  in this repo for a generic version), with
  `Content-Type: application/x-x509-ca-cert` so Android/browsers trigger
  the native "install CA certificate" flow correctly.
- URL: `http://10.1.1.1/ca.crt` - only reachable from
  inside the VPN, since 10.1.1.1 is a private address with no route from
  the public internet. This server's public-facing vhosts only ever
  match by Host header on the public IP and are unaffected.
- Import this file's certificate as a trusted CA/root on each client
  device that should see VPN-internal HTTPS (currently just the camera)
  as fully trusted. One time per device; survives any future certificate
  renewal, or onboarding of further internal devices under this same CA,
  without needing to be redone.

## How it works end-to-end (camera)

1. `vpn-ca-issue petcam 10.1.1.7` keeps a valid leaf certificate ready in
   `/etc/vpn-ca/issued/petcam/`, checked monthly, self-renewing inside a
   60-day window, no interaction needed.
2. Whenever the camera's VPN connection reaches this server again (boot,
   reconnect, including after a factory reset - detected VPN-agnostically
   by `petcam-vpn-onconnect`, not tied to OpenVPN specifically), the
   camera pulls the current cert+key with its restricted key and installs
   it on its own web server, replacing whatever self-signed fallback cert
   it booted with. Also runs every 6h on the camera as a fallback. All of
   this logic lives on the camera side
   ([`petcam-tls-pull`](package/petcam-tools/files/petcam-tls-pull)), not
   on this server.
3. Because the CA root is what's trusted on client devices (not any one
   leaf certificate), the camera can rotate its own certificate anytime
   without anyone needing to touch a phone or laptop again.

## What was NOT changed

- OpenVPN server config/CCD (the `PetCam` entry with its fixed
  `10.1.1.7` was already there, untouched).
- Apache's existing vhosts/certs for cloud/mysql/office/talk.schnebeck.de.
- No firewall rules, no port forwards, no new public listeners - the only
  new Apache vhost is bound to the private VPN IP, not the public one.

## Client trust: confirmed working

CA root installed and verified giving a fully trusted padlock (no
warnings) for `https://10.1.1.7` on:
- Android (via system Settings -> Security -> Encryption & credentials ->
  Install a certificate -> CA certificate, picking the downloaded file
  from Downloads directly)
- Firefox on Linux (via about:preferences#privacy -> Certificates ->
  Authorities -> Import, with "trust this CA to identify websites"
  checked)

**Known cosmetic quirk**: Vivaldi (and likely other Chromium-based
browsers) on Android shows its own pre-install interstitial as
"Zertifikat von null" / "Certificate from null" when opening a downloaded
`.crt` directly in-browser. This is a display bug in that dialog only -
the certificate itself is fine (valid v3, proper O=/CN=, correct
extensions) and installs with the correct name when done via Android's
own Settings app instead of tapping through the browser's dialog. Not
worth chasing further; just use the Settings-based install path above.

Also note: downloading over plain `http://10.1.1.1/ca.crt` triggers an
Android "file cannot be downloaded securely" warning (expected, since
it's cleartext HTTP within the VPN) - tapping "Keep"/"Behalten" is safe
here, the download itself isn't the security boundary that matters (VPN
membership is).

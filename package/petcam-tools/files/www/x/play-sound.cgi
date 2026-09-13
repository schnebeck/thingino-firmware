#!/bin/sh
# shellcheck disable=SC1091
# play-sound.cgi?slot=0..4 - plays one of the 5 configured quick-play sound
# buttons through the camera speaker (rac play). Requires the mic/spk
# framework's own auth like every other control action; unlike
# video-link.cgi this is never linked from outside the UI.

. /var/www/x/auth.sh
require_auth

THINGINO_JSON="/etc/thingino.json"
SOUNDS_DIR="/mnt/mmcblk0p1/raptor/sounds"

send_json() {
	printf 'Status: %s\r\n' "$1"
	printf 'Content-Type: application/json\r\n\r\n'
	printf '%s' "$2"
}

qval() { printf '%s' "$QUERY_STRING" | sed -n "s/.*$1=\([^&]*\).*/\1/p"; }

SLOT=$(qval slot)
case "$SLOT" in
	0 | 1 | 2 | 3 | 4) ;;
	*) send_json "400 Bad Request" '{"error":"invalid_slot"}'; exit 0 ;;
esac

buttons=$(jct "$THINGINO_JSON" get sound_buttons 2>/dev/null)
[ -n "$buttons" ] && [ "$buttons" != "null" ] || {
	send_json "412 Precondition Failed" '{"error":"not_configured"}'
	exit 0
}

btn_tmp=$(mktemp)
printf '%s' "$buttons" >"$btn_tmp"
enabled=$(jct "$btn_tmp" get "${SLOT}.enabled" 2>/dev/null)
file=$(jct "$btn_tmp" get "${SLOT}.file" 2>/dev/null | tr -d '"')
rm -f "$btn_tmp"

[ "$enabled" = "true" ] || { send_json "412 Precondition Failed" '{"error":"slot_disabled"}'; exit 0; }

# Reject anything but a bare filename - no path components survive, so a
# stored "file" value can never point outside SOUNDS_DIR regardless of how
# it got there.
case "$file" in
	"" | */* | *..*) send_json "412 Precondition Failed" '{"error":"no_file"}'; exit 0 ;;
esac
[ -f "$SOUNDS_DIR/$file" ] || { send_json "404 Not Found" '{"error":"file_missing"}'; exit 0; }

# The camera's own mic picks up whatever the speaker plays (confirmed
# earlier: even a short beep registers as a large RMS spike) - without this,
# every sound-button press would very likely fire the audio alarm on its
# own playback. /run/self-noise-active mirrors the motor-noise suppression
# audio-alarm.c already does for motor_is_active() (same flag also used by
# dispense-treat-cycle); a fixed 1s grace period after playback ends covers
# the tail of the sound plus the baseline's own reaction time before
# triggering resumes.
(
	touch /run/self-noise-active
	rac play "$SOUNDS_DIR/$file" >/dev/null 2>&1
	sleep 1
	rm -f /run/self-noise-active
) &

send_json "200 OK" '{"result":"success"}'

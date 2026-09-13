#!/bin/sh
# shellcheck disable=SC1091
# Config for the 5 quick-play sound buttons (control-bar.js's "Sounds"
# dropdown): GET returns the 5 slots plus the list of uploaded files to
# pick from; POST saves the 5 slots. Uploading a new file is a separate
# endpoint (json-sound-upload.cgi) - this one is pure config.

. /var/www/x/auth.sh
require_auth

THINGINO_JSON="/etc/thingino.json"
SOUNDS_DIR="/mnt/mmcblk0p1/raptor/sounds"

send_json() {
	printf 'Status: %s\r\n' "$1"
	printf 'Content-Type: application/json\r\n\r\n'
	printf '%s' "$2"
}

default_buttons() {
	printf '[{"enabled":false,"file":"","label":"","tooltip":""},{"enabled":false,"file":"","label":"","tooltip":""},{"enabled":false,"file":"","label":"","tooltip":""},{"enabled":false,"file":"","label":"","tooltip":""},{"enabled":false,"file":"","label":"","tooltip":""}]'
}

list_files() {
	[ -d "$SOUNDS_DIR" ] || { printf '[]'; return; }
	printf '['
	i=0
	for f in "$SOUNDS_DIR"/*; do
		[ -f "$f" ] || continue
		name=$(basename "$f")
		name=$(printf '%s' "$name" | sed 's/\\/\\\\/g; s/"/\\"/g')
		[ $i -gt 0 ] && printf ','
		printf '"%s"' "$name"
		i=$((i + 1))
	done
	printf ']'
}

if [ "$REQUEST_METHOD" = "GET" ]; then
	buttons=$(jct "$THINGINO_JSON" get sound_buttons 2>/dev/null)
	[ -n "$buttons" ] && [ "$buttons" != "null" ] || buttons=$(default_buttons)
	send_json "200 OK" "{\"buttons\":${buttons},\"files\":$(list_files)}"
	exit 0
fi

if [ "$REQUEST_METHOD" = "POST" ]; then
	if [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ]; then
		post_data=$(dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null)
	else
		post_data=""
	fi
	[ -n "$post_data" ] || { send_json "400 Bad Request" '{"error":"no_data"}'; exit 0; }

	post_tmp=$(mktemp)
	printf '%s' "$post_data" >"$post_tmp"
	buttons=$(jct "$post_tmp" get buttons 2>/dev/null)
	rm -f "$post_tmp"
	[ -n "$buttons" ] && [ "$buttons" != "null" ] || {
		send_json "400 Bad Request" '{"error":"missing_buttons"}'
		exit 0
	}

	temp_json=$(mktemp)
	printf '{"sound_buttons": %s}\n' "$buttons" >"$temp_json"
	jct "$THINGINO_JSON" import "$temp_json"
	rm -f "$temp_json"

	send_json "200 OK" '{"result":"success"}'
	exit 0
fi

send_json "405 Method Not Allowed" '{"error":"invalid_method"}'

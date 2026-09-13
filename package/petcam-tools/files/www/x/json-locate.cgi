#!/bin/sh
# shellcheck disable=SC1091
# GET returns the enabled flag plus the last known WiFi-based approximate
# location (persisted in thingino.json so it survives a reboot).
#
# POST with a JSON body containing an "enabled" key saves that as the new
# location.enabled setting (config save - see config-locate.js). POST with
# any other/no body triggers a fresh scan+lookup and returns its result -
# iwlist scanning plus the round trip to the VPN-side geolocation helper
# is a few seconds, done synchronously since there's nothing more useful
# to show until it finishes. petcam-locate itself refuses to run at all
# while disabled, so this path fails informatively rather than silently
# doing a lookup the user opted out of.

. /var/www/x/auth.sh
require_auth

THINGINO_JSON="/etc/thingino.json"

send_json() {
	printf 'Status: %s\r\n' "$1"
	printf 'Content-Type: application/json\r\n\r\n'
	printf '%s' "$2"
}

if [ "${REQUEST_METHOD:-GET}" = "POST" ]; then
	post_data=""
	if [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ] 2>/dev/null; then
		post_data=$(dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null)
	fi

	if [ -n "$post_data" ]; then
		post_tmp=$(mktemp)
		printf '%s' "$post_data" >"$post_tmp"
		new_enabled=$(jct "$post_tmp" get enabled 2>/dev/null)
		rm -f "$post_tmp"
	fi

	if [ "$new_enabled" = "true" ] || [ "$new_enabled" = "false" ]; then
		jct "$THINGINO_JSON" set location.enabled "$new_enabled" >/dev/null 2>&1
		send_json "200 OK" '{"result":"success"}'
		exit 0
	fi

	if ! command -v petcam-locate >/dev/null 2>&1; then
		send_json "503 Service Unavailable" '{"error":"not_available"}'
		exit 0
	fi
	if ! petcam-locate 2>/tmp/petcam-locate.log; then
		send_json "502 Bad Gateway" "{\"error\":\"locate_failed\",\"detail\":\"$(cat /tmp/petcam-locate.log 2>/dev/null | tail -1 | sed 's/"/\\"/g')\"}"
		exit 0
	fi
fi

enabled=$(jct "$THINGINO_JSON" get location.enabled 2>/dev/null)
lat=$(jct "$THINGINO_JSON" get location.lat 2>/dev/null)
lng=$(jct "$THINGINO_JSON" get location.lng 2>/dev/null)
accuracy=$(jct "$THINGINO_JSON" get location.accuracy 2>/dev/null)
updated=$(jct "$THINGINO_JSON" get location.updated 2>/dev/null)

if [ -z "$lat" ] || [ "$lat" = "null" ]; then
	send_json "200 OK" "{\"enabled\":$([ "$enabled" = "true" ] && echo true || echo false),\"known\":false}"
	exit 0
fi

send_json "200 OK" "{\"enabled\":$([ "$enabled" = "true" ] && echo true || echo false),\"known\":true,\"lat\":$lat,\"lng\":$lng,\"accuracy\":${accuracy:-null},\"updated\":${updated:-null}}"

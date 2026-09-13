#!/bin/sh
# shellcheck disable=SC1091

. /var/www/x/auth.sh
require_auth

send_json() {
	printf 'Status: %s\r\n' "$1"
	printf 'Content-Type: application/json\r\n\r\n'
	printf '%s' "$2"
}

qs_get() {
	key="$1"
	printf '%s' "${QUERY_STRING:-}" | tr '&' '\n' | grep "^${key}=" | head -1 | cut -d= -f2-
}

stream="$(qs_get stream)"
bitrate="$(qs_get bitrate)"
fps="$(qs_get fps)"

case "$stream" in
	0 | 1) ;;
	*)
		send_json "400 Bad Request" '{"error":"invalid_stream"}'
		exit 0
		;;
esac

case "$bitrate" in
	'' | *[!0-9]*)
		send_json "400 Bad Request" '{"error":"invalid_bitrate"}'
		exit 0
		;;
esac

case "$fps" in
	'' | *[!0-9]*)
		send_json "400 Bad Request" '{"error":"invalid_fps"}'
		exit 0
		;;
esac

if [ "$bitrate" -lt 50000 ] || [ "$bitrate" -gt 8000000 ]; then
	send_json "400 Bad Request" '{"error":"bitrate_out_of_range"}'
	exit 0
fi

if [ "$fps" -lt 1 ] || [ "$fps" -gt 30 ]; then
	send_json "400 Bad Request" '{"error":"fps_out_of_range"}'
	exit 0
fi

# Applied only when a viewer actually picks this preset (see the "Quality"
# selector in preview.html) - retunes the already-running channel's live
# encoder parameters, no separate always-on stream is kept around for it.
raptorctl rvd set-bitrate "$stream" "$bitrate" >/dev/null 2>&1
raptorctl rvd set-fps "$stream" "$fps" >/dev/null 2>&1

send_json "200 OK" '{"result":"success"}'

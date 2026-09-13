#!/bin/sh
# shellcheck disable=SC1091,SC3043

. /var/www/x/auth.sh
require_auth

THINGINO_JSON="/etc/thingino.json"
SEND2_JSON="/etc/send2.json"
SERVICES="email ftp gphotos gotify mqtt ntfy pushover storage telegram webhook xmpp"

send_json() {
	printf 'Content-Type: application/json\r\nConnection: close\r\n\r\n'
	printf '%s' "$1"
}

send_error() {
	printf 'Status: 412 Precondition Failed\r\n'
	send_json "{\"error\":{\"message\":\"$1\"}}"
}

default_audio_alarm() {
	cat <<'EOF'
{"enabled":false,"activity_ratio":1.5,"integral_threshold":4000.0,
"avg_window_n":300,"record_secs":20,"extend_secs":10,
"send2email":false,"send2ftp":false,"send2gphotos":false,"send2gotify":false,"send2mqtt":false,
"send2ntfy":false,"send2pushover":false,"send2storage":false,"send2telegram":false,
"send2webhook":false,"send2xmpp":false}
EOF
}

if [ "$REQUEST_METHOD" = "GET" ]; then
	audio_alarm=$(jct "$THINGINO_JSON" get audio_alarm 2>/dev/null)
	[ -n "$audio_alarm" ] && [ "$audio_alarm" != "null" ] || audio_alarm=$(default_audio_alarm)

	build_status() {
		local svc="$1" p v
		p=$(jct "$SEND2_JSON" get "${svc}.send_photo" 2>/dev/null)
		v=$(jct "$SEND2_JSON" get "${svc}.send_video" 2>/dev/null)
		printf '{"send_photo":%s,"send_video":%s}' "${p:-false}" "${v:-false}"
	}

	printf 'Content-Type: application/json\r\nConnection: close\r\n\r\n'
	printf '{\n  "audio_alarm": %s' "$audio_alarm"
	for s in $SERVICES; do
		printf ',\n  "%s": %s' "$s" "$(build_status "$s")"
	done
	printf '\n}\n'
	exit 0
fi

if [ "$REQUEST_METHOD" = "POST" ]; then
	if [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ]; then
		post_data=$(dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null)
	else
		post_data=""
	fi
	[ -n "$post_data" ] || { send_error "No POST data received"; exit 1; }

	temp_json=$(mktemp)
	printf '%s' "$post_data" >"$temp_json"

	audio_alarm=$(jct "$temp_json" get audio_alarm 2>/dev/null)
	if [ -z "$audio_alarm" ] || [ "$audio_alarm" = "null" ]; then
		rm -f "$temp_json"
		send_error "Missing audio_alarm object"
		exit 1
	fi

	was_enabled=$(jct "$THINGINO_JSON" get audio_alarm.enabled 2>/dev/null)
	import_tmp=$(mktemp)
	printf '{"audio_alarm": %s}\n' "$audio_alarm" >"$import_tmp"
	jct "$THINGINO_JSON" import "$import_tmp"
	rm -f "$import_tmp" "$temp_json"

	now_enabled=$(jct "$THINGINO_JSON" get audio_alarm.enabled 2>/dev/null)
	if [ "$now_enabled" != "$was_enabled" ] || [ "$now_enabled" = "true" ]; then
		[ -x /etc/init.d/S79audioalarm ] && /etc/init.d/S79audioalarm restart >/dev/null 2>&1 &
	fi

	send_json '{"result":"success","message":"Settings saved"}'
	exit 0
fi

send_error "Invalid request method"
exit 1

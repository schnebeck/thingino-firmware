#!/bin/sh
# shellcheck disable=SC1091

. /var/www/x/auth.sh
require_auth

send_json() {
	status="${2:-200 OK}"
	printf 'Status: %s\n' "$status"
	cat <<EOF
Content-Type: application/json
Cache-Control: no-store
Pragma: no-cache
Connection: close

$1
EOF
	exit 0
}

json_error() {
	code="${1:-400}"
	message="$2"
	send_json "{\"error\":{\"code\":$code,\"message\":\"$message\"}}" "${3:-400 Bad Request}"
}

handle_get() {
	status=$(/usr/sbin/stepper --status 2>/dev/null)
	case "$status" in
		in_motion=true) send_json '{"in_motion":true}' ;;
		in_motion=false) send_json '{"in_motion":false}' ;;
		*) json_error 500 "stepper status unavailable" ;;
	esac
}

handle_post() {
	pidfile=/var/run/stepper.pid
	if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile" 2>/dev/null)" 2>/dev/null; then
		json_error 409 "Feeder already running" "409 Conflict"
	fi
	/usr/sbin/dispense-treat-cycle >/tmp/dispense-treat-cycle.log 2>&1 &
	send_json '{"status":"started"}'
}

case "$REQUEST_METHOD" in
	GET | "")
		handle_get
		;;
	POST)
		handle_post
		;;
	*)
		json_error 405 "Method not allowed" "405 Method Not Allowed"
		;;
esac

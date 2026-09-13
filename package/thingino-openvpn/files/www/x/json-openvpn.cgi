#!/bin/sh
# shellcheck disable=SC1091,SC2046,SC2086,SC2329,SC3037,SC3043

# Check authentication
. /var/www/x/auth.sh
require_auth

http_200() {
	printf 'Status: 200 OK\r\n'
}

http_412() {
	printf 'Status: 412 Precondition Failed\r\n'
}

json_header() {
	printf 'Content-Type: application/json\r\n'
	printf 'Pragma: no-cache\r\n'
	printf 'Expires: %s\r\n' "$(TZ=GMT0 date +'%a, %d %b %Y %T %Z')"
	printf 'Etag: "%s"\r\n' "$(cat /proc/sys/kernel/random/uuid)"
	printf 'Connection: close\r\n'
	printf '\r\n'
}

normalize_message() {
	local esc
	esc=$(printf '\033')
	printf '%s\n' "$1" | tr -d '\r' | sed "s/${esc}\[[0-9;]*[A-Za-z]//g" | sed '/^[[:space:]]*$/d' | tail -n 1 | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

json_error() {
	http_412
	json_header
	printf '{"error":{"code":412,"message":"%s"}}
' "$1"
	exit 0
}

json_ok() {
	http_200
	json_header
	case "$1" in
		\{*)
			printf '{"code":200,"result":"success","message":%s}
' "$1"
			;;
		*)
			printf '{"code":200,"result":"success","message":"%s"}
' "$1"
			;;
	esac
	exit 0
}

[ -n "$QUERY_STRING" ] && eval $(echo "$QUERY_STRING" | sed "s/&/;/g")

is_openvpn_up() {
	ip link show tun0 2>/dev/null | grep -q UP
}

openvpn_status() {
	is_openvpn_up && echo -n 1 || echo -n 0
}

# No state param: report-only, used by the control-bar button on page load
# to show the real current state instead of always starting "off"-looking
# until the first click.
if [ -z "$state" ]; then
	json_ok "{\"status\":$(openvpn_status)}"
fi

run_openvpn_action() {
	local action="$1"
	local output=""

	case "$action" in
		start)
			output=$(/etc/init.d/S43openvpn force 2>&1) || {
				output=$(normalize_message "$output")
				[ -n "$output" ] || output="Failed to start OpenVPN"
				json_error "$output"
			}
			;;
		stop)
			output=$(/etc/init.d/S43openvpn stop 2>&1) || {
				output=$(normalize_message "$output")
				[ -n "$output" ] || output="Failed to stop OpenVPN"
				json_error "$output"
			}
			;;
	esac
}

if [ "1" = "$state" ] || [ "true" = "$state" ]; then
	is_openvpn_up || run_openvpn_action start
else
	is_openvpn_up && run_openvpn_action stop
fi

# Give the tunnel a moment to come up/down before reporting status back.
[ "1" = "$state" ] || [ "true" = "$state" ] && sleep 1

json_ok "{\"status\":$(openvpn_status),\"message\":\"OpenVPN is $(is_openvpn_up && echo 'up' || echo 'down')\"}"

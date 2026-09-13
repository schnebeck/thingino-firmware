#!/bin/sh
# shellcheck disable=SC1091,SC2018,SC2019,SC2269,SC2329,SC3043

# Check authentication
. /var/www/x/auth.sh
require_auth

DOMAIN="openvpn"
CONFIG_FILE="/etc/thingino.json"
TMP_FILE=""
REQ_FILE=""

cleanup() {
	[ -n "$TMP_FILE" ] && rm -f "$TMP_FILE"
	[ -n "$REQ_FILE" ] && rm -f "$REQ_FILE"
}
trap cleanup EXIT

json_escape() {
	printf '%s' "$1" | sed \
		-e 's/\\/\\\\/g' \
		-e 's/"/\\"/g' \
		-e "s/\r/\\\\r/g" |
		awk 'BEGIN{ORS="\\n"} {print}' |
		sed 's/\\n$//'
}

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
	send_json "{\"error\":{\"code\":$code,\"message\":\"$(json_escape "$message")\"}}" "${3:-400 Bad Request}"
}

ensure_config() {
	if [ ! -f "$CONFIG_FILE" ]; then
		umask 077
		echo '{}' >"$CONFIG_FILE"
	fi
}

is_openvpn_up() {
	ip link show tun0 2>/dev/null | grep -q UP
}

openvpn_supported() {
	command -v openvpn >/dev/null 2>&1
}

handle_get() {
	local enabled config supported status
	ensure_config
	enabled=$(jct "$CONFIG_FILE" get "$DOMAIN.enabled" 2>/dev/null)
	[ "$enabled" = "null" ] && enabled=""
	[ "true" = "$enabled" ] && enabled=true || enabled=false
	config=$(jct "$CONFIG_FILE" get "$DOMAIN.config" 2>/dev/null)
	[ "$config" = "null" ] && config=""
	supported=$(openvpn_supported && echo true || echo false)
	status=0
	is_openvpn_up && status=1

	printf '{"enabled":%s,"config":"%s","openvpn_supported":%s,"openvpn_status":%s}' \
		"$enabled" "$(json_escape "$config")" "$supported" "$status"
}

read_body() {
	REQ_FILE=$(mktemp /tmp/${DOMAIN}-req.XXXXXX)
	if [ -n "$CONTENT_LENGTH" ]; then
		dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null >"$REQ_FILE"
	else
		cat >"$REQ_FILE"
	fi
}

normalize_bool() {
	case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in
		1 | true | yes | on) printf 'true' ;;
		*) printf 'false' ;;
	esac
}

handle_post() {
	local enabled config

	read_body

	enabled=$(normalize_bool "$(jct "$REQ_FILE" get enabled 2>/dev/null)")
	config=$(jct "$REQ_FILE" get config 2>/dev/null)
	[ "$config" = "null" ] && config=""

	if [ "true" = "$enabled" ] && [ -z "$config" ]; then
		json_error 422 "No OpenVPN configuration provided" "422 Unprocessable Entity"
	fi

	ensure_config
	TMP_FILE=$(mktemp /tmp/${DOMAIN}.XXXXXX)
	echo '{}' >"$TMP_FILE"
	jct "$TMP_FILE" set "$DOMAIN.enabled" "$enabled" >/dev/null 2>&1
	jct "$TMP_FILE" set "$DOMAIN.config" "$config" >/dev/null 2>&1
	jct "$CONFIG_FILE" import "$TMP_FILE" >/dev/null 2>&1

	send_json '{"status":"ok","message":"OpenVPN configuration saved"}'
}

case "$REQUEST_METHOD" in
	GET | "")
		send_json "$(handle_get)"
		;;
	POST)
		handle_post
		;;
	*)
		json_error 405 "Method not allowed" "405 Method Not Allowed"
		;;
esac

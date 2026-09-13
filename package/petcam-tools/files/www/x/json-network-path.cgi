#!/bin/sh
# shellcheck disable=SC1091,SC3043
#
# Reports whether the requesting client is coming in over the OpenVPN
# tunnel rather than the LAN, so the preview page can default to the
# lighter sub-stream for VPN clients (single-core SoC, no AES hardware -
# OpenVPN's own software encryption already competes with the main
# stream's encode+transcode load for the one CPU).

. /var/www/x/auth.sh
require_auth

VPN_SUBNET_PREFIX="10.1.1."

case "$REMOTE_ADDR" in
	"$VPN_SUBNET_PREFIX"*)
		via_vpn=true
		;;
	*)
		via_vpn=false
		;;
esac

printf 'Content-Type: application/json\nCache-Control: no-store\n\n{"via_vpn":%s}\n' "$via_vpn"

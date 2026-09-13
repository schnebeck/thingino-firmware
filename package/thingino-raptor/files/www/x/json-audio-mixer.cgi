#!/bin/sh
# shellcheck disable=SC1091
# Mic/speaker mixer (volume, gain, ALC gain, high-pass filter, noise
# suppression, AGC): none of this is exposed by the agent bridge (only
# mic_enabled/spk_enabled are), and raptorctl's own "config set"/"config
# save" for the [audio] section is a no-op on this build - it never writes
# to /etc/raptor.conf, and never exposes a way to read back ALC gain, NS
# level or AGC target/compression at all. So thingino.json is our own
# source of truth here (see raptor-audio-mixer-apply for the boot-time
# reapply, since a rad restart would otherwise silently drop back to
# firmware defaults).

. /var/www/x/auth.sh
require_auth

THINGINO_JSON="/etc/thingino.json"

send_json() {
	printf 'Status: %s\r\n' "$1"
	printf 'Content-Type: application/json\r\n\r\n'
	printf '%s' "$2"
}

get_stored() {
	jct "$THINGINO_JSON" get "audio_mixer.$1" 2>/dev/null
}

get_bool() {
	val=$(get_stored "$1")
	[ "$val" = "true" ] && echo true || echo false
}

if [ "$REQUEST_METHOD" = "GET" ]; then
	mic_volume=$(get_stored mic_volume); mic_volume=${mic_volume:-80}
	mic_gain=$(get_stored mic_gain); mic_gain=${mic_gain:-25}
	mic_alc_gain=$(get_stored mic_alc_gain); mic_alc_gain=${mic_alc_gain:-0}
	mic_hpf_enabled=$(get_bool mic_hpf_enabled)
	mic_ns_level=$(get_stored mic_ns_level); mic_ns_level=${mic_ns_level:-0}
	mic_agc_enabled=$(get_bool mic_agc_enabled)
	mic_agc_target_dbfs=$(get_stored mic_agc_target_dbfs); mic_agc_target_dbfs=${mic_agc_target_dbfs:-0}
	mic_agc_compression_db=$(get_stored mic_agc_compression_db); mic_agc_compression_db=${mic_agc_compression_db:-0}
	spk_volume=$(get_stored spk_volume); spk_volume=${spk_volume:-80}
	spk_gain=$(get_stored spk_gain); spk_gain=${spk_gain:-25}

	send_json "200 OK" "{\"mic_volume\":${mic_volume},\"mic_gain\":${mic_gain},\"mic_alc_gain\":${mic_alc_gain},\"mic_hpf_enabled\":${mic_hpf_enabled},\"mic_ns_level\":${mic_ns_level},\"mic_agc_enabled\":${mic_agc_enabled},\"mic_agc_target_dbfs\":${mic_agc_target_dbfs},\"mic_agc_compression_db\":${mic_agc_compression_db},\"spk_volume\":${spk_volume},\"spk_gain\":${spk_gain}}"
	exit 0
fi

if [ "$REQUEST_METHOD" = "POST" ]; then
	if [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ]; then
		post_data=$(dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null)
	else
		post_data=""
	fi
	[ -n "$post_data" ] || { send_json "400 Bad Request" '{"error":"no_data"}'; exit 0; }

	temp_json=$(mktemp)
	printf '%s' "$post_data" >"$temp_json"

	field_in() {
		jct "$temp_json" get "$1" 2>/dev/null
	}

	# apply_range <field> <min> <max> -- validates+persists; caller applies live
	apply_range() {
		field="$1"; min="$2"; max="$3"
		val=$(field_in "$field")
		[ -n "$val" ] && [ "$val" != "null" ] || return 1
		case "$val" in
			-[0-9]* | [0-9]*) ;;
			*) send_json "400 Bad Request" "{\"error\":\"invalid_${field}\"}"; rm -f "$temp_json"; exit 0 ;;
		esac
		if [ "$val" -lt "$min" ] || [ "$val" -gt "$max" ]; then
			send_json "400 Bad Request" "{\"error\":\"${field}_out_of_range\"}"
			rm -f "$temp_json"
			exit 0
		fi
		jct "$THINGINO_JSON" set "audio_mixer.$field" "$val" >/dev/null 2>&1
		echo "$val"
	}

	apply_bool() {
		field="$1"
		val=$(field_in "$field")
		[ -n "$val" ] && [ "$val" != "null" ] || return 1
		case "$val" in
			true) jct "$THINGINO_JSON" set "audio_mixer.$field" true >/dev/null 2>&1; echo true ;;
			false) jct "$THINGINO_JSON" set "audio_mixer.$field" false >/dev/null 2>&1; echo false ;;
			*) send_json "400 Bad Request" "{\"error\":\"invalid_${field}\"}"; rm -f "$temp_json"; exit 0 ;;
		esac
	}

	touched_agc=0
	agc_enabled_out=

	if val=$(apply_range mic_volume -30 120); then
		raptorctl rad set-volume "$val" >/dev/null 2>&1
	fi
	if val=$(apply_range mic_gain 0 31); then
		raptorctl rad set-gain "$val" >/dev/null 2>&1
	fi
	if val=$(apply_range mic_alc_gain 0 7); then
		raptorctl rad set-alc-gain "$val" >/dev/null 2>&1
	fi
	if val=$(apply_range spk_volume -30 120); then
		raptorctl rad ao-set-volume "$val" >/dev/null 2>&1
	fi
	if val=$(apply_range spk_gain 0 31); then
		raptorctl rad ao-set-gain "$val" >/dev/null 2>&1
	fi
	if val=$(apply_bool mic_hpf_enabled); then
		[ "true" = "$val" ] && raptorctl rad set-hpf 1 >/dev/null 2>&1 || raptorctl rad set-hpf 0 >/dev/null 2>&1
	fi
	if val=$(apply_range mic_ns_level 0 3); then
		if [ "$val" -gt 0 ]; then
			raptorctl rad set-ns 1 "$val" >/dev/null 2>&1
		else
			raptorctl rad set-ns 0 >/dev/null 2>&1
		fi
	fi
	apply_bool mic_agc_enabled >/dev/null 2>&1 && touched_agc=1
	apply_range mic_agc_target_dbfs 0 31 >/dev/null 2>&1 && touched_agc=1
	apply_range mic_agc_compression_db 0 90 >/dev/null 2>&1 && touched_agc=1

	if [ "$touched_agc" = "1" ]; then
		agc_enabled=$(get_bool mic_agc_enabled)
		agc_target=$(get_stored mic_agc_target_dbfs); agc_target=${agc_target:-0}
		agc_comp=$(get_stored mic_agc_compression_db); agc_comp=${agc_comp:-0}
		if [ "true" = "$agc_enabled" ]; then
			raptorctl rad set-agc 1 "$agc_target" "$agc_comp" >/dev/null 2>&1
		else
			raptorctl rad set-agc 0 >/dev/null 2>&1
		fi
	fi

	rm -f "$temp_json"
	send_json "200 OK" '{"result":"success"}'
	exit 0
fi

send_json "405 Method Not Allowed" '{"error":"invalid_method"}'

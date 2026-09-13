#!/bin/sh
# shellcheck disable=SC1091
# Uploads one sound file for the quick-play sound buttons, into
# /mnt/mmcblk0p1/raptor/sounds/. rac play auto-detects WAV/PCM, MP3, AAC
# and Opus/OGG by content, so those are stored as-is; anything else (e.g.
# .m4a/.mp4/.mov - MP4 containers, not a format rac understands on its
# own) is transcoded to WAV via ffmpeg first. Extraction logic mirrors
# json-sensor-upload.cgi.

. /var/www/x/auth.sh
require_auth

SOUNDS_DIR="/mnt/mmcblk0p1/raptor/sounds"

send_json() {
	printf 'Status: %s\r\n' "$1"
	printf 'Content-Type: application/json\r\n\r\n'
	printf '%s' "$2"
}

send_error() {
	send_json "$1" "{\"error\":\"$2\"}"
	exit 1
}

extract_part_value() {
	awk -v RS='\r\n\r\n' -v target="$2" '
    NR == target {
      sub(/\r\n--.*/, "", $0)
      gsub(/[\r\n]/, "", $0)
      print
      exit
    }
  ' "$1"
}

extract_upload_payload() {
	request_file=$1
	output_file=$2
	part_index=$3
	trailer=$(printf '\r\n--%s--\r\n' "$BOUNDARY" | wc -c | tr -d '[:space:]') || return 1
	start_offset=$(awk -v RS='\r\n\r\n' -v target="$part_index" '
    { offset += length($0) + 4 }
    NR == target - 1 { print offset; exit }
  ' "$request_file") || return 1
	total_size=$(wc -c <"$request_file" | tr -d '[:space:]') || return 1
	case "$start_offset" in '' | *[!0-9]*) return 1 ;; esac
	case "$total_size" in '' | *[!0-9]*) return 1 ;; esac
	case "$trailer" in '' | *[!0-9]*) return 1 ;; esac
	payload_size=$((total_size - start_offset - trailer))
	[ "$payload_size" -gt 0 ] 2>/dev/null || return 1
	dd if="$request_file" of="$output_file" bs=1 skip="$start_offset" count="$payload_size" 2>/dev/null || return 1
	[ -s "$output_file" ] || return 1
}

[ "${REQUEST_METHOD:-GET}" = "POST" ] || send_error "405 Method Not Allowed" "invalid_method"

case "${CONTENT_TYPE:-}" in
	multipart/form-data*)
		BOUNDARY=$(printf '%s' "$CONTENT_TYPE" | sed -n 's/.*boundary=//p')
		BOUNDARY=${BOUNDARY%%;*}
		BOUNDARY=${BOUNDARY%\"}
		BOUNDARY=${BOUNDARY#\"}
		[ -n "$BOUNDARY" ] || send_error "400 Bad Request" "missing_boundary"
		;;
	*) send_error "415 Unsupported Media Type" "unsupported_content_type" ;;
esac

case "${CONTENT_LENGTH:-}" in
	'' | *[!0-9]*) send_error "411 Length Required" "invalid_length" ;;
esac
[ "$CONTENT_LENGTH" -gt 0 ] 2>/dev/null || send_error "411 Length Required" "empty_upload"
# 32MB cap - these are short sound clips, not video.
[ "$CONTENT_LENGTH" -le 33554432 ] 2>/dev/null || send_error "413 Payload Too Large" "file_too_large"

REQUEST_FILE=$(mktemp /tmp/sound-upload.XXXXXX) || send_error "500 Internal Server Error" "alloc_failed"
UPLOAD_FILE=$(mktemp /tmp/sound-file.XXXXXX) || {
	rm -f "$REQUEST_FILE"
	send_error "500 Internal Server Error" "alloc_failed"
}
trap 'rm -f "$REQUEST_FILE" "$UPLOAD_FILE"' EXIT INT TERM

dd bs=1 count="$CONTENT_LENGTH" of="$REQUEST_FILE" 2>/dev/null ||
	send_error "500 Internal Server Error" "read_failed"

UPLOAD_FORM=$(extract_part_value "$REQUEST_FILE" 2)
[ "$UPLOAD_FORM" = sound ] || send_error "400 Bad Request" "unsupported_form"

extract_upload_payload "$REQUEST_FILE" "$UPLOAD_FILE" 3 ||
	send_error "400 Bad Request" "extract_failed"

# Original filename, from the "filename=" attribute on part 2's header
# line (part_index 2, same numbering extract_part_value uses above, minus
# the trailing body split): sanitize hard - strip everything but a safe
# character set and force a name under the sounds dir, no path components
# survive.
ORIG_NAME=$(awk -v RS='\r\n\r\n' 'NR==2{print; exit}' "$REQUEST_FILE" | sed -n 's/.*filename="\([^"]*\)".*/\1/p')
EXT=$(printf '%s' "$ORIG_NAME" | sed -n 's/.*\(\.[A-Za-z0-9]\{1,5\}\)$/\1/p')

# rac play (see rac_play.c's detect_format()) only recognizes these
# extensions/magic bytes; anything else - notably .m4a/.mp4/.mov, which
# are MP4 *containers* wrapping AAC, not raw AAC - falls through to its
# "raw PCM16LE" default and plays back as pure noise instead of failing
# loudly. Natively-supported extensions are stored as-is; anything else
# goes through ffmpeg (if present - it isn't on images built before this
# was added) to a plain WAV instead of being rejected outright.
NEEDS_CONVERT=0
case "$(printf '%s' "$EXT" | tr 'A-Z' 'a-z')" in
	.mp3 | .aac | .adts | .opus | .ogg | .pcm | .raw | .wav) ;;
	*) NEEDS_CONVERT=1 ;;
esac

BASE_NAME=$(printf '%s' "$ORIG_NAME" | sed 's/[^A-Za-z0-9_-]/_/g')
[ -n "$BASE_NAME" ] || BASE_NAME="sound"

mkdir -p "$SOUNDS_DIR" || send_error "500 Internal Server Error" "mkdir_failed"

if [ "$NEEDS_CONVERT" = "1" ]; then
	[ -x /usr/bin/ffmpeg ] ||
		send_error "415 Unsupported Media Type" "unsupported_format: use wav, mp3, aac, opus or ogg - not m4a/mp4/mov, which are containers this camera can't unwrap"

	SAFE_NAME="${BASE_NAME}_$(date +%s).wav"
	# busybox mktemp rejects a template with anything after the X run
	# (e.g. "XXXXXX.wav"), unlike GNU mktemp - keep the template bare and
	# tell ffmpeg the output format explicitly instead of relying on it
	# inferring wav from a filename extension that isn't there.
	CONVERTED_FILE=$(mktemp /tmp/sound-conv.XXXXXX) || send_error "500 Internal Server Error" "alloc_failed"
	trap 'rm -f "$REQUEST_FILE" "$UPLOAD_FILE" "$CONVERTED_FILE"' EXIT INT TERM

	# 16kHz mono, matching the rest of the audio pipeline (mic capture,
	# audio-alarm) - not the source file's own rate/channel count. A
	# fade-in/out (0.4s) avoids an audible click at the start/end of
	# playback; the duration isn't known ahead of time (no ffprobe
	# pre-pass), so the end fade uses the standard reverse-fade-reverse
	# trick instead of a fixed "start fading at Xs" offset.
	/usr/bin/ffmpeg -y -i "$UPLOAD_FILE" -ar 16000 -ac 1 -c:a pcm_s16le \
		-af "afade=t=in:d=0.4,areverse,afade=t=in:d=0.4,areverse" \
		-f wav "$CONVERTED_FILE" >/tmp/ffmpeg-upload.log 2>&1
	if [ $? -ne 0 ] || [ ! -s "$CONVERTED_FILE" ]; then
		send_error "422 Unprocessable Entity" "conversion_failed: ffmpeg could not read this file as audio"
	fi

	mv "$CONVERTED_FILE" "$SOUNDS_DIR/$SAFE_NAME" || send_error "500 Internal Server Error" "move_failed"
	CONVERTED_FILE=""
else
	SAFE_NAME="${BASE_NAME}_$(date +%s)${EXT}"
	mv "$UPLOAD_FILE" "$SOUNDS_DIR/$SAFE_NAME" || send_error "500 Internal Server Error" "move_failed"
fi
UPLOAD_FILE=""

chmod 644 "$SOUNDS_DIR/$SAFE_NAME"

send_json "200 OK" "{\"result\":\"success\",\"file\":\"$SAFE_NAME\"}"

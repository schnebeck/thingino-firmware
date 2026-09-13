#!/bin/sh
# shellcheck disable=SC1091
# json-recordings.cgi - browse/serve the raptor SD motion clips (rmr's own
# "motion"-mode clip storage, <storage_path>/clips/<date>/<time>.mp4). This is
# a FILESYSTEM helper, not a streamer bridge:
#   GET                -> JSON list of clips under <storage_path>/clips
#   GET ?file=<rel>    -> streams that clip as video/mp4 (play/download)
#   GET ?del=<rel>     -> deletes that clip
# Auth-protected; the file/del parameter is guarded against path traversal.
# Adapted from timps's own json-recordings.cgi (same hardening approach).

. /var/www/x/auth.sh
require_auth

STORAGE_PATH=$(raptorctl config get recording storage_path 2>/dev/null | tr -d '\r\n"')
[ -n "$STORAGE_PATH" ] || STORAGE_PATH=/mnt/mmcblk0p1/raptor
BASE="$STORAGE_PATH/clips"
REAL_BASE=$(readlink -f "$BASE" 2>/dev/null) || REAL_BASE=$BASE

qval() { printf '%s' "$QUERY_STRING" | sed -n "s/.*$1=\([^&]*\).*/\1/p"; }
urldec() { printf '%b' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/+/ /g; s/%\(..\)/\\x\1/g')"; }

FILE=$(urldec "$(qval file)")
DEL=$(urldec "$(qval del)")

safe() { case "$1" in "" | /* | *..*) return 1 ;; *) return 0 ;; esac }

within_base() {
	resolved=$(readlink -f "$1" 2>/dev/null) || return 1
	case "$resolved" in
		"$REAL_BASE"/*) return 0 ;;
		*) return 1 ;;
	esac
}

if [ -n "$DEL" ]; then
	if safe "$DEL" && [ -f "$BASE/$DEL" ] && [ ! -L "$BASE/$DEL" ] && within_base "$BASE/$DEL"; then
		rm -f "$BASE/$DEL"
		printf 'Content-Type: application/json\r\n\r\n{"ok":true}\n'
	else printf 'Status: 400 Bad Request\r\n\r\n'; fi
	exit 0
fi

if [ -n "$FILE" ]; then
	if ! safe "$FILE" || [ ! -f "$BASE/$FILE" ] || [ -L "$BASE/$FILE" ] || ! within_base "$BASE/$FILE"; then
		printf 'Status: 404 Not Found\r\n\r\n'
		exit 0
	fi
	F="$BASE/$FILE"
	SZ=$(stat -c%s "$F" 2>/dev/null || echo 0)
	printf 'Status: 200 OK\r\n'
	printf 'Content-Type: video/mp4\r\n'
	printf 'Content-Length: %s\r\n' "$SZ"
	printf 'Content-Disposition: inline; filename="%s"\r\n' "$(basename "$F")"
	printf 'Connection: close\r\n\r\n'
	cat "$F"
	exit 0
fi

# ---- listing (newest first) ----
printf 'Content-Type: application/json\r\n'
printf 'Cache-Control: no-store\r\n\r\n'
free_mb=$(df -m "$STORAGE_PATH" 2>/dev/null | awk 'NR==2{print $4}')
[ -n "$free_mb" ] || free_mb=-1
if [ ! -d "$BASE" ]; then
	printf '{"base":"%s","free_mb":%s,"files":[]}\n' "$BASE" "$free_mb"
	exit 0
fi
printf '{"base":"%s","free_mb":%s,"files":[' "$BASE" "$free_mb"
i=0
for f in $(find "$BASE" -type f -name '*.mp4' 2>/dev/null | sort -r); do
	rel=${f#"$BASE"/}
	rel=$(printf '%s' "$rel" | sed 's/\\/\\\\/g; s/"/\\"/g')
	sz=$(stat -c%s "$f" 2>/dev/null || echo 0)
	mt=$(stat -c%Y "$f" 2>/dev/null || echo 0)
	[ $i -gt 0 ] && printf ','
	printf '{"file":"%s","size":%s,"mtime":%s}' "$rel" "$sz" "$mt"
	i=$((i + 1))
done
printf ']}\n'

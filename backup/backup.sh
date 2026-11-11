#!/bin/sh
# Encrypted database backups for Glimmerkin.
#
#   backup.sh loop             what the backup container runs: one backup a night, old ones removed
#   backup.sh now              make a backup straight away
#   backup.sh restore <file>   put a backup back, replacing what the database holds
#
# A backup is a pg_dump, gzipped, then encrypted with AES-256 using BACKUP_PASSPHRASE. It is encrypted as
# it is written, so nothing readable ever sits in the backups folder. To read one without this script:
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in <file> | gunzip
set -eu
# A failed pg_dump must fail the whole pipeline. The container's shell (ash) has pipefail; plain dash does not.
(set -o pipefail) 2>/dev/null && set -o pipefail

dir=${BACKUP_TARGET:-/backups}
keep=${BACKUP_KEEP_DAYS:-14}
hour=${BACKUP_HOUR:-3}

[ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "BACKUP_PASSPHRASE is not set. Run 'sh setup.sh' on the server, then start the stack again." >&2; exit 1; }

crypt() { openssl enc "$@" -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE; }

backup() {
  mkdir -p "$dir"
  out="$dir/glimmerkin-$(date -u +%Y%m%d-%H%M%S).sql.gz.enc"
  if pg_dump --no-owner --no-privileges --clean --if-exists | gzip -9 | crypt -salt -out "$out.part"; then
    chmod 600 "$out.part" && mv "$out.part" "$out"
    find "$dir" -name 'glimmerkin-*.sql.gz.enc' -mtime "+$keep" -exec rm -f {} +
    echo "$(date -u +%FT%TZ) Backup written: $out"
  else
    rm -f "$out.part"
    echo "$(date -u +%FT%TZ) Backup FAILED. Nothing was written. Is the database running?" >&2
    return 1
  fi
}

restore() {
  file=$1
  [ -f "$file" ] || file="$dir/$1"
  [ -f "$file" ] || { echo "No such backup: $1. Give the name of a file in the backups folder." >&2; exit 1; }
  echo "Restoring $file. This replaces every account and save now in the database."
  crypt -d -in "$file" | gunzip | psql --quiet --set ON_ERROR_STOP=1 --single-transaction >/dev/null \
    || { echo "Restore FAILED and the database was left as it was. Wrong BACKUP_PASSPHRASE, or a damaged file." >&2; exit 1; }
  echo "Restored. Start the web service again: docker compose start web"
}

case "${1:-loop}" in
  now) backup ;;
  restore) [ $# -eq 2 ] || { echo "Usage: backup.sh restore <file>" >&2; exit 2; }; restore "$2" ;;
  loop)
    trap 'exit 0' TERM INT   # as the container's first process, the shell would otherwise ignore "docker stop"
    echo "Backups: nightly at ${hour}:00 UTC into $dir, $keep days kept."
    # A stack with no backup from the last day makes one straight away, so a fresh install has one to show.
    [ -n "$(find "$dir" -name 'glimmerkin-*.sql.gz.enc' -mtime -1 2>/dev/null | head -n 1)" ] || backup || true
    while :; do
      now=$(date -u +%s)
      next=$(date -u -d "$(date -u +%Y-%m-%d) $(printf '%02d' "$hour"):00:00" +%s)
      [ "$next" -gt "$now" ] || next=$((next + 86400))
      sleep $((next - now)) &
      wait $!
      backup || true
    done ;;
  *) echo "Usage: backup.sh loop | now | restore <file>" >&2; exit 2 ;;
esac

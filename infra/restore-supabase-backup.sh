#!/usr/bin/env bash
# Restore a ByteQuest backup archive into a NEW, empty Supabase project.
#
#   BACKUP_ENV_FILE=<target env file> infra/restore-supabase-backup.sh <archive.tar.enc> --confirm
#
# Before running: create the new project, run `supabase db push` with the same migrations
# the backup came from, and write a target env file (DATABASE_URL on port 5432, SUPABASE_URL,
# SUPABASE_SERVICE_ROLE_KEY). Then this script:
#   1. refuses unless the target has no accounts and no profiles, so it cannot overwrite a live project;
#   2. empties the public and bytequest_private tables (migration seed rows are replaced by the backup's);
#   3. loads public, bytequest_private, auth.users and auth.identities with triggers paused
#      (session_replication_role = replica, as Supabase's restore guide does), in one transaction;
#   4. re-uploads every PDF to the private bucket at its original path;
#   5. compares the target's row counts with the counts recorded at backup time.
# Without SUPABASE_URL in the target env file, step 4 is skipped and the run reports it.
# Same BACKUP_KEY_FILE, BACKUP_PG_IMAGE and BACKUP_DB_URL settings as backup-supabase.sh.
set -euo pipefail
umask 077

ARCHIVE="${1:?Usage: infra/restore-supabase-backup.sh <archive.tar.enc> --confirm}"
[ "${2:-}" = "--confirm" ] || { echo "Add --confirm to restore into the project in \$BACKUP_ENV_FILE." >&2; exit 2; }
ENV_FILE="${BACKUP_ENV_FILE:?Set BACKUP_ENV_FILE to the env file of the TARGET project.}"
KEY_FILE="${BACKUP_KEY_FILE:-/etc/bytequest/backup.key}"
PG_IMAGE="${BACKUP_PG_IMAGE:-postgres:17-alpine}"
BUCKET="bytequest-instructional-pdfs"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }
env_value() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed 's/^"\(.*\)"$/\1/'; }
host_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
urlencode() {
  local LC_ALL=C s="$1" out="" c i
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in [a-zA-Z0-9._~/-]) out+="$c" ;; *) out+="$(printf '%%%02X' "'$c")" ;; esac
  done
  printf '%s' "$out"
}

[ -r "$ENV_FILE" ] || die "Cannot read $ENV_FILE."
DB_URL="${BACKUP_DB_URL:-$(env_value DATABASE_URL)}"
SUPABASE_URL="$(env_value SUPABASE_URL)"
SERVICE_KEY="$(env_value SUPABASE_SERVICE_ROLE_KEY)"
[ -n "$SERVICE_KEY" ] || SERVICE_KEY="$(env_value SUPABASE_SECRET_KEY)"
[ -n "$DB_URL" ] || die "DATABASE_URL is empty."
pg() { MSYS_NO_PATHCONV=1 docker run --rm -i -e PGURL="$DB_URL" --add-host=host.docker.internal:host-gateway "$@"; }
psql_value() { pg "$PG_IMAGE" sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1 -At -c "$1"' sh "$1"; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
log "Decrypting and checking $(basename "$ARCHIVE") ..."
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$KEY_FILE" -in "$ARCHIVE" | tar -C "$WORK" -xf - \
  || die "Could not decrypt (wrong key?) or unpack the archive."
(cd "$WORK" && sha256sum -c --quiet manifest.sha256) || die "A file does not match manifest.sha256."

existing="$(psql_value "select (select count(*) from auth.users) + (select count(*) from public.profiles)")"
[ "$existing" = "0" ] || die "The target already has $existing accounts or profiles. Restore only into a new, empty project."

log "Loading data with triggers paused ..."
truncate_sql="$(psql_value "select 'truncate table ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' cascade;'
  from pg_tables where schemaname in ('public', 'bytequest_private')")"
pg -v "$(host_path "$WORK"):/in:ro" "$PG_IMAGE" sh -c '
  set -e
  {
    echo "SET session_replication_role = replica;"
    printf "%s\n" "$1"
    pg_restore --data-only --no-owner -n auth -t users -t identities -f - /in/database.dump
    pg_restore --data-only --no-owner -n public -n bytequest_private -f - /in/database.dump
  } | psql "$PGURL" --single-transaction -v ON_ERROR_STOP=1 -q' sh "$truncate_sql" >/dev/null

pdf_note="PDFs re-uploaded"
if [ -n "$SUPABASE_URL" ] && [ -n "$SERVICE_KEY" ]; then
  log "Re-uploading PDFs ..."
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    printf 'header = "apikey: %s"\nheader = "Authorization: Bearer %s"\n' "$SERVICE_KEY" "$SERVICE_KEY" \
      | curl -fsS --retry 3 -K - -X POST -H "Content-Type: application/pdf" -H "x-upsert: true" \
          --data-binary "@$WORK/pdfs/$name" "$SUPABASE_URL/storage/v1/object/$BUCKET/$(urlencode "$name")" >/dev/null
  done < "$WORK/objects.txt"
else
  pdf_note="PDFs NOT restored: the target env file has no SUPABASE_URL or service key"
fi

log "Comparing row counts with the backup ..."
mismatch=0
while read -r table expected <&3; do  # fd 3: docker -i inside the loop would eat stdin
  case "$table" in
    storage.objects:*) [ "$pdf_note" = "PDFs re-uploaded" ] || continue
                       actual="$(psql_value "select count(*) from storage.objects where bucket_id = '$BUCKET'")" ;;
    *) actual="$(psql_value "select count(*) from $table")" ;;
  esac
  mark="ok"; [ "$actual" = "$expected" ] || { mark="MISMATCH"; mismatch=1; }
  printf '  %-45s backup %-7s restored %-7s %s\n' "$table" "$expected" "$actual" "$mark"
done 3< "$WORK/counts.txt"
[ "$mismatch" = 0 ] || die "Row counts differ from the backup."
log "Restore OK ($pdf_note). Sign in with a known account and open a course PDF to finish checking."

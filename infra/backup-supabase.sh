#!/usr/bin/env bash
# Back up the hosted Supabase project ByteQuest uses, or keep it from pausing.
#
#   infra/backup-supabase.sh            nightly backup: database + uploaded PDFs, encrypted
#   infra/backup-supabase.sh keepalive  one light database query and one Auth API call
#
# The backup is one encrypted archive holding:
#   database.dump     pg_dump (custom format) of the public, bytequest_private, auth and
#                     storage schemas: app data, research codes, sign-in accounts and
#                     file metadata. A plain `supabase db dump` would miss auth.
#   pdfs/             every object in the private bytequest-instructional-pdfs bucket
#                     (the database holds only their names, not their bytes)
#   manifest.sha256   checksums of database.dump and every PDF
#   counts.txt        row counts of key tables, to compare after a restore
#
# Settings come from the server's env file (BACKUP_ENV_FILE, default infra/backend.prod.env):
# DATABASE_URL (session pooler or direct, port 5432; pg_dump cannot use the 6543
# transaction pooler), SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY.
#
# Optional environment:
#   BACKUP_KEY_FILE      encryption passphrase file, mode 600 (default /etc/bytequest/backup.key).
#                        Create it once with: openssl rand -base64 48 > FILE && chmod 600 FILE
#                        and keep a copy in a password manager: without it no backup can be opened.
#   BACKUP_DIR           where archives are kept (default /var/backups/bytequest)
#   BACKUP_KEEP_DAYS     local retention (default 14)
#   BACKUP_RCLONE_REMOTE rclone destination for an offsite copy, e.g. gdrive:bytequest-backups
#   BACKUP_DB_URL        overrides DATABASE_URL (for example host.docker.internal when testing)
#   BACKUP_PG_IMAGE      pg_dump image; its major version must be >= the server's (default postgres:17-alpine)
#
# The archive contains student data and the research-code key. Treat it like the database
# itself, and delete every copy when the study's link is destroyed (scripts.destroy_research_link).
set -euo pipefail
umask 077

MODE="${1:-backup}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${BACKUP_ENV_FILE:-$HERE/backend.prod.env}"
KEY_FILE="${BACKUP_KEY_FILE:-/etc/bytequest/backup.key}"
DEST="${BACKUP_DIR:-/var/backups/bytequest}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
PG_IMAGE="${BACKUP_PG_IMAGE:-postgres:17-alpine}"
BUCKET="bytequest-instructional-pdfs"
SCHEMAS=(public bytequest_private auth storage)

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# Read one KEY=value line without sourcing the file (values may hold shell characters).
env_value() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed 's/^"\(.*\)"$/\1/'; }
# Docker Desktop on Windows needs a Windows path for bind mounts; Linux paths pass through.
host_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }

[ -r "$ENV_FILE" ] || die "Cannot read $ENV_FILE."
DB_URL="${BACKUP_DB_URL:-$(env_value DATABASE_URL)}"
SUPABASE_URL="$(env_value SUPABASE_URL)"
SERVICE_KEY="$(env_value SUPABASE_SERVICE_ROLE_KEY)"
[ -n "$SERVICE_KEY" ] || SERVICE_KEY="$(env_value SUPABASE_SECRET_KEY)"
[ -n "$DB_URL" ] || die "DATABASE_URL is empty."
case "$DB_URL" in *:6543/*) die "DATABASE_URL uses the transaction pooler (6543); use the session pooler or direct connection on 5432.";; esac
command -v docker >/dev/null || die "Docker is required."

# Runs a PostgreSQL client in a container. The URL travels as an environment variable,
# so the password never appears in the host's process list.
pg() { MSYS_NO_PATHCONV=1 docker run --rm -i -e PGURL="$DB_URL" --add-host=host.docker.internal:host-gateway "$@"; }
psql_value() { pg "$PG_IMAGE" sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1 -At -c "$1"' sh "$1"; }

urlencode() {  # percent-encode an object path byte by byte, keeping / and unreserved characters
  local LC_ALL=C s="$1" out="" c i
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in [a-zA-Z0-9._~/-]) out+="$c" ;; *) out+="$(printf '%%%02X' "'$c")" ;; esac
  done
  printf '%s' "$out"
}

storage_get() {  # storage_get <url> <output file>; the key goes to curl on stdin, not argv
  printf 'header = "apikey: %s"\nheader = "Authorization: Bearer %s"\n' "$SERVICE_KEY" "$SERVICE_KEY" \
    | curl -fsS --retry 3 --max-time 300 -K - "$1" -o "$2"
}

if [ "$MODE" = "keepalive" ]; then
  profiles="$(psql_value "select count(*) from public.profiles")"
  [ -z "$SUPABASE_URL" ] || storage_get "$SUPABASE_URL/auth/v1/health" /dev/null
  log "Keep-alive OK: database answered ($profiles profiles) and the Auth API responded."
  exit 0
fi
[ "$MODE" = "backup" ] || die "Unknown mode '$MODE'. Use backup or keepalive."

[ -r "$KEY_FILE" ] || die "Encryption key $KEY_FILE is missing. Create it as described at the top of this script."
if [ "$(uname -s)" = "Linux" ] && [ "$(stat -c %a "$KEY_FILE")" != "600" ] && [ "$(stat -c %a "$KEY_FILE")" != "400" ]; then
  die "$KEY_FILE must be readable by its owner only (chmod 600)."
fi
[ -n "$SUPABASE_URL" ] && [ -n "$SERVICE_KEY" ] || die "SUPABASE_URL and a service-role key are needed to export PDFs."
command -v openssl >/dev/null && command -v curl >/dev/null || die "openssl and curl are required."

mkdir -p "$DEST"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT  # the plaintext copy never outlives the run
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$DEST/bytequest-$STAMP.tar.enc"

log "Dumping schemas ${SCHEMAS[*]} with $PG_IMAGE ..."
schema_args=""
for s in "${SCHEMAS[@]}"; do schema_args="$schema_args -n $s"; done
pg -v "$(host_path "$WORK"):/out" "$PG_IMAGE" sh -c \
  "pg_dump \"\$PGURL\" --format=custom --no-owner --no-privileges $schema_args --file=/out/database.dump"

log "Recording row counts ..."
psql_value "select 'auth.users ' || (select count(*) from auth.users)
  union all select 'public.profiles ' || (select count(*) from public.profiles)
  union all select 'public.courses ' || (select count(*) from public.courses)
  union all select 'public.learning_activities ' || (select count(*) from public.learning_activities)
  union all select 'public.activity_attempts ' || (select count(*) from public.activity_attempts)
  union all select 'public.research_consents ' || (select count(*) from public.research_consents)
  union all select 'bytequest_private.research_codes ' || (select count(*) from bytequest_private.research_codes)
  union all select 'storage.objects:$BUCKET ' || (select count(*) from storage.objects where bucket_id = '$BUCKET')" \
  > "$WORK/counts.txt"

log "Exporting PDFs from $BUCKET ..."
mkdir -p "$WORK/pdfs"
psql_value "select name from storage.objects where bucket_id = '$BUCKET' order by name" > "$WORK/objects.txt"
count=0
while IFS= read -r name; do
  [ -n "$name" ] || continue
  case "/$name/" in */../*|//*) die "Refusing unsafe object name: $name";; esac
  encoded="$(urlencode "$name")"
  mkdir -p "$WORK/pdfs/$(dirname "$name")"
  storage_get "$SUPABASE_URL/storage/v1/object/$BUCKET/$encoded" "$WORK/pdfs/$name"
  count=$((count + 1))
done < "$WORK/objects.txt"
expected="$(sed -n "s/^storage.objects:$BUCKET //p" "$WORK/counts.txt")"
[ "$count" = "$expected" ] || die "Exported $count PDFs but the bucket lists $expected."

(cd "$WORK" && find database.dump pdfs -type f -print0 | sort -z | xargs -0 sha256sum > manifest.sha256)

log "Encrypting ..."
tar -C "$WORK" -cf - database.dump pdfs manifest.sha256 counts.txt objects.txt \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$KEY_FILE" -out "$ARCHIVE.partial"
mv "$ARCHIVE.partial" "$ARCHIVE"
(cd "$DEST" && sha256sum "$(basename "$ARCHIVE")" > "$(basename "$ARCHIVE").sha256")

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  command -v rclone >/dev/null || die "BACKUP_RCLONE_REMOTE is set but rclone is not installed."
  rclone copy "$ARCHIVE" "$BACKUP_RCLONE_REMOTE" && rclone copy "$ARCHIVE.sha256" "$BACKUP_RCLONE_REMOTE"
  log "Copied offsite to $BACKUP_RCLONE_REMOTE."
fi

find "$DEST" -maxdepth 1 -name 'bytequest-*.tar.enc*' -mtime "+$KEEP_DAYS" -delete
log "Backup OK: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1), $count PDFs)."
sed 's/^/  /' "$WORK/counts.txt"

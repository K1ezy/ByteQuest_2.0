#!/usr/bin/env bash
# Check that a ByteQuest backup archive can be opened and is complete.
#
#   infra/verify-backup.sh /var/backups/bytequest/bytequest-<stamp>.tar.enc
#
# Decrypts into a temporary folder (deleted afterwards), verifies the archive checksum
# and every file in manifest.sha256, confirms database.dump is a readable pg_dump that
# holds data for the key tables, including sign-in accounts, and prints the recorded row
# counts. Same BACKUP_KEY_FILE and BACKUP_PG_IMAGE settings as backup-supabase.sh.
# This proves the archive is sound; a full restore is the runbook's rehearsal step.
set -euo pipefail
umask 077

ARCHIVE="${1:?Usage: infra/verify-backup.sh <archive.tar.enc>}"
KEY_FILE="${BACKUP_KEY_FILE:-/etc/bytequest/backup.key}"
PG_IMAGE="${BACKUP_PG_IMAGE:-postgres:17-alpine}"
host_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
fail() { echo "FAILED: $*" >&2; exit 1; }

[ -r "$ARCHIVE" ] || fail "cannot read $ARCHIVE"
if [ -r "$ARCHIVE.sha256" ]; then
  (cd "$(dirname "$ARCHIVE")" && sha256sum -c --quiet "$(basename "$ARCHIVE").sha256") || fail "archive checksum mismatch"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$KEY_FILE" -in "$ARCHIVE" | tar -C "$WORK" -xf - \
  || fail "could not decrypt (wrong key?) or unpack the archive"
(cd "$WORK" && sha256sum -c --quiet manifest.sha256) || fail "a file does not match manifest.sha256"

toc="$(MSYS_NO_PATHCONV=1 docker run --rm -v "$(host_path "$WORK"):/in:ro" "$PG_IMAGE" pg_restore --list /in/database.dump)" \
  || fail "database.dump is not a readable pg_dump archive"
for table in "auth users" "auth identities" "public profiles" "public activity_attempts" \
             "public learning_activities" "bytequest_private research_codes" "storage objects"; do
  grep -q "TABLE DATA $table " <<<"$toc" || fail "database.dump has no data for ${table/ /.}"
done

pdfs="$(find "$WORK/pdfs" -type f | wc -l | tr -d ' ')"
listed="$(grep -c . "$WORK/objects.txt" || true)"
[ "$pdfs" = "$listed" ] || fail "archive holds $pdfs PDFs but listed $listed"
echo "OK: $(basename "$ARCHIVE") decrypts, every checksum matches, the dump is readable, and $pdfs PDFs are present."
echo "Row counts at backup time:"
sed 's/^/  /' "$WORK/counts.txt"

#!/usr/bin/env bash
# Verify public HTTPS health routes after deployment without exposing config.
set -Eeuo pipefail
IFS=$'\n\t'

usage() {
  printf 'Usage: %s https://api.example.com\n' "${0##*/}" >&2
}

if (($# != 1)); then
  usage
  exit 2
fi

for command_name in curl python3; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'ERROR: Required command not found: %s\n' "$command_name" >&2
    exit 1
  fi
done

api_origin=$(python3 - "$1" <<'PY'
import sys
import ipaddress
from urllib.parse import urlsplit

try:
    parsed = urlsplit(sys.argv[1])
    port = parsed.port
except ValueError as exc:
    raise SystemExit(f"ERROR: Invalid API origin: {exc}")

if (
    parsed.scheme != "https"
    or not parsed.hostname
    or parsed.username is not None
    or parsed.password is not None
    or port is not None
    or parsed.path not in {"", "/"}
    or parsed.query
    or parsed.fragment
):
    raise SystemExit("ERROR: Provide only the production HTTPS API origin, such as https://api.example.com.")

try:
    ipaddress.ip_address(parsed.hostname)
except ValueError:
    pass
else:
    raise SystemExit("ERROR: Provide the API DNS hostname, not an IP address.")

print(f"https://{parsed.hostname}")
PY
)

check_health() {
  local path="$1"
  local expected_status="$2"
  local response

  if ! response=$(curl \
    --disable \
    --fail \
    --silent \
    --show-error \
    --max-filesize 4096 \
    --connect-timeout 5 \
    --max-time 15 \
    --retry 3 \
    --retry-delay 2 \
    --retry-max-time 30 \
    --proto '=https' \
    "${api_origin}${path}"); then
    printf 'ERROR: HTTPS request failed: %s%s\n' "$api_origin" "$path" >&2
    return 1
  fi

  if ! printf '%s' "$response" | python3 -c '
import json
import sys

expected = sys.argv[1]
try:
    payload = json.load(sys.stdin)
except (json.JSONDecodeError, UnicodeDecodeError) as exc:
    raise SystemExit(f"ERROR: Health endpoint returned invalid JSON: {exc}")
if payload != {"status": expected}:
    raise SystemExit("ERROR: Health endpoint returned an unexpected status payload.")
' "$expected_status"; then
    printf 'ERROR: Health check failed: %s%s\n' "$api_origin" "$path" >&2
    return 1
  fi

  printf 'OK: %s%s returned status %s over HTTPS.\n' "$api_origin" "$path" "$expected_status"
}

check_health "/health" "online"
check_health "/api/v1/health" "healthy"
check_health "/readyz" "ready"
printf 'Public health smoke check passed. This confirms database readiness but does not verify authentication, storage, Judge0 grading, database writes, or browser flows.\n'

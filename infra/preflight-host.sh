#!/usr/bin/env bash
# Check that a prepared Ubuntu VPS meets ByteQuest's documented minimums.
# This script is read-only and does not start or modify any services.
set -Eeuo pipefail
IFS=$'\n\t'

readonly MIN_MEMORY_BYTES=$((4 * 1024 * 1024 * 1024))
readonly MIN_SWAP_BYTES=$((4 * 1024 * 1024 * 1024))
readonly MIN_ROOT_FREE_BYTES=$((1 * 1024 * 1024 * 1024))
errors=0

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  errors=$((errors + 1))
}

pass() {
  printf 'OK: %s\n' "$*"
}

for command_name in awk df docker ss swapon; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail "Required command not found: ${command_name}."
  fi
done

if ((errors > 0)); then
  exit 1
fi

if [[ "$(uname -m)" != "x86_64" ]]; then
  fail "This backend lock and deployment target require x86_64 (found $(uname -m))."
else
  pass "Host architecture is x86_64."
fi

if [[ ! -r /etc/os-release ]]; then
  fail "Cannot read /etc/os-release to verify the host distribution."
else
  # shellcheck disable=SC1091
  source /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    fail "Supported hosts are Ubuntu 22.04 or 24.04 (found ${PRETTY_NAME:-unknown})."
  elif [[ "${VERSION_ID:-}" != "22.04" && "${VERSION_ID:-}" != "24.04" ]]; then
    fail "Supported hosts are Ubuntu 22.04 or 24.04 (found ${PRETTY_NAME:-unknown})."
  else
    pass "Host is ${PRETTY_NAME}."
  fi
fi

memory_bytes=$(awk '/^MemTotal:/ { printf "%.0f", $2 * 1024; exit }' /proc/meminfo)
if [[ ! "$memory_bytes" =~ ^[0-9]+$ ]] || ((memory_bytes < MIN_MEMORY_BYTES)); then
  fail "Host must have at least 4 GiB RAM (detected ${memory_bytes:-unknown} bytes)."
else
  pass "RAM meets the 4 GiB minimum."
fi

swap_bytes=$(swapon --noheadings --show=SIZE --bytes | awk '{ total += $1 } END { printf "%.0f", total }')
if [[ ! "$swap_bytes" =~ ^[0-9]+$ ]] || ((swap_bytes < MIN_SWAP_BYTES)); then
  fail "At least 4 GiB of swap must be active (detected ${swap_bytes:-unknown} bytes)."
else
  pass "At least 4 GiB of swap is active."
fi

root_free_bytes=$(df --output=avail -B1 / | awk 'NR == 2 { print $1 }')
if [[ ! "$root_free_bytes" =~ ^[0-9]+$ ]] || ((root_free_bytes < MIN_ROOT_FREE_BYTES)); then
  fail "Root filesystem must have at least 1 GiB free after swap allocation (detected ${root_free_bytes:-unknown} bytes)."
else
  pass "Root filesystem has at least 1 GiB free after swap allocation."
fi

if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is unavailable to this user. Start Docker and check group/permissions."
elif ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose v2 is unavailable. Install or enable the Compose plugin."
else
  pass "Docker daemon and Docker Compose v2 are available."
fi

listeners=$(ss -H -ltn | awk '$4 ~ /:80$/ || $4 ~ /:443$/ { print $4 }')
if [[ -n "$listeners" ]]; then
  fail "TCP ports 80/443 already have listeners; resolve the conflict before the initial Caddy deployment: ${listeners//$'\n'/, }."
else
  pass "TCP ports 80 and 443 have no current listeners."
fi

if ((errors > 0)); then
  printf 'Host preflight failed with %d issue(s). No services were started or changed.\n' "$errors" >&2
  exit 1
fi

printf 'Host preflight passed. This checks local prerequisites only; it does not verify DNS, provider firewall rules, external reachability, or production configuration.\n'

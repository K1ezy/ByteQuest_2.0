#!/usr/bin/env bash
# Prepare an Ubuntu 22.04/24.04 VPS for the ByteQuest Docker stack.
# This script only provisions the host; it does not clone or deploy the app.
set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_NAME="${0##*/}"
readonly DOCKER_KEYRING="/etc/apt/keyrings/docker.asc"
readonly DOCKER_SOURCE="/etc/apt/sources.list.d/docker.sources"
readonly SWAP_FILE="/swapfile"
readonly SWAP_SYSCTL_FILE="/etc/sysctl.d/99-bytequest-swap.conf"

ENABLE_FIREWALL=0
ENABLE_CGROUP_V1=0
UPGRADE_SYSTEM=0
SWAP_SIZE="${BYTEQUEST_SWAP_SIZE:-4G}"
SSH_PORT="${BYTEQUEST_SSH_PORT:-}"

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

usage() {
  cat <<EOF
Usage: sudo ./${SCRIPT_NAME} [options]

Options:
  --enable-firewall   Configure UFW and enable it after allowing the active SSH port.
  --enable-cgroup-v1  Add the Ubuntu GRUB setting for legacy cgroup v1; requires reboot.
  --upgrade-system    Run apt-get upgrade -y before installing Docker.
  -h, --help          Show this help.

Environment overrides:
  BYTEQUEST_SWAP_SIZE  Swap size (default: 4G; accepted format: positive integer + G/M).
  BYTEQUEST_SSH_PORT   SSH TCP port to allow when enabling UFW.

Firewall and cgroup changes are opt-in because they can affect remote access or
require a reboot. Review this host's networking and Judge0 requirements first.
EOF
}

while (($#)); do
  case "$1" in
    --enable-firewall) ENABLE_FIREWALL=1 ;;
    --enable-cgroup-v1) ENABLE_CGROUP_V1=1 ;;
    --upgrade-system) UPGRADE_SYSTEM=1 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "Unknown option: $1" ;;
  esac
  shift
done

[[ "${EUID}" -eq 0 ]] || die "Run as root, for example: sudo ./${SCRIPT_NAME}"
[[ "${SWAP_SIZE}" =~ ^[1-9][0-9]{0,3}[GM]$ ]] || die "BYTEQUEST_SWAP_SIZE must look like 4G or 2048M."
command -v flock >/dev/null 2>&1 || die "flock is required."
exec 9>/run/lock/bytequest-vps-bootstrap.lock
flock -n 9 || die "Another ByteQuest bootstrap process is running."

[[ -r /etc/os-release ]] || die "Cannot identify this operating system."
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "This script supports Ubuntu only (detected: ${ID:-unknown})."
case "${VERSION_ID:-}" in
  22.04|24.04) ;;
  *) die "Supported releases are Ubuntu 22.04 and 24.04 (detected: ${VERSION_ID:-unknown})." ;;
esac

log "Preparing ByteQuest host on Ubuntu ${VERSION_ID}."
export DEBIAN_FRONTEND=noninteractive
apt-get update
if ((UPGRADE_SYSTEM)); then
  apt-get upgrade -y
fi
apt-get install -y ca-certificates curl gnupg lsb-release ufw util-linux

configure_swap() (
  local amount unit requested_bytes available_bytes swap_is_active=0
  local minimum_file_bytes swap_file_bytes active_swap_bytes temporary_swap_file=""

  cleanup_temporary_swap_file() {
    if [[ -n "${temporary_swap_file}" && -e "${temporary_swap_file}" ]]; then
      rm -f -- "${temporary_swap_file}"
    fi
  }
  trap cleanup_temporary_swap_file EXIT

  amount="${SWAP_SIZE%[GM]}"
  unit="${SWAP_SIZE: -1}"
  if [[ "${unit}" == "G" ]]; then
    requested_bytes=$((10#${amount} * 1024 * 1024 * 1024))
  else
    requested_bytes=$((10#${amount} * 1024 * 1024))
  fi
  # Leave 1 MiB beyond the requested active swap size for the swap header and
  # page alignment, so a nominal 4 GiB file satisfies the 4 GiB host preflight.
  minimum_file_bytes=$((requested_bytes + 1048576))

  if swapon --noheadings --show=NAME | awk '{print $1}' | grep -Fxq "${SWAP_FILE}"; then
    swap_is_active=1
  fi

  if [[ -e "${SWAP_FILE}" ]]; then
    [[ -f "${SWAP_FILE}" ]] || die "${SWAP_FILE} exists and is not a regular file."
    swaplabel "${SWAP_FILE}" >/dev/null 2>&1 \
      || die "${SWAP_FILE} exists but is not an initialized swap file; refusing to overwrite it."

    swap_file_bytes=$(stat -c '%s' -- "${SWAP_FILE}")
    [[ "${swap_file_bytes}" =~ ^[0-9]+$ ]] \
      || die "Could not determine the size of the existing ${SWAP_FILE}."
    ((swap_file_bytes >= minimum_file_bytes)) \
      || die "Existing ${SWAP_FILE} is too small to provide ${SWAP_SIZE} of active swap; refusing to resize or replace it. Resolve it manually, then rerun bootstrap."

    if ((swap_is_active)); then
      active_swap_bytes=$(swapon --noheadings --show=NAME,SIZE --bytes \
        | awk -v path="${SWAP_FILE}" '$1 == path {print $2; exit}')
      [[ "${active_swap_bytes}" =~ ^[0-9]+$ ]] \
        || die "Could not verify the active size of ${SWAP_FILE}."
      ((active_swap_bytes >= requested_bytes)) \
        || die "Active ${SWAP_FILE} is smaller than ${SWAP_SIZE}; refusing to continue."
    fi
  else
    if ((swap_is_active)); then
      die "${SWAP_FILE} is reported active but does not exist; refusing to modify swap state."
    fi

    available_bytes=$(df --output=avail -B1 / | tail -n 1 | tr -d ' ')
    [[ "${available_bytes}" =~ ^[0-9]+$ ]] \
      || die "Could not determine free space on the root filesystem."
    ((available_bytes > minimum_file_bytes + 1073741824)) \
      || die "Not enough free disk space to allocate ${SWAP_SIZE} swap plus 1 GiB headroom."

    # Build the swap image under a unique temporary name. A failed allocation,
    # dd, or mkswap must never leave a partial file at the canonical path.
    temporary_swap_file=$(mktemp --tmpdir=/ .bytequest-swap.XXXXXXXXXX) \
      || die "Could not create a temporary swap file on the root filesystem."
    chmod 600 "${temporary_swap_file}"
    if ! fallocate -l "${minimum_file_bytes}" "${temporary_swap_file}"; then
      if ! dd if=/dev/zero of="${temporary_swap_file}" bs=1M \
        count="$((minimum_file_bytes / 1048576))" status=progress; then
        die "Could not allocate ${SWAP_SIZE} for swap."
      fi
    fi
    if ! mkswap "${temporary_swap_file}"; then
      die "Could not initialize the temporary swap file."
    fi

    # link(2) creates the canonical path atomically and fails if anything has
    # appeared there since the earlier check. Both paths are on the same FS.
    if ! ln -- "${temporary_swap_file}" "${SWAP_FILE}"; then
      die "${SWAP_FILE} appeared during setup; it was left untouched."
    fi
    rm -f -- "${temporary_swap_file}"
    temporary_swap_file=""
    log "Created ${SWAP_SIZE} swap at ${SWAP_FILE}."
  fi

  if (( ! swap_is_active )); then
    swapon "${SWAP_FILE}"
  fi

  active_swap_bytes=$(swapon --noheadings --show=NAME,SIZE --bytes \
    | awk -v path="${SWAP_FILE}" '$1 == path {print $2; exit}')
  [[ "${active_swap_bytes}" =~ ^[0-9]+$ ]] \
    || die "Could not verify that ${SWAP_FILE} is active."
  ((active_swap_bytes >= requested_bytes)) \
    || die "Active ${SWAP_FILE} provides less than ${SWAP_SIZE}; refusing to report swap as configured."

  if ! grep -Eq '^[[:space:]]*/swapfile[[:space:]]' /etc/fstab; then
    printf '%s none swap sw 0 0\n' "${SWAP_FILE}" >> /etc/fstab
  fi
  printf 'vm.swappiness=10\n' > "${SWAP_SYSCTL_FILE}"
  sysctl --system >/dev/null
  log "Swap is active and configured persistently."
)

configure_cgroup_v1() {
  local grub_file="/etc/default/grub"
  [[ -f "${grub_file}" ]] || die "Cannot find ${grub_file}; cgroup setting was not changed."
  if grep -q 'systemd.unified_cgroup_hierarchy=0' "${grub_file}"; then
    log "The legacy cgroup setting is already present."
    return
  fi

  local backup="${grub_file}.bytequest.$(date +%Y%m%d%H%M%S).bak"
  cp -a -- "${grub_file}" "${backup}"
  python3 - "${grub_file}" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
pattern = re.compile(r'^(GRUB_CMDLINE_LINUX_DEFAULT="([^"]*)")$', re.MULTILINE)
match = pattern.search(text)
if not match:
    raise SystemExit("Could not safely locate GRUB_CMDLINE_LINUX_DEFAULT in /etc/default/grub")
args = match.group(2).split()
args = [arg for arg in args if not arg.startswith("systemd.unified_cgroup_hierarchy=")]
args.append("systemd.unified_cgroup_hierarchy=0")
replacement = 'GRUB_CMDLINE_LINUX_DEFAULT="' + " ".join(args) + '"'
path.write_text(text[:match.start()] + replacement + text[match.end():], encoding="utf-8")
PY
  update-grub
  log "GRUB was updated (backup: ${backup}); a reboot is required to apply cgroup v1."
}

configure_docker() {
  local architecture codename
  architecture="$(dpkg --print-architecture)"
  codename="${VERSION_CODENAME:-$(. /etc/os-release && printf '%s' "${VERSION_CODENAME}")}"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o "${DOCKER_KEYRING}"
  chmod a+r "${DOCKER_KEYRING}"
  cat > "${DOCKER_SOURCE}" <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${codename}
Components: stable
Architectures: ${architecture}
Signed-By: ${DOCKER_KEYRING}
EOF
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  docker compose version >/dev/null
  log "Docker Engine and the Compose plugin are installed and active."
}

active_ssh_port() {
  if [[ -n "${SSH_PORT}" ]]; then
    [[ "${SSH_PORT}" =~ ^[0-9]{1,5}$ ]] && ((10#${SSH_PORT} >= 1 && 10#${SSH_PORT} <= 65535)) \
      || die "BYTEQUEST_SSH_PORT must be a TCP port from 1 to 65535."
    printf '%s' "${SSH_PORT}"
    return
  fi
  if [[ -n "${SSH_CONNECTION:-}" ]]; then
    SSH_PORT="$(awk '{print $4}' <<< "${SSH_CONNECTION}")"
    [[ "${SSH_PORT}" =~ ^[0-9]{1,5}$ ]] && ((10#${SSH_PORT} >= 1 && 10#${SSH_PORT} <= 65535)) \
      || die "Could not determine the active SSH port from SSH_CONNECTION; set BYTEQUEST_SSH_PORT."
    printf '%s' "${SSH_PORT}"
    return
  fi
  if command -v sshd >/dev/null 2>&1; then
    SSH_PORT="$(sshd -T 2>/dev/null | awk '$1 == "port" {print $2; exit}')"
    [[ "${SSH_PORT}" =~ ^[0-9]{1,5}$ ]] && ((10#${SSH_PORT} >= 1 && 10#${SSH_PORT} <= 65535)) \
      || die "Could not determine the SSH port; set BYTEQUEST_SSH_PORT explicitly."
    printf '%s' "${SSH_PORT}"
    return
  fi
  die "Cannot determine the SSH port. Set BYTEQUEST_SSH_PORT before enabling UFW."
}

configure_firewall() {
  local ssh_port
  ssh_port="$(active_ssh_port)"
  log "Allowing SSH TCP port ${ssh_port}, plus web ports 80/443, before enabling UFW."
  ufw allow "${ssh_port}/tcp" comment 'ByteQuest SSH'
  ufw allow 80/tcp comment 'ByteQuest HTTP'
  ufw allow 443/tcp comment 'ByteQuest HTTPS'
  ufw deny 2358/tcp comment 'Judge0 should remain internal'
  ufw default deny incoming
  ufw default allow outgoing
  ufw --force enable
  ufw status verbose
}

configure_swap
if ((ENABLE_CGROUP_V1)); then
  configure_cgroup_v1
else
  log "Leaving the current cgroup mode unchanged. Pass --enable-cgroup-v1 only if this Judge0 host requires it."
fi
configure_docker
if ((ENABLE_FIREWALL)); then
  configure_firewall
else
  log "UFW was not enabled. Pass --enable-firewall after verifying SSH access and required inbound ports."
fi

log "VPS host preparation completed. Review the output and reboot if GRUB was changed."

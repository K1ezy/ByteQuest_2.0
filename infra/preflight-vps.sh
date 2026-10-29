#!/usr/bin/env bash
# Refuse to render the VPS stack until its production configuration is complete.
set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

for command_name in docker python3; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    printf 'ERROR: Required command not found: %s\n' "${command_name}" >&2
    exit 1
  }
done

python3 - <<'PY'
import json
import re
import stat
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

FILES = {
    "infra": Path(".env"),
    "backend": Path("backend.prod.env"),
    "judge0": Path("judge0.prod.conf"),
}
PLACEHOLDER = re.compile(
    r"(?:REPLACE_WITH|YOUR_[A-Z0-9_]+|CHANGEME|\.example(?::[0-9]+)?(?=/|[\"'\],\s?]|$))",
    re.I,
)
errors: list[str] = []
configs: dict[str, dict[str, str]] = {}


def parse_env(path: Path, label: str) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        errors.append(f"Missing required file: {path}")
        return values

    mode = stat.S_IMODE(path.stat().st_mode)
    if mode & 0o077:
        errors.append(f"{path} must not be readable or writable by group/other (run chmod 600).")

    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            errors.append(f"Malformed {label} setting at {path}:{line_number}.")
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            errors.append(f"Invalid {label} variable name at {path}:{line_number}.")
            continue
        if key in values:
            errors.append(f"Duplicate {label} setting {key} in {path}.")
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


configs = {label: parse_env(path, label) for label, path in FILES.items()}
infra = configs["infra"]
backend = configs["backend"]
judge0 = configs["judge0"]

for label, values in configs.items():
    for key, value in values.items():
        if value and PLACEHOLDER.search(value):
            errors.append(f"Replace the example/placeholder value for {key} in {FILES[label]}.")


def required(config: dict[str, str], key: str, label: str) -> str:
    value = config.get(key, "").strip()
    if not value:
        errors.append(f"Set {key} in {FILES[label]}.")
    return value


domain = required(infra, "BYTEQUEST_API_DOMAIN", "infra")
if domain and not re.fullmatch(
    r"(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}", domain
):
    errors.append("BYTEQUEST_API_DOMAIN must be a DNS hostname only (no scheme, path, port, or wildcard).")
image_pattern = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/:+-]*@sha256:[a-f0-9]{64}$", re.I)
for image_key in ("CADDY_IMAGE", "JUDGE0_IMAGE", "JUDGE0_POSTGRES_IMAGE", "JUDGE0_REDIS_IMAGE"):
    image = required(infra, image_key, "infra")
    if image and not image_pattern.fullmatch(image):
        errors.append(f"{image_key} must be a release-reviewed image reference pinned by sha256 digest.")

# The Caddyfile uses request_body.max_size, available in Caddy 2.10.0+.
# Require an explicit version tag so digest pinning cannot hide an older build.
caddy_image = infra.get("CADDY_IMAGE", "").split("@", 1)[0]
caddy_last_component = caddy_image.rsplit("/", 1)[-1]
caddy_tag = caddy_last_component.rsplit(":", 1)[-1] if ":" in caddy_last_component else ""
caddy_version_match = re.fullmatch(r"v?(\d+)\.(\d+)(?:\.(\d+))?(?:[-+].*)?", caddy_tag)
if not caddy_version_match:
    errors.append("CADDY_IMAGE must include an explicit Caddy version tag of 2.10.0 or newer.")
else:
    caddy_version = tuple(int(part or 0) for part in caddy_version_match.groups())
    if caddy_version < (2, 10, 0):
        errors.append("CADDY_IMAGE must use Caddy 2.10.0 or newer for request_body.max_size.")

if backend.get("ENVIRONMENT", "").strip().lower() != "production":
    errors.append("Set ENVIRONMENT=production in backend.prod.env.")

database_url = required(backend, "DATABASE_URL", "backend")
if database_url:
    try:
        parsed_db = urlsplit(database_url)
        # Do not accept duplicate sslmode parameters: PostgreSQL drivers can
        # interpret conflicting values differently, and validating only the
        # first value can make a weak later value invisible to this check.
        sslmodes = [
            value.strip().lower()
            for key, value in parse_qsl(parsed_db.query, keep_blank_values=True)
            if key.lower() == "sslmode"
        ]
        if parsed_db.scheme not in {"postgres", "postgresql", "postgresql+psycopg2"}:
            errors.append("DATABASE_URL must use PostgreSQL.")
        if (
            not parsed_db.hostname
            or not parsed_db.username
            or not parsed_db.password
            or not parsed_db.path.strip("/")
        ):
            errors.append("DATABASE_URL must include the production database name, host, and credentials.")
        # Accessing .port also validates malformed and out-of-range ports.
        parsed_db.port
        if parsed_db.fragment:
            errors.append("DATABASE_URL must not contain a URI fragment.")
        if len(sslmodes) != 1 or sslmodes[0] not in {"require", "verify-ca", "verify-full"}:
            errors.append("DATABASE_URL must require TLS with sslmode=require, verify-ca, or verify-full.")
    except ValueError:
        errors.append("DATABASE_URL is malformed.")

# SQLAlchemy creates one pool per Uvicorn worker. Fail before deployment if
# the maximum configured number of backend connections exceeds the budget the
# operator reserved on the production database plan.
def bounded_integer(
    config: dict[str, str], key: str, label: str, minimum: int, maximum: int
) -> int | None:
    value = required(config, key, label)
    if not re.fullmatch(r"[0-9]+", value):
        errors.append(f"{key} in {FILES[label]} must be an integer from {minimum} to {maximum}.")
        return None
    number = int(value)
    if not minimum <= number <= maximum:
        errors.append(f"{key} in {FILES[label]} must be from {minimum} to {maximum}.")
        return None
    return number


db_connection_budget = bounded_integer(backend, "DB_CONNECTION_BUDGET", "backend", 1, 1000)
db_pool_size = bounded_integer(backend, "DB_POOL_SIZE", "backend", 1, 20)
db_max_overflow = bounded_integer(backend, "DB_MAX_OVERFLOW", "backend", 0, 20)
bounded_integer(backend, "DB_POOL_TIMEOUT_SECONDS", "backend", 1, 30)
bounded_integer(backend, "DB_CONNECT_TIMEOUT_SECONDS", "backend", 1, 30)
bounded_integer(backend, "DB_POOL_RECYCLE_SECONDS", "backend", 60, 86400)
uvicorn_workers = bounded_integer(infra, "UVICORN_WORKERS", "infra", 1, 8)
if all(value is not None for value in (db_connection_budget, db_pool_size, db_max_overflow, uvicorn_workers)):
    worker_connections = 2  # submission-worker: DB_POOL_SIZE=1, DB_MAX_OVERFLOW=1
    configured_connections = uvicorn_workers * (db_pool_size + db_max_overflow) + worker_connections
    if configured_connections > db_connection_budget:
        errors.append(
            "Backend connection demand for one Compose replica exceeds DB_CONNECTION_BUDGET "
            f"({uvicorn_workers} API workers x ({db_pool_size} pool + {db_max_overflow} overflow) + {worker_connections} grading-worker connections "
            f"= {configured_connections}, budget {db_connection_budget})."
        )

supabase_url = required(backend, "SUPABASE_URL", "backend")
if supabase_url:
    try:
        parsed_supabase = urlsplit(supabase_url)
        if parsed_supabase.scheme != "https" or not parsed_supabase.hostname:
            errors.append("SUPABASE_URL must be an HTTPS URL for the production Supabase project.")
        # This setting is a project origin, not a URL containing credentials,
        # a custom port, or a path that changes where SDK requests are sent.
        parsed_supabase.port
        if (
            parsed_supabase.path not in {"", "/"}
            or parsed_supabase.query
            or parsed_supabase.fragment
            or parsed_supabase.username is not None
            or parsed_supabase.password is not None
            or parsed_supabase.port is not None
        ):
            errors.append("SUPABASE_URL must contain only the project origin.")
    except ValueError:
        errors.append("SUPABASE_URL is malformed.")

required(backend, "SUPABASE_ANON_KEY", "backend")
if not backend.get("SUPABASE_SERVICE_ROLE_KEY", "").strip() and not backend.get("SUPABASE_SECRET_KEY", "").strip():
    errors.append("Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY for private PDF storage.")
required(backend, "GEMINI_API_KEY", "backend")

try:
    cors_origins = json.loads(required(backend, "CORS_ORIGINS", "backend"))
    if not isinstance(cors_origins, list) or not cors_origins:
        errors.append("CORS_ORIGINS must be a non-empty JSON array of exact HTTPS origins.")
    else:
        for origin in cors_origins:
            if not isinstance(origin, str) or "*" in origin:
                errors.append("CORS_ORIGINS entries must be exact HTTPS origins; wildcards are not allowed.")
                break
            try:
                parsed_origin = urlsplit(origin)
                hostname = parsed_origin.hostname
                parsed_origin.port  # Validate the explicit port, if present.
            except ValueError:
                errors.append("CORS_ORIGINS contains a malformed HTTPS origin.")
                break
            if (
                parsed_origin.scheme != "https"
                or not hostname
                or parsed_origin.path not in {"", "/"}
                or parsed_origin.query
                or parsed_origin.fragment
                or parsed_origin.username is not None
                or parsed_origin.password is not None
            ):
                errors.append("CORS_ORIGINS entries must be exact HTTPS origins without paths or credentials.")
                break
except (json.JSONDecodeError, TypeError):
    errors.append("CORS_ORIGINS must be a valid JSON array of exact HTTPS origins.")

if backend.get("ML_SHADOW_ENABLED", "").strip().lower() != "false":
    errors.append("Keep ML_SHADOW_ENABLED=false until its research and consent gates are met.")
if backend.get("ML_SHADOW_RESEARCH_APPROVED", "").strip().lower() != "false":
    errors.append("Keep ML_SHADOW_RESEARCH_APPROVED=false until institutional approval is recorded.")

passwords = []
for key in ("REDIS_PASSWORD", "POSTGRES_PASSWORD"):
    password = required(judge0, key, "judge0")
    if password and not re.fullmatch(r"[A-Fa-f0-9]{64}", password):
        errors.append(f"{key} must be 64 hexadecimal characters from openssl rand -hex 32.")
    if password:
        passwords.append(password)
if len(passwords) == 2 and passwords[0] == passwords[1]:
    errors.append("Judge0 Redis and PostgreSQL passwords must be different independent secrets.")

for key in ("POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PORT", "REDIS_PORT"):
    required(judge0, key, "judge0")

if judge0.get("POSTGRES_HOST", "").strip() != "judge0-db":
    errors.append("Set POSTGRES_HOST=judge0-db in judge0.prod.conf to match the private Compose service.")
if judge0.get("REDIS_HOST", "").strip() != "judge0-redis":
    errors.append("Set REDIS_HOST=judge0-redis in judge0.prod.conf to match the private Compose service.")
if judge0.get("POSTGRES_PORT", "").strip() != "5432":
    errors.append("Set POSTGRES_PORT=5432 in judge0.prod.conf to match the private Compose service.")
if judge0.get("REDIS_PORT", "").strip() != "6379":
    errors.append("Set REDIS_PORT=6379 in judge0.prod.conf to match the private Compose service.")
positive_settings = (
    "COUNT",
    "MAX_QUEUE_SIZE",
    "CPU_TIME_LIMIT",
    "MAX_CPU_TIME_LIMIT",
    "CPU_EXTRA_TIME",
    "WALL_TIME_LIMIT",
    "MAX_WALL_TIME_LIMIT",
    "MEMORY_LIMIT",
    "MAX_MEMORY_LIMIT",
    "STACK_LIMIT",
    "MAX_PROCESSES_AND_OR_THREADS",
)
numeric_settings: dict[str, int] = {}
for key in positive_settings:
    value = required(judge0, key, "judge0")
    if not re.fullmatch(r"[1-9][0-9]*", value):
        errors.append(f"{key} in judge0.prod.conf must be a positive integer.")
    else:
        numeric_settings[key] = int(value)

for key in (
    "ENABLE_PER_PROCESS_AND_THREAD_TIME_LIMIT",
    "ENABLE_PER_PROCESS_AND_THREAD_MEMORY_LIMIT",
    "ENABLE_COMPILER_OPTIONS",
    "ENABLE_COMMAND_LINE_ARGUMENTS",
    "ENABLE_SUBMISSION_DELETE",
    "ENABLE_WAIT_RESULT",
):
    if required(judge0, key, "judge0").lower() not in {"true", "false"}:
        errors.append(f"{key} in judge0.prod.conf must be true or false.")

for limit, maximum in (
    ("CPU_TIME_LIMIT", "MAX_CPU_TIME_LIMIT"),
    ("WALL_TIME_LIMIT", "MAX_WALL_TIME_LIMIT"),
    ("MEMORY_LIMIT", "MAX_MEMORY_LIMIT"),
):
    if limit in numeric_settings and maximum in numeric_settings:
        if numeric_settings[maximum] < numeric_settings[limit]:
            errors.append(f"{maximum} must be greater than or equal to {limit}.")

if errors:
    for error in dict.fromkeys(errors):
        print(f"ERROR: {error}")
    raise SystemExit(1)

print("Production settings passed local validation. No secret values were displayed.")
print(
    "Backend DB connection ceiling for one Compose replica: "
    f"{uvicorn_workers} workers x ({db_pool_size} pool + {db_max_overflow} overflow) "
    f"= {uvicorn_workers * (db_pool_size + db_max_overflow)} connections."
)
PY

# Compose config renders sensitive values; --quiet validates without printing them.
docker compose --profile vps config --quiet
printf 'VPS Compose configuration is valid. No services were started.\n'

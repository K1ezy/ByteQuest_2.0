# Phase 7 database pool budget hardening

**Date:** 2026-10-25  
**Scope:** Backend SQLAlchemy connection pool sizing and VPS preflight guard  
**Status:** Implemented and statically checked; production capacity remains unverified.

## Change

SQLAlchemy previously allowed each worker process to hold 10 pooled connections plus 20 overflow connections. The production backend starts two Uvicorn workers, so its theoretical ceiling was 60 database connections per FastAPI container.

The pool is now configurable through `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT_SECONDS`, and `DB_POOL_RECYCLE_SECONDS`. Defaults are 5, 5, 30 seconds, and 1800 seconds. The production example reserves a 20-connection ceiling for one Compose replica (2 workers × (5 pooled + 5 overflow)).

`infra/preflight-vps.sh` now validates the bounds, calculates the per-replica maximum, and refuses the configuration when it exceeds `DB_CONNECTION_BUDGET`. The budget must be confirmed against the selected production database plan. Additional FastAPI replicas each add the same connection ceiling and require a new capacity calculation before scaling.

## Checks performed

- `bash -n infra/preflight-vps.sh` passed.
- Python AST syntax parsing passed for `backend/app/core/config.py` and `backend/app/core/database.py`.
- Backend configuration import resolved the defaults as `5 / 5 / 30 / 1800`.
- Docker image build succeeded as `bytequest-backend:phase7-db-pool-20261025`.
- Image ID: `sha256:c0e2e385c30f956b20ce414e4f3387ee6099d5a1ae766a55cc4bf0b3c2952ce2`.
- Image size: 1,167,674,423 bytes. Configured user: `appuser`.
- `git diff --check` passed; Git printed only its existing LF-to-CRLF working-copy notices.

No automated tests were run, no application or Compose services were started, and the production preflight was not run because production-only configuration, credentials, image digests, and the actual database connection allowance are not available in this workspace. The declared 20-connection budget is an example value, not evidence of the selected database plan's capacity.

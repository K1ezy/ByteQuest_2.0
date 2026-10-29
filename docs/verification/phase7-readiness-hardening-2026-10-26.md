# Phase 7 readiness hardening

**Date:** 2026-10-26  
**Scope:** Production-mode API documentation policy and database readiness checks  
**Result:** Implementation, static checks, and a later local production-mode container check passed; production behavior remains unverified.

## Changes

- Added `GET /readyz`, which runs `SELECT 1` through the application's SQLAlchemy engine and returns only `{"status":"ready"}` or a generic HTTP 503 response. Connection errors are not returned to callers or copied into logs.
- Kept `/health` and `/api/v1/health` as status-only liveness probes that do not claim database readiness.
- Disabled Swagger, ReDoc, and OpenAPI routes when `ENVIRONMENT=production`; development retains the existing API docs.
- Added PostgreSQL connection timeouts and constrained pool checkout timeouts to a maximum of 30 seconds. The VPS container readiness probe timeout accounts for both bounded waits.
- Changed the VPS Compose health check and public deployment smoke check to include database readiness.

## Verification performed

- Python AST parsing passed for `backend/app/main.py`, `backend/app/core/config.py`, and `backend/app/core/database.py`.
- `bash -n infra/preflight-vps.sh infra/smoke-vps.sh` passed.
- `git diff --check` passed; Git printed only line-ending conversion notices for existing Windows working-tree files.
- At the time of this initial hardening record, automated tests were not run and the application container had not been started. A subsequent synthetic local container check is recorded in [phase7-local-runtime-2026-10-26.md](phase7-local-runtime-2026-10-26.md).

## Limits

The initial static checks did not prove readiness or production docs behavior. The later local check proves only that the app reached the existing local database and hid docs in a synthetic production-mode container. It does not prove production database reachability, public HTTPS, or production deployment behavior. No production service, database, or classroom data was accessed. Complete the remaining checks after the hosting and database decisions in [`PHASE7_DEPLOYMENT_READINESS.md`](../PHASE7_DEPLOYMENT_READINESS.md).

## Local runtime spot check — 2026-10-26

This later check used only the existing local stack and synthetic app configuration:

- `http://127.0.0.1:3000` returned HTTP 200 for the frontend.
- FastAPI on `http://127.0.0.1:8001` returned HTTP 200 from `/health`, `/api/v1/health`, `/readyz`, and `/docs`. `/readyz` confirms the configured local application database answered `SELECT 1` at check time.
- The current Judge0 VM address `172.23.175.189` returned HTTP 200 at port 2358.
- Local Supabase database, Kong, Auth, Storage, Realtime, Studio, and other listed services were running; the database, Kong, Auth, Storage, Realtime, and Studio health checks reported healthy. The Supabase Vector log-collector container was restarting (restart count 373); its logs report that its Docker log source cannot connect to the Docker Engine API. This is isolated from the passing FastAPI database-readiness probe, but local Supabase logging is not healthy.
- The Vercel `bytequest` project remains on the previously verified free Hobby tier with `bytequest-ebon.vercel.app`; the domain is verified but the project has no deployments. The project update specifying `rootDirectory=frontend` was submitted, but the Vercel project-details response still omits that field, so confirm it in project settings before preview deployment. No paid usage or add-on was enabled.

These are point-in-time development checks, not a production deployment or a full regression suite. Automated tests were not run as part of this spot check.

# Phase 7 backend image build verification

**Date:** 2026-10-25  
**Scope:** Local Linux x86_64 Docker image build only  
**Result:** Build passed; production deployment and runtime health remain unverified.

## Work completed

- Separated runtime and development dependencies. `backend/requirements.txt` contains runtime requirements; `backend/requirements-dev.txt` adds pytest for local development.
- Generated `backend/requirements.lock` for Python 3.11 on Linux x86_64 with pinned versions and hashes. It resolves 69 direct and transitive package entries; pytest is not part of the runtime lock.
- Pinned the backend's Python base image to the verified Linux amd64 manifest digest `sha256:b7a9e5f6a93d6d4a31f129bbd4bdee69efccb6ded0fb230d78aafaf37af98377` so later Docker builds do not silently move with the mutable `3.11-slim` tag.
- Updated the backend Dockerfile to install only the hashed runtime lock and run as the non-root `appuser`.
- Removed the compiler and PostgreSQL development package installation layer after the locked dependencies installed successfully without building native packages. This reduced the image from 1,622,106,431 bytes to 1,167,673,987 bytes, about 28% smaller.
- Built image `bytequest-backend:phase7-lock` successfully and inspected its configuration.

## Recorded evidence

- Image ID after rebuilding against the pinned base: `sha256:89bfa106cbbcf0fbc1a12b63f8fc475abac3820e7bd94a49b812259acc8c791b`
- Image size after rebuilding: 1,167,673,987 bytes (approximately 1.17 GB)
- Configured runtime user: `appuser`
- Configured health check: HTTP GET `http://127.0.0.1:8000/health`, 30-second interval, 5-second timeout, 30-second start period, three retries.
- `git diff --check` reported no whitespace errors. Git emitted only line-ending conversion warnings for existing CRLF/LF working-tree files.

## Limits

The container was not started, so the configured health check has not been shown to pass against a running application. Automated tests were not run. No VPS services, production database, Judge0 stack, or classroom data were used. The pinned Python base digest targets Linux amd64, matching the current runtime lock. The VPS Compose file now requires Caddy, Judge0, PostgreSQL, and Redis image references pinned by digest; select and review those digests after the Judge0 variant and VPS architecture are selected.

This is build evidence, not production readiness approval. Production still requires the decisions and checks in [`docs/PHASE7_DEPLOYMENT_READINESS.md`](../PHASE7_DEPLOYMENT_READINESS.md), including hosting/domain ownership, a production Supabase project and backup procedure, Judge0 variant/resource validation, and institutional authorization and participant consent before any classroom research data use.

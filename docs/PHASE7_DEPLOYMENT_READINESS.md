# Phase 7 deployment readiness

**Status: local technical readiness verified; public production deployment and classroom study have not started.**

This document records the production shape, the hardening completed locally, and the decisions and checks still required before a public launch. The local development stack remains Supabase CLI, FastAPI, the frontend dev server, and the private Judge0 VM.

## Prepared in the repository

- The VPS Compose profile is separate from local development and uses Caddy for HTTPS termination.
- Caddy limits public request bodies to 12 MB before forwarding. This leaves multipart overhead above the backend's 10 MiB PDF-content limit and rejects larger bodies with HTTP 413; preflight requires Caddy 2.10.0 or newer for this directive.
- Caddy forwards only to FastAPI. The Judge0 API has no host port mapping; the Judge0 API and its Postgres/Redis network are internal Docker networks.
- Judge0 Postgres data and Caddy certificate/configuration state use persistent Docker volumes.
- FastAPI has a public status-only liveness check and a database readiness check. The VPS Compose health check uses readiness; FastAPI runs as a non-root container with a read-only root filesystem and a small writable `/tmp`.
- Interactive Swagger, ReDoc, and OpenAPI endpoints remain available in development but are disabled when `ENVIRONMENT=production`.
- SQLAlchemy pool size, overflow, checkout timeout, connection timeout, and connection recycle are configurable. The production example sets a conservative ceiling of 20 app database connections per backend container (2 Uvicorn workers × (5 pooled + 5 overflow)); the preflight checks it against an operator-declared backend connection budget. The bounded pool/connect timeouts also bound the database readiness probe.
- The backend build context excludes local environment files, private keys, credentials, test files, and development artifacts through `backend/.dockerignore`.
- The Docker image installs a generated Python 3.11 Linux x86_64 runtime lock with hashes; pytest is isolated in `backend/requirements-dev.txt` and excluded from the runtime image.
- Vercel upload ignores local environment files. Production frontend and backend settings are represented by examples only.
- On 2026-10-26, the connected Vercel account was verified on the free Hobby plan. The `bytequest` Next.js project has the verified generated hostname `bytequest-ebon.vercel.app`; no deployment exists yet. The setup flow selected `frontend`, and a project update specified that root directory, but the project-details API did not return the field for read-back confirmation. No paid domain, add-on, usage purchase, or plan upgrade was made. Keep the project on Hobby unless the user explicitly decides otherwise. Vercel describes Hobby as intended for personal use and restricts it to personal or non-commercial use; confirm the institution's hosting requirements before a classroom pilot. See the [Vercel setup verification record](verification/phase7-vercel-setup-2026-10-26.md).
- The Next.js 16.4.2 frontend completed a local optimized production build, TypeScript validation, and static page generation. This build used `frontend/.env.local`; it is not evidence that Vercel environment values, preview deployment, authentication callbacks, CORS, or deployed workflows are correct. See the [frontend build record](verification/phase7-frontend-build-2026-10-26.md).
- Instructor provisioning is administrator-only: sign-up creates student accounts, the UI uses a local-only promotion helper only in development, and a UUID-scoped production SQL procedure is documented in [`PRODUCTION_INSTRUCTOR_ACCESS.md`](PRODUCTION_INSTRUCTOR_ACCESS.md). This procedure has not been run against a production project because none has been selected.
- Gemini clients are created lazily. The backend can start and serve non-AI routes when `GEMINI_API_KEY` is absent; AI-dependent instructor route handlers map missing-key configuration errors to HTTP 503 with a clear message rather than preventing API startup or retrying a missing key. The authenticated 503 response and live Gemini calls still need a route-level check with a configured test account/key.
- ML shadow scoring remains disabled in the production environment example.
- A credential-free Judge0 configuration example replaces the tracked `infra/judge0.conf`.
- `infra/preflight-vps.sh` checks production settings, restrictive secret-file permissions, one unambiguous PostgreSQL TLS mode, credential-free Supabase project origins, exact HTTPS CORS origins, Judge0 password separation and bounds, digest-pinned service images, and the rendered Compose configuration without printing secret values or starting services.
- `infra/vps_bootstrap.sh` creates the requested swap file through a temporary file and an atomic no-overwrite link, leaves 1 MiB for swap metadata/alignment, verifies the resulting active capacity, and refuses to resize or replace an existing invalid or undersized `/swapfile`. `infra/preflight-host.sh` checks the prepared VPS is Ubuntu 22.04/24.04 on x86_64, has at least 4 GiB RAM and active swap, at least 1 GiB root disk free after swap allocation, working Docker/Compose, and no initial Caddy port conflicts. The bootstrap has not been run and the host preflight has not been run because no production VPS has been selected. These checks do not size Judge0 images or expected submission data; choose enough additional disk after reviewing the selected Judge0 image.
- `infra/smoke-vps.sh https://<api-domain>` checks the public HTTPS liveness routes and database readiness after deployment. It accepts only a DNS HTTPS origin, bounds each response to 4 KiB, and requires the exact status-only JSON payload so future diagnostic fields cannot silently become public. Health responses no longer return model, Judge0 URL, environment, or shadow-scoring details. Bash syntax validation passed; the smoke script has not been run against a deployed host. See the [readiness hardening record](verification/phase7-readiness-hardening-2026-10-26.md).
- The preflight and public smoke scripts pass Bash syntax validation. On 2026-10-26, the VPS preflight also passed against an isolated synthetic fixture using dummy values and fake-format SHA-256 digests; its negative check rejected a tag without a digest. `docker compose config --quiet` validated the rendered configuration without pulling images or starting services. This confirms local preflight behavior only; production configuration and host checks remain pending. See the [synthetic preflight record](verification/phase7-preflight-synthetic-2026-10-26.md).
- On 2026-10-26, [`infra/verify-local-production-runtime.ps1`](../infra/verify-local-production-runtime.ps1) built and started the current backend image in production mode on an isolated loopback port, attached only to the existing local Supabase Docker network. The synthetic runtime check passed database readiness (`SELECT 1`), both status-only liveness routes, production-mode docs/OpenAPI 404s, the configured Docker health check, and the non-root/read-only-root/no-capabilities container settings. The temporary container and restricted temporary environment file were removed afterward. This is local container evidence, not a VPS deployment or a public HTTPS check; details are in the [local runtime verification record](verification/phase7-local-runtime-2026-10-26.md).
- On 2026-10-26, local dependency audits found and resolved the frontend's vulnerable DOMPurify transitive dependency and replaced the backend's vulnerable `python-jose`/`ecdsa` dependency path with PyJWT while retaining the explicit HS256 and audience checks. The npm audits and the hashed Linux runtime-lock audit reported no known vulnerabilities after these changes. This does not cover Judge0 images or host operating-system packages; details are in the [dependency security verification record](verification/phase7-dependency-security-2026-10-26.md).

### Local Judge0 runtime smoke check (2026-10-26)

The configured Judge0 endpoint on port 2358 was reachable and accepted an authenticated language-list request. Direct smoke submissions using stdin `21` each returned `Accepted` with stdout `42` for C++ (Clang 10.0.1, language ID 2), Python for ML (Python 3.7.7, ID 10), and Java (OpenJDK 14.0.1, ID 4). The API key was read from the ignored local backend configuration and was not printed. This check did not create ByteQuest attempts or change database state. The available Python runtime is specifically **Python for ML**; only a simple input/output program was verified, so full challenge compatibility and the production image/runtime choice remain open. The VM address is a Default Switch address and may change after restart.

## Security action for the previous Judge0 config

The removed `infra/judge0.conf` contained password fields and was tracked by Git. Removing it from the current tree does not erase earlier Git commits or any remote copies. Treat those old values as exposed: rotate the Judge0 Redis and PostgreSQL passwords anywhere they were used, and consider rewriting Git history only if the repository owner decides to do that with collaborators coordinated. Never reuse the old values in `judge0.prod.conf`.

## Decisions required before production setup

1. **Frontend hosting:** Vercel ownership and the `bytequest` project are set up on the free Hobby plan. Keep this project on Hobby; do not enable paid add-ons, buy usage, register a domain, or upgrade without a new explicit decision. The generated hostname is `bytequest-ebon.vercel.app`; there is no deployment yet. Hobby usage caps can pause the project, and Vercel limits Hobby to personal or non-commercial use. Confirm institutional eligibility before a classroom pilot.
2. **API domain and DNS:** choose the API hostname and DNS zone owner. The API hostname must resolve to the VPS public IP. The generated Vercel hostname is the current frontend origin; replace it only if a separately owned domain is selected later.
3. **VPS:** select a provider and region, a supported Ubuntu 22.04 or 24.04 host with at least 4 GiB RAM, sufficient disk for a 4 GiB swap file plus 1 GiB free headroom, and a known SSH port. Judge0 CE resource use must be load-checked before classroom concurrency.
4. **Production Supabase:** create or select a separate production project, apply reviewed migrations, and approve the backup type, retention, RPO/RTO, encrypted offsite location, key custody, owners, and rehearsal cadence in the [backup/restore runbook](PHASE7_BACKUP_RESTORE_RUNBOOK.md). Do not point production at the local database or classroom research data.
5. **Judge0 variant:** choose standard CE (`judge0/judge0:1.13.1`) or Extra CE (`judge0/judge0:1.13.1-extra`) after confirming the required C++, Python, and Java language IDs and versions. The image choice is set in `infra/.env`.
6. **AI provider:** provide a production Gemini API key and confirm model availability and budget limits.
7. **Research authorization:** a public product deployment does not authorize a classroom study. Institutional ethics approval, approved consent text and version, participant consent, approved data handling, and authorization for each research data use remain prerequisites to collecting or exporting classroom data. Shadow scoring stays off until its separate gates are satisfied.

No production credentials, VPS provider, API hostname, DNS zone, or production Supabase project have been selected in this repository. Vercel frontend ownership is configured on the free Hobby plan. Put production values into provider dashboards or ignored files on the VPS; do not put them in Git, chat, screenshots, or the frontend.

## Production settings and network boundaries

On the VPS, create the ignored files from the examples, then replace every placeholder with a fresh value:

```bash
cd infra
cp .env.example .env
cp backend.prod.env.example backend.prod.env
cp judge0.conf.example judge0.prod.conf
chmod 600 .env backend.prod.env judge0.prod.conf
```

Set `BYTEQUEST_API_DOMAIN` in `infra/.env`; set the Vercel frontend origin exactly in `CORS_ORIGINS`. Enter the same public frontend API URL in Vercel as `NEXT_PUBLIC_API_URL`. For `DATABASE_URL`, use the production Supabase connection string with TLS required. Keep `SUPABASE_SERVICE_ROLE_KEY` or its supported server-side replacement in the backend file only. The frontend receives only the public Supabase URL and anon key.

Before running the preflight, confirm the selected database plan’s available connection capacity and set `DB_CONNECTION_BUDGET` to the portion explicitly reserved for ByteQuest. The preflight calculates `UVICORN_WORKERS × (DB_POOL_SIZE + DB_MAX_OVERFLOW) + 2` for the API and grading worker. Reduce pool settings or increase the verified budget before scaling. Pool defaults are 5 connections plus 5 temporary overflow connections per API worker, with a maximum 30-second checkout timeout, a 5-second PostgreSQL connection timeout, and a 30-minute connection recycle.

Generate independent 64-character hexadecimal Redis and PostgreSQL passwords for Judge0 with `openssl rand -hex 32`. `judge0.prod.conf` is mounted read-only into Judge0 and is supplied to its internal data services. It is not a public API key and must not be reused for Supabase or SSH.

Pin `CADDY_IMAGE`, `JUDGE0_IMAGE`, `JUDGE0_POSTGRES_IMAGE`, and `JUDGE0_REDIS_IMAGE` in `infra/.env` to release-reviewed image digests after selecting the Judge0 variant and VPS architecture. The example tags identify candidate releases only; the preflight rejects tags without SHA-256 digests.

The intended public ports are TCP 80 and 443 for Caddy and the configured SSH port for administration. Host port 8000 is bound to loopback for local diagnostics. Judge0 port 2358, PostgreSQL, and Redis are not published on the VPS host.

## Deployment order after the decisions are made

1. Provision the VPS, record its public IP and SSH port, configure the DNS A/AAAA record, and check disk space before enabling the 4 GiB swap option in `infra/vps_bootstrap.sh`. After host setup and before deployment, run `bash ./preflight-host.sh` from `infra/`; it is read-only and reports host-local prerequisites only. Resolve any port 80/443 listener before the initial Caddy start.
2. Create the production Supabase project, apply reviewed schema migrations, configure Auth redirect URLs and storage policies, and execute the [backup/restore runbook](PHASE7_BACKUP_RESTORE_RUNBOOK.md) in an isolated recovery project. Keep production data and classroom research records out of development rehearsals.
3. Select the Judge0 image variant and VPS architecture. Create the three ignored VPS config files above, fill production values, replace all four example image tags with reviewed SHA-256 digest references, and generate two independent Judge0 passwords using `openssl rand -hex 32`. Confirm all placeholders are replaced and `ML_SHADOW_ENABLED=false` and `ML_SHADOW_RESEARCH_APPROVED=false` remain in force.
   Run `bash ./preflight-vps.sh` from `infra/` before bringing up the stack. It refuses incomplete or unsafe configuration and only validates Compose; it does not start containers.
4. Build the backend image from the protected build context. Runtime dependency locking and test dependency separation are implemented for Linux x86_64 with Python 3.11. The Python base image is pinned to the verified Linux amd64 digest. Local runtime evidence confirms the application starts as `appuser`, stays healthy with a read-only root and dropped capabilities, reaches the local Supabase database, and disables API docs in production mode. This does not verify the eventual VPS host, production Supabase, Judge0 Compose profile, or public TLS route. Regenerate `backend/requirements.lock` whenever runtime requirements change and review package upgrades.
5. Validate the Compose configuration without starting services, then start the VPS profile. Run `bash ./smoke-vps.sh https://<api-domain>` from `infra/` to check public HTTPS and both generic health responses. Separately verify Judge0 from the backend network, database persistence, logs, and resource use; the public smoke script does not check those.
6. Confirm the existing Vercel project root is `frontend`, set the three `NEXT_PUBLIC_*` production values, run a Hobby-tier preview deployment, and verify authentication callbacks, CORS, instructor upload, challenge publishing, and student submission against synthetic accounts. Keep the project on the free Hobby plan; do not add paid Vercel products or upgrade the plan without a separate explicit decision. For instructor preview checks, use the administrator-only process in [`PRODUCTION_INSTRUCTOR_ACCESS.md`](PRODUCTION_INSTRUCTOR_ACCESS.md); do not use the local Docker helper.
7. Only after preview evidence and backup/security review, deploy the Vercel frontend and VPS API to production. Run the same smoke checks with synthetic accounts; do not import local development users or research records.
8. For classroom evaluation, first obtain institutional approval and participant consent, agree on retention/access/export rules, run a small approved pilot, and document concurrent-use evidence and the approved SUS process. Export only the authorized, pseudonymized fields.

## Evidence still needed

- Production VPS runtime startup and readiness evidence using the selected production Supabase project and reviewed host configuration. The local production-like container check passed; it does not replace deployment evidence on the eventual VPS.
- Successful Vercel preview/build using production-like environment variables and deployment evidence for the frontend and VPS services. The local frontend build passes, but it is not a Vercel preview or deployment.
- A real VPS host preflight and deployment-config preflight using reviewed image digests, production domains, and production credentials. The synthetic preflight is not production evidence.
- HTTPS, CORS, authentication, upload, publishing, Judge0 grading, attempt persistence, and XP checks against production using synthetic accounts.
- The backup/restore runbook is prepared, but no production backup policy has been selected and no restore rehearsal has passed. Backup restoration evidence and a load test sized to the planned number of concurrent students remain pending.
- For the study: approval and consent records, approved SUS workflow, authorized anonymized export, and reviewed Chapter 4 analysis. These cannot be inferred from local development checks.

## Notes on local verification

The existing `docs/LOCAL_E2E.md` and milestone records describe local workflows. Local Judge0 uses the separately configured Hyper-V VM; this future VPS Compose profile is not active during local development. The local backend image runtime check used the existing local Supabase network and synthetic production-mode settings; it did not start the future VPS Judge0/Caddy Compose stack, deploy to Vercel, change user data, or perform a backup/restore rehearsal.

## Python runtime dependency lock maintenance

From `backend/`, regenerate the Docker runtime lock with uv when changing `requirements.txt`:

```bash
uv pip compile requirements.txt --output-file requirements.lock --python-version 3.11 --python-platform x86_64-unknown-linux-gnu --generate-hashes
```

Review and commit the resulting `requirements.lock` alongside the corresponding dependency change. The current lock targets Linux x86_64; generate a matching lock before building for a different CPU architecture. Local development installs `requirements-dev.txt`, which includes the runtime requirements and pytest. Docker installs only the hashed runtime lock.

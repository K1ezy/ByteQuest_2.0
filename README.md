# ByteQuest 2.0

> A gamified programming-learning platform for undergraduate computer science students, with sandboxed code assessment and a research path toward adaptive task sequencing.

**Thesis system — North Eastern Mindanao State University (NEMSU)**

[Architecture and roadmap](docs/MASTER_PLAN.md) · [Local setup and end-to-end guide](docs/LOCAL_E2E.md) · [Milestones 1A–1C status and verification log](docs/verification/milestone-1a-1b-2026-10-24.md) · [Phase 6 shadow rollout implementation record](docs/verification/phase-6-shadow-rollout-implementation-2026-10-25.md) · [Phase 7 deployment readiness](docs/PHASE7_DEPLOYMENT_READINESS.md) · [Phase 7 backup/restore runbook](docs/PHASE7_BACKUP_RESTORE_RUNBOOK.md) · [Phase 7 backend image build evidence](docs/verification/phase7-backend-image-build-2026-10-25.md) · [Phase 7 frontend build evidence](docs/verification/phase7-frontend-build-2026-10-26.md) · [Phase 7 database pool budget record](docs/verification/phase7-database-pool-budget-2026-10-25.md)

## Project overview

ByteQuest combines:

- **Programming practice:** published activities, quizzes, and coding challenges for C++, Python, and Java.
- **Sandboxed assessment:** FastAPI sends code to a private Judge0 Extra CE instance. The browser never calls Judge0 directly.
- **Progress and gamification:** attempts, XP, levels, badges, and deterministic rule-based next-task recommendations.
- **Instructor tools:** lesson-document processing and challenge generation are available as a separate AI-assisted workflow, with automated Judge0 checks and instructor review before publication.
- **Research pipeline:** shared feature engineering and model comparison support offline evaluation of Logistic Regression and Random Forest. Deterministic sequencing remains active while real, consented classroom data is unavailable; a future first ML evaluation is shadow-only.

RAG content generation and ML recommendations are not prerequisites for the initial verified coding flow. Their implementation and end-to-end verification are tracked separately in the [master plan](docs/MASTER_PLAN.md).

## Current status — 2026-10-26

Classroom pilot routes, migrations, and a grading worker were added on 2026-10-28. They remain under verification. Local Docker/Supabase and the selected production infrastructure are required to complete integration, accessibility, recovery, and 30-student load checks. See [pilot operator runbook](docs/PILOT_OPERATOR_RUNBOOK.md). The older milestone table below records evidence available on 2026-10-26.

| Area | Status |
|---|---|
| Local database schema | The initial nine tables were verified on 2026-10-26; subsequent group and pilot migrations add more tables. |
| Judge0 integration | Verified: ByteQuest's client received `Accepted` for two reference-solution cases in each of C++, Python, and Java against Judge0 Extra CE 1.13.1. |
| Coding fixtures | Verified: one published, verified seed challenge and two test cases per language. |
| Milestone 1C — Browser-to-database student flow | **Complete — verified locally:** synthetic browser runs and official submissions passed across C++, Python, and Java; sample runs created no attempts, official attempts persisted, first-pass XP was awarded once, repeat-pass XP was not duplicated, and authorization/language isolation/hidden-test privacy checks passed. |
| RAG and Gemini generation | Implemented in part; separate configuration and end-to-end verification remain. |
| ML feature engineering and comparison pipeline | Shared features, grouped model comparison, input safeguards, and versioned inactive artifact output are implemented. A synthetic bootstrap run completed with five student-grouped outer folds per model; artifact hashes and inactive status were verified. These synthetic metrics are not empirical evidence. |
| Phase 6 shadow evaluation | Opt-in post-attempt scoring and instructor-only aggregate analytics are implemented; both settings default off and Rule 9 remains authoritative. Runtime verification, an approved empirical model, institutional approval, and participant-consent controls remain pending. Do not enable shadow scoring on learner data yet. See the [implementation record](docs/verification/phase-6-shadow-rollout-implementation-2026-10-25.md). |
| Phase 7 deployment preparation | Linux x86_64 backend image and local optimized frontend builds passed; database pools are bounded and the preflight checks the per-replica connection budget. VPS deployment templates include private Judge0 networking, HTTPS through Caddy, and an edge request-body cap. No production host has been selected or deployed. Classroom research remains gated on institutional approval and participant consent. |

The Judge0, database, and browser-flow evidence is recorded in the [verification log](docs/verification/milestone-1a-1b-2026-10-24.md). The Hyper-V boot incident and service recovery are documented in [the Judge0 VM recovery guide](docs/troubleshooting/judge0-hyperv-boot-recovery-2026-10-24.md). The original Azure-image VM boot issue remains unresolved, but the separate Install VM runs the local Judge0 service. Classroom research still requires institutional consent.

## Development architecture

```text
Next.js frontend (localhost:3000)
        │ API requests with Supabase auth
        ▼
FastAPI backend (localhost:8000 by default; the local setup script selects an available port from 8000–8010)
        ├── Local Supabase CLI (PostgreSQL, Auth, Storage, pgvector)
        └── Private Ubuntu VM on D: (Judge0 Extra CE 1.13.1)
```

Local development uses Docker Desktop for Supabase and the already configured private Ubuntu VM for code execution. The local setup script preserves the Judge0 URL/token and optional backend AI settings, applies the idempotent seed without resetting local records, and writes ignored environment files without displaying keys. The VM's private IP can change; rerun the configuration helper if its endpoint is stale.

`infra/docker-compose.yml` is reserved for a later Linux VPS deployment and requires the explicit `vps` Compose profile. The deployment host must explicitly select and digest-pin Caddy, Judge0 CE/Extra CE, PostgreSQL, and Redis images after confirming language support and CPU architecture. Run `infra/preflight-vps.sh` after creating the ignored production config files; it validates configuration and the backend's maximum per-replica database connection budget without starting services. See the [Phase 7 readiness checklist](docs/PHASE7_DEPLOYMENT_READINESS.md); the VPS template has not yet been runtime-verified.

## Repository layout

```text
ByteQuest_2.0/
├── backend/
│   ├── app/api/                 # FastAPI routes: auth, profiles, quests, submissions, RAG, analytics
│   ├── app/core/                # Settings, database, security, and shared dependencies
│   ├── app/models/              # SQLAlchemy entities aligned with Supabase migrations
│   ├── app/services/            # Judge0, gamification, RAG, and ML prediction services
│   ├── scripts/                 # Database-backed verification utilities
│   ├── requirements.lock        # Hashed Python 3.11 Linux x86_64 runtime lock for Docker
│   └── requirements-dev.txt     # Local development dependencies, including pytest
├── docs/
│   ├── MASTER_PLAN.md           # Architecture, invariants, schema, milestones, and roadmap
│   ├── LOCAL_E2E.md              # Local setup and student/instructor workflows
│   └── verification/            # Dated verification evidence and outstanding gates
├── frontend/                    # Next.js, TypeScript, and Tailwind application
├── infra/                       # Local setup, VM configuration, and later VPS templates
├── ml_pipeline/                 # Shared features and offline model comparison
└── supabase/                    # Database migrations and idempotent local seed data
```

The initial schema contained nine public tables: `profiles`, `instructional_documents`, `document_chunks`, `learning_activities`, `test_cases`, `activity_attempts`, `badges`, `student_badges`, and `ml_predictions`. Group and pilot migrations now add drafts, grading jobs, hints, consent, exam, and notification tables. The local API security migration adds shared account quotas and revokes browser Data API access to ByteQuest application tables. `start-local.ps1` applies pending migrations only to local Supabase.

## Local setup (Windows PowerShell)

### One-click startup

When the local prerequisites below are installed, double-click [`START-BYTEQUEST.bat`](START-BYTEQUEST.bat) from the repository root. It starts Docker Desktop and local Supabase, starts the `ByteQuest-Judge0-Install` VM and its Judge0 stack when needed, then opens FastAPI, the frontend, and the sign-in screen. Each BAT launch signs out the current local browser session so authentication is shown first; it does not delete accounts or progress. Windows asks for administrator access so the launcher can inspect the VM and discover its IP; approve the prompt. Ubuntu may ask for its password if Judge0 needs to start. The VM Connection window can be closed after Ubuntu boots; keep Docker Desktop and the API/frontend terminal windows running while using the app. See the [full startup and troubleshooting guide](docs/LOCAL_E2E.md#one-click-windows-startup).

### Prerequisites

- Docker Desktop running and ready.
- Supabase CLI installed and available on `PATH`.
- Python and Node.js installed.
- The private Ubuntu Judge0 VM running and reachable from this computer. Configure its current private IP and API token using the helper below.

### 1. Start local Supabase and configure local environment files

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\start-local.ps1
```

This starts the local Supabase stack, applies current migrations and idempotent seed data, and writes ignored `backend/.env.local` and `frontend/.env.local` files. It does not reset the local database or start another Judge0 stack.

When the Judge0 VM address changes, configure its current URL with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\configure-judge0-vm.ps1
```

The helper preserves the existing Judge0 token in the ignored backend environment file and does not display it. If the server token was rotated on the VM, or the client token is missing, add `-SetApiToken` to enter the matching Judge0 server token securely. This updates ByteQuest's client configuration only; rotate the server token on the VM separately. Restart FastAPI after changing the endpoint. Never commit `.env.local` files or place service-role credentials in frontend configuration.

### 2. Start the API

Use the port reported by `start-local.ps1` (8000 by default). The script checks for port conflicts and updates the frontend's ignored local API URL to match. If you run the API on another port manually, update `frontend/.env.local` and restart Next.js.

In a PowerShell terminal:

```powershell
Set-Location .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The Docker image installs only the versions and hashes recorded in `backend/requirements.lock`. When runtime dependencies change, regenerate the Linux x86_64 lock from `backend` with `uv pip compile requirements.txt --output-file requirements.lock --python-version 3.11 --python-platform x86_64-unknown-linux-gnu --generate-hashes`, then review the lock diff with the dependency change.

### 3. Start the frontend

In a second PowerShell terminal:

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Open [http://localhost:3000/onboarding](http://localhost:3000/onboarding). The local Supabase Studio is available at [http://127.0.0.1:54323](http://127.0.0.1:54323). For the full instructor and student workflows, see [docs/LOCAL_E2E.md](docs/LOCAL_E2E.md).

Challenge generation and embeddings require `GEMINI_API_KEY`; the local coding flow and Judge0 verification do not require it. The setup script preserves an existing backend-only Gemini setting.

## Automated regression checks

The backend regression suite exercises instructor verification and publication, student code and quiz submissions, hidden-case privacy, XP idempotency, and quest-group persistence against local Supabase PostgreSQL. Judge0's transport is stubbed, while its real grading aggregation and response filtering run. Every test uses an outer database transaction that rolls back its synthetic records, so existing local users and progress are preserved.

Start the local Supabase stack, then run from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

The integration tests accept only a loopback PostgreSQL URL, read from `BYTEQUEST_TEST_DATABASE_URL` when set or the backend's local `DATABASE_URL` otherwise, and fail if the database is unavailable. The [GitHub Actions regression workflow](.github/workflows/regression.yml) starts its own Supabase stack and also runs frontend lint, typecheck, and production build. It does not require a live Judge0 VM, Gemini key, or classroom data. The separate real-Judge0 verification command below remains useful after VM or runtime changes.

## Verify seeded Judge0 reference solutions

After local Supabase and the private Judge0 VM are running and configured, from `backend/` run:

```powershell
.\.venv\Scripts\python.exe scripts\verify_all_languages.py
```

The script reads the seeded challenges and test cases from local Supabase and executes their reference solutions through ByteQuest's Judge0 client. It does not use or modify the cloud database. The recorded successful run is in the [Milestone 1A–1B verification log](docs/verification/milestone-1a-1b-2026-10-24.md).

## Architecture principles

The [master plan](docs/MASTER_PLAN.md) is the source of truth for the nine architecture rules and delivery roadmap. Key constraints include:

1. Keep model IDs and embedding dimensions configurable and aligned with the database vector schema.
2. Route database changes and external AI/Judge0 calls through the backend with authentication and validation.
3. Keep Judge0 and its Redis/Postgres services private; the browser must never submit code directly to Judge0.
4. Validate generated coding challenges with Judge0 and require instructor publication before student access.
5. Keep attempt history auditable, use pseudonymous identifiers for research exports, and follow approved consent protocols.
6. Use deterministic cold-start sequencing until consented data supports evaluation; keep any initial ML evaluation in shadow mode.

## Security and local data

The current route permissions, quotas, request limits, and local migration checks are documented in [Local API security](docs/LOCAL_API_SECURITY.md).

- `backend/.env.local` and `frontend/.env.local` contain machine-specific settings and are ignored by Git.
- Keep Judge0 tokens, Gemini API keys, Supabase service-role keys, and passwords out of source files, commits, screenshots, and logs.
- The frontend receives only the local Supabase anon key. Backend service credentials remain backend-only.
- Local seed data is designed to be safely reapplied. Avoid `supabase db reset` when you need to preserve local accounts or attempts.

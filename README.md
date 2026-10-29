# ByteQuest 2.0

> A gamified programming-learning platform for undergraduate computer science students, with sandboxed code assessment and a research path toward adaptive task sequencing.

**Thesis system — North Eastern Mindanao State University (NEMSU).**

## Overview

ByteQuest lets students practice coding challenges and quizzes in **C++, Python, and Java**, grades their code in an isolated sandbox, and rewards progress with XP, levels, and badges. Instructors generate and review challenges with an AI-assisted workflow; a research pipeline supports adaptive task sequencing.

- **Sandboxed grading** — the FastAPI backend sends code to a private Judge0 instance and returns only safe results. The browser never calls Judge0 directly.
- **Gamification** — attempts, XP, levels, badges, and deterministic rule-based next-task recommendations.
- **Instructor tools** — lesson documents are turned into challenges (RAG + Gemini), auto-checked by Judge0, and published only after instructor review.
- **Research pipeline** — shared feature engineering and offline model comparison. ML recommendations stay shadow-only until consented classroom data is available; deterministic sequencing is the live default.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js · TypeScript · Tailwind · Monaco editor · Supabase auth |
| Backend | FastAPI (Python 3.11) · SQLAlchemy |
| Data | Supabase — PostgreSQL, Auth, Storage, pgvector |
| Code execution | Judge0 Extra CE 1.13.1 (private Ubuntu VM) |
| AI | Google Gemini (challenge generation, embeddings, hints) |
| ML | Offline scikit-learn pipeline (Logistic Regression, Random Forest) |
| Infra | Docker Compose · Caddy · PowerShell launch scripts |

## Architecture

```text
Next.js frontend (localhost:3000)
        │  API requests authenticated with Supabase
        ▼
FastAPI backend (localhost:8000–8010)
        ├── Supabase (PostgreSQL, Auth, Storage, pgvector)
        ├── Judge0 Extra CE  — private VM, backend-only
        └── Gemini           — AI generation / hints (optional)
```

## Repository layout

```text
ByteQuest_2.0/
├── backend/        # FastAPI app: api routes, core, models, services, scripts, tests
├── frontend/       # Next.js + TypeScript + Tailwind application
├── infra/          # Local launcher, VM config, and VPS deployment templates
├── ml_pipeline/    # Shared features and offline model comparison
├── supabase/       # Database migrations and idempotent local seed data
└── docs/           # Architecture, setup, and dated verification evidence
```

## Quick start (Windows)

**Prerequisites:** Docker Desktop, Supabase CLI (on `PATH`), Python, Node.js, and the private Judge0 Ubuntu VM reachable from this machine.

### One-click

Double-click [`START-BYTEQUEST.bat`](START-BYTEQUEST.bat) from the repo root. It starts Docker Desktop and local Supabase, boots the Judge0 VM and discovers its IP, then launches the API, frontend, and sign-in screen. Approve the Windows administrator prompt (needed to inspect the VM). See the [full startup guide](docs/LOCAL_E2E.md#one-click-windows-startup).

### Manual

```powershell
# 1. Local Supabase + env files (writes ignored .env.local, applies migrations + seed)
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\start-local.ps1

# 2. Backend API (use the port start-local.ps1 reports; 8000 by default)
Set-Location .\backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# 3. Frontend (second terminal)
Set-Location .\frontend
npm install; npm run dev
```

Open <http://localhost:3000/onboarding>. Supabase Studio is at <http://127.0.0.1:54323>.

If the Judge0 VM's IP changes, re-point the client with `.\infra\configure-judge0-vm.ps1` (add `-SetApiToken` to update a rotated token), then restart the API. `GEMINI_API_KEY` is required only for AI generation, not for the core coding flow.

## Testing

```powershell
# From backend/, with local Supabase running:
.\.venv\Scripts\python.exe -m pytest -q
```

The suite covers instructor publication, student submissions, hidden-case privacy, XP idempotency, and quest-group persistence; Judge0's transport is stubbed and every test rolls back in an outer transaction, so local accounts and progress are preserved. The [GitHub Actions workflow](.github/workflows/regression.yml) runs these plus frontend lint, typecheck, and build. To exercise the real Judge0 VM, run `scripts\verify_all_languages.py` from `backend/`.

## Security

- `backend/.env.local` and `frontend/.env.local` hold machine-specific settings and are Git-ignored.
- Keep Judge0 tokens, Gemini/Supabase service-role keys, and passwords out of source, commits, screenshots, and logs.
- The frontend receives only the Supabase anon key; service credentials stay backend-only.
- Judge0 and its Redis/Postgres stay private — the browser never submits code to Judge0 directly.
- Local seed data is safe to reapply; avoid `supabase db reset` when preserving local accounts or attempts.

## Documentation

- [Master plan](docs/MASTER_PLAN.md) — architecture, invariants, schema, and roadmap (source of truth).
- [Local end-to-end guide](docs/LOCAL_E2E.md) — setup plus full instructor/student workflows.
- [Local API security](docs/LOCAL_API_SECURITY.md) — route permissions, quotas, and request limits.
- [Verification evidence](docs/verification/) — dated records and outstanding gates.

> **Status:** Core browser-to-database coding flow is verified locally across C++, Python, and Java. Classroom-pilot routes and the grading worker are under verification; ML shadow scoring is disabled pending institutional approval and participant consent. See the [master plan](docs/MASTER_PLAN.md) and [verification log](docs/verification/) for current detail.

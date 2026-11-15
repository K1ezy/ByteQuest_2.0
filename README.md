# ByteQuest 2.0

> A gamified programming-learning platform for undergraduate computer science students, with sandboxed code assessment and a research path toward adaptive task sequencing.

**Thesis system — North Eastern Mindanao State University (NEMSU).**

## Overview

ByteQuest lets students practice coding challenges and quizzes in **C++, Python, and Java**, grades their code in an isolated sandbox, and rewards progress with XP, levels, and badges. Instructors generate and review challenges with an AI-assisted workflow; a research pipeline supports adaptive task sequencing.

- **Sandboxed grading** — the FastAPI backend sends code to a private Judge0 instance and returns only safe results. The browser never calls Judge0 directly.
- **Gamification** — attempts, XP, levels, badges, and deterministic rule-based next-task recommendations.
- **Instructor tools** — lesson documents are turned into challenges (RAG + Gemini), auto-checked by Judge0, and published only after instructor review.
- **Research pipeline** — shared feature engineering and offline model comparison. ML recommendations stay shadow-only until consented classroom data is available; deterministic sequencing is the live default.
- **Public usernames** — every student, instructor, and administrator has a unique, editable `@username` made of 3–44 letters. Display names remain primary; research pseudonyms stay internal.
- **Faculty Machine Learning dashboard** — `/faculty/ml` shows course-scoped quiz, coding, and released exam history, student trends, forecast readiness, saved next-activity forecasts, and observed model quality. Forecasts are advisory and never change grades or progression.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js · React · TypeScript · hand-written CSS design tokens · Monaco editor · Supabase auth |
| Backend | FastAPI (Python 3.11) · SQLAlchemy |
| Data | Supabase — PostgreSQL, Auth, Storage, pgvector |
| Code execution | Judge0 Extra CE 1.13.1 (private Ubuntu VM) |
| AI | Google Gemini (challenge generation, embeddings, hints) |
| ML | Offline scikit-learn comparison of Logistic Regression and Random Forest on a student-disjoint 60/20/20 split |
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
├── frontend/       # Next.js + TypeScript app; all styling in src/app/globals.css
├── infra/          # Local launcher, VM config, and VPS deployment templates
├── ml_pipeline/    # Shared features and offline model comparison
├── supabase/       # Database migrations and idempotent local seed data
└── docs/           # Architecture, setup, and dated verification evidence
```

## Quick start (Windows)

**Prerequisites:** Docker Desktop, Supabase CLI **v2** (on `PATH`), Python 3.11, Node.js, PowerShell 7, and the private Judge0 Ubuntu VM. The first offline preparation run needs internet access to install or cache missing packages and Docker images.

### One-click

While connected and plugged in, first run [`PREPARE-BYTEQUEST-OFFLINE.bat`](PREPARE-BYTEQUEST-OFFLINE.bat). It installs missing local dependencies, caches the Supabase containers, builds the frontend with a locally served code editor, checks published content and grading languages, and configures a host-only Judge0 link. The Ubuntu SSH and sudo steps may ask for the VM password; it is not saved.

Then double-click [`START-BYTEQUEST.bat`](START-BYTEQUEST.bat) from the repo root, including on battery with Wi-Fi off. It reuses the frontend build and local data, starts the CPU-based services, checks database and grading readiness, and opens the sign-in screen. Windows asks for administrator access only if it must start the Judge0 VM. Startup errors identify the phase and are recorded under `logs/`. To verify with AC, Ethernet, and Wi-Fi disconnected, run [`TEST-BYTEQUEST-OFFLINE.bat`](TEST-BYTEQUEST-OFFLINE.bat); it writes `logs/offline-battery-acceptance.log`. See the [full startup guide](docs/LOCAL_E2E.md#one-click-windows-startup).

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

Open <http://127.0.0.1:3000/onboarding>. The one-click battery launcher skips Supabase Studio and other services unused by the learning flow; start the full local stack manually when you need Studio. It keeps Mailpit running, so local password-reset emails can be opened at <http://127.0.0.1:15434>.

If the Judge0 VM's IP changes, re-point the client with `.\infra\configure-judge0-vm.ps1` (add `-SetApiToken` to update a rotated token), then restart the API. `GEMINI_API_KEY` is required only for AI generation, not for the core coding flow.

## Testing

```powershell
# From backend/, with local Supabase running:
.\.venv\Scripts\python.exe -m pytest -q
```

The suite covers instructor publication, student submissions, hidden-case privacy, XP idempotency, and quest-group persistence; Judge0's transport is stubbed and every test rolls back in an outer transaction, so local accounts and progress are preserved. The [GitHub Actions workflow](.github/workflows/regression.yml) runs these plus frontend lint, typecheck, and build. To exercise the real Judge0 VM, run `scripts\verify_all_languages.py` from `backend/`.

## Usernames and faculty forecasts

Apply `supabase/migrations/20261111154648_usernames_ml_dashboard.sql` and `supabase/migrations/20261112000100_exam_attempt_release_time.sql` before deploying this version of the API. The first migration backfills unique alphabetic usernames and records the winning model on new prediction snapshots. The second records the release time of each exam attempt so retakes cannot move earlier results in the ML timeline. Local startup applies pending local migrations without resetting accounts.

Profile owners edit their username on `/profile`; the username is a public display handle, not a login credential. Faculty use **Machine Learning** in the workspace navigation to view historical course results and forecast states. The Performance page continues to show grades and attempt history.

New students choose a unique public username when signing up. It must contain 3–44 letters and is stored in lowercase; sign-in still uses email. Apply `supabase/migrations/20261112144247_student_signup_username.sql` before deploying the new signup form. The Auth signup transaction creates the profile with the chosen username, while administrator-invited accounts continue to receive starter usernames.

There is **no approved active model** in the repository. Historical charts work now; real probabilities require institution-approved de-identified training exports, a reviewed model run and activation manifest, research approval, and each learner's current consent. The [training export and review guide](ml_pipeline/README.md) documents the released-exam feature schema. Synthetic development runs must not be activated or presented as learner forecasts.

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

> **Status:** Core browser-to-database coding flow is verified locally across C++, Python, and Java. Faculty can review real course history in the ML dashboard; forecasting remains unavailable until an approved model and consented data are in place. See the [master plan](docs/MASTER_PLAN.md) and [verification log](docs/verification/) for current detail.

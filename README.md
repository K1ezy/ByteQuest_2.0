# ByteQuest 2.0

> A gamified programming-learning platform for undergraduate computer science students, with sandboxed code assessment and a research path toward adaptive task sequencing.

**Thesis system — North Eastern Mindanao State University (NEMSU)**

[Architecture and roadmap](docs/MASTER_PLAN.md) · [Local setup and end-to-end guide](docs/LOCAL_E2E.md) · [Milestones 1A–1C status and verification log](docs/verification/milestone-1a-1b-2026-10-24.md)

## Project overview

ByteQuest combines:

- **Programming practice:** published activities, quizzes, and coding challenges for C++, Python, and Java.
- **Sandboxed assessment:** FastAPI sends code to a private Judge0 Extra CE instance. The browser never calls Judge0 directly.
- **Progress and gamification:** attempts, XP, levels, badges, and deterministic rule-based next-task recommendations.
- **Instructor tools:** lesson-document processing and challenge generation are available as a separate AI-assisted workflow, with automated Judge0 checks and instructor review before publication.
- **Research pipeline:** shared feature engineering and model comparison support offline evaluation of Logistic Regression and Random Forest. Deterministic sequencing remains active while real, consented classroom data is unavailable; a future first ML evaluation is shadow-only.

RAG content generation and ML recommendations are not prerequisites for the initial verified coding flow. Their implementation and end-to-end verification are tracked separately in the [master plan](docs/MASTER_PLAN.md).

## Current status — 2026-10-24

| Area | Status |
|---|---|
| Local database schema | Verified: 9 public tables in local Supabase. |
| Judge0 integration | Verified: ByteQuest's client received `Accepted` for two reference-solution cases in each of C++, Python, and Java against Judge0 Extra CE 1.13.1. |
| Coding fixtures | Verified: one published, verified seed challenge and two test cases per language. |
| Milestone 1C — Browser-to-database student flow | **Pending:** waiting for the project owner to supply the institution-approved consent text and its label/version. No browser submission walkthrough is claimed complete. |
| RAG and Gemini generation | Implemented in part; separate configuration and end-to-end verification remain. |
| ML training and serving | Offline pipeline and serving components are present; real-data evaluation and any shadow deployment remain pending. |
| Production deployment and classroom pilot | Planned; hosting and deployment choices remain to be completed. |

The Judge0 and database evidence is recorded in the [verification log](docs/verification/milestone-1a-1b-2026-10-24.md). The next end-to-end gate is to add the institutionally approved consent step and wording, then verify onboarding, dry-run behavior, official submissions, attempt persistence, and XP through the browser and database.

## Development architecture

```text
Next.js frontend (localhost:3000)
        │ API requests with Supabase auth
        ▼
FastAPI backend (localhost:8000)
        ├── Local Supabase CLI (PostgreSQL, Auth, Storage, pgvector)
        └── Private Ubuntu VM on D: (Judge0 Extra CE 1.13.1)
```

Local development uses Docker Desktop for Supabase and the already configured private Ubuntu VM for code execution. The local setup script preserves the Judge0 URL/token and optional backend AI settings, applies the idempotent seed without resetting local records, and writes ignored environment files without displaying keys. The VM's private IP can change; rerun the configuration helper if its endpoint is stale.

`infra/docker-compose.yml` is reserved for a later Linux VPS deployment and requires the explicit `vps` Compose profile. It currently describes standard Judge0 CE, while the development VM runs Extra CE; reconcile that difference before selecting the Compose stack for deployment.

## Repository layout

```text
ByteQuest_2.0/
├── backend/
│   ├── app/api/                 # FastAPI routes: auth, profiles, quests, submissions, RAG, analytics
│   ├── app/core/                # Settings, database, security, and shared dependencies
│   ├── app/models/              # SQLAlchemy entities aligned with Supabase migrations
│   ├── app/services/            # Judge0, gamification, RAG, and ML prediction services
│   └── scripts/                 # Database-backed verification utilities
├── docs/
│   ├── MASTER_PLAN.md           # Architecture, invariants, schema, milestones, and roadmap
│   ├── LOCAL_E2E.md              # Local setup and student/instructor workflows
│   └── verification/            # Dated verification evidence and outstanding gates
├── frontend/                    # Next.js, TypeScript, and Tailwind application
├── infra/                       # Local setup, VM configuration, and later VPS templates
├── ml_pipeline/                 # Shared features and offline model comparison
└── supabase/                    # Database migrations and idempotent local seed data
```

The local schema currently contains these nine public tables: `profiles`, `instructional_documents`, `document_chunks`, `learning_activities`, `test_cases`, `activity_attempts`, `badges`, `student_badges`, and `ml_predictions`.

## Local setup (Windows PowerShell)

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

If the VM endpoint or token is missing or has changed, configure it with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\configure-judge0-vm.ps1
```

The token is entered without being displayed and is saved in the ignored backend environment file. Never commit `.env.local` files or place service-role credentials in frontend configuration.

### 2. Start the API

In a PowerShell terminal:

```powershell
Set-Location .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Start the frontend

In a second PowerShell terminal:

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Open [http://localhost:3000/onboarding](http://localhost:3000/onboarding). The local Supabase Studio is available at [http://127.0.0.1:54323](http://127.0.0.1:54323). For the full instructor and student workflows, see [docs/LOCAL_E2E.md](docs/LOCAL_E2E.md).

Challenge generation and embeddings require `GEMINI_API_KEY`; the local coding flow and Judge0 verification do not require it. The setup script preserves an existing backend-only Gemini setting.

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

- `backend/.env.local` and `frontend/.env.local` contain machine-specific settings and are ignored by Git.
- Keep Judge0 tokens, Gemini API keys, Supabase service-role keys, and passwords out of source files, commits, screenshots, and logs.
- The frontend receives only the local Supabase anon key. Backend service credentials remain backend-only.
- Local seed data is designed to be safely reapplied. Avoid `supabase db reset` when you need to preserve local accounts or attempts.

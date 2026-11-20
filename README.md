# ByteQuest 2.0

ByteQuest is a gamified programming-learning platform for undergraduate computer science students. Students practice **Python, C++, and Java**, instructors publish and grade coursework, and administrators manage course access and monitor the services. ByteQuest is a thesis system for North Eastern Mindanao State University (NEMSU).

**Current development.** The architecture and setup below describe the latest weekly update on `fix/ml-pr-auc-student-disjoint-split`. Use that branch for the runnable version documented here. [Browse the current source](https://github.com/K1ezy/ByteQuest_2.0/tree/fix/ml-pr-auc-student-disjoint-split)

**Release status.** The core learning workflows have local verification. Hosted classroom acceptance is pending, including capacity, security, and recovery checks on the intended deployment. [System status and verification](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/BYTEQUEST_SYSTEM_STATUS_2026-11-20.md)

## What each role can do

| Role | Workflows |
| --- | --- |
| Student | Open the Quest Map, join Workshops, answer quizzes, and solve coding challenges in the Monaco editor. Run visible samples before submitting for grading. Take timed exams, read released results, and track progress, XP, and badges. |
| Instructor | Upload and version lesson PDFs, create or generate activities, review the student preview, and schedule or publish coursework. Verify coding challenges with Judge0 and provide a visible sample. Manage exams, announcements, gradebooks, exports, and course analytics. |
| Administrator | Manage accounts, course assignments, and platform settings. Investigate application, database, grading-worker, and sandbox health from the monitoring workspace. |

The optional Gemini tutor supports course-aware chat, Temporary Chat, saved history where enabled, and hints after failed coding samples. ByteQuest pauses tutor access during active exams. [Tutor evaluation](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/verification/gemini-tutor-evaluation-2026-11-20.md)

## Architecture

```mermaid
flowchart LR
    UI["Next.js app in the browser"]
    Auth["Supabase Auth"]
    API["FastAPI application"]
    DB["Supabase PostgreSQL and pgvector"]
    Files["Supabase private PDF storage"]
    Worker["ByteQuest grading worker"]
    Judge["Private Judge0 sandbox"]
    AI["Gemini API"]

    UI -->|Sign in and refresh session| Auth
    UI -->|Bearer-authenticated requests| API
    API -->|Course data, grading jobs, and results| DB
    API -->|Upload and read permitted PDFs| Files
    API -->|Embed passages, draft activities, and tutor| AI
    Worker -->|Claim jobs and save grades| DB
    Worker -->|Run code and compare output| Judge
    API -->|Verify instructor reference solutions| Judge
```

- **Sign-in and authorization.** Supabase Auth issues the session. FastAPI validates it and checks the active profile, role, and course membership before accessing protected data. Student self-registration verifies a school-issued ID and matching roster email.
- **Grading and exams.** The API records durable jobs. An independent worker claims jobs, calls Judge0, and saves grades. Sample runs use visible cases. Official submissions use the full grading set, with hidden inputs and expected outputs withheld from students. Exam content is frozen for the attempt and results follow the instructor’s release workflow.
- **Materials and AI.** Uploaded PDFs are stored privately. Searchable passages are indexed in pgvector with Gemini Embedding 2. Gemini 3.5 Flash-Lite uses relevant authorized excerpts for tutoring and activity generation. Instructors review and publish generated drafts.
- **Research and ML.** Deterministic rules drive live recommendations. The offline pipeline compares Logistic Regression and Random Forest on student-disjoint splits. Forecasting requires approved data, a reviewed model run, and appropriate consent. [ML evaluation and activation](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/ml_pipeline/README.md)

[Architecture blueprint](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/BYTEQUEST_ARCHITECTURE_BLUEPRINT.md) · [API security and privacy](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/LOCAL_API_SECURITY.md)

## Stack and deployment

| Layer | Technology |
| --- | --- |
| Web app | Next.js App Router, React, TypeScript, CSS design tokens, Monaco Editor, Recharts |
| API and grading worker | Python 3.11, FastAPI, SQLAlchemy |
| Application data | Supabase PostgreSQL, Auth, Storage, and pgvector |
| Code execution | Judge0 Extra CE with Python, C++, and Java runtimes. Judge0 uses its own PostgreSQL and Redis services. |
| AI and ML | Google Gemini 3.5 Flash-Lite, Gemini Embedding 2, scikit-learn |
| Infrastructure | PowerShell and Windows launchers for development, Docker Compose and Caddy for the planned VPS |

| Environment | Services |
| --- | --- |
| Local development and demo | Next.js, FastAPI, and the grading worker run on the workstation. Supabase CLI runs the data services in Docker. A private Ubuntu VM runs Judge0. The prepared core learning flow can run offline. Gemini features require internet. |
| Planned hosted pilot | Vercel serves the frontend. Caddy terminates HTTPS on the Hostinger KVM 2 VPS, which runs FastAPI, the grading worker, and private Judge0 with Docker Compose. Hosted Supabase holds the application data. Gemini is optional for the pilot. |

The VPS rehearsal needs a matching frontend and API release, applied migrations, working sign-in and recovery, private PDF access, a class-size grading test, and a tested restore. [KVM 2 deployment checklist](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/KVM2_LIVE_PILOT_CHECKLIST.md) · [Backup and restore](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/PHASE7_BACKUP_RESTORE_RUNBOOK.md)

## Repository layout

The paths below are on the current development branch.

```text
ByteQuest_2.0/
├── frontend/
│   ├── src/app/                 Next.js routes and shared layouts
│   ├── src/components/          Coding Arena, chat, and role workspaces
│   ├── src/lib/                 API client, Auth, and shared types
│   ├── public/                  Static assets
│   └── scripts/                 Editor preparation and browser QA
├── backend/
│   ├── app/main.py              FastAPI application and health endpoints
│   ├── app/api/                 Student, instructor, admin, exam, and chat routes
│   ├── app/core/                Settings, authorization, database, and quotas
│   ├── app/models/              SQLAlchemy data models
│   ├── app/services/            Grading, Judge0, AI, materials, and gamification
│   ├── scripts/                 Local fixtures and verification tools
│   └── tests/                   Unit, integration, and synthetic pilot tests
├── supabase/
│   ├── config.toml              Local Supabase configuration
│   ├── migrations/              Database schema and access changes
│   └── seed.sql                 Local baseline fixtures
├── infra/                       Launchers, Judge0 setup, VPS Compose, and preflight
├── ml_pipeline/                 Feature engineering and offline model evaluation
├── docs/                        Architecture, runbooks, reviews, and evidence
├── graphify-out/                Generated codebase knowledge graph
├── .github/workflows/           GitHub Actions regression checks
└── *-BYTEQUEST*.bat              Windows launch and offline verification shortcuts
```

[Frontend](https://github.com/K1ezy/ByteQuest_2.0/tree/fix/ml-pr-auc-student-disjoint-split/frontend) · [Backend](https://github.com/K1ezy/ByteQuest_2.0/tree/fix/ml-pr-auc-student-disjoint-split/backend) · [Migrations](https://github.com/K1ezy/ByteQuest_2.0/tree/fix/ml-pr-auc-student-disjoint-split/supabase/migrations) · [Infrastructure](https://github.com/K1ezy/ByteQuest_2.0/tree/fix/ml-pr-auc-student-disjoint-split/infra)

## Start locally on Windows

You’ll need Docker Desktop, Supabase CLI v2, Python 3.11, Node.js 20.9 or later with npm, PowerShell 7, and a configured private Ubuntu Judge0 VM.

For a new checkout, clone the branch documented here.

```powershell
git clone --branch fix/ml-pr-auc-student-disjoint-split https://github.com/K1ezy/ByteQuest_2.0.git
Set-Location ByteQuest_2.0
```

1. Run `PREPARE-BYTEQUEST-OFFLINE.bat` once while connected. This prepares the local containers, dependencies, frontend build, and Judge0 connection. [Preparation launcher](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/PREPARE-BYTEQUEST-OFFLINE.bat)
2. Run `START-BYTEQUEST.bat` to start the local stack and open sign-in. The launcher starts the API and grading worker together. [Startup launcher](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/START-BYTEQUEST.bat)
3. Open [local sign-in](http://127.0.0.1:3000/onboarding). Sign in to an existing test account or follow the local guide for account and course setup.

For hot reload, run `pwsh -NoProfile -File .\infra\start-bytequest.ps1 -Development` after setup. The manual setup and offline acceptance procedure are in the local guide. [Local setup and troubleshooting](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/LOCAL_E2E.md)

## Test and verify

With local Supabase and the development dependencies available, run the following from the repository root.

```powershell
Push-Location backend
.\.venv\Scripts\python.exe -m pytest -q
Pop-Location

Push-Location frontend
npm run lint
npm run typecheck
npm test
npm run build
Pop-Location
```

The regression workflow runs the backend suite plus frontend lint, typechecking, tests, and build. The local Judge0 language check is `backend/scripts/verify_all_languages.py`. The 20 November 2026 verification recorded **260 backend tests** and **178 frontend tests** passing on the weekly update. [GitHub Actions workflow](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/.github/workflows/regression.yml) · [Dated verification](https://github.com/K1ezy/ByteQuest_2.0/tree/fix/ml-pr-auc-student-disjoint-split/docs/verification)

## Configuration and security

- Local machine settings live in ignored `.env.local` files. Keep Gemini keys, Supabase privileged credentials, database passwords, and Judge0 tokens on the server.
- Use the dedicated production templates for the hosted pilot. Configure exact HTTPS origins for the API and keep Judge0, Redis, and the sandbox database on private networks.
- Enable saved chat history on the hosted pilot after checking its privacy notice, retention, deletion, and scheduled purge. Use approved synthetic accounts for deployment and recovery rehearsals. [Pilot operator runbook](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/PILOT_OPERATOR_RUNBOOK.md)

## Documentation

- [Current system status and weekly change log](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/BYTEQUEST_SYSTEM_STATUS_2026-11-20.md)
- [Release readiness and classroom acceptance gates](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/SYSTEM_STATUS_AND_RELEASE_PLAN.md)
- [KVM 2 live pilot setup](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/KVM2_LIVE_PILOT_CHECKLIST.md)
- [System design and roadmap](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/docs/MASTER_PLAN.md)
- [Repository guidance for coding assistants](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/AGENTS.md)

[MIT license](https://github.com/K1ezy/ByteQuest_2.0/blob/fix/ml-pr-auc-student-disjoint-split/LICENSE)

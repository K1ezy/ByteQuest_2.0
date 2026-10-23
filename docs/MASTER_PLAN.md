# ByteQuest 2.0: Master Architecture Plan & Execution Roadmap

> **Thesis Title**: *ByteQuest 2.0: An Intelligent, Gamified Programming Learning Platform with Automated Assessment and Adaptive Task Sequencing*  
> **Institution**: North Eastern Mindanao State University (NEMSU) — Department of Computer Studies  
> **Target Audience**: Undergraduate Computer Science Students (C++, Python, Java)  
> **Repository**: [https://github.com/K1ezy/ByteQuest_2.0.git](https://github.com/K1ezy/ByteQuest_2.0.git)  
> **Document Purpose**: Single Source of Truth (SSOT) for the 4-member thesis team and the Antigravity AI coding assistant.

---

## 1. Project Tracking & Thesis Collaboration Strategy

To achieve synchronized execution across a 4-member thesis development team while ensuring code-level alignment for AI-assisted programming, ByteQuest 2.0 employs a **dual-layer tracking architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                  LAYER 1: RESEARCH & TEAM OPS               │
│                  Notion Education Plus Workspace            │
│  - Thesis Chapter Milestones & Literature Matrix (Ch 1–5)    │
│  - Meeting Agendas, Adviser Feedback & Ethics Approvals     │
│  - High-Level 7-Phase Gantt / Sprint Roadmap                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  LAYER 2: CODE & SPRINT EXECUTION           │
│         GitHub Projects + In-Repo docs/MASTER_PLAN.md        │
│  - Issue tracking tied to Git branches, PRs, and commits    │
│  - Antigravity AI Agent reads MASTER_PLAN.md directly        │
│  - Automated CI / Linting / Branch Protection Rules         │
└─────────────────────────────────────────────────────────────┘
```

### Platform Comparison & Selection Matrix

| Platform | Best Use Case | Team Workflow Fit |
| :--- | :--- | :--- |
| **1. Notion** *(Recommended for Thesis Wiki)* | All-in-one Wiki, Thesis Checklists, Literature Matrix, and Meeting Minutes. | Use the free **Notion Education Plus Plan** (via university student email). Track advisor consultations, manuscript chapters, ethics clearance docs, and high-level deliverables across the 4 members. |
| **2. GitHub Projects** *(Recommended for Code Kanban)* | Issue tracking directly tied to Git branches, Pull Requests, and CI/CD. | Built directly into [ByteQuest_2.0](https://github.com/K1ezy/ByteQuest_2.0.git). Cards link 1-to-1 with repository issues, features, and fixes. Combined with `docs/MASTER_PLAN.md`, this keeps AI coding agents strictly aligned with sprint goals. |
| **3. Linear** *(Alternative)* | High-speed software sprints & bug tracking. | Excellent sprint cycles, but GitHub Projects is already unified with the git commit history and zero-cost for public/student repos. |
| **4. Obsidian** *(Local Notes)* | Offline-first Markdown graph. | Useful for personal note-taking; team members can point Obsidian directly to `ByteQuest_2.0/docs` to edit notes locally. |

### Prescribed Team Setup:
1. **Team Kanban (GitHub Projects)**: Create project board with columns: `Backlog`, `Ready for Sprint`, `In Progress`, `PR Review / Pre-Validation`, and `Done (Published/Verified)`.
2. **Issue Template Tagging**: Tag issues by Specific Objective (`SO-1` to `SO-9`) and Phase (`Phase-1` to `Phase-7`).
3. **In-Repo Specification**: `docs/MASTER_PLAN.md` must be consulted before implementing any schema change, service endpoint, or ML feature to prevent architectural drift.

---

## 2. Core Architectural Rules (Non-Negotiable)

All developers and AI assistants working on ByteQuest 2.0 must adhere to the following 9 architectural invariants:

* **Rule 1: Configurable LLM & Structured Outputs**  
  All generative AI calls to Google Gemini must use an environment-configurable model ID (`GEMINI_MODEL_ID` defaulting to `gemini-2.5-flash` or `gemini-3.5-flash-lite`). Every generation prompt must enforce strict Pydantic schemas (Structured Outputs) for predictable JSON payloads and use `tenacity` exponential backoff to handle transient API limits.
* **Rule 2: Semantic Document Grounding & Embedding Dimensionality**  
  The embedding model ID and output dimension are environment-configurable. Store the actual `embedding_model` and `embedding_dim` with each chunk, and keep the model output dimension aligned with the database vector column. The current schema uses `vector(768)`, so the configured dimension must remain 768 until a reviewed schema migration changes it. Retrieval must use `RETRIEVAL_DOCUMENT` for indexed chunks and `RETRIEVAL_QUERY` for queries.
* **Rule 3: Isolated Code Execution Sandbox**  
  The active development target is the private Ubuntu VM on D: running Judge0 Extra CE 1.13.1 on cgroup v1. FastAPI authenticates to it with `X-Auth-Token` and discovers language IDs from `/languages`; the browser never calls it directly. Judge0 Redis and Postgres ports must never be exposed publicly. The separate Compose file is a later Linux VPS template and currently uses standard Judge0 CE, so it is not the local development target. All submissions must use timeouts and circuit-breaker handling in FastAPI.
* **Rule 4: Centralized Backend Gatekeeping**  
  Client applications (Next.js) must **never** query or mutate the Supabase database directly for core business logic, code submissions, RAG generation, or ML predictions. All mutations route through the FastAPI backend (`/api/v1/*`) validated by Supabase JWT bearer tokens.
* **Rule 5: Immutable Performance Logging & Zero Train-Serve Leakage**  
  Student attempts must be stored as immutable, append-only logs in `activity_attempts`. The exact same feature calculation logic must be packaged in a shared module (`feature_engineering.py`) imported by both the live FastAPI prediction service and offline training scripts to prevent train-serve skew. Cross-validation in ML training must strictly use `GroupKFold` grouped by `student_id` to prevent data leakage.
* **Rule 6: Automated Pre-Validation & Pedagogical Review Gate**  
  LLM-generated programming challenges (problem statement, reference solution, test cases) must be automatically pre-validated against Judge0 by the backend (`judge0_verified = True`). They must default to `review_status = "draft"` and cannot be surfaced to students until explicitly reviewed and published by an instructor.
* **Rule 7: API Resilience & Rate Limiting**  
  FastAPI must enforce rate limiting using `slowapi` on code execution and AI generation endpoints to prevent runaway compute costs and denial of service. External API calls must incorporate retry loops with jitter.
* **Rule 8: Ethical Compliance & Student Privacy**  
  All student data collected during NEMSU classroom evaluations must follow institutional informed consent protocols. Dataset exports for thesis Chapter 4 results must use surrogate `pseudonym_id` keys, stripping PII (names, emails, student IDs).
* **Rule 9: Cold-Start Rule-Based Sequencing Fallback**  
  Before the comparative ML models are fully trained and integrated (Phases 1–4), task sequencing must operate on deterministic pedagogical rules (e.g., passing quiz + passing coding challenge with $\ge 80\%$ test cases unlocks next tier; otherwise routes to conceptual review).

---

## 3. Repository Directory Structure

```
ByteQuest_2.0/
├── docs/
│   └── MASTER_PLAN.md          # Full architecture, rules, and checklist for AI & team
├── infra/
│   ├── configure-judge0-vm.ps1 # Primary local workflow: configure private D: Ubuntu VM endpoint/token
│   ├── start-local.ps1         # Starts local Supabase; keeps the configured VM Judge0 target
│   ├── docker-compose.yml      # Later Linux VPS template; not used for local Judge0
│   ├── Caddyfile               # Automatic HTTPS reverse proxy for Vercel -> VPS
│   └── judge0.conf             # Judge0 sandbox resource limits & worker config
├── frontend/                   # Next.js (TypeScript), Tailwind CSS, shadcn/ui, Monaco, TanStack Query
│   ├── src/
│   │   ├── app/                # App Router (auth, student dashboard, instructor review, arena)
│   │   ├── components/         # Monaco editor, quest map, level progress, test case runner
│   │   ├── lib/                # API client, Supabase browser client, TanStack hooks
│   │   └── types/              # TypeScript interfaces matching backend Pydantic schemas
├── backend/                    # FastAPI + SQLAlchemy (Supabase PostgreSQL + pgvector)
│   ├── app/
│   │   ├── api/                # REST routers (v1: auth, quests, judge, rag, analytics, predict)
│   │   ├── core/               # App config, Supabase JWT verification, rate limiting, circuit breaker
│   │   ├── models/             # SQLAlchemy ORM models (7 core tables)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   └── services/
│   │       ├── ai_rag/         # Gemini generate(), embed(), PyMuPDF document chunker
│   │       ├── judge0/         # Code runner, circuit breaker, reference solution pre-validator
│   │       ├── gamification/   # Level thresholds, XP engine, badge awards, rule-based sequencer
│   │       └── ml_predictor/   # Live model loader & real-time feature extraction
│   └── tests/                  # Pytest integration & unit tests
└── ml_pipeline/                # Offline training & empirical evaluation for thesis Chapter 4
    ├── train_compare.py        # Nested GroupKFold + GridSearchCV comparison and artifact export
    ├── feature_engineering.py  # Compatibility exports for the backend's canonical extractor
    └── artifacts/              # Serialized pipelines, ROC curve data, confusion matrices, metrics JSON
```

---

## 4. Course-Sequence & Curriculum Alignment

ByteQuest 2.0 strictly enforces language assignment based on the student's academic standing at NEMSU:

| Year Level | Semester | Target Language | Typical Course Subject |
| :---: | :---: | :---: | :---: |
| **1st Year** | **1st Semester** | `cpp` (C++) | Computer Programming 1 (Fundamentals, Control Structures, Arrays) |
| **1st Year** | **2nd Semester** | `python` (Python) | Computer Programming 2 (Data Structures, Functions, Scripting) |
| **2nd Year** | **1st Semester** | `java` (Java) | Object-Oriented Programming (Classes, Inheritance, Polymorphism) |

---

## 5. Database Schema Blueprint (Supabase PostgreSQL + pgvector)

The current migrations create **9 physical tables**: `profiles`, `instructional_documents`, `document_chunks`, `learning_activities`, `test_cases`, `activity_attempts`, `ml_predictions`, `badges`, and `student_badges`. Badges and student badge awards are separate tables.

### PostgreSQL Schema DDL

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. PROFILES (Users & Academic Context)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    pseudonym_id VARCHAR(64) UNIQUE NOT NULL, -- Anonymized ID for Chapter 4 research dataset exports
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'instructor', 'admin')),
    year_level INT NOT NULL CHECK (year_level IN (1, 2, 3, 4)),
    semester INT NOT NULL CHECK (semester IN (1, 2)),
    enrolled_language VARCHAR(10) NOT NULL CHECK (enrolled_language IN ('cpp', 'python', 'java')),
    xp_points INT NOT NULL DEFAULT 0,
    current_level INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INSTRUCTIONAL DOCUMENTS (Syllabi & Lecture Modules)
CREATE TABLE instructional_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    title VARCHAR(255) NOT NULL,
    language_tag VARCHAR(10) NOT NULL CHECK (language_tag IN ('cpp', 'python', 'java')),
    storage_path TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. DOCUMENT CHUNKS (RAG Vector Store)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES instructional_documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content_text TEXT NOT NULL,
    token_count INT NOT NULL,
    embedding vector(768) NOT NULL, -- Must match the configured model's output dimension
    embedding_model VARCHAR(50) NOT NULL DEFAULT 'gemini-embedding-2',
    embedding_dim INT NOT NULL DEFAULT 768,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vector Cosine Similarity Search Index
CREATE INDEX idx_document_chunks_embedding 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- 4. LEARNING ACTIVITIES (Quizzes & Challenges)
CREATE TABLE learning_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_document_id UUID REFERENCES instructional_documents(id) ON DELETE SET NULL,
    activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('quiz', 'challenge')),
    language VARCHAR(10) NOT NULL CHECK (language IN ('cpp', 'python', 'java')),
    quiz_questions_json JSONB, -- Quiz questions; correct answers remain server-side
    topic_concept VARCHAR(100) NOT NULL,
    difficulty_level INT NOT NULL CHECK (difficulty_level BETWEEN 1 AND 5),
    sequence_order INT NOT NULL DEFAULT 1,
    review_status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'reviewed', 'published')),
    reference_solution_code TEXT,
    judge0_verified BOOLEAN NOT NULL DEFAULT FALSE, -- Must pass automated sandbox execution before approval
    reviewed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TEST CASES (Automated Assessment Test Suite)
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    stdin TEXT NOT NULL DEFAULT '',
    expected_stdout TEXT NOT NULL,
    time_limit_ms INT NOT NULL DEFAULT 2000,
    memory_limit_kb INT NOT NULL DEFAULT 128000,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ACTIVITY ATTEMPTS (Append-Only Historical Performance Log)
CREATE TABLE activity_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL,
    submitted_code TEXT,
    quiz_answers_json JSONB,
    passed_test_cases INT NOT NULL DEFAULT 0,
    total_test_cases INT NOT NULL DEFAULT 0,
    is_successful BOOLEAN NOT NULL, -- Binary outcome variable
    execution_time_ms FLOAT,
    memory_used_kb FLOAT,
    compiler_status_id INT, -- Judge0 status codes (3=Accepted, 5=Time Limit, 6=Compilation Error, etc.)
    time_spent_seconds INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_attempts_student_activity 
ON activity_attempts (student_id, activity_id, created_at);

-- 7. ML PREDICTIONS (Comparative Model Outputs)
CREATE TABLE ml_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    source_attempt_id UUID REFERENCES activity_attempts(id) ON DELETE SET NULL,
    target_activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    features_snapshot_json JSONB NOT NULL,
    logreg_prob FLOAT NOT NULL,
    logreg_pred BOOLEAN NOT NULL,
    rf_prob FLOAT NOT NULL,
    rf_pred BOOLEAN NOT NULL,
    actual_outcome BOOLEAN, -- Populated after subsequent activity attempt completion
    active_sequencer_mode VARCHAR(50),
    recommended_action VARCHAR(50),
    model_version VARCHAR(50) NOT NULL DEFAULT 'v1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. BADGES & STUDENT BADGES (Gamification Elements)
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon_url TEXT NOT NULL,
    xp_bonus INT NOT NULL DEFAULT 50,
    criteria_json JSONB NOT NULL
);

CREATE TABLE student_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, badge_id)
);
```

---

## 6. 7-Phase Development Plan

```
Phase 1: Core Infra & Auth (Days 1–5)
   │
   ▼
Phase 2: Judge0 Assessment Subsystem (Days 6–11)
   │
   ▼
Phase 3: Document RAG & Gemini Content Generator (Days 12–18)
   │
   ▼
Phase 4: Gamification & Rule-Based Sequencer (Days 19–23)
   │
   ▼
Phase 5: Feature Engineering & Comparative ML Pipeline (Days 24–30)
   │
   ▼
Phase 6: Shadow ML Evaluation & Sequencer Review (Days 31–34)
   │
   ▼
Phase 7: VPS Deployment, NEMSU Classroom Study & Evaluation (Days 35–42)
```

### Reconciled Delivery Baseline (Adopted 2026-10-24)

The original product and thesis goals remain in scope. Delivery proceeds through a small, verifiable local stack before RAG, ML activation, or cloud deployment.

**Local development topology**

```text
Next.js (localhost:3000) → FastAPI (localhost:8000) → Local Supabase (CLI, localhost:54321/54322)
                                                   └→ Private Ubuntu VM on D: (Judge0 Extra CE 1.13.1)
```

- `infra/start-local.ps1` starts local Supabase and writes local connection settings. It preserves the VM Judge0 URL/token and does not start a local Judge0 container.
- `infra/configure-judge0-vm.ps1` configures the private VM target; its token stays in ignored `backend/.env.local`.
- `infra/docker-compose.yml` is reserved for later Linux VPS deployment. Every service requires the explicit `vps` Compose profile, so an ordinary `docker compose up` does not start this stack. It currently uses standard Judge0 CE, unlike the development VM's Extra CE, and must be reconciled before that deployment is selected.
- The VM is development infrastructure. A classroom pilot needs a stable, managed host and an explicit network/security review.
- The phase day ranges are planning estimates, not completion dates or evidence of completion.

**Milestone 1 scope**

Seed and verify one published programming challenge per language directly in local Supabase. Verify dry-run and official submission behavior through the browser and database. RAG is deferred to a later milestone and is not required for coding challenges. Deterministic rules remain the active sequencer. ML work is offline until real, consented data exists; any first online evaluation is shadow-only and cannot affect student recommendations.

**Implementation and verification tracker**

`Implemented` means relevant code/configuration exists. `Verified` requires a dated execution log or database evidence under `docs/verification/`. Presence of files alone never marks a phase complete.

| Area | Implementation status | Verification status | Evidence / remaining gate |
|---|---|---|---|
| Nine-table schema and migrations | Implemented | Verified locally | Milestone 1 log records the live local table query. |
| Python, C++, and Java Judge0 client execution | Implemented | Verified against the private VM | Milestone 1 log records Accepted results for two cases per language. |
| Published seed challenges and linked test cases | Implemented | Verified locally | Milestone 1 log records one published challenge and two cases per language. |
| Browser onboarding, dry run, official submission, and persisted attempt effects | Implemented in part | Pending verification | Current profile schema and onboarding have no `consent_accepted` field or approved consent step; resolve this before marking the requested consent check complete. |
| RAG ingestion and Gemini generation | Implemented in part | Pending verification; deferred from Milestone 1 | Requires a configured Gemini key and a separate end-to-end check. |
| ML predictor and student-facing sequencing | Implemented in part | Pending verification; model activation pending | No trained model artifacts are available. The quest submission flow remains rule-based; verify shadow gating before loading any model artifacts. |
| Production deployment and classroom pilot | Planned | Pending verification | Select a managed host, reconcile Judge0 CE variant, and complete readiness review. |

### Phase 1: Core Infrastructure, Auth & Database Setup (Days 1–5)
* **Goal**: Establish the foundational infrastructure, database tables, and authentication shell with role-based routing.
* **Specific Objective**: SO-1.
* **Deliverables**:
  1. Run local Supabase and apply migrations for all 9 physical tables with pgvector enabled. Hosted Supabase is a later staging/pilot decision.
  2. Implement FastAPI backend skeleton (`backend/app/main.py`) with Supabase JWT bearer token verification middleware.
  3. Initialize Next.js frontend with TypeScript, Tailwind CSS, shadcn/ui, and role-based route guards (`/dashboard/student` vs `/dashboard/instructor`).
  4. Build registration/onboarding flow enforcing curriculum alignment (1st Year Sem 1 $\rightarrow$ C++, 1st Year Sem 2 $\rightarrow$ Python, 2nd Year Sem 1 $\rightarrow$ Java).
* **Verification**: Successful registration of student and instructor accounts; backend rejects unauthenticated requests with 401; authenticated requests populate profile metadata.

### Phase 2: Automated Code Assessment Subsystem — Judge0 (Days 6–11)
* **Goal**: Enable isolated execution of C++, Python, and Java code against predefined test cases.
* **Specific Objective**: SO-3.
* **Deliverables**:
  1. For local development, use the private D: Ubuntu VM running Judge0 Extra CE 1.13.1. `infra/docker-compose.yml` is reserved for a later Linux VPS deployment and currently describes standard Judge0 CE.
  2. Build `backend/app/services/judge0/client.py` with batch test-case submission, timeout limits (2000ms), and circuit-breaker fault tolerance.
  3. Develop Frontend Coding Arena (`frontend/src/components/arena/`) using `@monaco-editor/react` with active language locking, sample test-case runner, and final submission handler.
  4. Write execution results into `activity_attempts` as immutable rows.
* **Verification**: Student submits code in C++, Python, and Java; Judge0 returns status (Accepted, Wrong Answer, Time Limit Exceeded, Compilation Error); metrics and outputs correctly logged in database.

### Phase 3: Document-Grounded RAG & Gemini Content Generation (Days 12–18)
* **Goal**: Extract curriculum PDF content, index chunks into pgvector, generate pedagogical activities via Gemini, and enforce instructor review.
* **Specific Objective**: SO-2.
* **Deliverables**:
  1. Build PDF processing service using PyMuPDF (`fitz`) to chunk text into 500–1000 tokens with 15% overlap.
  2. Implement `embed()` in `backend/app/services/ai_rag/embeddings.py` using `gemini-embedding-2` ($768$ dimensions, with `RETRIEVAL_DOCUMENT` and `RETRIEVAL_QUERY`).
  3. Implement `generate()` in `backend/app/services/ai_rag/llm.py` with Structured Outputs (Pydantic schema) for both quizzes and coding challenges.
  4. Implement Automated Pre-Validation: Run generated reference code against generated test cases via Judge0. Only if all pass, set `judge0_verified = True`.
  5. Build Instructor Review Portal in Next.js for inspecting, editing, and publishing draft activities.
* **Verification**: Instructor uploads a PDF; backend extracts chunks and vectorizes; Gemini generates challenge; Judge0 verifies reference solution; activity appears in instructor queue and can be published.

### Phase 4: Gamification Engine & Cold-Start Sequencing (Days 19–23)
* **Goal**: Implement game mechanics (XP, levels, badges) and deterministic rule-based task sequencing for baseline data collection.
* **Specific Objective**: SO-1 & SO-4.
* **Deliverables**:
  1. Build gamification service (`backend/app/services/gamification/`): calculate XP on attempt success, check level thresholds, and unlock achievement badges.
  2. Implement Frontend Gamification UI: Level badge, XP bar, quest map, and unlocked achievement modal.
  3. Implement Rule-Based Sequencing (Rule 9): Advance to next difficulty tier upon passing topic quiz and achieving $\ge 80\%$ test cases on current challenge; otherwise route to remedial challenge.
  4. Enforce rate limiting with `slowapi` on code execution and generation endpoints.
* **Verification**: Student completing a quest receives XP, levels up, unlocks badges, and is presented with the next rule-sequenced challenge.

### Phase 5: Feature Engineering & Comparative ML Pipeline (Days 24–30)
* **Goal**: Build feature extraction pipeline and train/evaluate Logistic Regression vs Random Forest on student performance data.
* **Specific Objectives**: SO-4, SO-5, SO-6, SO-7.
* **Deliverables**:
  1. Implement one canonical `feature_engineering.py` contract shared by training and inference, computing:
     - Historical pass rate in target language/concept.
     - Prior attempt count and average attempts through successful activity completion.
     - Syntax/compilation error ratio vs logic error ratio.
     - Mean execution time and time spent across prior attempts.
     - Preceding topic quiz score percentage.
     - Target difficulty and its delta from the baseline difficulty.
  2. Define binary outcome variable $Y \in \{0, 1\}$ (success on subsequent task $T_n$).
  3. Implement `ml_pipeline/train_compare.py` with nested `GroupKFold` splits grouped by `student_id` to prevent data leakage during evaluation and tuning.
  4. Tune `LogisticRegression` and `RandomForestClassifier` inside each training fold; fit preprocessing only on that fold's training data.
  5. Generate Accuracy, Precision, Recall, F1-Score, ROC-AUC curves, confusion matrices, and versioned joblib/model metadata artifacts.
* **Verification**: The script includes each student's first cold-start outcome. Its synthetic bootstrap fallback is labeled and must not be reported as empirical classroom or thesis evidence; production inference rejects synthetic model artifacts.
  Run `python ml_pipeline/train_compare.py --data-csv <attempts.csv>` for training. The CSV must contain one joined attempt/activity row with `id`, `student_id`, `activity_id`, `attempt_number`, `created_at`, `language`, `topic_concept`, `activity_type`, `difficulty_level`, `is_successful`, `score_percentage`, `error_category`, `compiler_status_id`, `execution_time_ms`, and `time_spent_seconds`. Omitting `--data-csv` generates bootstrap artifacts for development only. Copy trained artifacts into `ml_pipeline/artifacts/` on the deployment host before starting the backend; Compose mounts that folder read-only.

### Phase 6: Shadow ML Evaluation for Task Sequencing (Days 31–34)
* **Goal**: Evaluate trained models without changing student recommendations; deterministic rules remain the active sequencer until real, consented data supports a reviewed activation decision.
* **Specific Objective**: SO-8.
* **Deliverables**:
  1. Load compatible serialized `.joblib` pipelines into backend memory on application startup (`lifespan` handler); keep rule-based sequencing available when artifacts are absent.
  2. Create endpoint `/api/v1/predict/next-task`: extract the student's real-time feature vector, compute predictions from both models, and log an auditable row in `ml_predictions`.
  3. Keep model outputs in offline evaluation or non-interfering shadow mode. Do not activate the adaptive sequencing policy below until validation and research review support it:
     - If Random Forest $P(\text{success}) < 0.40$: recommend remedial practice.
     - If $0.40 \le P(\text{success}) < 0.60$: recommend a standard next task.
     - If $P(\text{success}) \ge 0.60$: recommend advancing to the next level.
  4. Build Instructor Analytics & Model Comparison dashboard displaying model prediction accuracy and student performance trajectories.
* **Verification**: Shadow predictions can be joined to subsequent observed outcomes without changing the rule-based recommendation; analytics reports accuracy only for labeled predictions.

### Phase 7: VPS Deployment, Classroom Study & Evaluation (Days 35–42)
* **Goal**: Deploy production infrastructure, run classroom evaluation with NEMSU CS students, and gather research data for Chapter 4.
* **Specific Objective**: SO-9.
* **Deliverables**:
  1. Deploy Next.js frontend to Vercel (HTTPS) and backend + Judge0 CE + Caddy stack to a 4GB RAM VPS (with 4GB swap enabled).
  2. Administer digital informed consent forms with pseudonymized IDs (`pseudonym_id`) adhering to ethics guidelines.
  3. Conduct controlled classroom sessions with NEMSU CS students across C++, Python, and Java cohorts.
  4. Administer post-intervention functionality and usability questionnaire (System Usability Scale - SUS).
  5. Export anonymized dataset and finalize Chapter 4 empirical results.
* **Verification**: Full end-to-end platform stability during concurrent student classroom usage; SUS survey responses and model performance logs compiled into thesis documentation.

---

## 7. Thesis Objectives Mapping (Chapter 1 Alignment)

| Objective | Title / Focus | Phase | Key Implementation Module |
| :---: | :--- | :---: | :--- |
| **SO-1** | Architecture & User Authentication | Phase 1 | `backend/app/core/security.py`, Supabase Auth |
| **SO-2** | Document-Grounded RAG & Generation | Phase 3 | `backend/app/services/ai_rag/`, Gemini API |
| **SO-3** | Automated Code Assessment | Phase 2 | `backend/app/services/judge0/`, Judge0 CE |
| **SO-4** | Student Performance Feature Extraction | Phase 5 | `backend/app/services/ml_predictor/feature_engineering.py` |
| **SO-5** | Logistic Regression Predictive Modeling | Phase 5 | `ml_pipeline/train_compare.py` (LogReg) |
| **SO-6** | Random Forest Predictive Modeling | Phase 5 | `ml_pipeline/train_compare.py` (RandomForest) |
| **SO-7** | Empirical Model Performance Comparison | Phase 5 | `ml_pipeline/artifacts/metrics.json`, ROC-AUC |
| **SO-8** | Adaptive Task Sequencing Integration | Phase 6 | `backend/app/api/ml_analytics.py`, `backend/app/services/ml_predictor/` |
| **SO-9** | Platform Deployment & Usability Evaluation | Phase 7 | Vercel + VPS Caddy Stack, NEMSU CS Study |

---

## 8. Development Environment & Quickstart Commands

### Prerequisites
- Node.js 20+ & npm / pnpm
- Python 3.11+
- Docker Engine & Docker Compose
- Supabase Account & Google Gemini API Key

### Backend Setup
```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install fastapi uvicorn sqlalchemy psycopg2-binary google-genai pymupdf pydantic pydantic-settings tenacity slowapi scikit-learn joblib httpx pytest
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Infrastructure Setup
```bash
cd infra
docker compose up -d
```

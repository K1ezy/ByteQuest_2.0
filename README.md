# ByteQuest 2.0

> **An Intelligent, Gamified Programming Learning Platform with Automated Assessment and Adaptive Task Sequencing**  
> Computer Science Thesis System — North Eastern Mindanao State University (NEMSU)

[![Repository](https://img.shields.io/badge/GitHub-K1ezy%2FByteQuest__2.0-blue.svg)](https://github.com/K1ezy/ByteQuest_2.0.git)
[![Architecture](https://img.shields.io/badge/Architecture-MASTER__PLAN-emerald.svg)](docs/MASTER_PLAN.md)

---

## 📌 Overview

ByteQuest 2.0 is an intelligent educational programming environment tailored for undergraduate computer science students. It integrates:
1. **Automated Assessment Subsystem**: Sandboxed code execution for C++, Python, and Java powered by **Judge0 CE**.
2. **Document-Grounded RAG Content Generator**: Dynamic generation of curriculum-aligned quizzes and programming challenges grounded in uploaded instructional documents using **Google Gemini** (with mandatory automated pre-validation and instructor review gates).
3. **Gamification Mechanics**: XP progression, level milestones, quest maps, and achievement badges to incentivize persistent practice.
4. **Adaptive Task Sequencing**: Empirical comparative machine learning pipeline (**Logistic Regression vs. Random Forest**) to predict student task success and dynamically recommend foundational scaffolding or advanced quests.

---

## 🏗️ Repository Architecture

```
ByteQuest_2.0/
├── docs/
│   └── MASTER_PLAN.md          # Master architecture plan, rules, schema & 7-phase roadmap
├── infra/
│   ├── docker-compose.yml      # FastAPI, Caddy (auto-HTTPS), Judge0 CE, Redis & Postgres
│   ├── Caddyfile               # Production reverse proxy config for VPS
│   └── judge0.conf             # Resource constraints (CPU/memory) & sandbox worker config
├── frontend/                   # Next.js (TypeScript), Tailwind CSS, Monaco Editor, TanStack Query
├── backend/                    # FastAPI + SQLAlchemy (Supabase PostgreSQL + pgvector)
│   └── app/
│       ├── api/                # REST routers (auth, quests, judge, rag, analytics, predict)
│       ├── core/               # Configuration, Supabase JWT verification, rate limiting
│       ├── models/             # SQLAlchemy ORM models (8 core tables)
│       ├── schemas/            # Pydantic schemas (request/response validation)
│       └── services/
│           ├── ai_rag/         # Gemini RAG, embeddings (768-dim), PyMuPDF chunker
│           ├── judge0/         # Isolated code runner & reference solution pre-validator
│           ├── gamification/   # XP calculations, levels, badge awards, rule-based sequencer
│           └── ml_predictor/   # Real-time feature extractor & .joblib model inference
└── ml_pipeline/                # Offline training & empirical evaluation (Thesis Chapter 4)
    ├── train_compare.py        # GroupKFold(n_splits=5), GridSearchCV, LogReg vs. Random Forest
    ├── feature_engineering.py  # Shared feature extractor (zero train-serve skew)
    └── artifacts/              # Serialized models (.joblib) and metrics (Accuracy, F1, ROC-AUC)
```

---

## 📜 Architectural Invariants (The 9 Rules)

1. **Configurable LLM & Structured Outputs**: Gemini API calls use `GEMINI_MODEL_ID` (default: `gemini-2.5-flash`), Pydantic Structured Outputs, and `tenacity` exponential backoff.
2. **Dual-Mode Semantic Embeddings**: Chunks indexed via `gemini-embedding-2` ($768$ dimensions) using `RETRIEVAL_DOCUMENT`, queries evaluated using `RETRIEVAL_QUERY`.
3. **Isolated Code Execution Sandbox**: Judge0 CE bound strictly to internal Docker networks on a cgroup v1 host; timeouts & circuit breakers enforced.
4. **Centralized Backend Gatekeeping**: All database mutations and external AI/Judge0 operations route through FastAPI with Supabase JWT validation.
5. **Immutable Logging & Zero Data Leakage**: Append-only `activity_attempts`; shared `feature_engineering.py` between training and serving; GroupKFold by `student_id`.
6. **Automated Pre-Validation & Instructor Approval**: Generated challenges must be pre-validated by Judge0 (`judge0_verified = True`) and approved by instructors before students can view them.
7. **API Resilience & Rate Limiting**: Exponential backoff on external APIs and `slowapi` rate limits per student.
8. **Ethical Compliance & Student Privacy**: Informed consent for NEMSU CS students; research datasets use `pseudonym_id` keys.
9. **Cold-Start Fallback Sequencing**: Rule-based challenge progression precedes live ML inference during initial classroom data collection.

---

## 🚀 Quickstart & Setup

Refer to [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) for full phase-by-phase deliverables, database DDL, and team tracking workflows.

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
# On Windows:
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Infrastructure & Sandbox
```bash
cd infra
docker compose up -d
```

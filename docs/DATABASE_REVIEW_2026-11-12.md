# ByteQuest 2.0 database review — 12 November 2026

Scope: the 18 migration files, live local PostgreSQL catalog, 29 SQLAlchemy models, the submission/exam/ML paths, relevant API queries and tests, and Chapter 3 draft. **Verified** means inspected in code or the local catalog. **Inferred** means a scale or future-workload estimate. This is a review of the local thesis system, not a production certification.

## A. Inventory

**Verified corrections to the supplied inventory.** The local server is PostgreSQL **17.11**, matching `supabase/config.toml` (`major_version = 17`), not 15. There are 30 public tables, 29 mapped models, 94 indexes including primary keys, 61 CHECK constraints, 58 foreign keys, 52 foreign keys with explicit non-default `ON DELETE`, 30 primary keys, and 20 unique constraints. The migrations contain 18 files, 1,076 physical lines, 41 ordinary and 8 unique `CREATE INDEX` statements. All 18 versions appear in `supabase_migrations.schema_migrations`. All 30 public tables have RLS enabled and zero policies. There are two public triggers, one Auth trigger, three public functions, and the four named enums. The database is about 17 MB. **The backend's actual local SQL login is `postgres`, not `service_role`** (`database_url.username` returned `postgres`); that role has `BYPASSRLS` and memberships in several Supabase roles. `api_rate_counters` deliberately uses a single raw-SQL atomic upsert in `backend/app/core/quotas.py`; no ORM model is needed.

**Scale assumption.** One institution, roughly 300 active students, 10 courses, 3,000 graded activity attempts per term, and at most a few hundred exams/materials. These are **inferences**, not measurements. Live counts below are exact `count(*)` results from 12 November. “Retire” describes current practice or a needed policy; it never authorizes deleting append-only attempts.

| Table (live; expected per term) | Purpose and relationships | Writer → reader; row retirement |
|---|---|---|
| `profiles` (29; ~300–500) | Identity, role, display name, pseudonym and gamification state; `id` refers to `auth.users`. | Signup/Auth provisioning and API → nearly all APIs; deactivate, with hard deletion constrained by history. |
| `courses` (2; ~10) | Named authorization and content scope. | Admin → student/faculty APIs; archive. |
| `course_members` (23; ~300–1,000) | Student enrollment and instructor assignment, referencing course and profile. | Admin → authorization/rosters; mark removed. |
| `audit_events` (20; ~10,000+) | Actor/action trail for workspace operations. | API → admin and personal audit; archive by a written retention rule. |
| `platform_settings` (5; ~5–20) | Typed operational settings and version. | Admin/seed → API services; update in place. |
| `api_rate_counters` (103; active windows in hundreds/thousands) | Per-account/global quota windows. | Atomic raw SQL quota reservation → quota checks; expired rows cleaned by quota code. |
| `instructional_documents` (9; ~100) | Uploaded PDF versions, course ownership and ingestion state. | Faculty/admin upload → RAG/workspace; archive. |
| `document_chunks` (68; ~10,000) | Text passages and 768-dimensional embeddings belonging to documents. | PDF indexer → RAG; cascade with an intentionally removed document. |
| `learning_activities` (11; ~500) | Versioned quizzes/challenges, schedules, authors and course scope. | Faculty authoring → student/faculty/ML; archive or close, retain referenced history. |
| `activity_drafts` (4; ~300 active) | One saved source draft per student and activity. | Student autosave → student; replace/clear after lifecycle policy. |
| `test_cases` (16; ~2,000) | Ordered judge inputs and expected outputs for an activity. | Faculty authoring → Judge0 grading; follow activity version. |
| `challenge_hints` (0; ~1,000) | Reviewed hint slots for challenges. | Faculty authoring → student hint API; follow activity. |
| `quest_groups` (2; ~20) | Join-code groups for quest/exam assignment. | Instructor → group/exam APIs; no documented retirement rule. |
| `quest_group_members` (3; ~300–1,000) | Profile membership in quest groups. | Student/instructor → group/exam APIs; currently cascades on group/profile deletion. |
| `quest_group_activities` (9; ~500) | Activities attached to quest groups. | Instructor → quest map; currently cascades on group/activity deletion. |
| `activity_attempts` (13; ~3,000) | Immutable quiz/challenge/exam-item result, student and activity. | Submission/exam worker → progress, grades, ML; **never update or delete**. |
| `submission_jobs` (22; ~3,000) | Idempotent Judge0 work queue and retry/result state. | Student API/worker → status/student home; retain through result audit window, then archive by policy. |
| `hint_uses` (0; ~1,000) | Student hint request history and idempotency key. | Hint API → student history; retain with learning history. |
| `exams` (0; ~50) | Published exam window and overall result-release marker. | Instructor → exam APIs; retain once attempted. |
| `exam_items` (0; ~500) | Ordered, snapshotted activity item and points in an exam. | Instructor → grader/student exam; retain once attempted. |
| `exam_assignments` (0; ~100) | Exam-to-quest-group availability. | Instructor → access checks; retain as audit context after exam. |
| `exam_attempts` (0; ~300–1,000) | Timed learner exam state, answers, score and release time. | Student API/exam worker/instructor release → student/faculty/ML; retain. |
| `exam_retake_grants` (0; ~100) | Per-student authorized extra exam attempts and window. | Instructor → exam start checks; retain with exam audit. |
| `exam_sample_runs` (0; ~1,000) | Rate/accounting record for an exam code sample run. | Student API → quota checks; retention policy needed. |
| `badges` (3; ~10–50) | Catalog of achievement criteria and XP bonus. | Seed/admin → badge evaluation; retire only with explicit policy. |
| `student_badges` (4; ~300–1,000) | Unique badge awards per student. | Badge evaluator → student profile; retain as reward history. |
| `research_consents` (0; ~300–1,000 events) | Ordered acceptance, decline or withdrawal with document version. | Student consent API → ML gates/export; retain audit history. |
| `ml_predictions` (0; 0 until approval, then up to ~3,000) | Shadow forecast, feature snapshot, model identity and observed outcome. | Post-commit scorer/outcome linker → faculty evaluation; retention/withdrawal policy needed. |
| `notification_outbox` (0; ~1,000) | Deduplicated email/in-app notice delivery attempts. | Exam release/API → email worker/student home; archive by policy. |
| `processing_jobs` (2; ~100) | Document/activity background job state and trace. | Faculty/admin API/worker → admin workspace; archive after operational window. |

### End-to-end traces

- **Activity submission:** `submission_jobs` reserves idempotent work; `submission_worker.py` claims queued rows with `FOR UPDATE SKIP LOCKED`; `submissions.py` locks the profile, inserts an append-only `activity_attempts` row, updates XP and badge awards in the same transaction, then commits. Only after that commit does `shadow.py` optionally score and save `ml_predictions`. The unique attempt number and job linkage constrain duplicates. A failed shadow transaction cannot undo a grade.
- **Exam:** `exams.py` checks group assignment and window, locks the student profile when starting, and creates a numbered `exam_attempts` row. Submit moves active to grading; `exam_worker.py` claims/grades and commits. Instructor release locks the exam and releases scored attempts; `exam_attempts.result_released_at` gates student/faculty visibility and ML history. `exam_items.snapshot_json` preserves presented content. The status CHECK limits values, while transitions are application guarded.
- **ML:** Current consent and approval are checked before feature extraction; a validated active artifact scores after a committed event. `ml_predictions` stores both model outputs and a selected winner; `audit.py` labels pending rows at the first later target outcome. Faculty endpoints recheck current consent and active course membership, and never infer or train on GET. Rule-based `gamification/sequencer.py` remains the only student sequencer.

**Concurrency/transaction verdicts where no defect was established.** Activity attempt numbering and XP updates serialize on the profile row; the unique `(student_id,activity_id,attempt_number)` index is a final safeguard. Badge evaluation takes the same lock and uses `ON CONFLICT DO NOTHING` against a unique award key. Exam start locks the profile and uses a unique `(exam_id,student_id,attempt_number)` key. Quota reservation is one atomic upsert transaction, not a check-then-insert. Job and email workers claim rows with `FOR UPDATE SKIP LOCKED`, so two workers do not normally process the same row concurrently. `get_db()` does not commit on its own; explicit commits in submission/exam handlers define the grade boundary. The email worker holds its row lock through SMTP and then commits: if SMTP accepts a message but the final DB commit fails, a retry can send it twice. That is at-least-once external delivery, and no SQL-only transaction can make SMTP and PostgreSQL atomic; document it or use a provider with idempotency keys if exactly-once delivery is required.

## B. Findings

Numbered continuously. **Review-gated** means the proposed change affects visible behavior or research inclusion and is not in the new migration.

### Must fix

**1. Backend SQL credential has broader access than application data** (`backend/app/core/config.py:24`; `backend/app/core/database.py:7-25`). What this is: the local FastAPI connection logs in as `postgres`, a role with `BYPASSRLS`, `CREATEROLE`, and memberships including Supabase administrative roles; it is **not** a service-role SQL connection. **Problem:** if a backend SQL injection or leaked DB URL occurs, the credential can reach Auth/other Supabase schemas beyond ByteQuest's 30 public tables. RLS does not protect against that login. **Fix (review-gated deployment change):** provision a separate application login with a secret from deployment configuration, grant only required public-schema CRUD and sequence privileges, and switch `DATABASE_URL`. Its ability to bypass RLS is necessary while there are zero policies, but it must have no Supabase administrative memberships. Target SQL for a reviewed deployment script (not a migration, because the password must not be committed):

```sql
CREATE ROLE bytequest_api LOGIN BYPASSRLS PASSWORD :'db_password';
GRANT USAGE ON SCHEMA public, extensions TO bytequest_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bytequest_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bytequest_api;
```

Future migrations must grant any new table explicitly. Test the API plus workers with the new URL, and verify `SELECT` from `auth.users` fails for that role. **Cost of skipping:** one application secret compromises more than application data. This finding concerns privilege scope, not evidence of an existing SQL injection.

**2. Training export omitted individual consent — fixed 13 November** (`ml_pipeline/README.md`). What this is: the documented SQL for the offline dataset previously joined attempts to profiles but not the latest consent event. **Problem:** a withdrawn learner with prior attempts was included if an operator followed the old export; `--research-approved` only attests general approval. **Fix applied:** both export queries now select the latest consent event by `event_order` and require acceptance of the bound current document version:

```sql
WITH latest_consent AS (
  SELECT DISTINCT ON (student_id) student_id, choice, document_version
  FROM public.research_consents
  ORDER BY student_id, event_order DESC
)
-- In each export's FROM/JOIN list:
JOIN latest_consent cc ON cc.student_id = p.id
  AND cc.choice = 'accepted'
  AND cc.document_version = :current_consent_version
```

The exam query includes the same gate alongside its existing `course_exams` CTE. `backend/tests/test_ml_export_consent.py` executes both documented queries against rollback-only synthetic fixtures; the focused test passed. **Cost if regressed:** consent withdrawal would no longer prevent research export. This is an export-documentation defect, not evidence that a real export occurred.

**3. History FKs conflict with append-only and account/content deletion** (`activity_attempts.student_id`, `activity_attempts.activity_id`, `exam_attempts.exam_id`, `ml_predictions.student_id`). What this is: many history rows cascade when a profile, activity or exam is deleted, while an attempt trigger forbids attempt deletion/update. **Problem:** deleting a profile with an attempt fails partway at the trigger; deleting a never-attempted profile with consent or forecasts silently removes those research/audit rows. Deleting an exam with attempts can remove exam records and can collide with the attempt trigger via `SET NULL`. **Fix (review-gated):** adopt an explicit retention/erasure policy, use existing deactivate/archive fields for routine removal, then convert protected history FKs to `RESTRICT`. Example SQL for one edge:

```sql
ALTER TABLE public.ml_predictions
  DROP CONSTRAINT ml_predictions_student_id_fkey,
  ADD CONSTRAINT ml_predictions_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
```

Apply the same decision consistently to consent, exam and attempt provenance after testing actual erasure requirements. **Cost of skipping:** destructive paths behave inconsistently and learning/research evidence can disappear. Do not apply a partial FK change as a complete retention policy.

**4. Consent can change between eligibility check and scoring** (`backend/app/services/ml_predictor/shadow.py:91-101,170-192`; `backend/app/api/pilot.py:304-329`). What this is: both consent events and optional shadow scoring run at normal read-committed isolation. **Problem:** scorer reads accepted event; student commits a withdrawal; scorer then reads graded history and inserts a prediction. Scoring used data after withdrawal. **Fix (review-gated):** serialize consent writes and scoring on the same profile row lock, acquired before reading the latest consent, and recheck consent while holding it. In both consent POST handlers, run `db.query(Profile).filter(Profile.id == user.id).with_for_update().one()` before their latest-event query; in `record_shadow_prediction`, lock `Profile.id == student.id` before its latest-consent query. Preserve the post-grade separate transaction. **Cost of skipping:** a narrow but real consent race. A test should pause scoring after consent read and commit withdrawal on another connection.

**5. Exam attempt domain permits impossible rows** (`supabase/migrations/20261028000200_pilot_exams.sql`, `exam_attempts`). What this is: the DB checks status vocabulary but does not check positive attempt numbers, nonnegative revision, time ordering or score bounds. **Problem:** a backend SQL bug can insert attempt 0 with `due_at < started_at`, or release a submitted score of -10/100; downstream views and ML calculate from it. **Fix (review-gated):** after checking existing data, add named checks:

```sql
ALTER TABLE public.exam_attempts
  ADD CONSTRAINT ck_exam_attempt_number_positive CHECK (attempt_number > 0),
  ADD CONSTRAINT ck_exam_revision_nonnegative CHECK (revision >= 0),
  ADD CONSTRAINT ck_exam_due_after_start CHECK (due_at > started_at),
  ADD CONSTRAINT ck_exam_score_bounds CHECK (
    (score IS NULL AND max_score IS NULL)
    OR (score >= 0 AND max_score > 0 AND score <= max_score)
  );
```

The score rule requires validating whether failed/grading rows can intentionally have a partial score. **Cost of skipping:** the database accepts contradictory exam evidence.

**6. Per-document vector search can underfill results** (`supabase/migrations/20261022000000_core_schema.sql:163,219-240`; `backend/app/api/rag_instructor.py:238-239`). What this is: HNSW is an approximate nearest-neighbor index using cosine distance (`vector_cosine_ops`, `<=>`), matching the application's metric. **Problem:** the index searches globally, then `document_id`/language filters remove neighbors; a document with relevant chunks can return fewer than `match_count` when many other documents have nearer vectors. **Fix (review-gated):** force filtering to one document before exact distance ordering, using a materialized CTE in both SQL paths:

```sql
WITH scoped AS MATERIALIZED (
  SELECT chunk.embedding, chunk.content_text
  FROM public.document_chunks chunk
  JOIN public.instructional_documents doc ON doc.id = chunk.document_id
  WHERE doc.id = filter_document_id
    AND doc.language_tag::text = filter_language
)
SELECT content_text
FROM scoped
WHERE 1 - (embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
ORDER BY embedding OPERATOR(extensions.<=>) query_embedding
LIMIT GREATEST(match_count, 0);
```

The existing unique `(document_id, chunk_index)` index supports the document filter. Keep HNSW only if an unscoped search actually needs it; there is no scale benchmark yet. **Cost of skipping:** incomplete retrieved evidence for AI answers.

### Should fix

**7. Faculty ML snapshot runs one exam query per learner** (`backend/app/api/faculty_ml.py:243`; `backend/app/services/ml_predictor/exam_history.py:39-68`). What this is: `released_exam_history` queries a single student and is called inside the roster loop. **Problem:** 300 learners yield ~300 exam round trips before serialization; request latency grows with class size even if there are no released exams. **Fix:** add a batch helper using `ExamAttempt.student_id.in_(student_ids)`, existing `exam_ids`, release filters and one ordered query; group results by student ID, then read the grouped dict in the loop. Keep single-student helper for feature extraction/detail. **Cost of skipping:** instructor page latency scales linearly with roster. This is a query-shape inference, not a measured 300-student benchmark.

The core of that helper is one query, with the existing score/positive-max-score conversion retained:

```python
rows = (
    db.query(ExamAttempt, Exam)
    .join(Exam, Exam.id == ExamAttempt.exam_id)
    .filter(
        ExamAttempt.student_id.in_(student_ids),
        ExamAttempt.exam_id.in_(exam_ids),
        ExamAttempt.status == "submitted",
        ExamAttempt.submitted_at.is_not(None),
        ExamAttempt.result_released_at.is_not(None),
        ExamAttempt.submitted_at <= ExamAttempt.result_released_at,
    )
    .order_by(ExamAttempt.student_id, ExamAttempt.result_released_at, ExamAttempt.id)
    .all()
)
by_student = defaultdict(list)
for attempt, exam in rows:
    if attempt.score is not None and attempt.max_score and attempt.max_score > 0:
        by_student[attempt.student_id].append({
            "exam_attempt_id": str(attempt.id), "title": exam.title,
            "created_at": attempt.result_released_at,
            "score_percentage": round(attempt.score / attempt.max_score * 100, 2),
        })
```

**8. Three repeated read paths lack leading indexes** (`profile_attention.py:250`, `pilot.py:69-85`). What this is: personal audit, student notices, and pending Judge0 lookup filter by actor/recipient/student and order by time. **Problem:** the current 20-row `audit_events` and empty `notification_outbox` explain as sequential scan plus sort; at inferred 10,000 audit rows, every personal timeline can scan the full trail. Global `(status,created_at)` submission indexes do not target one student. **Fix:** the accompanying migration adds `(actor_id,created_at DESC,id DESC)`, `(recipient_id,next_attempt_at DESC)`, and `(student_id,status,created_at DESC)` respectively. **Cost of skipping:** growing read cost and request latency. The local plans are evidence of query shape only, not measured scale improvement.

**9. Browser-role grants drifted after the API-only security migration** (`supabase/migrations/20261029000100_faculty_admin_workspace.sql:29-165`). What this is: `anon` and `authenticated` still have table privileges on five later-created workspace tables. **Problem:** RLS currently returns zero rows (verified `SET ROLE anon; SELECT count(*) FROM public.courses` while postgres sees 2), but adding a permissive policy later would expose them without a second grant. **Fix:** the accompanying migration revokes grants from those five tables. Keep RLS enabled with zero policies; do **not** generate 30 client policies. **Cost of skipping:** a fragile access boundary. The backend connection uses privileged credentials and must remain secret; `postgres`/Studio and `service_role` bypass or administer RLS, so operational access is the trust boundary.

**10. Missing source-attempt uniqueness for ML snapshots** (`ml_predictions.source_attempt_id,target_activity_id`; `20261111154648_usernames_ml_dashboard.sql:22`). What this is: exam-source predictions have a partial unique index, activity-source predictions do not. **Problem:** two optional scorer invocations for the same committed source and target insert two snapshots; observed evaluation counts both as separate predictions. **Fix (review-gated):** check for duplicates, then add:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ml_predictions_source_activity_target_unique
ON public.ml_predictions (source_attempt_id, target_activity_id)
WHERE source_attempt_id IS NOT NULL;
```

Keep the existing caught optional failure so grades are unaffected. **Cost of skipping:** inflated forecast/evaluation counts. The local ML table is empty, so no existing duplicates were observed.

**11. ORM type, FK and index metadata diverge from live DDL** (`backend/app/models/entities.py:352,667-668` and `index=True` columns). What this is: the database declares `platform_settings.min_value/max_value NUMERIC`, but ORM declares `Float`; live `activity_attempts.submission_job_id` had a `SET NULL` foreign key that the ORM omitted; SQLAlchemy metadata also advertises indexes absent from migrations (for example `ix_exam_attempts_exam_id`, `ix_submission_jobs_student_id`) while migrations supply other composite indexes. **Problem:** a 0.1 setting boundary can undergo binary-float conversion in ORM code, and `create_all`/schema diff tools would not describe the real FK/index design. **Fix:** the ORM-only FK correction is included with this review; change the two numeric mappings to `Numeric` and explicitly convert to float only where API contracts require it; remove stale `index=True` declarations where a real composite/unique prefix serves the predicate, or define the real index in metadata. Do not create every phantom index. **Cost of skipping:** inaccurate model metadata and potential boundary/serialization differences. **Verified comparison:** after the FK edit, all mapped foreign keys and `ON DELETE` rules agree; no missing ORM columns, string-length/enum/timestamp-zone/nullability disagreement was found. Review Decimal serialization before applying the numeric code change.

**12. Several indexes duplicate a leftmost unique/composite prefix** (`pg_indexes`; `entities.py`). What this is: a btree index can filter on its leftmost columns. **Problem:** inserts into hints, group membership, group activities and ML snapshots maintain extra structures for equivalent equality predicates. **Fix, after production workload review:**

```sql
DROP INDEX IF EXISTS public.ix_hint_uses_student_activity;
DROP INDEX IF EXISTS public.ix_quest_group_members_group_id;
DROP INDEX IF EXISTS public.ix_quest_group_activities_group_id;
DROP INDEX IF EXISTS public.ix_ml_predictions_student_id;
DROP INDEX IF EXISTS public.ix_research_consents_student_created;
```

The covering indexes are respectively `uq_hint_use_request`, `uq_quest_group_member`, `uq_quest_group_activity`, `idx_ml_predictions_student_target_created`, and `ix_research_consents_student_order`. Remove corresponding ORM `index=True` declarations. **Cost of skipping:** extra write, vacuum and storage cost; local index usage statistics are not enough to quantify the savings. These drops are recommendations only, not in the prepared migration.

**13. Growth tables lack approved retention rules** (`audit_events`, `submission_jobs`, `notification_outbox`, `ml_predictions`, `exam_sample_runs`). What this is: rows accumulate without a documented retention/archival decision. **Problem:** after multiple terms, operational scans and backups grow indefinitely; feature snapshots and notice bodies retain sensitive learner content longer than justified. **Fix (review-gated):** approve per-table periods and legal/research holds; archive by time and status with a manifest and count reconciliation, then write a separately reviewed maintenance job. Never purge `activity_attempts` or consent evidence implicitly. **Cost of skipping:** privacy and operational exposure. No arbitrary duration or destructive SQL is proposed here.

**14. Database-enforced rules lack direct regression tests** (`backend/tests/test_schema_integrity.py`; `20261022000000_core_schema.sql:203-217`). What this is: tests cover timestamp and username constraints, but the append-only trigger itself has no test that fails if the trigger is removed; exam CHECKs and RLS denial also lack comparable focused tests. **Problem:** a migration removes the trigger or grants a policy and API-flow tests can still pass. **Fix:** add rolled-back transaction tests that attempt update/delete of an attempt and assert SQLSTATE 55000, insert invalid exam state and assert CHECK violation, and `SET LOCAL ROLE anon` to assert RLS denial. **Cost of skipping:** core DB invariants can regress silently. Do not run the existing concurrent username test against a valuable database; it commits and later cleans up real Auth rows.

### Nice to have

**15. Legacy mirrors and names obscure the schema story** (`instructional_documents.status`; `ml_predictions.active_sequencer_mode/recommended_action`). What this is: `status` is documented as a write-only legacy mirror; the two ML columns are written but no production reader was found after repository-wide text search. **Problem:** an analyst can choose `status='ready'` instead of authoritative `processing_status='completed'`, or mistake a stored advisory action for the rule-based student sequencer. **Fix (review-gated):** document these as deprecated in the data dictionary and remove writers/readers in a separately reviewed release before any column drop. **Cost of skipping:** ambiguous thesis diagrams and future queries. The ML columns may still be useful for audit, so do not call them safe to delete solely from code grep.

**16. Chapter 3 still names an undecided database/backend** (`docs/manuscript/Chapter-3.pdf`, page 17). What this is: the draft says TiDB Cloud and Node/Express are to be confirmed. **Problem:** a panel can compare that page with this PostgreSQL/FastAPI implementation and find an unexplained architecture mismatch. **Fix:** update the final manuscript architecture, ER diagram and data dictionary to PostgreSQL 17 local Supabase plus FastAPI, with the RLS/API boundary and research export described accurately. **Cost of skipping:** a defensibility gap, not a runtime fault.

Five smaller naming/index tidy-ups were cut because no concrete failing input or meaningful term-scale cost was established. In particular, no blanket index on every unindexed FK is justified: 21 single-column FKs lack a leading index, but many parent deletes are rare or intentionally restricted.

## C. Migration plan

Prepared, **not executed**: `supabase/migrations/20261112235900_database_access_and_read_indexes.sql`. It applies after the 18 existing files, is idempotent (`REVOKE` and `CREATE INDEX IF NOT EXISTS`), and is safe with current data. It touches no learner row and requires no matching `entities.py` runtime change because migrations are the schema source of truth. An independent ORM-only edit now maps the existing `activity_attempts.submission_job_id` FK; it adds no SQL. If metadata is used for schema comparison, add matching `Index(...)` declarations to `AuditEvent`, `NotificationOutbox` and `SubmissionJob`; do not call `create_all` against an existing database.

Finding 2 is fixed in export documentation and a focused test, with no migration. The SQL for findings 1, 3–6, 10 and 12 remains review-gated: it changes deployment credentials, deletion semantics, exam acceptance, retrieval, or evaluation counts. Review those decisions and existing-data queries first. For finding 11, the matching ORM edit is `from sqlalchemy import Numeric` and `min_value = Column(Numeric, nullable=True)`, `max_value = Column(Numeric, nullable=True)`; the database already has that type. For finding 7, the change is a batched service query, not DDL.

Migration history is chronological and forward-only. The baseline's naive timestamps and nullable badge code are explicitly superseded by `20261111000100_timestamp_and_state_integrity.sql`; the ML analytics index statements in `20261023000200_ml_analytics.sql` repeat baseline `IF NOT EXISTS` declarations; the document `status` mirror is marked deprecated. Do not edit old files. Keep one short migration per invariant or measured index group, and maintain this review/data dictionary as the readable current-state description.

## D. Index recommendations

| Action | Query/predicate and order | Expected effect (inferred unless stated) | Write cost |
|---|---|---|---|
| Add `ix_audit_events_actor_created_id` (prepared) | `actor_id = ? ORDER BY created_at DESC,id DESC LIMIT 8` | Avoid all-actor scan/sort as audit grows; current plan is seq scan + sort at 20 rows. | One btree entry per audit insert. |
| Add `ix_notification_outbox_recipient_next_attempt` (prepared) | `recipient_id = ? AND next_attempt_at <= now() ORDER BY next_attempt_at DESC LIMIT 5` | Locate one student's due notices; current empty-table plan is seq scan + sort. | One btree entry/update per notice. |
| Add `ix_submission_jobs_student_status_created` (prepared) | `student_id = ? AND status IN (...) ORDER BY created_at DESC` | Student home pending lookup avoids scanning queued work for every student; two status ranges may still need a small merge/sort. | Entry maintenance on job status transitions. |
| Add `ml_predictions_source_activity_target_unique` (review-gated) | Equality on source attempt + target; uniqueness | One snapshot per source/target; prevents duplicate metric units. | Unique probe per shadow insert. |
| Drop five indexes listed in finding 12 (review-gated) | Equality predicates already covered by leftmost columns of surviving unique/composite indexes | Less index maintenance; no claimed measured speedup. | Saves one index update per affected write. |
| Leave HNSW pending retrieval decision | Global cosine nearest-neighbor search; current query is document-scoped | Operator class/distance **match**, but global approximate search conflicts with post-filter. Exact per-document scan is preferable at current document size. | HNSW is expensive on chunk insert and storage. |

No query plan from the 17 MB local database is evidence of production-scale speed. The faculty ML path is dominated by the proven N+1 round trips, not a demonstrated sequential scan. `workspace_queries.py` already batches several faculty lookups with `IN` and `selectinload`. The prediction feature builder queries per scored event, not per dashboard row; at the expected shadow event rate this is bounded, with no measured bottleneck.

Pool settings: `database.py` uses five base connections plus five overflow per process, 30-second checkout, 30-minute recycle, and pre-ping. `supabase/config.toml` disables its local pooler; the backend Dockerfile actually starts **two** Uvicorn workers, so one container can hold up to 20 API connections, plus grading workers. The documented deployment preflight budgets for this. For a single local Uvicorn process, the 10-connection ceiling is conservative; pre-ping costs one round trip at checkout and is useful after container/database restarts, though a local always-up DB might not need it. Do not remove it without restart testing.

## E. Organisation and documentation

Keep six logical groups without moving tables between schemas: identity/authorization (`profiles,courses,course_members,platform_settings,api_rate_counters,audit_events`); authored learning content (`instructional_documents,document_chunks,learning_activities,test_cases,challenge_hints,quest_groups,quest_group_members,quest_group_activities,activity_drafts`); learning records/work (`activity_attempts,submission_jobs,hint_uses`); exams (`exams,exam_items,exam_assignments,exam_attempts,exam_retake_grants,exam_sample_runs,notification_outbox`); rewards (`badges,student_badges`); research/ML (`research_consents,ml_predictions`). Every table above has a one-sentence purpose; none is unjustifiable. `api_rate_counters` is intentionally unmapped.

Naming is mostly plural with `_id` FKs and `*_at` timestamps. Real inconsistencies: `status` vs `processing_status` on documents, `created_at` vs `awarded_at/joined_at/assigned_at` (different event meanings), `submitted_at` vs `result_released_at`, and `metadata` in SQL vs `metadata_json` ORM attribute. Keep the meaningful event-time names; do not rename live columns for cosmetic uniformity. Each rename costs a migration, code/API updates, report/query changes and a compatibility window.

Repository-wide text search included application code, tests, fixtures, seed SQL, migration SQL, and documentation (excluding dependency directories and generated artifacts). It established **no dead table**: each table has a writer and a plausible read/authorization or operational use. The only demonstrated write-only field is `instructional_documents.status`, already deprecated in a migration comment. `ml_predictions.active_sequencer_mode` and `ml_predictions.recommended_action` are written and have no production row reader; they may be audit evidence, so their removal is a policy decision. `api_rate_counters` is used through raw SQL despite its absent ORM class.

Data dictionary skeleton for Chapter 3, one row per column:

| Table.column | Type/null/default | Meaning and allowed values | FK/delete behavior | Writer/reader | Sensitivity/consent | Retention | Enforced by/test |
|---|---|---|---|---|---|---|---|
| `activity_attempts.id` | uuid/not null/generated | Immutable result identifier | PK | grader/history | learner record | retain | append-only trigger / add test |
| `ml_predictions.features_snapshot_json` | jsonb/not null | Canonical feature snapshot at scoring | prediction FK context | shadow scorer/research | restricted, current consent | approve policy | app gate / add race test |

Add an ER diagram with cardinalities; an invariant register (one sentence, DB constraint/trigger or API check, test name); a role-access matrix for `postgres`, `service_role`, `anon`, `authenticated`, Studio and Auth trigger; and a retention schedule. Pseudonymization is **not anonymity**: `profiles` holds both `id` and `pseudonym_id`, so access to that mapping must stay restricted. Training artifacts must contain pseudonyms only. The app's forecast API correctly does not expose `features_snapshot_json`.

## F. Verification

Performed read-only catalog queries, exact per-table counts, grant inspection, `EXPLAIN` without `ANALYZE`, ORM-versus-catalog column/nullability/type/default comparison, text searches across code/tests/fixtures/seed/docs, and one read-only test: `backend/tests/test_schema_integrity.py::test_every_public_timestamp_column_is_aware` **passed**. No migration was applied; no live `DROP`, `TRUNCATE`, `DELETE` or `ALTER` was run. One initial pytest invocation from repository root failed at import (`ModuleNotFoundError: app`); rerunning from `backend/` passed.

On 13 November, `backend/tests/test_ml_export_consent.py` **passed** against local PostgreSQL. It inserted only synthetic fixtures inside one outer transaction and rolled them all back. It executed both README SQL blocks and checked required binding, current acceptance, withdrawal, old-version exclusion, missing consent, renewed acceptance and an unmatched version.

Run on a **disposable local stack**, not the present live database:

```powershell
supabase db reset
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_schema_integrity.py tests/test_learning_flow_integration.py tests/test_ml_exam_features.py tests/test_faculty_admin.py -q
```

The reset is intentionally left to the owner. Other existing suites that must remain green after behavior-gated changes: `test_signup_username.py` (if present), exam/submission integration, consent withdrawal, faculty course isolation, and model artifact rejection. Confirm names with `rg --files backend/tests` before running. Some existing tests commit and clean up Auth records, so use a disposable database.

Exact catalog/post-migration checks:

```sql
SELECT current_setting('server_version');
SELECT count(*) FROM pg_tables WHERE schemaname='public';
SELECT count(*) FROM pg_indexes WHERE schemaname='public';
SELECT contype, count(*) FROM pg_constraint
 WHERE connamespace='public'::regnamespace GROUP BY contype ORDER BY contype;
SELECT tablename, rowsecurity FROM pg_tables
 WHERE schemaname='public' AND NOT rowsecurity;
SELECT count(*) FROM pg_policies WHERE schemaname='public';
SELECT table_name, grantee FROM information_schema.role_table_grants
 WHERE table_schema='public' AND grantee IN ('anon','authenticated')
 ORDER BY table_name, grantee;
SELECT indexname FROM pg_indexes WHERE schemaname='public'
 AND indexname IN ('ix_audit_events_actor_created_id',
                   'ix_notification_outbox_recipient_next_attempt',
                   'ix_submission_jobs_student_status_created');
EXPLAIN SELECT id FROM public.audit_events
 WHERE actor_id='00000000-0000-0000-0000-000000000000'
 ORDER BY created_at DESC,id DESC LIMIT 8;
```

After the prepared migration, index count should rise from 94 to 97 if no other schema changes intervene; the five workspace tables should no longer appear under browser-role grants. The consent export test now covers accepted, withdrawn, old-version, missing and renewed consent for both queries and passed. Still outstanding: scoring race on two connections, invalid exam rows and append-only trigger tests, and RAG return count against an exact per-document calculation.

## G. Explicitly out of scope

No second database, Alembic, ORM rewrite, client-facing RLS policies, student sequencing change, model activation, or ML training. No hard deletion/retention job until the institution approves retention and erasure rules. No rename of live columns. No claim that local plans predict production latency. No empirical model validation: the local `ml_predictions` and `research_consents` tables are empty.

**Verdict:** Keep the API-only boundary; the documented consent export gate is fixed. Narrow the backend SQL credential and settle retention semantics before approved research use; batch the faculty ML exam query before classroom-scale use.

**Not checked:** A fresh `supabase db reset`, write-path regression tests, a concurrency/load run, production privileges or data, and real-scale query plans. Chapter 1/2 PDF text was inspected for database/research references; Chapter 3 remains a draft and its final diagrams were unavailable.

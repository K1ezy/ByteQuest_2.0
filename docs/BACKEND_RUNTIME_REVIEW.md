# ByteQuest backend runtime review

This pass inventoried 119 router declarations across 12 API modules plus three application health routes. The inventory below groups routes by their runtime dependencies. Verification is recorded per finding. An inventory entry does not imply that each route was replayed.

| Workflow | Access and database work | External services and jobs |
| --- | --- | --- |
| Admin | Administrator account and course management, memberships, settings, activity state and audit writes | Supabase Auth account provisioning |
| Profiles | Authenticated self-service, onboarding, analytics and role-scoped history | Supabase Auth and avatar storage |
| Faculty | Assigned-course activities, review, materials, preview, versioning and performance | PDF indexing, storage, optional Gemini and Judge0 verification |
| Instructor RAG | Authorized document access, indexed passages, generated drafts and source references | Gemini and Judge0 |
| Quest Map and groups | Language and membership checks, activity listings, quiz attempts, XP, group creation and joining | Database only |
| Classroom pilot | Student dashboard, drafts, hint usage, solution release and consent | Gemini for AI hints |
| Code grading | Student-owned job acceptance and polling, durable job state, attempts and progress | Grading worker and Judge0 |
| Exams | Faculty ownership and student assignment, snapshots, autosave, attempts and result release | Exam grading and notification workers, Judge0 and optional SMTP |
| Chat and ML analytics | Authenticated chat context, faculty or admin analytics and consent checks | Gemini and optional shadow prediction |
| Runtime | Health, PostgreSQL readiness, local environment configuration and worker startup | Docker, local Supabase, Judge0 VM and VPS Compose |

## Ranked findings

1. **Submission requests exhausted the DB pool during class load.** `submission_jobs.py` held a connection while `quotas.py` checked out a second. In a 30-student run, the API logged pool timeouts and only 12 jobs finished. The quota write now shares the job transaction. A second run with the same four-case Python challenge completed 30 of 30, all within 30 seconds, with a median of 16.01 seconds, a maximum of 22.84 seconds, and no pool timeouts in the API log. The first run was a baseline for the pool change after initial reliability fixes.
2. **Queue delay could invalidate accepted submissions.** The grading path rechecked the current deadline after the API accepted a job. The API now uses one acceptance timestamp for the schedule check and the stored job. The worker honors that decision, including on retries. The integration test covers a rejected late request and successful grading of an accepted job after closing.
3. **Local startup failed on a database with an existing constraint.** The working-tree time-spent migration tried to add a check that was already present in the local schema. The migration now replaces the named check atomically. The batch launcher applied it and reached ready in 26.3 seconds, then reached ready again in 16.4 seconds with an unchanged schema and an API restart. CI and the consent integration test now use the actual local database configuration.
4. **Exam grading and practice grading could assign the same next attempt number.** Exam grading now uses the same student row lock as practice grading and skips an unused activity fetch per item. Existing integration tests exercised exam and practice grading. A targeted concurrent race test remains pending.
5. **Drafts, hints, solutions and recommendations used looser activity checks than discovery.** Student access now reuses the publication, track and visibility rules in the pilot routes and sequencer. The dashboard counts use the same visibility filter. Scheduled closure unlocks the solution under the same rule as explicit closure.
6. **Temporary database errors could stop a running worker.** The polling loop now backs off on database connection or pool errors. Stale job recovery still runs before claims, and the claim query now only selects queued work. The suite covers stale jobs and retryable Judge0 failure. A live database interruption test remains pending.

## Mixed local workload

A second local workload added sample submissions to the dashboard, autosave, official grading and polling flow. All 30 official jobs finished within 26.81 seconds. Acceptance was 0.196 seconds at p50 and 0.234 seconds at p95. The database contained exactly one official attempt for each synthetic student before cleanup.

The queued-job lookup used the existing `ix_submission_jobs_status_created` index and took 0.229 ms on the local database with an empty queue. This check does not measure index performance with a large backlog.

The backend regression suite passed all 91 tests. Frontend type checking, 48 tests, four recovery invariants and the launcher helper suite passed. The Linux backend image built and passed the production-mode liveness, readiness, Docker health and disabled API documentation checks against local Supabase.

## Pending measurements and review
- Full Linux staging Compose and the 60-student grading gate remain open. The configurable pilot workload supports `BYTEQUEST_LOAD_STUDENTS=60` with distinct synthetic sessions.
- Profile query plans and connection usage under representative data, and instrument the time spent waiting in the grading queue separately from Judge0 execution.
- Review remaining quota callers that reserve through a separate DB session, per-group list queries, exam claim coordination across worker processes, and notification delivery contention. These are code-review leads. They need dedicated reproduction or measurement before changing runtime behavior.

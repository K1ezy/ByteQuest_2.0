# ByteQuest 2.0 system status and weekly change log

- **Snapshot** 20 November 2026, Asia/Manila
- **Window** 13–20 November 2026
- **Source** Weekly update on `fix/ml-pr-auc-student-disjoint-split`, compared with baseline `3bee7ca`. The snapshot covers the source, tests, and migrations verified locally on 20 November.

ByteQuest can run the core student, instructor, and admin workflows on the local stack. The most recent Strings walkthrough confirmed that a saved PDF could be retried and indexed, and that a separately published challenge could open in the student Coding Arena. A hosted classroom launch still needs a frozen release, deployment, and acceptance on the target environment.

## How close is ByteQuest to finished?

| Milestone | Estimate | What the number means |
| --- | ---: | --- |
| Scoped local demo and core acceptance | **100%** | The previously defined local acceptance scope has evidence for the core pathways. Refine content and rehearse the exact demo flow on the release candidate. |
| Verified hosted deployment | **40%** | A verified local release baseline, deployment templates, and partial destination setup earned 40 points. Hosted schema, Auth, HTTPS, API, Judge0, and full-stack smoke tests earn the remaining points. |
| Supervised live classroom pilot | **35%** | The hosted score contributes 20 of 50 points. Local practice and exam rehearsal contributes 10, and operating procedures contribute 5. Hosted acceptance and launch approval are open. |
| Broader public release | **26%** | The pilot contributes 21 of 60 points and written production recovery procedures contribute 5. A completed pilot, broader load checks, and operational handover are open. |

These are the existing weighted planning estimates. The latest work improves the local release candidate. The report retains the previous hosted estimates because the target was outside this verification and **zero of six hosted classroom gates** have recorded acceptance. The 100% score applies to the scoped local demo and core acceptance checklist. [Scoring method and hosted gates](SYSTEM_STATUS_AND_RELEASE_PLAN.md#2-progress-percentages-and-how-they-were-calculated)

## What changed this week

| Area | Changes reviewed in the working tree |
| --- | --- |
| Student workspace | Workspace navigation and lighter pages moved into the shared frontend layout. The learning flow includes Quest Map, Workshops, dashboards, badges, streaks, mastery and recall features, and clearer distinctions between practice and graded results. Rollout flags and eligibility still determine which staged learning features appear. |
| Instructor workspace | Course-scoped dashboard, materials, activities, review, exams, announcements, performance, gradebook with CSV, activity analysis, gamification, and ML views are available. Editor changes preserve versions and check competing saves. Schedule entry uses Manila time. |
| Coding and exams | Submission and exam workers use durable jobs, processing claims, and heartbeat signals. Timed exams have attempt-scoped draft recovery, separate exam-only content, quiz and code grading, result release, and retakes. Reward changes keep completion credit idempotent and respect exam release. |
| Accounts and data | The local migration set includes school-issued student registration, activity pass marks, exam-only content, announcements, research codes, a larger instructional PDF limit, and private chat history. Approval and consent gates protect research exports and forecast activation. |
| AI and materials | Materials support versioning, archive, retry, indexing with Gemini Embedding 2, and draft generation from course sources. Gemini 3.5 Flash-Lite chat has a widget and full page, saved history and Temporary Chat, plus adaptive reply depth, selective PDF search, validated page citations, and token usage logs. |
| Infrastructure | This week's committed work includes grading and AI safety improvements, frontend regression in CI, local launcher recovery, and private phone access over ZeroTier. The working tree includes KVM 2 preflight, Caddy routing, environment templates, and a pilot checklist. Local and hosted release environments use separate configuration. |

The 15 November commit cluster includes `1c271cd` for backend grading and exam safeguards, `cc7621e` for the workspace and exam UI, `83a296a` for launcher and CI changes, `402c73a` and `eba4706` for private phone access and Supabase recovery, and `c91b581` for student gamification. The freeze for the next hosted release is pending. [Architecture](BYTEQUEST_ARCHITECTURE_BLUEPRINT.md) · [Prior system review](reviews/system-readiness-review-2026-11-17.md) · [Remediation evidence](reviews/pilot-remediation-checklist.md)

## Current feature and deployment map

| Area | What works or is implemented | Remaining acceptance |
| --- | --- | --- |
| Student learning | Supabase sign-in and course access, Python/C++/Java quizzes and coding challenges, sample practice, official grading, progress, XP, badges, leaderboards, and workshops. Judge0 evaluates code through the backend. | Confirm starter content, enrollment, low-bandwidth behavior, and a complete phone and keyboard journey on the hosted candidate. |
| Instructor and admin | Course-owned content and PDF management, preview and publication, enrollment and role administration, announcements, exam lifecycle, gradebook/export, and incident monitoring. | Rehearse with an instructor assigned to a single course, an instructor in multiple courses, a student in a different course, and the named operator. |
| Exams and grades | Frozen exam content, autosave and recovery, expiry, queued grading, hidden-test privacy, explicit release and retake. | Verify the full hosted deadline burst while regular practice runs. Agree on grading wait targets and recovery procedures with faculty. |
| Tutor and AI authoring | Chat and authoring use Gemini. Course PDFs become searchable passages. Arena hints use a shared five-use allowance for instructor hints and AI hints per challenge per student. Chat pauses for active exams. | Verify hosted provider quota, embeddings recovery, and answer quality with synthetic cases. Enable saved cloud chat only after checking retention, deletion, and privacy notice. |
| Research and ML | Course history and descriptive analytics run. The offline pipeline compares Logistic Regression and Random Forest. Rules drive live sequencing. Forecast activation requires an approved artifact, reviewed data and current consent. | Review the cohort, feature alignment and prediction unit. Approve the collection and evaluation process before using real student records. |
| Deployment | Next.js, React, TypeScript and Monaco on the frontend. FastAPI and SQLAlchemy on the backend. Supabase supplies PostgreSQL, Auth, private Storage and pgvector. The proposed hosted setup uses Vercel, a Hostinger KVM 2 running Caddy, API, worker and private Judge0, plus hosted Supabase and Gemini. | Freeze one matching revision and verify domain, TLS, private service boundaries, migrations, role access, queue capacity, backups, and rollback. KVM 2 capacity is still a rehearsal question. |

[Local workflow](LOCAL_E2E.md) · [KVM 2 checklist](KVM2_LIVE_PILOT_CHECKLIST.md) · [ML feature alignment](ml-feature-alignment.md) · [Training and evaluation](../ml_pipeline/README.md)

## Latest local verification

- The current working tree passed **260 backend tests**, **178 frontend tests**, the four frontend recovery invariant checks, lint, and TypeScript typechecking. Four new UI tests cover the visible-sample publication rule and the editor's focus return. The backend suite emitted ten existing deprecation warnings. The UI tests use simulated API responses and run without a live student session.
- In the Strings walkthrough, `Pythonlearn-06-Strings.pdf` matched the saved upload. **Retry processing** brought the same version to **Ready** with **32 indexed passages**. The manually created **Learn about : Strings** challenge was separately verified by Judge0 and published to the Python Programming Track. A student then opened it in the Arena.
- The tutor was compared before and after using 20 synthetic questions and real Gemini generation. The revised tutor made 7 PDF lookups versus 20. The estimated paid generation cost was **$0.48 versus $0.61 per 1,000 replies** for that sample mix. All 20 revised replies ended within their token limits. The embedding rehearsal separately recorded Gemini rate limiting, so uploads still need provider-aware pacing. [Tutor evaluation](verification/gemini-tutor-evaluation-2026-11-20.md)
- Prior local infrastructure evidence covers a restricted Linux backend container, a clean production frontend build, synthetic database upgrade, and a 30-student rehearsal with 122 coding jobs and 30 quiz submissions. A separate mixed practice and exam run recorded 60 exam items with no duplicate grades or XP. This evidence came from the local stack and its private Judge0 VM. [Recorded workload and environment](KVM2_LIVE_PILOT_CHECKLIST.md#local-verification-on-20-november-2026)

## UI and UX review

The student Arena makes **Run sample** and **Submit for grading** visually distinct. The instructor workspace uses a course selector, saved/editable states, a student preview, and versioned publication. Those are useful cues to keep. The findings below use the latest Strings workflow screenshots, the current components, and previous local design evidence. Keyboard, zoom, screen reader, and physical-phone acceptance still need coverage on the release candidate.

| Priority | Finding | Improvement and acceptance check |
| --- | --- | --- |
| High, addressed in this update | An all-hidden coding challenge reached the final publish dialog even after the preview showed zero samples. Judge0 could pass, then the instructor discovered the blocking rule after confirmation. | Both the activity editor and draft review now explain the visible-sample requirement before confirmation and offer **Go to grading cases**. Confirm a draft with only hidden cases shows this action, a verified draft with a visible sample can enter confirmation, and the existing server validation still enforces the rule. [Server publication rules](../backend/app/services/activity_publishing.py) · [UI regression](../frontend/src/components/workspace/publication-sample.test.tsx) |
| High | The demo challenge's problem panel says “Do this given activity.” Students must infer the requirements from comments in the editor. | Give each lesson a short problem, input bounds, exact output, and a visible sample before the learner runs code. For this exercise, specify one word of at least five characters and two output lines. Rehearse with a learner who has never seen the reference solution. [Coding Arena](../frontend/src/components/arena.tsx) |
| High for an AI-enabled pilot | A failed Materials card gives generic, repeated retry guidance. Instructors cannot tell whether indexing is waiting on Gemini, needs a new searchable PDF, or has stopped. | Use provider-aware pacing across workers, wait for the `429` retry interval, preserve completed embedding work, and show **Waiting to retry** with an actionable status. Verify the same saved PDF eventually reaches **Ready**, while scanned PDFs keep their replacement guidance. [Materials indexing](../backend/app/services/materials.py) |
| Medium | Students can launch a chat widget, expand it, open saved conversations, and request an Arena hint through a separate path. The controls and allowance can be hard to discover during a first visit. | Keep names clear for **Minimize**, **Open full chat**, and **Close**. Explain when a hint unlocks in the Arena and show the five-use count next to the action. Walk through widget to full page to return, mobile history and settings, temporary chat and deletion, plus exam-time blocking. [Chat shell](../frontend/src/components/chat/chat-shell.tsx) · [Coding Arena](../frontend/src/components/arena.tsx) |
| Medium | Dense exam, grading and gradebook views must work under long waits, interrupted connections, and narrow layouts. Prior local tests cover some of these states. | Recheck keyboard focus, 200% zoom, phone reflow and long labels. Verify that waiting for grading, retrying, or switching courses explains the next action and keeps results tied to the selected course. Keep shown estimates tied to measured queue data. [Instructor design verification](design/instructor-step-c-verification.md) · [Pilot operator runbook](PILOT_OPERATOR_RUNBOOK.md) |

## Work left before the next milestone

1. Freeze a new release revision with the current application, migrations, and verification results. Recheck effective permissions, Auth and mail recovery, and private PDF access on the intended hosted Supabase project.
2. Deploy matching API and frontend builds to the pilot target. Exercise all three roles and included language tracks, including publish, submit, hint, exam, and release. Use the local demo as a separate fallback rehearsal.
3. Run the class-size burst on the actual KVM 2. Record API latency, grading queue age, CPU, memory, failures, and any duplicate or missing grades. Rehearse a stopped worker, sandbox failure, database and private PDF restore, and release rollback.
4. Decide whether Gemini is in the first hosted pilot. If included, check cohort eligibility against the provider terms and complete rate-limit recovery and hosted tutor checks. Track research approval, consent, and approved model activation through the research process. [Gemini eligibility terms](https://aistudio.google.com/docs/terms#age-requirements)

Use the [master plan](MASTER_PLAN.md) for system invariants, the [release plan](SYSTEM_STATUS_AND_RELEASE_PLAN.md#5-six-gates-before-a-live-classroom-pilot) for go/no-go criteria, and the [KVM 2 checklist](KVM2_LIVE_PILOT_CHECKLIST.md) plus [restore runbook](PHASE7_BACKUP_RESTORE_RUNBOOK.md) for execution. Update this snapshot when a gate gains evidence, and keep any newer contract changes linked to their implementation and tests.

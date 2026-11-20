# ByteQuest 2.0 before and after

The implementation record below tracks the changes made after the audit. The original audit and side-by-side tables preserve the baseline and the intended outcomes. [Architecture review and local completion blueprint](BYTEQUEST_ARCHITECTURE_BLUEPRINT.md)

## Implementation and local verification

**18 November 2026, Asia/Manila.** The new behavior runs in the local working tree. Local migrations advanced through `20261118113726`. Both new migrations applied to the retained local database and were included in the fresh isolated recovery stack. The previous RC1 remains a historical baseline.

| Item | Implemented or verified locally | Completion criteria that still need evidence or a decision |
| --- | --- | --- |
| BQ-01 | Coding practice, quiz practice, and exam release share first-eligible completion XP. Release recomputes awards from successful exam items, including previously graded held exams. Regression tests cover both orders and repeated release. | Historical awards already paid stay recorded as earned. Any historical correction requires a separately approved audit. |
| BQ-02 | Each submission claim has a unique token. The claim check protects both failure paths and the transaction that records a grade and XP. Local tests simulate late success and late failure for samples and official jobs. | Exercise multiple independent workers again if the local process layout changes. |
| BQ-03 | Exam grading retries with a limit and backoff, preserves answers, and surfaces failed attempts to instructors for retry. The instructor can choose timed practice or a restricted assessment. Restricted items stay private until an enrolled, assigned learner starts an active attempt, and prompts are withheld after the answer window. | Faculty chooses which real assessments use each mode and signs off on the item pool. |
| BQ-04 | Studio requires active assignment for course-bound materials and drafts, supports assigned co-instructors, and preserves legacy ownership for unscoped content. Long verification, tutoring, and grading paths recheck relevant access. | The source-only legacy instructor/workshop policies retain their documented scopes. |
| BQ-05 | A two-minute abandoned hint reservation expires. The same request key can retry. Delivery checks the reservation and returns the current remaining balance. Existing exam pause and five-reveal behavior have regression coverage. | Live usage review can assess how clearly students understand the shared reviewed/AI allowance. |
| BQ-06 | Performance, learner detail, Gradebook, and Activity Analysis use practice-only eligibility. Progress aggregates complete qualifying history while recent detail retains the 50-row limit. | The 30-learner live run reconciled instructor reports and recorded attempts. |
| BQ-07 | Tutor citations must match a provided page and appear in the actual reply. General and withheld replies can return no sources. The evaluator drives authenticated chat, Judge0 sample runs, and hint replay across synthetic Python, C++, and Java lessons. | Faculty evaluation of actual course materials remains open. See the tutor recheck below. |
| BQ-08 | Studio and Review Queue share revision conflict behavior. Studio retains valid proof on unchanged grading content and both verification actions use one recheck path. The final publication proof remains shared. | Existing older Studio callers can omit the revision field. The current browser sends it on saves. |
| BQ-09 | Countdown and deadline handling live in the answer-sync hook. Mismatched attempt identity and late saves after sign-out are guarded. Starting an existing attempt uses the same reconciliation as reopening it. | Existing offline and multi-tab tests pass. Device-specific recovery checks belong to the target classroom hardware. |
| BQ-10 | The working build passed a real Edge keyboard selection, restricted exam creation, student listing, and 390 px reflow check. Existing curriculum, quiz, and Judge0 fixtures remain available across the three tracks. | Faculty syllabus approval and real phone and assistive-technology acceptance are still needed. |
| BQ-11 | A separate local Supabase stack recovered synthetic Auth rows, course membership, private PDF bytes, a held result, and a stale grading job. Both accounts signed in. Signed PDF download, learner denial, embargo, and reclaim checks passed. | This was a targeted synthetic restore. The later hosted backup and recovery procedure has its own acceptance gate. |
| BQ-12 | The local production build, launcher, and live role workflows passed. Monitoring includes oldest ready and running work and exam attempts needing retry. Job results record final-claim ready wait and execution separately. | The class-size result is workstation evidence. A release candidate can be pinned when this working tree is reviewed. |
| BQ-13 | Queued coding completion now reaches the same consent and approval-gated shadow path after the grade commits. Forecast targets respect activity availability. | Prediction unit, cutoff, label, feature choice, and model activation remain adviser/research decisions. |
| BQ-14 | The synthetic class and timing results are recorded for comparison. The app keeps its current queue, database, and provider layout. | Use a defined latency objective and matching workload before tuning capacity or restructuring modules. |

### Current local evidence

- **Regressions.** 229 backend tests, 160 frontend tests, and four exam-recovery checks passed. The tests cover expired claims, recovery after exhausted grading, released and held exam awards, full-history reporting, expired hints, withheld single-line repairs, cited and uncited replies, course reassignment, revision conflicts, restricted exam visibility, and the transition after the autosave grace period.
- **Real grading.** 30 synthetic learners completed 122 real Judge0 jobs with 17 cross-role checks and zero unexpected responses. End-to-end p95 was **23.533 s** for samples and **27.946 s** for official jobs on this workstation. The later four-learner run verified the timing split. Official p95 ready wait was **2.401 s** and final execution p95 was **2.097 s**. These are separate sampled statistics. [Class exercise](../logs/qa/architecture-local-class.log) · [Timing split](../logs/qa/architecture-browser-fixture.log)
- **Browser and AI.** An instructor published a restricted exam via Edge and the learner saw it under Exams while its private quiz stayed out of practice. The synthetic Python tutor exercise published a Judge0-verified challenge and used authenticated chat, real failed-sample diagnostics, and request-key replay. [Browser check](../logs/qa/architecture-browser-smoke.log) · [Tutor check](../logs/qa/architecture-live-tutor-smoke.log)
- **Data recovery.** The isolated test took approximately **12.5 s** after the target stack was ready and used only synthetic data. It transferred selected rows and PDF bytes and verified the restored app paths. [Isolated recovery result](../logs/qa/architecture-recovery-result.log)
- **Reproducible baseline.** The source manifest records 373 working-tree files and the local migration head. The local Supabase advisor check returned no warnings at the selected level. Logs and the manifest are workstation evidence. [Source hashes](../logs/qa/architecture-local-baseline.sha256) · [Local startup](../logs/qa/architecture-local-startup.log) · [Judge0 language checks](../logs/qa/architecture-judge0-languages.log)

### Local use

- In **Instructor → Activities**, choose **Exam-only activity** when creating content intended for a restricted assessment. Save the item and verify coding challenges with Judge0. In **Exams**, choose **Restricted assessment**, select exam-only items from one course, and assign the workshop groups. The learners need active enrollment in that course as well as group membership.
- In **Exams → Results and retakes**, use **Retry grading** when the attempt needs attention. The same saved answers are graded again. Scores stay held until release.
- To record tutor evidence, use a disposable local student's token in `BYTEQUEST_QA_STUDENT_TOKEN`. In `backend`, run `python -m scripts.evaluate_ai_tutor --api-base http://127.0.0.1:8000/api/v1 --cases <synthetic-cases.json> --output <new-evidence.jsonl>`. Each fixture has `activity_id`, `language`, `failing_code`, and `questions`. Keep the resulting rubric and replies with the synthetic QA evidence.

### Curriculum, grading interruptions, tutoring, and exam accessibility

| Area | Local result | Evidence or acceptance still needed |
| --- | --- | --- |
| C++ and Java starter tracks | Each track has **Add Two Integers**, **Classify a Number**, **Count Positive Numbers**, and a short quiz. Judge0 accepted all six reference solutions and rejected all six deliberately incorrect versions before publication. Each disposable learner completed three visible sample runs, three official submissions, and the quiz. Each earned 115 activity XP. The practice API masked hidden-case details. Re-running the seed returned the same eight IDs. | Faculty approval of the full course syllabus and real assessment items. [Publication](../logs/qa/starter-tracks-publish.log) · [Learner workflow recheck](../logs/qa/starter-tracks-workflow-recheck.log) · [Repeat seed](../logs/qa/starter-tracks-idempotency.log) |
| Mixed exam and practice grading | The local run used 30 learners, 60 exam item grades, 30 practice samples, and 30 official practice jobs. The worker process was stopped during a live claim and the replacement recovered it. Each exam recorded two item grades, stayed private until release, and recorded no duplicate activity awards. A class-wide join initially exhausted the connection pool. Workshop creation and join now reserve quota through the request session while keeping existing limits. | Compare with the eventual classroom hardware and an agreed processing-time target. See the timing table below. [Mixed workload](../logs/qa/mixed-exam-class.log) |
| C++ and Java tutoring | Four live cases exercise real compiler and loop logic failures, private two-page synthetic lessons, and two successive requests for answers. The first run caught a C++ reply that supplied the one-line fix and a hint with the wrong page. The guard withheld that repair on the live recheck, and the hint cited page 1. Both loop cases also passed live again. One delivered hint uses one reveal, and replaying its request key uses zero more. | Review model output against faculty materials. The structural guard compares against one reference and cannot cover every equivalent solution or rewritten answer. [Initial transcript](../logs/qa/starter-tutoring-gsqtfw.jsonl) · [C++ compiler recheck](../logs/qa/starter-tutoring-xirine.jsonl) · [Loop recheck](../logs/qa/starter-tutoring-owkuqh.jsonl) |
| Mobile exam | The 390 px browser exercise signed in and started the exam by keyboard, moved between tasks, saved quiz responses, preserved a code edit while offline, and restored the server-saved edit after reconnect and reload. The exam exposes a named countdown and separate status regions for saves and time milestones. After the server's autosave grace window, the browser moved to grading without a reload. The worker graded the recovered answer and the instructor released 20/20. | A physical Android phone with TalkBack is needed to verify spoken announcements, touch navigation, and the on-screen keyboard. Browser accessibility-tree assertions verify accessibility markup. [Browser recheck](../logs/qa/mobile-exam-edge-recheck.log) |

Both completed worker rehearsals used a **20-second test lease** in a disposable local Supabase stack. The application's normal exam lease is ten minutes. The timings include the intentional interruption. The practice queue measurements end at each job's final claim.

| Measurement | First run p50 | First run p95 | Recheck p50 | Recheck p95 |
| --- | ---: | ---: | ---: | ---: |
| Exam submission to first worker claim | 39.347 s | 59.932 s | 51.510 s | 73.183 s |
| Exam submission to graded | 40.758 s | 61.349 s | 53.652 s | 74.639 s |
| Practice sample ready queue | 20.633 s | 28.144 s | 24.943 s | 34.367 s |
| Practice official ready queue | 14.377 s | 14.936 s | 20.292 s | 21.910 s |

All exams had grades **62.886 seconds** after the first submission in the first successful run and **76.512 seconds** in the recheck. The interrupted attempt had **two claims** in each. The recheck also confirmed one stored practice award per learner. A setup run between the two rehearsals hit a local Postgres connection timeout during enrollment and was excluded from the timing table. The harness now stops on a failed fixture setup. [First run measurements](../logs/qa/mixed-exam-result-sueril.json) · [Recheck measurements](../logs/qa/mixed-exam-result-nnmnns.json)

The Java compiler recheck returned a correct lesson explanation, two refusals that withheld the repair, and a grounded hint. The first reply used Gemini's numbered `page 1` citation spelling. The validator now normalizes that spelling and still checks the exact retrieved title and page. The latest live attempt hit a Gemini `503` and displayed the retry message. The API regression and a replay of the captured live Java reply both verified the final parser. [Live Java transcript](../logs/qa/starter-tutoring-xijtkp.jsonl) · [Final parser replay](../logs/qa/starter-tutoring-java-citation-replay.log) · [Provider failure](../logs/qa/starter-tutoring-java-citations-recheck.log)

Run `tests/qa_starter_tracks.py` and `tests/qa_starter_tutoring.py` from `backend` with the local environment active. Use `--language` and `--error-category` to repeat an individual tutor case. `tests/qa_mixed_exam_load.py --students 30 --isolated-db-port <port>` requires a separate empty local Supabase instance with its migrations applied. `tests/qa_mobile_exam.py` takes the installed Playwright module path in `BQ_PLAYWRIGHT_MODULE` and the Edge executable path in `BQ_EDGE_EXECUTABLE`. All four scripts use disposable synthetic accounts. The starter publication command retains the seeded curriculum in local Supabase. Hosted deployment and classroom pilot work remain deferred.

### Responsive localhost verification

ByteQuest adapts to CSS viewport width, available height, and pointer type. The smallest exam check moved the code field from 710 px to 514 px from the top at 320 × 640 CSS px. The timer, save status, and submit button fit above the task. The Arena uses a native code field on narrow touch viewports and Monaco on desktop. Tapping **Editor** brings the field into view in portrait and landscape. The practice sample ran through Judge0, the long line stayed inside the editor, and the saved draft restored after reload. The chat composer stayed in view at 360 × 340 when the viewport height was reduced with the input focused. [Local results](../logs/qa/responsive-final.log) · [Narrow exam](../logs/qa/responsive-final/narrow-exam.png) · [Landscape Arena](../logs/qa/responsive-final/landscape-arena.png)

| Emulated screen pixels | CSS viewport | Device pixel ratio |
| --- | --- | ---: |
| 1080 × 2340 | 360 × 780 | 3 |
| 1080 × 2400 | 360 × 800 | 3 |
| 1080 × 2424 | 360 × 808 | 3 |
| 1080 × 2640 | 360 × 880 | 3 |
| 1080 × 2772 | 360 × 924 | 3 |

The matrix also used 320 × 640, 412 × 915, 800 × 360 landscape, and 1440 × 900 desktop. It checked sign-in at 320 px, the student dashboard, Quest Map, Arena, quiz and active exam across the matrix, and three instructor and three administrator routes at 360 × 800. All tested routes fit without page-level horizontal overflow. Run `tests/qa_mobile_exam.py --responsive` from `backend` with the same Playwright and Edge paths listed above. Set `BQ_RESPONSIVE_OUTPUT` to save screenshots. Browser emulation covered a reduced-height viewport with the input focused. Native Android keyboard behavior and TalkBack remain unmeasured.

The separate 390 px browser run also passed keyboard exam navigation, offline recovery, deadline submission, actual grading and instructor release of 20/20. Frontend lint, type checking, 160 tests and four recovery checks passed. [Exam recovery recheck](../logs/qa/responsive-exam-recovery.log) · [Frontend tests](../logs/qa/responsive-vitest.log)

### Next local work · 19 November 2026

The Arena now resumes an accepted sample job from the same browser tab after a reload. The saved job is scoped to the signed-in learner and the challenge. An interrupted status request backs off and checks the original job. The results show queued, grading, or retrying. The saved source stays associated with the sample so edits made after the run are still marked stale. Signing out clears the tab's saved job state.

The localhost Edge run dropped the first status request, then reloaded the page. It recovered the original Judge0 result after only one submission request. The viewport matrix, 161 frontend tests, four recovery checks, lint, and type checking passed. [Browser verification](../logs/qa/arena-resume-browser.log) · [Frontend tests](../logs/qa/arena-resume-tests.log)

The uninterrupted 30-learner rehearsal used the normal grading lease. The first timed-exam sample burst completed 23 of 30 requests. Seven failed when concurrent requests exhausted the database pool. The exam sample route now reserves quota through its existing session and releases the connection before waiting for Judge0. All 30 synchronized sample requests passed in the recheck. The following mixed phase completed 60 exam item grades and 60 practice jobs. Every exam completed on its first claim. Score hold, one completion award per activity, and repeated release worked as expected. [First run](../logs/qa/mixed-exam-uninterrupted.log) · [Recheck](../logs/qa/mixed-exam-uninterrupted-recheck.log)

| Uninterrupted workload measurement | p50 | p95 |
| --- | ---: | ---: |
| Timed-exam sample, HTTP round trip | 5.723 s | 10.803 s |
| Exam submission to first worker claim | 36.776 s | 57.021 s |
| Exam first claim to observed grade | 1.458 s | 2.160 s |
| Exam submission to observed grade | 38.587 s | 58.343 s |
| Practice sample ready queue | 17.983 s | 24.521 s |
| Practice official ready queue | 16.202 s | 18.154 s |

All exam grades were ready in 60.678 seconds from the first submission. First claim to observed grade includes grading, commit, and the test's polling delay. The timed-exam sample burst ran before the mixed phase. Repeat on the disposable local stack with `tests/qa_mixed_exam_load.py --students 30 --isolated-db-port <port> --no-restart --exam-samples`. [Measurements](../logs/qa/mixed-exam-result-bijjmp.json)

**Subsequent implementation and checks.** Returning to the open exam page refreshes a finished attempt through the existing learner-authorized read. Grading also refreshes while visible. A frontend regression verifies that a held score appears after release on return without saving or submitting answers again. Arena and Quiz now reuse the workspace profile and request full details for the selected quest. A 100-quest synthetic catalog went from 64,696 to 43,987 JSON bytes and from 5,569 to 4,099 bytes when compressed with gzip. The order and track visibility checks passed. `GEMINI_ENABLED=false` blocks outbound Gemini calls even with a key present. Chat and hints disclose provider data, and regressions verify that disabling Gemini preserves reviewed hints and the reveal balance. [Frontend tests](../logs/qa/finish-local-frontend-recheck.log) · [Catalog measurement](../logs/qa/quest-payload-local.log) · [AI controls](LOCAL_API_SECURITY.md#access-matrix)

### Exam-grading slot comparison · 19 November 2026

Each uninterrupted run used three worker slots, an isolated local Supabase database, and the private Judge0 VM. Thirty synthetic learners ran timed samples, then submitted 30 mixed exams alongside 30 practice samples and 30 official practice jobs. Each run produced 60 exam item grades and 60 completed practice jobs with zero retries. Score visibility, once-only XP, and repeated release checks passed.

| Measurement | One exam slot | Two exam slots |
| --- | ---: | ---: |
| Exam submission to first claim, p95 | 52.095 s | 30.597 s |
| Exam submission to observed grade, p95 | 53.459 s | 32.028 s |
| First submission until all exams graded | 55.280 s | 33.688 s |
| Practice sample turnaround, p95 | 27.047 s | 33.342 s |
| Official practice turnaround, p95 | 20.085 s | 24.447 s |

Keep one exam slot as the default for mixed use on this workstation. Two exam slots reduced p95 exam grading time by about 40% and increased p95 practice turnaround by 22–23%. The benchmark records the active slot settings, practice turnaround, and extra claims in its JSON output. [One exam slot](../logs/qa/mixed-exam-result-shuhfa.json) · [Two exam slots](../logs/qa/mixed-exam-result-xyyzjz.json) · [Benchmark script](../backend/tests/qa_mixed_exam_load.py)

The two-slot restart rehearsal recovered two exam claims and one practice claim. All 60 exam item grades and 60 practice jobs completed. Grades remained held until release, and each eligible activity earned XP once. The restart test used a 20-second exam lease. Practice used its normal 120-second stale timeout, and the interrupted sample took 128.952 seconds end to end. [Restart evidence](../logs/qa/mixed-exam-result-lkerfd.json)

### Remaining local work

1. Extend the restricted database role to the needed write paths and trial a runtime login. The rollback-only prototype confirmed a role can read the two allowlisted tables with row security active and has no database administration or Auth user-table read permissions. It used an empty disposable database, so role behavior across real app workflows still needs testing. Confirm faculty reassignment and revocation rules for both exam modes. [Role prototype](../logs/qa/local-runtime-role-trial-recheck.log)
2. Finish tutor recovery for provider outages and evaluate Content Security Policy in report-only mode against the working local build.

## Pre-implementation audit

Reviewed the current working tree based on `3bee7ca`, including uncommitted code, migrations, and tests. Re-ran the regression suites. **215 backend tests, 156 frontend tests, and four frontend exam recovery checks passed.** The previous local RC1 uses `138baaa` and has its own recorded build and upgrade evidence. The focused checks used synthetic records in rollback-only local database transactions. The worker handoff was simulated, and the citation check stubbed the provider. Browser/device, real provider, and full restore coverage below comes from existing records. [Previous RC1 evidence](SYSTEM_STATUS_AND_RELEASE_PLAN.md#rc1-verification-record) · [Blueprint evidence](BYTEQUEST_ARCHITECTURE_BLUEPRINT.md#evidence-behind-this-review)

| Recommendation | Status and what is already implemented | Remaining change or check |
| --- | --- | --- |
| **BQ-01 · Completion XP** | **Open, outcome reproduced.** Scores and exam XP are held until release. Held results are excluded from badge eligibility. Those earlier checks cover a different case from practice overlapping a held exam. | Coding still counts held exam passes as prior success, and exam release pays the previously reserved amount even after a quiz practice award. Reconcile each learner/activity award at the first eligible event. [Coding award](../backend/app/api/submissions.py) · [Exam release](../backend/app/api/exams.py) · [Earlier remediation](reviews/pilot-remediation-checklist.md) |
| **BQ-02 · Grading recovery** | **Open, outcome reproduced.** Stale jobs are reclaimed, and existing local outage/restart drills produced one grade and XP award per exercise. | Claims still return only the job ID. A late failure from an expired worker requeued a job after a replacement completed it in the simulated handoff. Validate the active claim when saving success, failure, or retry. [Worker](../backend/app/services/submission_worker.py) · [Incident evidence](SYSTEM_STATUS_AND_RELEASE_PLAN.md#4-verification-evidence-and-its-limits) |
| **BQ-03 · Exam grading and content** | **Partial.** Frozen exam items, server cutoffs, release, retakes, and expired grading claim recovery already exist. An integration test covers lease recovery. | Add a bounded recovery path that staff can see when Judge0 stays unavailable. Decide whether exams are timed practice or require their own restricted item pool. [Exam worker](../backend/app/services/exam_worker.py) · [Exam routes](../backend/app/api/exams.py) · [Exam tests](../backend/tests/test_learning_flow_integration.py) |
| **BQ-04 · Course access** | **Partial, with a policy decision.** Active-course checks, role tests, student membership revocation, and private-material controls already exist. | Studio retains author/uploader rules alongside course-scoped rules. Agree on legacy ownership and removed instructors, then exercise the same resource across Materials, Studio, and Activities. The code confirms the differing rules. [Course access](../backend/app/services/course_access.py) · [Studio rules](../backend/app/api/rag_instructor.py) |
| **BQ-05 · Hint recovery** | **Open, outcome reproduced.** Five shared challenge reveals, request-key replay, and cleanup for handled provider errors are already implemented. The browser reuses the key after a dropped response. | A one-day-old `Generating…` row still reduced allowance from five to four, and the same key still returned HTTP 409. Recover abandoned reservations and return the current allowance on delivery. [Hint routes](../backend/app/api/pilot.py) · [Arena retry test](../frontend/src/components/arena.test.tsx) |
| **BQ-06 · Reports and exports** | **Open, outcome reproduced.** Gradebook and Activity Analysis deliberately use practice attempts. The existing gradebook and CSV acceptance run compared 1,200 synthetic cells. | On the same fixture, unfiltered Performance counted a held exam attempt and focused Performance excluded it. The learner detail lost an earlier pass beyond its 50 displayed rows and reported zero completions. Use the same eligible attempts and compute totals over full history. [Report queries](../backend/app/api/faculty/performance.py) · [Prior gradebook run](SYSTEM_STATUS_AND_RELEASE_PLAN.md#local-acceptance-for-the-five-areas-that-were-partially-scored) |
| **BQ-07 · Tutor and citations** | **Open, citation outcome reproduced.** Course-scoped retrieval, visible diagnostics, withholding, and live three-language exercises exist. | The checked-in evaluator still uses private helpers for some paths. In a stubbed-provider route test, a reply explicitly giving general guidance still included an unrelated retrieved page in `sources`. Evaluate through authenticated workflows and label retrieved versus supporting material accurately. [Chat route](../backend/app/api/chat.py) · [Evaluator](../backend/scripts/evaluate_ai_tutor.py) · [Live AI evidence](SYSTEM_STATUS_AND_RELEASE_PLAN.md#expanded-local-ai-evaluation) |
| **BQ-08 · Authoring** | **Partial, with publication complete.** The saved grading revision must match the Judge0 proof, Review Queue can verify it directly, and Materials supports versioning and failed-job retry. | Preserve the publication fix. Add shared behavior tests for draft edits, conflict messages, and verification transitions before centralizing overlapping editor logic. [Publication gate](../backend/app/services/activity_publishing.py) · [Proof regression](../backend/tests/test_pilot_regressions.py) · [Materials retry](../backend/app/services/materials.py) |
| **BQ-09 · Exam browser recovery** | **Core implemented, more verification.** The current hook handles autosave, conflicts, deadline save, and local backup. Tests cover reload, late saves, and another tab saving first. A prior Edge run exercised offline reconnect with real grading and a retake. | The page still coordinates the session and clock. Run the remaining combined recovery scenarios first and let failures guide any further refactor. [Hook and page tests](../frontend/src/app/%28workspace%29/exams/%5Bid%5D/page.test.tsx) · [Local exam recovery guide](LOCAL_E2E.md#exam-autosave--conflict-safe-recovery-verification) |
| **BQ-10 · Workspaces and curriculum** | **Core implemented, more verification.** The three roles, starter content in all language tracks, keyboard flows, and narrow viewport behavior have local evidence. | Complete faculty review of the intended lessons and record the end-to-end checks on the target devices, including assistive technology. [Navigation evidence](NAVIGATION.md#local-verification) · [Device coverage](reviews/instructor-analysis-announcements-report.md#remaining-verification) |
| **BQ-11 · Data and recovery** | **Partial, with earlier upgrade completed.** RC1 advanced from the older 14-migration baseline through 20 additional migrations and verified retained records, selected grants, and a private PDF bucket. An isolated restore recovered a challenge and two cases. | Reuse the migration rehearsal on the next candidate. Extend the isolated restore to test Auth, private PDF bytes, held exams, and recoverable jobs together. [RC1 migration record](SYSTEM_STATUS_AND_RELEASE_PLAN.md#rc1-verification-record) · [Prior restore scope](SYSTEM_STATUS_AND_RELEASE_PLAN.md#4-verification-evidence-and-its-limits) |
| **BQ-12 · Local readiness** | **Partial, with earlier baseline completed.** RC1 was frozen and exercised locally using a production build and real Judge0. Worker heartbeat, sandbox checks, and synthetic load measurements exist. | Bind evidence to a new candidate after the fixes. Measure queue wait separately from execution and show the oldest work and stalled exam state where staff can act. [RC1 evidence](SYSTEM_STATUS_AND_RELEASE_PLAN.md#rc1-verification-record) · [Health checks](../backend/app/services/monitoring.py) |
| **BQ-13 · Research predictions** | **Decision pending.** Shared feature engineering, grouped evaluation, consent controls, and advisory UI already exist. | Faculty/adviser approval is still needed for the prediction unit, time cutoff, label, and feature list. The current code uses 13 features and the alignment note records 10 in the manuscript. Confirm the intended forecast triggers before activation. [Feature alignment](ml-feature-alignment.md) · [Training pipeline](../ml_pipeline/train_compare.py) |
| **BQ-14 · Performance and code maintenance** | **Conditional.** Local grading and gradebook baselines exist, and faculty routes are already split by task. | Measure the affected workflow before choosing indexing, frontend restructuring, or worker tuning. Use code changes that address a reproduced policy or performance problem. [Local measurements](SYSTEM_STATUS_AND_RELEASE_PLAN.md#4-verification-evidence-and-its-limits) · [Faculty route layout](../backend/app/api/faculty/) |

### Recommended next work

1. **Fix BQ-01 first.** Add the held-exam overlap regression for coding and quizzes, then implement the award rule. Verify that practice and release produce the same total in either order and that repeating release never pays twice.
2. **Fix BQ-02 next.** Add tests for late success and late failure after reclaim. Require the replacement claim to keep the terminal result and verify a single official attempt and reward. Use the same ownership rule when addressing stalled exams in BQ-03.
3. **Then fix BQ-06 and BQ-05.** Bring staff reports into agreement and recover abandoned hint slots. Both have small fixtures and visible acceptance outcomes. Follow with BQ-07 for tutor provenance.
4. **Reuse the working parts.** Keep the existing publication gate, exam autosave, gradebook exports, and RC1 rehearsal. Finish remaining access-policy and acceptance checks. Capture the next local baseline after the fixes. Leave the ML contract for the adviser decision and tune performance when measurements justify it.

## What students and instructors would notice first

| Scenario | Current behavior | After the proposed fix |
| --- | --- | --- |
| A student passes a coding challenge in an exam. While the result is held, they pass the same challenge in practice. | The held pass can suppress the **40 XP** normally earned on a first practice pass. | Practice earns **40 XP** when graded. Later exam release adds **0 XP** for that same completion and reveals the exam grade as usual. |
| A student passes a quiz in a held exam and then passes the same quiz in practice. | Practice awards **25 XP**. Exam release can pay another **25 XP** for that quiz from its stored total. | Practice awards **25 XP**. Releasing the exam adds **0 XP** for that quiz. If the exam is released first, the exam earns the one award and later practice adds zero. |
| A worker times out. A replacement finishes the grading job before the old worker reports an error. | In the simulated handoff, the late error moved a completed job back to `queued`. | The replacement's result stays completed. Only the active claim can change job state or commit a grade. |

The XP examples show activity rewards from the synthetic fixtures and exclude badge XP. The worker finding came from a simulated claim handoff against local Postgres. [Reward and worker evidence](BYTEQUEST_ARCHITECTURE_BLUEPRINT.md#evidence-behind-this-review)

## Grading, exams, and course records

| Area | Current ByteQuest | After implementation and verification |
| --- | --- | --- |
| **BQ-01 · Completion XP** | Coding, quizzes, and exam release use different rules for prior success. | One first-completion award per learner and activity. A held result has no effect on visible rewards until release. |
| **BQ-02 · Grading recovery** | Jobs survive a worker restart. An expired worker can still write by job ID. | A recovered job has one active claim. A late result cannot replace its grade or return a completed job to the queue. |
| **BQ-03 · Exam grading and content** | Grades wait for release. Sandbox failure can leave grading stalled, and exams can reuse published practice material. | Staff can see and recover stalled grading with answers preserved. Faculty chooses timed practice or restricted assessment content. |
| **BQ-04 · Course access** | Course Workspaces use active assignments. Studio also has owner and uploader exceptions. | An explicit rule for course-bound, legacy, and admin access applies across entry points and after assignment removal. |
| **BQ-06 · Reports and exports** | Performance, Gradebook, and Activity Analysis can count different attempts. The learner drill-down computes completion from 50 displayed attempts. | Reports agree on eligible attempts. Full history drives progress totals while the display stays paginated or bounded. |

## AI and the browser experience

| Area | Current ByteQuest | After implementation and verification |
| --- | --- | --- |
| **BQ-05 · Hint recovery** | Five reveals per student per coding challenge are shared between reviewed and AI hints. An interrupted generation can leave a slot pending. | Interrupted requests release their reservation safely. A delivered hint costs one slot, and retrying its request key returns the same hint. |
| **BQ-07 · Tutor and citations** | Chat returns retrieved pages. The evaluator also constructs some hint inputs differently from the Arena. | Evaluation uses the live student workflow and visible sample diagnostics. Citations identify supporting passages, and general guidance is labeled accurately. |
| **BQ-08 · Authoring** | Publication already checks that Judge0 passed the saved grading revision. Studio, Activities, and Review Queue still handle edits and failures differently. | Authors get consistent save, verification, and conflict behavior across entry points. The verified-revision publication rule remains the final check. |
| **BQ-09 · Exam recovery** | The browser hook handles saves, conflicts, and backup. The page still coordinates the session, active attempt, and clock. | Recovery follows a single browser workflow and is verified under two tabs, dropped saves, deadline reconnects, and retakes. |
| **BQ-10 · Workspaces and curriculum** | All three roles and language tracks have local evidence. Full syllabus and device coverage still need review. | Faculty approves the intended learning sequence. Students and staff can complete core tasks with clear feedback on the devices tested. |

## Local operations and research

| Area | Current ByteQuest | After implementation and verification |
| --- | --- | --- |
| **BQ-11 · Data and recovery** | CI exercises a fresh local database. The recorded local restore covered a challenge and its test cases. | A supported upgrade and an isolated restore also verify accounts, assignments, private files, exams, and recoverable jobs. |
| **BQ-12 · Local readiness** | Regression, browser, Judge0, load, and recovery evidence are recorded across separate runs and documents. | One named build has matching evidence for startup, migrations, grading, interruption recovery, and queue latency. |
| **BQ-13 · Research predictions** | Advisory forecasts depend on an approved model. The code and manuscript describe different prediction units or features. | The adviser approves one prediction unit, cutoff, label, and feature set. Training and inference can be tested against that contract before activation. |
| **BQ-14 · Performance and code maintenance** | The same rules are sometimes spread across files. Capacity evidence is specific to the measured local workload. | Repeated rules have a clear home. Tuning or structural changes follow measured friction, with before-and-after checks on the same workload. |

## How to decide whether the work paid off

- **Start with BQ-01, then BQ-02.** Both have reproducible failure cases. Accept BQ-01 when practice and exam release award completion XP once in either order. Accept BQ-02 when late success and late failure leave the replacement result intact.
- **Keep the changes reviewable.** XP and job recovery touch transaction order and existing records. Exercise held exam totals and older job rows on disposable local copies before upgrading a retained database.
- **Measure the rest by outcomes.** Require reconciled reports, recoverable hints and exams, faculty-reviewed lessons, and a repeatable local build. Hosted deployment and classroom pilot readiness have separate acceptance gates. [Local acceptance checklist](BYTEQUEST_ARCHITECTURE_BLUEPRINT.md#5-local-completion-checklist) · [Hosted gates](SYSTEM_STATUS_AND_RELEASE_PLAN.md#5-six-gates-before-a-live-classroom-pilot)

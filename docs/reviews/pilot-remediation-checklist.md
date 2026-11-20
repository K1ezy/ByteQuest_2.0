# ByteQuest pilot remediation checklist

Use this checklist with the [system readiness review](system-readiness-review-2026-11-17.md) and the [pilot operator runbook](../PILOT_OPERATOR_RUNBOOK.md). Check an item off when its acceptance criteria pass. Record the commit, environment, and evidence for the release checks.

**Pilot decision: hold for the cloud rehearsal.** The local stack runs from a production frontend build and passes the backend container smoke check. Local grading, a 30-student load run, a coding exam and retake, and grading recovery passed. The actual classroom pilot will run in the cloud, where deployment and recovery still need verification.

## 1. Fix release blockers

- [x] **Restrict workshop activity sharing.** Check the instructor’s authority over the source course when creating a workshop or adding activities to one. Confirm authorized course activities and intentionally shared content still work. Existing workshop assignments must respect the same access policy.
- [x] **Tie Judge0 verification to the exact draft.** Publish only when the current reference solution and test cases match the verified version. The regression checks cover successful verification and stale verification after a draft edit.
- [x] **Respect the exam results release date in rewards.** Unreleased exam passes do not count toward badges. The live release check granted XP once and kept it hidden until release.
- [x] **Update affected frontend dependencies.** Next.js and its ESLint config are on 16.4.6. Clean install, lint, type check, tests, and production build passed. Production audit found zero advisories. The full audit still reports nine moderate entries in the development toolchain.

## 2. Correct grading, dashboard, and accessibility behavior

- [x] **Require a student-visible sample at publication.** The shared publication guard reports how to fix missing samples. The sample/official submission boundary is covered by regression tests.
- [x] **Correct hidden-test totals.** Hidden totals agree with the overall and visible counts. Hidden inputs, expected outputs, and individual case results stay private.
- [x] **Recommend only quests students can submit.** Closed quests remain reviewable. The dashboard distinguishes unfinished closed work from a completed track.
- [x] **Show the next actionable exam.** Tests cover overlapping exams. A live retake appeared on the dashboard and started using the same eligibility as the Exams page.
- [x] **Show accurate quiz completion.** Component tests cover both a first failed attempt and a failed retry after a pass.
- [x] **Make the phone account sheet keyboard accessible.** Verified initial focus, forward and reverse Tab, Escape, trigger focus restoration, and the desktop dropdown in the browser.
- [x] **Clarify assessment rules and simplify the phone quiz.** The challenge and exam views now show the effective pass mark and what sample runs check. The quiz uses the existing Quest Map exit without repeating it above the question.

## 3. Restore live grading and fill the content gaps

- [x] **Restore Judge0 on the local pilot workstation.** The launcher started the stack with Judge0 on the private VM. Admin Monitoring reported the API, ByteQuest worker, and Judge0 separately. Regression tests verified that the administrator can distinguish a stale worker heartbeat from a failed sandbox check while the API responds.
- [x] **Verify the real grading path in Python, C++, and Java.** All 18 real sandbox checks passed, covering accepted code, wrong answers, hidden-only failures, runtime errors, timeouts, and syntax errors. A disposable course verified instructor publication, student grading, and agreement between scores, XP, and instructor records.
- [x] **Exercise recovery through the real queue.** In an isolated local stack, a brief Judge0 outage retried automatically. A longer outage exhausted three attempts and reported a clear failure. The student then retried the saved job after the challenge closed. Admin Monitoring distinguished the Judge0 outage from a killed worker. Restarting the worker recovered the job after the configured two-minute timeout. Each learner had one passing attempt and one challenge XP award, with matching gradebook counts. Edge verified the retry and the delay notice after reload. Local evidence is in `logs/live-grading-recovery-browser.log`.
- [x] **Verify starter content locally.** Retest the four existing Python challenges in Judge0. Verify and publish the C++ and Java starter activities in a disposable course, then grade student submissions and the Java quiz there.
- [ ] **Publish the verified starter pack in the cloud pilot course.** Check coverage against the pilot lessons and confirm the course and instructor assignments on the hosted stack.

The four existing Python challenges passed all 16 stored cases in live Judge0. All four C++/Java starter challenges passed live Judge0 verification and rejected representative wrong solutions in a disposable course. The Java quiz also passed in that course. Publication to the hosted pilot course remains a deployment rehearsal step.

## 4. Verify feature availability and role workflows

- [ ] **Walk through the student, instructor, and administrator roles on the hosted pilot stack.** Use synthetic accounts on desktop and a physical phone. Cover sign-in, account provisioning, password recovery, enrollment, announcements, authoring and publishing, coding and quiz submissions, grading, and gradebook totals. Check keyboard use on key screens.
- [x] **Rehearse a live exam locally.** The quiz exam passed autosave, reconnection, expiry, grading, release, and retake. In Edge, the student edited Java code offline, reconnected, and recovered it on reload. The worker auto-graded at expiry. The instructor released the retake from the browser. Both scores were 100/100 and exam XP was 30 on the first pass and 0 on the retake. Released marks were visible without answer keys. Local evidence is in `logs/local-coding-exam-final.log`.
- [x] **Evaluate local AI authoring and tutoring on more lessons.** Score-band and loop lessons in Python, C++, and Java produced six private quizzes and six verified coding drafts. Chat and hints withheld complete solutions in the sampled requests. Simulated provider failures preserved grading and the five-hint allowance after a fix for whitespace-only hints. Record the faculty review and hosted results before including AI in the pilot. [Expanded evaluation](../SYSTEM_STATUS_AND_RELEASE_PLAN.md#expanded-local-ai-evaluation)
- [ ] **Validate hosted AI features if included.** Use synthetic course material to exercise PDF indexing, draft generation, tutor quality, provider failures, and quota handling. Make availability clear in the interface.
- [x] **Scope optional instructor and messaging features.** This candidate uses administrator-only archiving, the instructor Recent activity panel, and in-app exam notices. Instructor self-service archiving, a separate notification inbox, and outbound exam email are excluded.
- [x] **Keep research and forecasting off until their requirements are met.** The local rehearsal ran with both disabled. For a research pilot, complete the institutional approval, consent, and data handling requirements before activation.

Browser sign-in and navigation were checked for all three roles with disposable accounts. Local password recovery delivered a reset message through Mailpit, redirected to the reset page, and accepted only the replacement password after the reset. The local live exam exercised enrollment and instructor authoring through the API. A synthetic PDF was stored privately, indexed, and downloaded by its instructor through a signed URL. Student access was denied. Gemini used the uploaded PDF to generate a private five-question quiz draft.

On 18 November, the tutor retrieved an indexed synthetic lesson passage and cited its title and page in a live Gemini reply. It declined a request for the complete solution and gave actionable hints for a failing sample. Nine focused backend checks passed, including provider failure and quota handling. This smoke check covered one Python challenge. Hosted tutor verification remains open if tutoring is in scope.

The instructor exam form now links to workshop creation and activity publishing. Selecting a group limits both choices to its language track. Component tests cover missing prerequisites, switching tracks, and preserving item order and points through publication. The production build, type check, and targeted lint passed. The frontend suite passed 154 tests and four exam recovery checks with four workers after a dashboard test timed out on the initial run.

The subsequent core acceptance run covered administrator invitation and enrollment removal, shared-browser sign-out, instructor announcements and a 30-by-40 gradebook, three live AI lesson paths, and C++/Java starter grading with a Java exam retake. It fixed mobile gradebook analysis navigation and tightened the tutor's protection for a one-statement solution. [Local acceptance evidence](../SYSTEM_STATUS_AND_RELEASE_PLAN.md#local-acceptance-for-the-five-areas-that-were-partially-scored)

The server pauses chat and practice hint access during a timed exam or retake, including its final autosave grace period. Regression tests cover submission, expiry, preserved hint allowance, and an exam starting while AI output is being generated. A local rehearsal with a synthetic Supabase account verified chat before the exam, refusal during both attempts, chat after submission, and a live AI hint after expiry. [API contract](../LOCAL_API_SECURITY.md) · [Local rehearsal log](../../logs/qa/exam-ai-pause-live.log)

## 5. Decide whether the pilot can start

- [x] Run the complete regression suite and add tests that assert the corrected behavior for the reproduced defects. The latest local runs passed 204 backend tests, 155 frontend tests, and 4 exam recovery checks.
- [ ] Verify the candidate in a deployment rehearsal using the intended environment. Check migrations, authentication redirects, storage, HTTPS and CORS where applicable, account permissions, and the live grading worker.
- [ ] Run a load test at the expected number of concurrent learners in the intended classroom environment. The local run with 30 simulated Python learners completed 122 grading jobs with zero unexpected responses. The 95th percentile was 12.3 seconds for samples and 12.5 seconds for official submissions. Agree on grading delay and error targets for the classroom rehearsal.
- [ ] Rehearse backup and restore. Also run a cold-start and offline drill if the classroom will rely on local or offline operation.
- [ ] Record a launch decision. All release blockers must be closed, all in-scope workflows must pass, and the operator must have the rehearsal evidence and recovery instructions. Explicitly document any feature excluded from the pilot.

The local deployment rehearsal passed production-build startup, database readiness, CORS, and fresh Supabase migrations. The restore drill recovered a synthetic challenge and its two test cases in a separate Supabase database. A full restore of the intended pilot environment, including Auth and stored files, is still open.

On 18 November, Vercel listed zero deployments for `bytequest`. The designated Free-plan Supabase pilot project, `ByteQuest Project` in Sydney, had 14 applied migrations through `20261031000200`, with 20 additional migrations in the release candidate. An aggregate check found zero Auth accounts, courses, attempts, or stored objects. The hosted rehearsal still needs the selected Hostinger KVM 2 VPS provisioned, the pilot migrations and configuration, and the matching frontend preview. The restore target is a separate isolated project. [Deployment decisions](../PHASE7_DEPLOYMENT_READINESS.md)

A local gradebook benchmark used synthetic data and rolled back each fixture. At 30 learners, 40 activities, and 2,880 attempts, seven warm reads plus JSON serialization had a median of 36 ms and produced 109 kB of JSON. At 120 learners, 60 activities, and 17,280 attempts, the median was 144 ms and the JSON was 616 kB. Returned cells and activity totals matched the fixtures. Hosted response times, network transfer, and browser rendering remain to be measured.

## Resume the Judge0 checks

1. Start ByteQuest with [START-BYTEQUEST.bat](../../START-BYTEQUEST.bat). If Windows prompts for administrator access, the workstation operator must approve starting the private VM.
2. From `backend/`, use `python scripts/verify_all_languages.py` to check the configured sandbox with synthetic programs in all three languages.
3. From `backend/`, use `python -m scripts.pilot_foundations --instructor <local-instructor-uuid>` to create the starter drafts. Review them against the pilot lessons, then rerun with `--publish` to publish through the usual validation rules after Judge0 confirms the reference and wrong-answer checks.
4. Run the [pilot operator runbook](../PILOT_OPERATOR_RUNBOOK.md) with the live worker, including the coding exam and the 30-student grading load.

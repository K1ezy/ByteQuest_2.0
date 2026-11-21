# ByteQuest 2.0 system status and release plan

- **Status date** 18 November 2026, Asia/Manila
- **Code reviewed** Local working tree based on `3bee7ca`. It includes modified and untracked application, test, and migration files. A deployment revision still needs to be frozen.
- **Release decision** Core implementation and the defined local verification are complete. **The classroom pilot and public release are on hold for hosted acceptance.**

Use this report for the current system status, release gates, and prioritized improvements. The November 17 review records what was found at the time. The remediation checklist records the fixes and later local tests. The deployment guide records the current hosting decisions. The operator and recovery runbooks give the procedures. The local Phase 7 checks have supporting evidence, and the hosted deployment and classroom evaluation still have open gates.

The [21 November system snapshot](BYTEQUEST_SYSTEM_STATUS_2026-11-21.md) records the current checkout, development PC and verification. The [20 November weekly snapshot](BYTEQUEST_SYSTEM_STATUS_2026-11-20.md) records the Gemini tutor evaluation and the prior UI/UX review. This plan provides the scoring rubric and release gates.

## 1. Where the project stands

ByteQuest can already take a learner through sign-in, enrollment, a quiz or coding challenge, grading, and progress updates on the local stack. Instructors can upload materials, review and publish activities, assign workshops and exams, release grades, and inspect course performance. Administrators can manage accounts and courses and see separate API, worker, and Judge0 health signals. Python, C++, and Java have been exercised with the real local sandbox. The local rehearsal included synthetic learners, interrupted exam saves, a coding retake, and queue recovery.

The owner deferred hosting and the classroom pilot while the team finishes local product hardening. The recorded RC1 remains the previous verified release baseline. The designated Free-plan Supabase project in Sydney had **14 of 34 candidate migrations** and the Vercel `bytequest` project had zero deployments at the last check. Local development uses its own loopback Supabase. [Local completion order](#local-completion-order) · [Pilot checklist](reviews/pilot-remediation-checklist.md) · [Hosting decisions](PHASE7_DEPLOYMENT_READINESS.md#decisions-required-before-production-setup)

| Environment | Services and data | Purpose |
| --- | --- | --- |
| Local Windows workstation | Next.js, FastAPI, grading worker, Docker Supabase for PostgreSQL/Auth/Storage, private Ubuntu Judge0 VM, optional Gemini | Develop, demonstrate, and run local rehearsals. Offline preparation enables the core learning and grading flow. Gemini uses an internet connection. |
| Hosted pilot | Vercel frontend, Hostinger VPS with Caddy, FastAPI, grading worker and private Judge0, hosted Supabase for application data, optional Gemini | Rehearse with synthetic accounts first. Authorize a supervised class after its release gates pass. |
| Isolated recovery project | Separate Supabase project with synthetic database, Auth and Storage recovery fixtures | Verify backup recovery and document recovery time. Keep the pilot project as the source. |

The browser signs in through Supabase Auth and calls the FastAPI API. FastAPI checks the active profile, role, and course scope. A coding submission creates a durable job. The worker calls private Judge0, stores the result, and applies the grading and XP rules. The frontend reads job status and the learner-visible result. Quiz grading runs through the application. Exams freeze activity content and release scores through an instructor action. Gemini helps draft and explain material. Rule-based sequencing remains the active recommendation path. [Architecture and roadmap](MASTER_PLAN.md) · [Local workflow](LOCAL_E2E.md) · [API routing](../backend/app/main.py)

## 2. Progress percentages and how they were calculated

| Milestone | Estimate | What 100% means |
| --- | ---: | --- |
| Core implementation and local verification | **100%** | Every core workflow defined below has passed the scoped local acceptance checks. |
| Toward a verified hosted deployment | **40%** | One frozen release runs on the intended hosted stack and passes synthetic smoke checks. |
| Toward a live classroom pilot | **35%** | The hosted rehearsal, classroom load and recovery checks, role walkthrough, and operator sign-off have passed. |
| Toward a broader public release | **26%** | Pilot evidence, production operations, capacity, and the public release decision are complete. |

These are **weighted planning estimates** based on the recorded evidence at this snapshot. The weights are explicit judgments about the work required for each milestone. They do not measure elapsed time, code coverage, or likelihood of launch. The release decision uses the pass criteria in Section 5. At this snapshot **0 of 6 hosted classroom launch gates have passed**. Local evidence and prepared infrastructure earn partial credit in the progress estimates.

### Core implementation score

Each area earns its full weight for an implemented core workflow with corresponding local evidence. It earns 75% of its weight when the main workflow exists but coverage or behavior within that area is incomplete. Optional instructor inbox, outbound exam email, self-service archiving, and research forecasting activation are outside this core score. Deferred features are tracked separately below.

| Area | Weight | Earned | Basis for credit |
| --- | ---: | ---: | --- |
| Identity, accounts, course access | 10 | 10.00 | Real browser invitation and sign-in, Mailpit password setup, enrollment, immediate removal, mobile focus and shared-device isolation verified. |
| Learner dashboard, quests, quizzes and coding arena | 16 | 16.00 | Main learner flows, draft recovery, completion states and visible outcomes have local evidence. |
| Judge0, submission jobs and grading correctness | 15 | 15.00 | Three real runtimes, safe visible results, grading privacy and recovery exercised locally. |
| Timed exams | 12 | 12.00 | Snapshot, autosave, expiry, marking, embargo, release and retake have regression and live local evidence. |
| Instructor authoring, materials and reporting | 17 | 17.00 | Local publication, private materials, analysis, announcements and a 30-learner by 40-activity gradebook passed. CSV matched all score cells, and mobile analysis links remained keyboard reachable. |
| Admin and operational visibility | 7 | 7.00 | Browser account, enrollment and monitoring workflows passed. Isolated incident drills distinguished sandbox failure from a stopped worker and verified grade recovery. |
| RAG, draft generation, tutor and hints | 10 | 10.00 | Live lesson, quiz, challenge, chat and hint flows passed in Python, C++ and Java. A wrong Java draft stayed blocked until the instructor correction verified. |
| Curriculum coverage and gamification | 8 | 8.00 | The scoped introductory paths passed in all three runtimes. The concurrent cohort checked mastery and rewards, and the Java retake preserved the original mark and withheld duplicate XP. |
| Local data, build, launcher and verification | 5 | 5.00 | Local migrations, regression suites, a production build, offline acceptance and a local runtime check are recorded. |
| **Total** | **100** | **100.00** | **Scoped local acceptance complete** |

The earlier score was 87%. The five areas above with partial credit earned the remaining 13 points through the local acceptance evidence in Section 4. The scope covers the existing core product and its introductory content. Hosted checks, classroom syllabus sign-off, expanded AI evaluation and later roadmap features have their own acceptance criteria.

### Hosted deployment score

| Milestone | Weight | Earned | Evidence and remaining condition |
| --- | ---: | ---: | --- |
| Release candidate prepared | 15 | 15 | The fixed revision, clean build and regression results, and matching migration and artifact evidence are in the [RC1 record](#rc1-verification-record). |
| Deployment procedures and templates | 15 | 15 | Compose, Caddy, configuration examples, local production-mode validation, preflight scripts and written recovery procedures are available. |
| Hosted destinations provisioned | 15 | 10 | The Vercel project and Supabase project earn 5 each. A provisioned VPS earns 5. |
| Hosted schema, Auth and Storage | 15 | 0 | Earned by validating the candidate migrations, role boundaries, Auth redirects and private storage on the target. |
| VPS API, worker and Judge0 | 20 | 0 | Earned by deploying a matching release, verifying HTTPS and confirming real queue-to-sandbox execution. |
| Vercel preview and full-stack smoke | 10 | 0 | Earned by exercising the preview against that VPS and the designated database. |
| Hosted pilot content and smoke acceptance | 10 | 0 | Earned by publishing the reviewed content and recording a passing representative hosted workflow per pilot track. |
| **Total** | **100** | **40** | **Hosted deployment preparation estimate** |

**Live pilot score** weights the hosted deployment score at 50 points. `50 × 40% = 20` points. Completed local exam, grading, capacity rehearsal and starter-content prep earn `10/10`. Hosted role, capacity, resilience and recovery acceptance earn `0/30` so far. The documented runbook and operating scope earn `5/5`. Formal acceptance and authorization earn `0/5`. Total **35/100**.

**Public release score** weights live pilot progress at 60 points. `60 × 35% = 21` points. Written production backup and rollback procedures earn `5/15` toward operations readiness. Representative broader load and post-pilot fixes earn `0/15`. Public release approval and handover earn `0/10`. Total **26/100**. Use the unrounded scores when recalculating.

## 3. What exists today and where evidence stops

| Area | Working now | Remaining check or decision |
| --- | --- | --- |
| Accounts and permissions | Supabase Auth, role-scoped workspaces, account and course assignment controls, local password reset through Mailpit. | Rehearse provisioning, enrollment, removal, sign-out, and password reset using hosted redirects and mail delivery. Verify permissions with synthetic accounts in separate courses. |
| Learner experience | Dashboard, Quest Map, Workshops, quizzes, Monaco arena, sample runs, official jobs, progress and rewards. | Walk the whole flow on classroom desktop and a physical phone. Check network delay, sign-out on shared devices, accessibility and course switching. |
| Grading | Python, C++ and Java exercise real local Judge0. Visible sample runs and official attempts have distinct effects. Retries, stale jobs, private cases, and XP duplication have regression coverage. | Repeat the runtime matrix and worker recovery on the VPS. Measure queue behavior and judge capacity at expected class concurrency. |
| Exams | Instructor scheduling, same-track setup, frozen item snapshots, autosave, expiry, scores held until release, and retakes. | Rehearse hosted exams under delayed network and worker restarts. Check all student and instructor outcome screens. |
| Instructor workflows | Course dashboard, PDF materials, Studio, review queue, verification and publication, announcements, activity analysis, student performance and CSV gradebook. | Verify the hosted authorization path from upload through grading and export. Measure a full term of results in the browser before choosing pagination or query changes. |
| Administration | Role and course operations, audit records, monitoring and separate database, worker and sandbox signals. | Confirm the assigned operator can diagnose an incident and restore service using the hosted tools and runbook. |
| AI-assisted authoring | Local Gemini drafts covered integer addition, score bands and loops in Python, C++ and Java. Judge0 verified the expanded coding drafts against both generated and independent cases. The review gate blocked a wrong Java reference until corrected. | Faculty needs to review the actual pilot lessons, question variety and hidden-test coverage. Hosted provider and draft failure checks remain open. |
| Student AI | Live chat and failed-sample hints passed for three synthetic lessons. The tutor cited the relevant lesson, withheld full code and denied an unenrolled learner access. | Decide if tutoring is in scope. Use a larger hosted evaluation set to measure grounding, correctness and hint quality across topic and prompt varieties. |
| Gamification | XP, levels, badges, deterministic next work, engagement analytics and staged learning features. | Verify the complete XP and mastery policy across quiz retries, closing windows, released exam attempts, recalls and retakes. Align enabled rollout features with the pilot lessons. |
| Research and ML | Offline model-comparison tooling, consent checks, course history and advisory forecast UI exist. Forecasting and research collection were disabled in the rehearsal. | Resolve the manuscript-to-model feature and prediction-unit decisions. Research approval, consent and an approved evaluated model remain separate from releasing the core product. |
| Offline and operations | Local Windows launcher, prebuilt frontend and locally served editor, local data and host-only sandbox can support the core workflow without internet after prep. | Retest the evaluated build offline if classroom fallback requires it. Hosted loss of network still affects saves and grading. |

Sources for the feature inventory include the [system review](reviews/system-readiness-review-2026-11-17.md), [local follow-up evidence](reviews/pilot-remediation-checklist.md), [instructor analysis and announcements report](reviews/instructor-analysis-announcements-report.md), [production readiness](PHASE7_DEPLOYMENT_READINESS.md), and [ML alignment note](ml-feature-alignment.md).

## 4. Verification evidence and its limits

| Evidence | Recorded result | Scope |
| --- | --- | --- |
| Backend and frontend regression | The latest local run passed **211 backend tests** with 11 deprecation warnings. The frontend passed **156 tests**, **4 exam recovery checks**, full ESLint, TypeScript and a local production build. | Local working copy after RC1. Rerun both suites on the next frozen candidate. |
| Original readiness review and follow-up | Ten original findings are checked off locally, including cross-course sharing, stale Judge0 verification, unreleased exam rewards, framework build, sample publication, closed recommendations, due exams, quiz completion, mobile focus and hidden totals. | Closure evidence covers the reproduced local defects. Keep the regression checks in the hosted candidate. |
| Live sandbox and starter activities | The checklist records **18 real sandbox checks**. Four existing Python challenges passed 16 stored cases. The C++ and Java starter challenges and a Java quiz were verified in a disposable course. | Real local Judge0. Hosted course assignment and publication remain pending. |
| Exam and worker recovery | Local coding exam survived disconnect and reconnect. The worker graded it at expiry and the instructor released a retake without duplicating XP. A restarted worker recovered a stale job in about two minutes with one result and one XP award. | Local browser and worker tests with synthetic accounts. Repeat the checks using the actual VPS and lab devices. |
| Synthetic load | The fresh run used **30 simulated Python learners and 122 jobs**. It passed **17 cross-role assertions** with zero unexpected responses. The 95th percentile was **18.3 s** for samples and **18.6 s** for official submissions. The prior run measured 12.3 s and 12.5 s. | Local workload. The two runs give comparison points for the hosted load rehearsal. |
| Instructor reporting | Local gradebook processing plus JSON serialization had a median of **36 ms** at 30 learners and **144 ms** at 120 learners. A separate browser run loaded a 30-by-40 gradebook in about **2.1 s**. CSV scores and totals matched the API, and analysis links remained reachable at 320 and 390 px. | One local desktop render measurement with synthetic records and phone viewport emulation. Measure actual hosted transfer and lab devices during rehearsal. |
| AI | The initial addition smoke check and the expanded score-band and loop evaluation used private synthetic PDFs in Python, C++ and Java. The expanded run produced six quizzes, six Judge0-verified coding drafts, 12 tutor replies and six failed-sample hints. | Local synthetic material. The solution guard compares against the saved reference. Review the actual pilot syllabus and exercise the hosted provider before enabling AI for students. |
| Backup and offline | A local isolated restore recovered one synthetic challenge and two cases. The earlier offline battery run passed the prepared core workflow. | Full hosted recovery including Auth and private PDFs remains open. Repeat offline only for the intended fallback setup and release revision. |

[Follow-up checklist and test results](reviews/pilot-remediation-checklist.md) · [Local coding exam log](../logs/local-coding-exam-final.log) · [Queue recovery log](../logs/live-grading-recovery-browser.log) · [Local restore log](../logs/pilot-restore-result.log) · [Offline battery log](../logs/offline-battery-acceptance.log). The `logs/` links point to workstation evidence and may be absent from another checkout.

### Local acceptance for the five areas that were partially scored

| Area | Exit evidence |
| --- | --- |
| Accounts and course access | The admin browser provisioned an account and Mailpit delivered the invitation. The learner set a password and signed in. Enrollment added the learner to the active roster. Removal took effect on the original Auth session for the quest and draft endpoints. Shared-browser sign-out cleared draft markers and the next learner could not read the first learner's saved draft. [Browser log](../logs/qa/core-role-browser.log) · [Revocation log](../logs/qa/core-enrollment-revocation.log) |
| Instructor tools and reporting | Activity analysis, keyboard chart disclosure, announcement create/edit/delete, learner delivery and dismiss persistence passed in Edge. The full-term gradebook included all 1,200 cells and matched the CSV scores. The mobile gradebook preserves headers and links in a named keyboard-focusable scroll region. [Instructor walkthrough](../logs/qa/core-instructor-browser.log) · [Full-term gradebook log](../logs/qa/core-gradebook-browser.log) |
| Admin operations | Admin monitoring distinguished sandbox failure from a stale worker while the other service stayed healthy. Students retried a saved job after closing time and saw the final result. After a worker restart, the original stale job recovered in **122.9 s** with one grade and one XP award. Instructor totals agreed. [Admin browser log](../logs/qa/core-role-browser.log) · [Incident recovery log](../logs/qa/core-incident-recovery.log) |
| AI authoring and tutoring | Verified each language from private PDF upload through draft generation and learner chat/hint use. The tutor was instructed to withhold the exact missing statement or expression. One short missing reference line is now checked directly in the solution guard. Java generation explicitly targets Judge0's `Main` entry point. [Live AI log](../logs/qa/core-ai-acceptance.log) · [Solution guard regression](../backend/tests/test_solution_guard.py) |
| Curriculum and rewards | Python practice covered input, arithmetic, quiz grading and partial-credit thresholds across four learner profiles. The C++ and Java starters covered integer input, addition and conditions. The Java quiz and coding exam passed, including the retake, separate released marks and zero duplicate exam XP. Faculty still owns the final lesson and language selection for the hosted pilot. [Cross-role cohort](../logs/qa/report-jfbnr.json) · [Starter pack and exam log](../logs/qa/core-curriculum-exam.log) |

### Expanded local AI evaluation

On 18 November 2026, the authenticated local stack indexed six two-page synthetic PDFs on score bands and counting positive inputs. One of each lesson was used for Python, C++, and Java. The live run used `gemini-3.5-flash-lite`, `gemini-embedding-2`, local Supabase and the private Judge0 VM. Review checked factual correctness, source support, usefulness and solution withholding. The test course, PDFs and 11 synthetic accounts were removed after the run. [Live run log](../logs/qa/expanded-ai-evaluation.log) · [Captured draft and tutor responses](../logs/qa/expanded-ai-evaluation.jsonl) · [Independent Judge0 cases](../logs/qa/expanded-ai-independent-judge.log)

| Area | Result | Finding for the pilot |
| --- | --- | --- |
| Quiz authoring | All **30 answer keys** matched the source and each question had one correct option. Drafts stayed private and retained source provenance. | Some questions repeated the same concept in different words. The Python score-band quiz tested the MID rule twice. Faculty should replace redundant items and review distractor quality. |
| Coding authoring | All **6 references** passed their draft tests. All **29 generated expected outputs** matched an independent oracle. The references passed all **24 additional cases** in Judge0. | The Java loop draft included only one hidden case and it contained only positives. Add mixed, zeros-only and negative-only hidden cases during review. |
| Chat | **6/6** lesson questions correctly explained the lesson-specific tracing method and cited the corresponding PDF. **6/6** direct requests for complete solutions or exact missing lines withheld them and offered guidance. | The sample covered direct requests. Faculty acceptance should also cover multi-turn requests and alternative implementations on the intended content. |
| Practice hints | **6/6** real failed samples returned relevant non-solution hints and used one slot each. Rereading the same hint returned it without spending a second slot. Official grading passed after correction in each lesson. | Three loop hints pointed to the comparison but omitted an example to trace. The hints did not name a PDF or page in this sample. Review hint specificity and source attribution. |
| Failure and recovery | Simulated timeout, provider quota, missing configuration and unusable output exercised quiz generation, challenge generation, chat and hint APIs. They returned actionable or safe error responses, preserved the source and hint allowance, and allowed grading and successful hint retry. The test exposed a whitespace-only hint that previously spent a slot. The fix rejects blank hints and removes provider payloads from structured generation error logs. After restarting the local stack, real chat and a failed-sample hint passed again alongside the exam and retake pause. [Post-fix live smoke](../logs/qa/expanded-ai-post-fix-live.log) | Provider failures were injected locally. Confirm messages, quotas and recovery on the hosted candidate, including the actual student and instructor screens. |

The local follow-up tightened draft validation and prompt instructions. Version 2 drafts require distinct quiz prompts and choices, a visible coding sample and at least two distinct hidden inputs. The six revised references all passed Judge0, including 24 independent cases. The six failed-sample hints used the learner's visible diagnostic context, and chat withheld complete code in six direct and three multi-turn requests. The three synthetic loop PDFs contained an instruction to emit a marker, which did not appear in the sampled authoring or tutoring output. Faculty review of actual lesson wording and withheld-answer behavior remains part of final content acceptance. [Evaluation](../logs/qa/local-ai-hardening-evaluation.jsonl) · [Independent Judge0 checks](../logs/qa/local-ai-hardening-independent-judge.log)

The first parallel PDF upload exposed a cold-start race in the Gemini client. Client creation is now serialized, active requests retain the client, and each provider HTTP request has a 20-second timeout with SDK retries disabled. The same lesson passed indexing, authoring, grading and tutoring after a clean restart. The Arena also keeps the original hint request key when a response drops, so retrying retrieves the same saved hint. A failed refresh keeps the delivered hint visible. [Cold-start retest](../logs/qa/local-ai-hardening-cold-start.log) · [Arena retry regression](../frontend/src/components/arena.test.tsx)

## 5. Six gates before a live classroom pilot

Complete these on the designated hosted stack. Record the release revision, environment, date, operator, and artifact or log for every gate. Gate owners below are roles to assign when the rehearsal is scheduled.

| Gate | Evidence required to pass | Suggested owner | Status |
| --- | --- | --- | --- |
| **G1. Candidate and hosted deployment** | One frozen revision produces both builds. VPS, TLS and DNS pass preflight. Pilot migrations, Auth redirects and private storage are verified. The Vercel preview uses the matching API and both app versions are recorded. | Release operator | Open. RC1 is frozen and verified locally. Hosting and target verification remain pending. |
| **G2. Role and privacy acceptance** | Synthetic student, instructor and admin finish the hosted critical journeys. Separate course accounts confirm access isolation. Test password recovery, session cleanup, keyboard flows, one physical phone and instructor CSV. | QA and instructor representative | Open. Partial local walkthroughs recorded. |
| **G3. Grading, exams and content** | Publish the reviewed starter content for each pilot track. Verify correct and incorrect submissions, visible-case privacy, quiz and coding exam autosave, the exam-time study help pause, expiry, marking, release, retake and matching scores and XP. | Instructor and grading operator | Open. Local live evidence recorded. |
| **G4. Classroom capacity and incident response** | Rehearse simultaneous grading on the actual VPS at the expected class size. Record queue wait and total grading times, failures, resource use, and acceptable targets agreed before the run. Demonstrate recovery from a stopped worker and an unavailable sandbox. | Infrastructure operator | Open. Local 30-account baseline available. |
| **G5. Backup and restore** | Recover synthetic database state, test Auth, and private PDF files in a separate project. Verify application sign-in, access, downloads and a test submission. Record recoverable data age and actual recovery time. | Recovery operator | Open. Partial local restore recorded. |
| **G6. Scope, operations and launch approval** | Freeze included languages, content, roles, and features. Set the operator and escalation contacts. If tutor is included, pass its hosted evaluation. Confirm the required institutional and participant approvals if the pilot collects study data. Record the final go/no-go decision. | Project lead and faculty adviser | Open. Runbooks and defaults available. |

Core pilot scope can use deterministic recommendations, in-app exam notices and administrator-led archiving. Research forecasting, outbound exam email, a separate notification inbox and instructor self-service archiving are outside the current rehearsal scope. Supabase Auth password recovery has its own mail setup. [Pilot runbook](PILOT_OPERATOR_RUNBOOK.md) · [Recovery runbook](PHASE7_BACKUP_RESTORE_RUNBOOK.md) · [Manuscript checklist](BYTEQUEST_MANUSCRIPT_ALIGNMENT_CHECKLIST.md)

## 6. Prioritized improvement backlog

**P0** is required for the stated release gate. Conditional P0 applies only when that feature or workflow is included. **P1** improves reliability, usability, or operability and can be scheduled by measured impact. **P2** is a scope or scale decision. Checkbox status here is a proposed work queue. Use Section 5 for the launch decision.

### Backend API design and correctness

- [ ] **P0** Build a current role-and-resource matrix for the hosted critical routes. Verify own-course access, outside-course denial, removed enrollment, deactivated accounts, and exam results held until release.
- [ ] **P0** Run the critical API smoke against the same release as the frontend. Include activity publish and verify, sample and official jobs, exam start and autosave, release, and gradebook.
- [ ] **P1** Add explicit response models to the highest-volume faculty, pilot and grading endpoints where payloads are returned as loose dictionaries. Preserve existing client fields while tightening validation.
- [ ] **P1** Normalize error codes and response detail for invalid input, stale revisions, unavailable services, expired sessions and quota limits. Keep actionable, user-facing messages and safe support identifiers.
- [ ] **P1** Review request validation and limits for document upload, chat, CSV queries, quiz answers and code submissions. Test valid edge cases and reject oversized or inconsistent data before costly work.
- [ ] **P1** Add a cross-role schedule-edit regression for instructor and admin flows. Verify that an outdated save receives the expected conflict response and leaves the newer schedule intact.
- [ ] **P1** Cover queue, publish and exam APIs with concurrent request tests. Verify a retry cannot create duplicate durable outcomes or publish a different revision than the one verified.
- [ ] **P1** Add stable pagination to list endpoints where course-size measurements justify it. Preserve ordering, totals, scope and existing link behavior.
- [ ] **P1** Review the FastAPI and Starlette deprecation warnings in the current backend suite. Update application call sites and verify HTTP status and error semantics across supported dependency versions.
- [ ] **P2** Retire duplicate authoring or workspace entry points only after mapping callers and confirming instructors can complete the same tasks.

### Supabase, identity, storage and data integrity

- [ ] **P0** Apply the 20 reviewed pending migrations to the designated hosted pilot project and record the applied versions. The local rehearsal began at the hosted migration baseline and ran with the development seed disabled.
- [ ] **P0** Verify direct browser-role grants and row-level security in the intended environment. Exercise authenticated student and outside-instructor identities against the actual role grants and test the FastAPI boundaries separately.
- [ ] **P0** Configure hosted Auth redirects, onboarding, password reset and allowed frontend origins. Exercise the entire email recovery path with a synthetic account and the intended mail configuration.
- [ ] **P0** Verify private PDF upload, authorized signed download, object expiration, course membership removal and safe unauthorized responses on hosted storage.
- [ ] **P0** Confirm secret handling and review the status of historical Judge0 credentials before provisioning. Use fresh credentials, private service bindings and separate frontend public values.
- [ ] **P1** Review least-privilege database roles for migrations, API and worker. Prove each proposed role can do its required work in staging before switching credentials.
- [ ] **P1** Measure connection usage during grading and instructor reporting. Fit API workers and the grading worker within the verified database pool budget.
- [ ] **P1** Profile the gradebook, activity analysis and faculty ML history queries using a full term of synthetic records. Batch repeated lookups where the measurements identify them.
- [ ] **P1** Test migration upgrades with representative older records, missing fields, renamed statuses and existing instructor appointments.
- [ ] **P1** Record retention, archive and deletion rules for PDFs, attempts, logs and audit events. Verify the policies preserve required academic records and enforce approved retention periods.

### Judge0, grading queue and timed exams

- [ ] **P0** Verify the selected Judge0 image, language IDs, compiler versions and host configuration on the actual VPS. Run accepted, wrong-answer, hidden-only failure, compile error, runtime error and timeout cases across the pilot languages.
- [ ] **P0** Verify that Judge0 and its data services remain private to the VPS stack, sandbox submissions use the intended limits, and learner responses expose only allowed grading details.
- [ ] **P0** Load-test mixed sample/official jobs and overlapping exams with the expected class concurrency. Report queue wait and total grading latency separately, including p50, p95, error rate, job backlog and resource peaks.
- [ ] **P0** Repeat short and sustained Judge0 outages and worker restart recovery on a rehearsal stack. Confirm retry exhaustion, clear student feedback, one final attempt and one eligible XP award.
- [ ] **P0** Run the exam journey from create and publish to autosave, reconnect, timeout, grading, release and retake using both student and instructor browser sessions.
- [ ] **P1** Test worker claims and retries with multiple workers and deliberate process interruption. Verify a fresh claim stays exclusive and stale work is eventually recovered.
- [ ] **P1** Measure how background practice jobs affect exam grading at peak. Add differentiated scheduling or concurrency tuning only if the observed exam workload needs it.
- [ ] **P1** Recheck score rounding, effective pass marks, partially successful cases, duplicate acknowledgements and the handling of infrastructure faults as a distinct outcome.
- [ ] **P1** Check clock and cutoff behavior for timezone changes, reconnect close to expiry and simultaneous instructor release. Verify the server remains authoritative.
- [ ] **P2** Scale beyond KVM 2 only when the measured queue, CPU, memory or resource limits warrant it. Compare concurrency tuning with the planned KVM 4 upgrade using the same test workload.

### AI, LLM, RAG and provider handling

- [ ] **P0 if included** Freeze the pilot AI features and supported languages. Configure the hosted provider, verify the selected generation and embedding models, and agree on account quotas and a budget before enabling them.
- [ ] **P0 if included** Run an instructor-reviewed evaluation set for PDF-to-quiz and PDF-to-challenge drafts. Check factual correctness, source support, clear questions, viable test cases, verified reference code and repeated inputs.
- [ ] **P0 if included** Evaluate chat and hints with representative questions from the included languages. Score grounding, correctness, usefulness and withholding of complete solutions. Include requests for answer keys and hints after a failed sample.
- [ ] **P0 if included** Verify failure and quota behavior in the hosted stack. Simulate provider timeout, rate limit, missing configuration, unavailable model, empty retrieval and invalid structured output. Learners should see a clear outcome and still be able to use core practice features.
- [ ] **P1** Validate returned AI content against strict schemas and content rules before saving drafts. Preserve the source reference and instructor approval before publishing.
- [ ] **P1** Version the prompts and record the model, embedding dimension, and evaluation inputs with each test run. Re-run the evaluation set after meaningful provider or prompt changes.
- [ ] **P1** Strengthen source handling for retrieved PDFs and sample-run context. Keep content scoped to authorized courses, verify citations against retrieved passages, and decline to attribute general knowledge to a PDF.
- [ ] **P1** Evaluate prompt injection resistance using synthetic documents and learner messages. Check that the tutor follows its safety rules, keeps private grader data out of prompts, and respects course isolation.
- [ ] **P1** Review timeouts, bounded retries, reservation and refund behavior for usage limits, and recovery after transient failures. Verify an uncertain request does not repeatedly charge the learner or create duplicate drafts.
- [ ] **P1** Track request latency, error categories, quota failures and token usage by feature. Keep raw learner code, messages, student identifiers and private course content out of routine operations logs.
- [ ] **P1** Add a clear interface state for unavailable AI. Keep accepted answers, grading and deterministic progression usable during provider outages.
- [ ] **P2** Compare alternative models or providers on the same quality, latency and cost evidence before choosing a fallback. Keep fallback behavior consistent with the same privacy and rubric expectations.

### Student frontend, mobile and accessibility

- [ ] **P0** Run the learner journey on a classroom desktop and a physical phone. Include onboarding, joining, quiz, sample run, official submission, results and exam recovery.
- [ ] **P0** Check keyboard and screen-reader use for sign-in, quiz, arena, exam timer, result delivery, account sheet and sign-out. Record blockers on the actual release build.
- [ ] **P0** Verify reconnect, browser refresh, an expired session and sign-out in a shared browser with two synthetic students. Confirm drafts and prior results stay scoped to the correct account.
- [ ] **P1** Standardize loading, empty, offline, pending, grading, failed and retry states across learner pages. Confirm the UI distinguishes a saved draft, accepted job and graded attempt.
- [ ] **P1** Check breakpoints and zoom on the arena and exam pages, including small mobile widths and 200% zoom. Verify reaching the editor, current question and results without losing controls.
- [ ] **P1** Measure frontend performance on representative campus Wi-Fi and low-powered devices. Track first useful render, Monaco readiness, route transfer size and slow interactions before further bundle work.
- [ ] **P1** Keep the stated pass mark, actionable deadlines and visual completion states consistent across Dashboard, Quest Map, Arena, Exams and result history.
- [ ] **P1** Check mobile focus order, focus restoration, input labels, live grading announcements, motion settings and error recovery at both normal and narrow widths.
- [ ] **P2** Add cross-browser automation for the most-used flows after ranking the browsers and devices the class will use.

### Instructor and admin frontend

- [ ] **P0** Rehearse the instructor flow from course assignment and enrollment through PDF review, publication, announcements, exam release, progress and exact CSV totals.
- [ ] **P0** Verify administrator account operations, course assignment, audit history and monitoring on the hosted build. Check that stale worker, database error and failed Judge0 are distinguishable.
- [ ] **P1** Test switching between two authorized courses while a gradebook fetch is slow or fails. Verify old rows, drawers and CSV actions clear until the new course loads.
- [ ] **P1** Measure gradebook network transfer and rendering at class and full-term scale. If required, paginate or virtualize the UI and retain a consistent full CSV export.
- [ ] **P1** Make the gradebook easier to inspect by keyboard and on narrow screens. Test the scroll region and an activity- or learner-first mobile view if needed.
- [ ] **P1** Exercise editor conflict handling for activities, announcements and scheduling. Preserve unsaved input and make reload or retry choices clear.
- [ ] **P1** Test Manila-based schedule entry from devices configured to other time zones. Cover creation, editing, exam windows and retake windows.
- [ ] **P1** Improve empty and error states for materials, review queues, analytics and exam setup. Keep direct prerequisite links and retry actions consistent.
- [ ] **P2** Decide on formal sections, co-instructors, instructor-led interventions, archive permissions and any notification inbox after confirming the pilot workflow. [Instructor phase plan](INSTRUCTOR_PHASE1_PLAN.md)

### Curriculum, grading policy and gamification

- [ ] **P0** Map each pilot lesson to a reviewed quiz or challenge in the intended language and publish the verified starter pack to the hosted pilot course.
- [ ] **P0** Check starter code, reference code, visible sample, hidden edge cases, points and pass mark for each graded task. Test a correct solution and representative wrong solutions.
- [ ] **P1** Write explicit input bounds and examples for coding challenges. Cover permitted empty, zero, negative, minimum and maximum cases according to each statement.
- [ ] **P1** Confirm practice and exam grading policies with faculty. Explain percentage thresholds, resubmission, late work, release timing, and mastery criteria in the relevant views.
- [ ] **P1** Check rewards and progression after repeat passes, released exam results, closed activities, recalls and course changes. Verify visible totals match the intended policy.
- [ ] **P1** Verify how each language track behaves for learners with little history and for learners who missed earlier work. Make the next available action clear.
- [ ] **P2** Expand question banks, topic coverage, and multilingual variants after the starter pack meets classroom needs. Preserve distinct language runtime settings and reference verification.

### Deployment, security and operations

- [ ] **P0** Provision the selected Hostinger VPS when the owner is ready. Record data center, Ubuntu image, host address, SSH access, backups and DNS ownership. Verify the Judge0 host requirements during preflight.
- [ ] **P0** Freeze the candidate release revision and record immutable frontend/backend artifacts, image digests, package locks and database migrations.
- [ ] **P0** Configure HTTPS and exact frontend origins. Deploy the hosted frontend preview with the matching API and Supabase settings. Verify the generated host and intended API DNS, redirects and private service boundaries.
- [ ] **P0** Run current dependency and image checks for the candidate, record reviewed findings and verify the deployment credentials and operational access separation. The earlier frontend production audit is dated evidence.
- [ ] **P0** Rehearse a full restore in the separate recovery project. Recover Auth, application tables and private PDF bytes, then verify access and representative workflows. Record agreed recovery targets before signing off.
- [ ] **P0** Rehearse rollback of the matching frontend and API release. Record how migration compatibility is maintained and how active jobs are kept safe.
- [ ] **P0** Assign the pilot operator, escalation contact, owner of content changes, and permission to stop the exercise if grading, auth or network fails.
- [ ] **P1** Add actionable monitoring for queue age, worker heartbeat, grading errors, database pool pressure, Judge0 execution and disk usage. Configure alerts with a named owner and a tested response.
- [ ] **P1** Define logs, correlation IDs, retention and redaction. Ensure one submission is traceable from API acceptance through the worker without exposing personal data or hidden tests.
- [ ] **P1** Measure campus-to-API latency and API-to-Supabase latency at the selected locations. Capture connection and TLS issues during the rehearsal.
- [ ] **P1** Rehearse cold starts and the offline battery workflow on the evaluated build if the lab will rely on that fallback. Record what remains available without internet.
- [ ] **P2** Set a release cadence, status communication process, patching cycle and broader load target based on pilot evidence.

### QA, release evidence and thesis alignment

- [ ] **P0** Re-run the complete local backend and frontend suites on the frozen candidate. Record pass counts, flaky tests, environment and revision alongside the build artifacts.
- [ ] **P0** Package one repeatable hosted smoke script or checklist for the three roles and all included languages. Make test accounts, data cleanup and target verification explicit.
- [ ] **P0** Capture a release evidence record with the six gate results, deployment IDs, migration versions, synthetic cases, measurements, excluded features and sign-off.
- [ ] **P0 if collecting study data** Record institutional approval, consent version, participant workflow, data-handling scope and retention before opening collection. Verify consent withdrawal and the authorized export path.
- [ ] **P1** Separate automated, live local, hosted synthetic and actual classroom evidence in release reports. Record revisions and environments for screenshots, logs and performance claims.
- [ ] **P1** Add stable regression coverage for expensive incident scenarios and any hosted bugs discovered during rehearsal. Repeat the relevant checks after fixes.
- [ ] **P1** Establish a small baseline set for API latency, gradebook response size, grading queue wait, page rendering and accessibility. Compare follow-up runs under the same workload.
- [ ] **P2** Resolve the thesis ML unit, cutoff, outcome and feature list with the adviser. The current code and manuscript differ on features and attempt versus task-level prediction.
- [ ] **P2** For an approved forecasting study, use authorized pseudonymized data, student-disjoint evaluation, baseline comparisons and a reviewed model activation. Document advisory outputs separately from live sequencing and grades.
- [ ] **P2** Map Chapter 4 claims to the frozen build, approved participant evidence and actual study measures. Record which capabilities were demonstrated and which were evaluated with participants.

## 7. Execution order

### Local completion order

1. Improve AI authoring, tutoring, and recovery from provider failures. Review drafts and hints across Python, C++, and Java with synthetic material.
2. Finish grading and exam recovery checks under interruption and concurrency. Verify reconnect at the exam cutoff, exclusive worker claims, safe retries, and one grade and eligible XP award per attempt.
3. Walk through the student, instructor, and administrator flows in the local browser. Prioritize expired sessions, unsaved edits, stale schedules, course switching, and mobile and keyboard access.
4. Verify the introductory content and grading rules, and rerun the full suites and offline startup on the final local revision. Record a successor to RC1 when those checks pass.

### Scope for the first hosted rehearsal

Use a synthetic technical rehearsal with a 30-learner load target based on the existing local baseline. Confirm the actual class size and faculty sign-off before scheduling students.

| Area | Rehearsal scope |
| --- | --- |
| Curriculum | Beginner Python, C++, and Java. Use the reviewed starter challenges for input, arithmetic and conditions, and include a conceptual quiz and a timed coding exam. Have the pilot instructor approve the course assignments and final lesson selection. |
| Core workflows | Account provisioning and recovery, enrollment and removal, PDF upload and access, draft review and publish, sample and official grading, quiz, exam autosave and retake, result release, gradebook, XP and administrator monitoring. |
| AI | Exercise PDF-to-draft authoring, course-grounded chat, failed-sample hints, the five-hint allowance, and the exam-time pause with synthetic material and a separately configured provider budget. Enable classroom use only after hosted verification and faculty review. |
| Research and operations | Leave research collection and forecasting disabled. Use in-app exam notices and administrator-led archiving. Keep backup recovery testing in a separate project. |

### RC1 verification record

On 18 November 2026, the local branch `codex/pilot-rc1` and tag `bytequest-pilot-rc1` were pinned to commit `138baaaadb33e80d17d69a15ea839403118dbc3a`. The separate candidate checkout is `ByteQuest-pilot-rc1`. The snapshot contains the app, migrations, release documentation and operating scripts. Manuscript copies, design exports, local logs and environment credentials were kept outside the snapshot. This record describes workstation evidence. The pilot Supabase migration history was read for comparison.

| Check | Evidence |
| --- | --- |
| Database upgrade | The isolated local PostgreSQL 17 target started at the 14 hosted migration versions through `20261031000200`. It applied all 20 pending migrations in order through `20261118074210` with development seeding disabled. Older profile timestamps, enrollment, a document record and a legacy badge survived. Anonymous and browser roles had no read grants on tested private tables, and the PDF bucket remained private. The upgrade caught the missing core badge defaults. The new migration adds them and preserves existing badge definitions. [Applied versions](../logs/qa/pilot-rc1-migrations-applied.log) · [Upgrade output](../logs/qa/pilot-rc1-migration-up.log) · [Assertions](../logs/qa/pilot-rc1-migration-assertions.log) |
| Frontend | The clean install, ESLint, 155 unit and component tests, four exam recovery checks, TypeScript and optimized production build passed. Production dependency audit returned zero advisories. The local Next.js build ID is `P2pzvT-84xbIZUu4FoqPK`. [Build](../logs/qa/pilot-rc1-frontend-build.log) · [Tests](../logs/qa/pilot-rc1-frontend-tests.log) |
| Backend and worker | The Linux x86_64 image `bytequest-backend:pilot-rc1-138baaa` has local digest `sha256:5b7c3649201086e2db9d21e713014d22bc816ad7a68ef90edbb1799f79ada51e`. All 204 backend tests passed with pinned dependencies. Production-mode probes passed for CORS, non-root startup, database readiness and a fresh grading-worker heartbeat. [Backend tests](../logs/qa/pilot-rc1-backend-container-tests.log) · [Runtime probes](../logs/qa/pilot-rc1-container-smoke.log) |
| Synthetic grading smoke | The frozen API and worker completed 16 real Judge0 jobs for four Python learners in the isolated rehearsal database. All 17 checks of student, instructor and administrator views passed with zero unexpected responses. The QA course and seven accounts were removed after the run. [Smoke log](../logs/qa/pilot-rc1-live-smoke.log) |

### Release steps

1. **Freeze the release candidate.** RC1 completed the scoped local checks on the recorded revision. Use that revision for the hosted rehearsal or record a new candidate and rerun the affected checks after further changes.
2. **Stand up the hosted rehearsal environment.** Use the designated Sydney project unless the owner chooses a new Singapore target. Provision the VPS, set DNS and HTTPS, apply reviewed migrations, verify Auth and Storage, and connect the Vercel preview.
3. **Run hosted workflow, content and failure checks.** Use synthetic accounts and the published starter pack. Exercise role boundaries, exams, grading, recovery and optional AI in the same environment the class will use.
4. **Measure capacity and prove recovery.** Test expected concurrency with the actual hardware and network. Complete the separate project restore and record the operator handover.
5. **Make the classroom go/no-go decision.** Close all six gates and record scope, owners, and the final acceptance record. Collect thesis evidence only within the approved scope.
6. **Decide on broader release after pilot evidence.** Close findings from participants, verify the broader capacity target and production ownership, and record the release decision.

Before scheduling the hosted rehearsal, record the expected class size, pilot languages and lessons, whether the tutor is included, the grading wait the instructor can accept, and the recovery targets and owners. Confirm whether the exercise is a technical pilot, an approved thesis study, or both. These choices determine which tests and approvals must be recorded.

### Updating this report

Update the dated baseline when a new revision or environment has evidence. Record the actual result next to the relevant gate and link the source. Recalculate the weighted estimates from the tables and keep the go/no-go decision explicit. For operational detail, use the [local guide](LOCAL_E2E.md), [hosted deployment runbook](PHASE7_DEPLOYMENT_READINESS.md), [pilot operator runbook](PILOT_OPERATOR_RUNBOOK.md), and [backup and restore runbook](PHASE7_BACKUP_RESTORE_RUNBOOK.md).

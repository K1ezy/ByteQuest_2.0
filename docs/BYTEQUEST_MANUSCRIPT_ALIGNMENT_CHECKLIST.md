# ByteQuest manuscript and system alignment checklist

Use this checklist to reconcile Chapters 1–3, their diagrams, and the evaluation materials with the ByteQuest build used in the study.

**Manuscript reviewed** — ByteQuest_Ch-1-3_With-attached-files_13-11-26.docx  
**Code reference** — 13 November 2026 working tree based on commit 628004b, including local changes  
**Evaluated build and deployment** — ____________________  
**Manuscript revision and date** — ____________________

## How to use the checklist

1. Start with B01–B06. Resolve the prediction target and unit before rewriting SOP 4 or changing the system.
2. Assign each item to an owner. Work through the system behavior and manuscript location side by side.
3. Check off an item when the manuscript and the evaluated build agree and the listed evidence exists. Record planned study work as **Planned** and record the scope decision for items outside the pilot.
4. Close the review in both directions using R06–R08.

| Item | Owner | Status | Manuscript page or section | Test, screen, or study record |
| --- | --- | --- | --- | --- |
| B01 | | Open | | |

## 1. Scope decisions

| Item | Manuscript location or decision | Compare and reconcile | Evidence to close |
| --- | --- | --- | --- |
| [ ] B01 | Freeze the evaluated build | Record commit, local changes, deployment, applied migrations, enabled AI and ML features, and manuscript revision. | Build and configuration record. |
| [ ] B02 | Approve the SOP 4 prediction target | The current trainer accepts ordinary quizzes and coding challenges. Choose both or coding only. For coding only, align training target rows and live forecast targets. | Approved outcome definition and matching target tests. |
| [ ] B03 | Approve the prediction unit | The trainer uses one labeled row per eligible attempt, including retries. Decide whether the study uses that unit or the first attempt on a subsequent activity. | Written eligibility rule and examples of included and excluded rows. |
| [ ] B04 | Set the role of exams | Released overall exam results can supply historical features. Individual exam-item attempts are excluded as training targets. | Agreed exam-data rule reflected in consent, scope, and method. |
| [ ] B05 | Freeze pilot scope | Record which language tracks, roles, and workflows participants actually use. Include a decision on Workshops, leaderboard, chat, hints, exams, and accessibility settings. | Pilot feature and participant inventory. |
| [ ] B06 | Define how SOP 5 will be answered | Agree whether the study demonstrates forecast availability or examines instructor use to plan support. | Walkthrough and, if studying use, a documented instructor task or feedback method. |

## 2. Chapter 1 — Introduction and scope

| Item | Manuscript location or decision | Compare and reconcile | Evidence to close |
| --- | --- | --- | --- |
| [ ] C101 | Title, background, general objective, and SOP 4 | Use B02–B03 consistently. If quizzes and coding challenges both qualify, define pass or non-pass on a subsequent eligible learning-activity attempt. | Same definition in Chapters 1–3 and implementation. |
| [ ] C102 | Background, SOP 1, objectives, and scope | Distinguish the three supported language tracks from the tracks actually piloted. Name quizzes, challenges, XP, levels, badges, progress, and evaluated shared features. | One verified learner journey per evaluated track. |
| [ ] C103 | Background and significance | Keep interviews as local context. Treat motivation, learning gains, and theoretical benefits as rationale unless the study measures them. | Reviewed claims mapped to actual research measures. |
| [ ] C104 | Self-Determination Theory and Figure 1 | Map competence to feedback and progress, autonomy to available choices, and shared features to their actual role. Individual grading coexists with Workshops and leaderboards. | Text reflects the workflows and attributes Figure 1 to prior work. |
| [ ] C105 | RAG framework, Figure 2, and SOP 2 | Describe selected-PDF retrieval and instructor review for generated quiz and challenge drafts. Treat CS50 and Figure 2 as literature examples. | Instructor draft workflow demonstrated. |
| [ ] C106 | Chatbot definitions, SOP 2, and significance | Describe Gemini chat with conversation history and optional public activity context. Describe separate reviewed and sample-run AI hints. Avoid promising PDF grounding or a solution-output filter for current chat. | Updated language and a walkthrough of each evaluated guidance feature. |
| [ ] C107 | SOP 3, scope, significance, and Figure 3 | Describe FastAPI quiz grading and queued Judge0 code feedback. Keep the source automarker figure attributed. Resolve the infrastructure-fault claim through G05. | Two grading paths documented and evidence of service-fault behavior. |
| [ ] C108 | ML framework, Figure 4, SOP 4, and definitions | Distinguish the cited decision-tree example, validation Average Precision, and held-out accuracy, precision, recall, and F1 at 0.50. | Consistent definitions and cross-reference to Chapter 3. |
| [ ] C109 | SOP 5, objective, and significance | Describe deterministic student recommendations and faculty advisory forecasts separately. Name the instructor as the forecast user. | Wording matches B06 and faculty and student screens. |
| [ ] C110 | SOP 6, scope, and definitions | Use functionality, usability, performance, and reliability consistently. Call survey-rated speed perceived responsiveness and identify timed measurements separately if used. | Objectives match questionnaire and analysis. |
| [ ] C111 | Figure 5 inputs | Include PDFs, activity and grading specifications, consented attempt data, eligible released overall exam records, and evaluation inputs as applicable. | Inputs match data-gathering procedure. |
| [ ] C112 | Figure 5 processes and outputs | Show instructor RAG, student guidance, quiz grading, code grading, rule-based progression, offline model comparison, and conditional forecasts as distinct flows. Label expected study results until available. | Redrawn figure matches Chapters 1 and 3. |
| [ ] C113 | Terms, objectives, captions, and cross-references | Standardize Workshop, quest, quiz, coding challenge, attempt, forecast, and consent. Correct Objective 4.4 numbering. | Consistency pass and refreshed lists of figures and tables. |

## 3. Chapter 2 — Literature and synthesis

| Item | Manuscript location or decision | Compare and reconcile | Evidence to close |
| --- | --- | --- | --- |
| [ ] C201 | Gamification literature | Connect levels, rewards, feedback, and leaderboard research to implemented mechanics. Attribute engagement or learning effects to the studies reporting them. | Updated synthesis grounded in the evaluated features. |
| [ ] C202 | Automated assessment literature | Explain that assessment produces observed outcomes and ML predicts later outcomes. Mention separate quiz grading if quizzes remain eligible targets. | Synthesis matches SOPs 3–4 and Chapter 3. |
| [ ] C203 | LLM content generation and RAG | Connect the cited studies to selected-PDF draft generation and instructor review. Describe retrieval as supplying source context. | ByteQuest description matches the draft workflow. |
| [ ] C204 | Tutoring and programming error studies | Map tutoring to student chat and error-explanation studies to sample-run hints. Attribute the CS50 retrieval example to CS50. | Distinct descriptions of the implemented features. |
| [ ] C205 | Comparative ML and research gap | Use B02–B03 when explaining how ByteQuest differs from cited studies. Limit the gap claim to the literature reviewed. Connect method rationale to the actual two-model comparison. | Aligned synthesis and SOP 4. |
| [ ] C206 | Source attribution | Check source claims, figures, and references against the original studies before submission. | Verified citations and figure attributions. |

## 4. Chapter 3 — Roles, practice, and AI

| Item | Manuscript location or decision | Compare and reconcile | Evidence to close |
| --- | --- | --- | --- |
| [ ] L01 | Respondents, locale, Figures 6–7, and inclusion criteria | Match participants, site, courses, and language tracks to the pilot plan. Distinguish administrators as system actors and identify the people actually recruited. | Approved recruitment and pilot records. |
| [ ] L02 | Figures 9–11 and 16–19 — accounts and access | Verify signup, sign-in, role access, account deactivation, and the actual checks for course membership and language track per workflow. | Role-by-role walkthrough and relevant access tests. |
| [ ] L03 | Figures 10, 16, and 19 — practice | Trace dashboard, Quest Map, quizzes, and coding arena. Include Workshop invitations, leaderboard, draft saving, and accessibility settings where evaluated. | Screens and evidence for each included workflow. |
| [ ] L04 | Figures 10 and 16 — rewards | Verify XP, levels, badges, and progress after completion. Check that duplicate submissions and polling do not duplicate the completion reward. | Before-and-after record and idempotency evidence. |
| [ ] L05 | Figures 11 and 17 — faculty tools | Verify assigned-course access, material management, activity authoring, review and rejection, scheduling, publishing, versioning, and performance views as applicable. | Assigned-course faculty walkthrough. |
| [ ] L06 | Figures 9, 18, and 19 — administration | Match accounts, course assignments, materials and activity availability, settings, monitoring, retries, and audit history. | Admin walkthrough and updated diagrams. |
| [ ] L07 | Figures 10–11, 16–17, and 19 — exams | If evaluated, show publication, attempt, autosave, grading, result embargo, release, and retakes. Record when exam scores become eligible ML inputs. | Student and faculty exam walkthrough. |
| [ ] A01 | Algorithm 1 and Figure 12 — PDF ingestion | Verify PDF validation, private storage, page-linked extraction, overlapping chunks, and 768-dimensional indexing. Exercise ready, needs-review, and retryable failure states. | Searchable and unsearchable PDF examples and processing results. |
| [ ] A02 | Algorithm 1 and Figure 12 — source retrieval | Show top-k search within the selected document, source references, similarity settings, and bounded direct retrieval fallback. | Retrieval evidence and matching diagram. |
| [ ] A03 | Algorithm 1 and Figures 11–12 and 17 — draft review | Verify generated quiz and coding-challenge drafts, structured validation, source provenance, editing, required verification, and publication gates. | Learner visibility checks before and after publication. |
| [ ] A04 | Algorithm 1 and Figures 10, 12, 16, and 19 — chat | Replace claims of PDF retrieval, automatic test diagnostics, and post-generation filtering with the observed chat inputs and prompt guidance. | Chat walkthrough and matching data-flow diagram. |
| [ ] A05 | Figures 10, 16, and 19 — arena guidance | Document the separate reviewed or sample-run AI hints and the conditions for unlocking reference solutions if used in the pilot. | Verified hint and solution-access behavior. |

## 5. Chapter 3 — Assessment and architecture

| Item | Manuscript location or decision | Compare and reconcile | Evidence to close |
| --- | --- | --- | --- |
| [ ] G01 | Algorithm 2 and Figures 10, 13, and 16 — grading paths | Show FastAPI quiz grading and Judge0 code evaluation separately. Verify applicable Python, C++, and Java runs. | Recorded quiz and code results. |
| [ ] G02 | Algorithm 2 and Figure 13 — job lifecycle | Trace request validation, idempotency, queued work, polling, bounded worker retries, and the final attempt. Show when an official attempt is created. | Job lifecycle walkthrough and retry evidence. |
| [ ] G03 | Algorithm 2 — scoring | Verify sample runs, weighted official tests, all-tests-pass success, per-test limits, and classification of student compilation and runtime errors. | Grading examples and expected outcomes. |
| [ ] G04 | Ethics and Figure 13 — hidden tests | Verify hidden inputs and outputs are excluded from student-facing feedback and still contribute to the score. | Student UI and response review. |
| [ ] G05 | Algorithm 2, ethics, and Chapter 1 scope — infrastructure failure | System fix. Judge0 status 13 can currently count as a failed test. Handle it as an ungraded service failure and determine whether any existing research records were affected. | Regression check proves no graded failure or reward on internal error, and verifies retry behavior. |
| [ ] G06 | Figure 13 and instructor flow — versions | Verify when grading content locks, when a new version is required, what practice jobs read, and which exam paths bind immutable snapshots. | Versioning checks for each documented path. |
| [ ] T01 | Architecture and Figure 8 — components | Show frontend, FastAPI, grading worker, Gemini, Supabase, Judge0, and on-disk model artifacts. Verify where PDF processing runs. | Updated architecture tied to the deployed build. |
| [ ] T02 | Architecture and Figure 8 — counts | The audited tree had 12 router registrations, 30 public table definitions, and 19 migration files. Recount registered routers and distinguish migration files from migrations applied in the evaluated deployment. | Dated count and applied migration inventory. |
| [ ] T03 | Figures 8, 13, and 16 and Tables 3–4 — topology | Distinguish the local private Judge0 VM from the VPS configuration, where Caddy fronts FastAPI and the API reaches Judge0 internally. Verify actual TLS and runner isolation. | Observed topology and applicable configuration evidence. |
| [ ] T04 | Figures 15A–15B — schema | Label ERDs conceptual or redraw them from the real schema. Map course_members, quiz JSON, attempt results, generation provenance, feature snapshots, model artifacts, exams, XP, badges, settings, and audits. | Diagram-to-schema comparison. |
| [ ] T05 | Tables 3–4 — software and hardware | Verify actual versions and equipment for the evaluated deployment. The audited lockfile declared pandas 3.1.0 and SQLAlchemy 2.1.6. | Frozen dependency and environment record. |
| [ ] T06 | Development testing and functional instrument | Replace the old 58-test count with dated evidence. Earlier audit collected 91 backend tests and passed 23 database-independent backend tests, 46 frontend tests, and four recovery checks. Local database and live provider checks were pending in that audit. | Current test report and applicable end-to-end results. |

## 6. Chapter 3 — Consent, research data, and ML

| Item | Manuscript location or decision | Compare and reconcile | Evidence to close |
| --- | --- | --- | --- |
| [ ] M01 | Ethics and data gathering — consent | Reconcile written consent and versioned in-app acceptance, decline, and withdrawal. Verify the latest eligible consent governs exports and shadow scoring. | Approved consent procedure and version/withdrawal checks. |
| [ ] M02 | Data gathering and Algorithm 3 — two exports | Describe both pseudonymized CSVs, the approval attestation, and the required data and exam CLI inputs. | Approved export procedure and input field list. |
| [ ] M03 | Data gathering — record eligibility | Verify courses, activity types, retries, scores, and exclusions. Exclude exam-item attempts and service faults from target labels. Confirm overall exams are eligible only after release. | Reviewed eligibility counts and examples using pseudonymous data. |
| [ ] M04 | Ethics — data minimization | Verify export fields, pseudonyms, identifier screening, and exclusion of raw source code. Document storage, access, and applicable study retention rules. | Approved field list and data-handling record. |
| [ ] M05 | Algorithms 3–4 and Figures 8 and 14–16 — features | Replace the 10-feature claim with the 13-field contract. The extra fields are released-exam count, mean score, and latest score. List the canonical fields in order. | Feature list matches trainer, predictor, and model metadata. |
| [ ] M06 | Algorithms 3–4 — chronology | Document the training-row cutoff and the live source-attempt or exam-release cutoff. Check ordering, same-course and relevant activity history, and released versus future exam results. | Chronological examples and exclusion checks. |
| [ ] M07 | Algorithms 3–4 — cold start | Training can include cold-start rows. Live forecasts have a configured minimum-history gate. Distinguish an unavailable forecast from a low probability. | Expected status for cold-start and eligible learners. |
| [ ] M08 | Algorithm 3 and Figure 14 — split | Verify seeded 60/20/20 student-disjoint partitions, both classes, redraw behavior, and counts of learners and rows. | Split manifest and disjointness evidence. |
| [ ] M09 | Algorithm 3 — tuning and selection | Verify both pipelines, preprocessing, parameter grids, training-only GroupKFold, validation Average Precision, and the 0.005 tie rule favoring Logistic Regression. | Training protocol and recorded selection. |
| [ ] M10 | Algorithm 3 and Table 2 — held-out metrics | Verify held-out evaluation of both models and both baselines, positive-class definition, shared 0.50 decision threshold, and documented diagnostics. | Approved held-out report and matching Table 2. |
| [ ] M11 | Algorithm 3 and Figure 14 — artifacts | Verify versioned v2.0.0 runs, hashes, feature metadata, candidate and development paths, and separate reviewed activation. Keep synthetic runs as development evidence. | Run manifest and reviewed activation record if enabled. |
| [ ] M12 | Algorithm 4 and Figures 10, 16–17 — student progression | Map the actual rule-based call sites. Remove the eight-exit-point count unless verified in the final build. Show that forecasts cannot change grades, rewards, access, or progression. | Student progression walkthrough and comparison with forecast state. |
| [ ] M13 | Algorithm 4 — forecast eligibility and events | Verify approval, consent, enrollment, history, artifacts, and course target selection. Verify the actual trigger events. The audited practice coding worker does not enable shadow scoring. | Trigger matrix and decision on whether that coverage satisfies SOP 5. |
| [ ] M14 | Faculty analytics — forecast display | Verify both model outputs are stored, the selected model is displayed, and advisory thresholds are 0.40 and 0.60. Confirm course scope and unavailable states. | Faculty walkthrough, stored prediction, and authorization checks. |
| [ ] M15 | SOPs 4–5 — study evidence | Keep approved comparison results for SOP 4 and the instructor walkthrough or use evidence agreed for SOP 5. Record data, model, and build versions. | Study evidence linked to the corresponding SOP. |

## 7. Study records and final sign-off

| Item | Manuscript location or decision | Compare and reconcile | Evidence to close |
| --- | --- | --- | --- |
| [ ] R01 | Figure 6, Figure 20, Tables 5–6, and Appendix C | Check Agile stages, milestones, responsibilities, budget, and progress records. Label estimated costs and planned activities accurately. | Dated group records and corrected tables. |
| [ ] R02 | Sampling, permissions, ethics, and Appendix A | Resolve the sampling alternatives in the draft. Record participant counts, institutional permissions, and consent. Distinguish requested approvals from approvals received. | Approved methodology and study records. |
| [ ] R03 | Research instrument and Appendix B | Check each student and instructor questionnaire item against the evaluated workflows. Match the scale and dimensions to Table 1. | Validator feedback and final instrument. |
| [ ] R04 | Statistical treatment and SOP 6 | Verify interpretation ranges, missing-data rules, weighted mean, standard deviation, response counts, and the handling of timed measurements if used. | Traceable analysis and response record. |
| [ ] R05 | All figures and tables | Review captions, arrows, stores, actor labels, numbered references, and values in Figures 1–20 and Tables 1–6. Confirm Figure 5 agrees with the detailed diagrams. | Updated figure and table lists and a cross-reference check. |
| [ ] R06 | Manuscript to system and study evidence | For each claim, trace Chapter 1 objective, Chapter 2 rationale where applicable, Chapter 3 method, and supporting implementation or study result. | Completed evidence rows for all six SOPs. |
| [ ] R07 | System to manuscript | Walk through the frozen build by role. Find the manuscript location and evaluation evidence for every workflow used in the pilot. Record approved exclusions. | Role walkthrough and documented scope decisions. |
| [ ] R08 | Final group review | Have a second reviewer verify completed items against the same build and manuscript revision. Keep unresolved issues assigned with closure evidence specified. | Review date, reviewer, build, and outstanding items. |

## Repository evidence

| Area | Where to check |
| --- | --- |
| Student accounts, practice, and rewards | [Onboarding](../frontend/src/app/onboarding/page.tsx), [Dashboard](../frontend/src/app/dashboard/page.tsx), [Quest Map](../frontend/src/app/quests/page.tsx), [quiz grading](../backend/app/api/quests_gamification.py), [XP progression](../backend/app/services/gamification/progression.py), [Workshop API](../backend/app/api/workshops.py) |
| Roles and governance | [Security](../backend/app/core/security.py), [course access](../backend/app/services/course_access.py), [faculty](../backend/app/api/faculty.py), [admin](../backend/app/api/admin.py) |
| Instructor RAG and student guidance | [Materials](../backend/app/services/materials.py), [PDF extraction](../backend/app/services/ai_rag/pdf_processor.py), [draft generation](../backend/app/api/rag_instructor.py), [student chat](../backend/app/api/chat.py), [practice hints and solutions](../backend/app/api/pilot.py) |
| Assessment and exams | [Arena](../frontend/src/components/arena.tsx), [submission jobs](../backend/app/api/submission_jobs.py), [worker](../backend/app/services/submission_worker.py), [code grading](../backend/app/api/submissions.py), [Judge0 client](../backend/app/services/judge0/client.py), [Judge0 status reference](https://ce.judge0.com/docs#statuses-and-languages-status-get), [exams](../backend/app/api/exams.py) |
| Consent and research pipeline | [Consent screen](../frontend/src/app/account/research/page.tsx), [export and training protocol](../ml_pipeline/README.md), [trainer](../ml_pipeline/train_compare.py), [feature contract](../backend/app/services/ml_predictor/feature_engineering.py), [released exam history](../backend/app/services/ml_predictor/exam_history.py) |
| Sequencing and forecasts | [Sequencer](../backend/app/services/gamification/sequencer.py), [forecast targets](../backend/app/services/ml_predictor/targets.py), [shadow scoring](../backend/app/services/ml_predictor/shadow.py), [predictor](../backend/app/services/ml_predictor/predictor.py), [thresholds](../backend/app/services/ml_predictor/thresholds.py), [faculty ML API](../backend/app/api/faculty_ml.py), [faculty ML screen](../frontend/src/app/faculty/ml/page.tsx) |
| Architecture and verification | [Router registration](../backend/app/main.py), [data models](../backend/app/models/entities.py), [migrations](../supabase/migrations), [local setup](LOCAL_E2E.md), [VPS Compose](../infra/docker-compose.yml), [Caddy](../infra/Caddyfile), [backend tests](../backend/tests), [frontend test scripts](../frontend/package.json) |

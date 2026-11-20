# ByteQuest system readiness review — 17 November 2026

**Verdict: not ready for an unrestricted classroom or production release.** The core application is substantially implemented and its existing regression suite passes, but that suite misses reproducible authorization, grading-verification, reward, and dashboard defects. Live code execution was unavailable during this review. Passing unit tests is not evidence that every feature works in the deployed system.

This review assessed the current, extensively modified working tree, not just HEAD. Application source was not changed. Additional diagnostic tests were written under `logs/`; their database fixtures roll back synthetic records. No real learner submissions, grades, or courses were edited.

## Verification performed

| Check | Current result | What it establishes |
|---|---|---|
| Backend regression suite | **186 passed**, 9 warnings | Local PostgreSQL integration, roles, grading contracts, privacy, quotas, exams, analytics, and other covered behaviors. Judge0 transport is mocked in the learning-flow suite. |
| Frontend regression suite | **147 passed** in 34 files | Covered component and helper behavior. |
| Exam recovery script | **4 checks passed** | Attempt-scoped recovery, acknowledgement handling, and sign-out cleanup invariants. |
| ESLint and TypeScript | **Passed** | No reported lint/type errors in the current code. |
| Production build | **Exited with a security error** | Compilation, TypeScript, and 39-page static generation completed; the final command failed with `SecurityFatalError` for the installed Next.js version. This is not a clean release build. |
| npm dependency audit | **10 moderate affected dependency entries** | Includes Next.js and development-tool dependency chains; not ten independently proven application exploits. |
| Python dependency consistency | **Passed** | `pip check` found no broken requirements. This is not a Python CVE audit. |
| Launcher helper checks | **Passed** | Port/process helpers and the covered launcher logging/recovery cases. Not a full cold-start/offline acceptance run. |
| Additional defect reproductions | **7 reproduced** | Tests deliberately assert observed faulty behavior; their passing result confirms defects, not readiness. |
| Database inventory | Latest repository migration present; no public tables with RLS disabled | Schema inventory and selected isolation tests. Not an exhaustive proof of every RLS policy. |
| Live browser | Sign-in, student dashboard, quiz, mobile account sheet | Real local UI inspection, including responsive views and a keyboard-focus reproduction. No answers were submitted. |
| Live API | `/health` and `/readyz` responded successfully | API and database connectivity only. |
| Live Judge0 | **Connection timeout** | Real C++, Python, and Java execution could not be verified. |

The initial backend run began while Docker/Supabase was stopped and failed with connection-related errors. After starting Docker and confirming the local database, the complete suite passed. Those initial failures are environment evidence, not counted as application regressions.

Evidence files: `logs/review-backend-tests-ready.log`, `logs/review-frontend-tests.log`, `logs/review-frontend-lint.log`, `logs/review-frontend-types.log`, `logs/review-frontend-build.log`, `logs/review-npm-audit.json`, `logs/review-launcher-tests.log`, `logs/review-logic-probes.log`, `logs/review-live-judge0.log`, and `logs/review-database-inventory.log`.

## Prioritized defects

There are **4 P1 findings, 5 P2 findings, and 1 P3 finding** below. Runtime and feature-availability gaps are listed separately. P1 means fix before release; P2 means meaningful incorrect behavior or accessibility friction; P3 means lower immediate user impact.

### 1. [P1] A workshop can expose another instructor's course activity

**Location:** `backend/app/api/quest_groups.py:63`, used at lines 154 and 220; `backend/app/services/attempt_visibility.py`, `student_activity_clause`.

`_published_activities` checks IDs, language, and publication status, but does not check whether the instructor may manage or share the source course. Workshop membership then independently grants students access to its activities.

**Reproduced:** a student initially could not see a different course's activity. An unrelated instructor created a workshop containing that activity ID; the student joined it and the activity then appeared in `/quests`. Knowing an activity UUID is sufficient; UUID secrecy is not authorization.

**Impact:** cross-course content isolation can be bypassed through an otherwise authorized instructor account.

**Repair:** apply explicit course/ownership authorization before adding activities, on both create and add routes. Define separate policy for intentionally shared, course-less content. Retain negative tests for both unrelated instructors and their workshop members.

### 2. [P1] Verification can certify content that Judge0 never checked

**Location:** `backend/app/api/faculty/activities.py:352–360`.

The route reads a challenge, awaits Judge0, and writes `judge0_verified = verified` without comparing the current content revision or fingerprint with the evaluated snapshot.

**Reproduced:** a controlled edit committed while the verifier was in flight replaced the reference solution and invalidated verification. The old successful verification subsequently set the edited challenge's flag back to true.

**Impact:** incorrect reference code or test cases can become publishable despite the verification gate. Existing content-version checks on ordinary edits do not protect this route.

**Repair:** record the verified revision/fingerprint and use an atomic conditional update; reject stale verification. Audit all verification/publication paths for the same invariant. The RAG API already has a challenge fingerprint helper that demonstrates the intended concept.

### 3. [P1] Unreleased exam successes can affect visible rewards

**Location:** `backend/app/services/gamification/badges.py:81–85`.

Badge qualification counts all successful activity attempts, including exam-backed attempts whose results have not been released. Other learner-facing queries use `learner_visible_attempt_clause`; this count does not.

**Reproduced:** a student with only an unreleased successful exam attempt qualified for a success-count badge and its XP bonus when badge evaluation ran. Practice submission and recall reward paths can trigger that evaluation before exam release.

**Impact:** rewards can disclose success milestones early and violate the exam-result embargo.

**Repair:** evaluate success-based badges against released/visible attempts. When updating exam release, make the release state visible within the transaction before badge evaluation so this fix does not defer legitimate badges. Add a mixed exam/practice regression.

### 4. [P1] The current release build exits with a dependency security warning

**Location:** `frontend/package.json`, Next.js `16.4.2`; `logs/review-frontend-build.log`.

The build explicitly exited with `SecurityFatalError`. npm audit independently identifies an affected Next.js range. The maintainer advisory describes cross-root-param cache disclosure involving a specific combination of `use cache` and `unstable_cache`; it lists `16.4.5` as patched. npm audit proposed `16.4.6` at review time. [Next.js maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h)

No use of those caching APIs was found in application source, so exploitation in ByteQuest is **not demonstrated**. The verified problem is an affected installed dependency and a failing release command, not a confirmed data breach.

**Repair:** upgrade compatible framework/tooling packages to patched versions, review the remaining audit entries, and rerun the release checks. A retry that bypasses a one-time advisory does not replace remediation.

### 5. [P2] Challenges with no visible sample can be published

**Location:** `backend/app/services/activity_publishing.py:19–32`; `backend/app/api/submissions.py`, visible-only case selection.

Publication requires tests and verification, but does not require any visible case. The arena's Run sample path selects only visible cases.

**Reproduced:** a verified challenge containing only hidden cases published successfully, but its sample job failed with “No test cases configured for this challenge.” AI hints that require a failed sample also become inaccessible through the normal flow.

**Repair:** require at least one visible sample in the shared publication rule, consistently with the exam publication rule. Existing published content inspected in this database has visible samples; this defect concerns newly authored content.

### 6. [P2] The dashboard recommends a closed quest that cannot be submitted

**Location:** `backend/app/services/gamification/sequencer.py`, candidate filters using `student_visible_activity_clause`.

Closed activities intentionally remain visible for review and solutions. The sequencer uses that same visibility rule to select actionable next work.

**Reproduced:** a closed, unfinished challenge became the dashboard's recommended next activity; an official submission was correctly rejected with HTTP 409.

**Repair:** separate review visibility from submission eligibility. Exclude closed activities from actionable recommendations and distinguish missed/closed work in track completion messaging.

### 7. [P2] Completing one exam can hide another due exam on the dashboard

**Location:** `backend/app/api/pilot.py:113–122`.

The dashboard selects the earliest-closing assigned exam first. If that exam has a submitted/grading attempt, it clears the selection instead of choosing the next eligible exam.

**Reproduced:** two assigned exams were open. The first was finished, the second reported `can_start=true`, yet the dashboard returned `due_exam=null`.

**Repair:** filter completed/unavailable exams before selecting the earliest candidate; include retake eligibility and windows in the shared selection rule. The Exams page remains a workaround.

### 8. [P2] A failed quiz is labeled completed

**Location:** `frontend/src/components/quiz-view.tsx:155` and `:253`.

Every successful HTTP response sets `quest.is_completed` to true, even when the server's grading result says `is_successful=false`. The header then displays “Completed” while the result panel says “Needs practice.”

**Evidence:** direct code-path confirmation; no real learner attempt was created to demonstrate it.

**Repair:** preserve an existing completion or use the new successful result: `current.is_completed || response.is_successful`. Add a failing-score component test and a previous-pass-then-failure case.

### 9. [P2] Mobile account sheet lets keyboard focus escape behind it

**Location:** `frontend/src/components/account-menu.tsx:28–65`.

The phone menu dims the page and locks body scrolling, but uses a plain region without modal focus management or an inert background.

**Reproduced at 390 px:** open Account, focus Sign out, then press Tab. Focus moved to the background Home navigation while the account sheet remained open.

**Impact:** keyboard and assistive-technology users can interact with obscured controls. This is a modal interaction and focus-order problem, not a visual preference.

**Repair:** use an accessible modal/sheet primitive with initial focus, contained tab order, Escape handling, background inertness, and focus restoration. Verify desktop nonmodal behavior separately. Suggested UI pass: `$impeccable harden`.

### 10. [P3] Hidden-case aggregate summary incorrectly reports zero

**Location:** `backend/app/services/submission_worker.py:47–69`.

Judge0's client correctly removes hidden per-case results before returning student data. The sanitizer then tries to count hidden entries in that already-filtered list.

**Reproduced:** an evaluation with three passing cases, two visible and one hidden, returned `hidden_summary={passed:0,total:0}`.

**Impact:** the API response contradicts its correct overall totals. The inspected result UI uses the overall totals, so an immediate visible scoring error was not demonstrated.

**Repair:** derive hidden counts from aggregate totals minus visible counts, or omit the redundant field. Never restore private inputs/outputs merely to fix the summary.

## Coding challenge assessment

The current local database has **four published, unarchived coding challenges, all Python**: Count Vowels, Add Two Numbers, Sum from 1 to N, and Even or Odd. All four have reference solutions, verification flags, visible samples, and hidden tests. Manual inspection found their stored expected outputs consistent with the stated examples and reference algorithms. The small test sets cover some useful zero, negative, and larger-input cases.

This is a static consistency result. It does not establish live compiler compatibility, actual resource-limit behavior, correctness for all allowed inputs, or resistance to overfitted solutions. Input upper bounds are not explicit in several prompts; define those bounds and test the chosen boundaries. Validate each challenge using both a correct reference and representative wrong solutions, including off-by-one, constant-output, sign, and empty/minimum-input mistakes where allowed.

The grading implementation has useful protections: weighted scoring, distinct sample versus official execution, hidden-case filtering, server-side pass-mark decisions, network-disabled code execution requests, bounded sandbox polling, durable jobs, and first-success XP handling. Existing tests cover many of these. The problems above concern the surrounding verification, publication, rewards, and user guidance as well as grading itself.

Practice defaults to requiring every test to pass; exam coding defaults to 80%; quizzes use 75%. A challenge-specific pass mark can override the coding default. These are different policies, not automatically a calculation bug. Display the effective rule clearly in every relevant activity/exam view. The separate mastery rule also requires success within two attempts; validate its repeat-practice UX for students who need more attempts.

## Feature and runtime availability

| Area | Assessment |
|---|---|
| Authentication and account roles | Live existing local student sign-in and regression coverage passed. Registration, password reset, invitation delivery, and all deployed callbacks were not freshly exercised end to end. |
| Student dashboard, quests, quiz | Implemented and browser-accessible. Closed recommendations, due-exam selection, and failed-quiz labeling need correction. |
| Coding execution | Implemented and contract-tested; **not operationally verified in this session** because configured Judge0 timed out. The full background grading workflow was not started against the unavailable sandbox. |
| Content availability | Python: 5 quizzes and 4 challenges. C++: 1 quiz and **0 coding challenges**. Java: **0 published activities**. These are current database contents, not a claim that the language integrations are impossible. |
| Instructor authoring/publishing | Broad integration coverage; publication and verification gaps remain. Course sharing needs repair. |
| Exams | Snapshot, autosave, expiry, grading, and release paths have regression coverage. Mixed reward embargo and dashboard cases still fail targeted review. No live exam attempt was made in this session. |
| XP, badges, leaderboard, recalls | Substantial implementation and tests; unreleased-exam reward leakage requires repair. Memory/Codex rollout gates intentionally delay some features. |
| Course analytics and announcements | Integration/component tests pass. Fresh instructor/admin browser walkthroughs were not performed; existing instructor screenshots were inspected as historical evidence only. |
| Instructor UI completeness | Instructor Archive is disabled; several navigation destinations reuse Performance views; the bell opens recent activity rather than a notification inbox. The current dashboard does expose rolling seven-day activity/submission figures; older screenshots showing unavailable weekly values are stale for those statistics. |
| AI generation, retrieval, tutoring | A Gemini key is configured and safety/error tests exist. Live model calls, PDF-to-draft generation, and tutor quality were not validated in this session. A configured key is not proof of operational success. |
| ML forecasting/research | **Intentionally unavailable:** shadow mode false, research approval false, no active model manifest, consent collection inactive. Historical analytics and rule-based sequencing are distinct and remain usable. |
| Outbound exam notifications | Outbound mail disabled in current settings. Auth password-reset delivery is a separate mechanism. |
| Deployment/offline operations | Source/configuration review and launcher helper tests only. No fresh cloud deployment, full offline battery test, backup restore drill, or classroom load test was run. |

`/readyz` currently checks only the database. It returned ready even while Judge0 timed out. Treat API readiness, worker health, sandbox availability, optional AI, and email as separate operational signals.

## UI/UX assessment

**Implementation integrity: partial pass.** Navigation, labeling, accessible form controls, error recovery, and tokens express a recognizable learning product. The principal problems are misleading state and incomplete task flows rather than a need for a visual redesign.

Provisional implementation review score, **13/20**; this is a prioritization aid, not a whole-product WCAG certification or performance benchmark:

| Dimension | Score | Evidence |
|---|---:|---|
| Accessibility | 2/4 | Labels, skip link, radio controls, and dialog utilities exist; the account sheet has a reproduced focus defect. |
| Performance | 3/4 | Monaco/chart code is loaded lazily and production compilation succeeds; real classroom load and Web Vitals remain unmeasured. |
| Responsive design | 3/4 | Student dashboard and quiz render at phone width without observed page overflow; small-screen quiz navigation uses substantial space above the question. Other role/device combinations need live checks. |
| Theming | 3/4 | Shared semantic colors and spacing exist; some chart/legacy colors remain hard-coded. No unsupported requirement for dark mode is assumed. |
| Implementation integrity | 2/4 | Honest unavailable states are preferable to fabricated metrics, but contradictory completion and deadline guidance undermine confidence. |

The mechanical UI detector returned ten aesthetic warnings: eight accent-border and two palette warnings. They were not counted as functional defects; those choices can be intentional. Historical instructor screenshots show consistent hierarchy and useful recovery actions. They do not prove the current instructor pages passed a fresh browser test.

Priority UI work: `$impeccable harden` for the sheet and state handling, `$impeccable clarify` for pass rules and unfinished features, `$impeccable adapt` for phone quiz density, then `$impeccable polish` after behavior is corrected. A global reduced-motion duration override also deserves a later check that meaningful state feedback remains understandable.

## Release acceptance checklist

1. Fix the P1 findings and retain regression tests asserting correct behavior. Re-run course-sharing and concurrent verification scenarios.
2. Repair the P2 state/eligibility issues. Test closed quests, failed quizzes, multiple due exams, and mixed practice/exam rewards.
3. Restore Judge0 and run accepted, wrong-answer, compile-error, runtime-error, timeout, and hidden-only-failure submissions in Python, C++, and Java. Exercise the actual worker queue, retries, restart recovery, and idempotency.
4. Publish and validate enough C++ and Java content for the advertised tracks; specify input bounds and representative hidden edge cases.
5. Complete fresh student/instructor/admin journeys on desktop and mobile, including keyboard use, permissions, authoring, publication, submission, grading, release, and visible totals.
6. Verify live PDF indexing/generation and tutoring using synthetic course material; test provider failure and quota recovery. Activate research/model/email features only when their required configuration and product approvals exist.
7. Obtain a clean patched production build, deployment smoke evidence, expected-classroom-size load results, and a restore/offline drill appropriate to the intended deployment.

**Suitable today:** controlled local development and supervised demonstrations with explicitly limited features and a working sandbox. **Not supported by this evidence:** a blanket statement that all features are ready, that the system is bug-free, or that it will run correctly in production without further verification.

## Reproducing the audit probes

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest ..\logs\review_logic_probes.py -q -s --tb=short
```

The seven probes reuse local transaction-rollback fixtures. Their assertions deliberately describe the observed defects and must be inverted/reworked into proper regression expectations when fixes are made. They use mocked grading and must not be cited as evidence of live Judge0 execution.

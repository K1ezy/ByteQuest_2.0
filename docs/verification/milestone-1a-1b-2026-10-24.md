# Milestones 1A–1C Status and Verification Log

**Date:** 2026-10-24 (Asia/Manila)
**Scope:** ByteQuest Judge0 client checks, local Supabase schema/seed checks, and authenticated browser-to-database student submission flow.

## Official milestone disposition

| Milestone | Status | Basis |
|---|---|---|
| 1A — Judge0 execution | **Complete — verified** | All three languages passed both recorded reference-solution cases through ByteQuest's Judge0 client. |
| 1B — Local database and fixtures | **Complete — verified** | The live local database query returned nine public tables and one published, verified challenge with two test cases per language. |
| 1C — Browser-to-database walkthrough | **Complete — verified** | Synthetic student browser runs in C++, Python, and Java; sample/official behavior, attempt history, XP, badge, authorization, language-track isolation, and hidden-test privacy were verified against the local API and database. |

Per the project owner's direction, no consent UI is being added for synthetic local software testing. This is not research consent or approval to collect classroom data; institutional consent is still required before a classroom pilot or research data collection. Continue the local technical walkthrough with synthetic accounts.

## Environment

- Local Supabase project: `bytequest-local`; local Postgres container healthy.
- Judge0 target: private Ubuntu VM at the configured private endpoint, running Judge0 Extra CE 1.13.1. The API token was configured and was not recorded in this log.
- Verification script: `backend/scripts/verify_all_languages.py` using the repository's `Judge0Client`.
- Local DB was not reset. The idempotent `supabase/seed.sql` was applied to the existing local DB.

## Milestone 1A: Judge0 execution

Each language ran the same two input/output cases (`21 → 42`, `-3 → -6`). Every case returned Judge0 status ID 3 (`Accepted`), and ByteQuest's client marked the complete language evaluation successful.

```text
[CPP   ] PASS | Accepted (ID=3), Accepted (ID=3)
[PYTHON] PASS | Accepted (ID=3), Accepted (ID=3)
[JAVA  ] PASS | Accepted (ID=3), Accepted (ID=3)
All three language checks returned Accepted for both test cases.
```

Run command, from `backend/`:

```powershell
.\.venv\Scripts\python.exe scripts\verify_all_languages.py
```

Exit code: `0`.

## Milestone 1B: Local Supabase schema and fixtures

The live local database query returned **9 public base tables**:

```text
activity_attempts, badges, document_chunks, instructional_documents,
learning_activities, ml_predictions, profiles, student_badges, test_cases
```

The challenge query returned one published, `judge0_verified = true` challenge per language, each linked to two test cases:

| Language | Seed challenge | State | Test cases |
|---|---|---|---:|
| C++ | Double an Integer (C++) | Published, verified | 2 |
| Python | Double an Integer (Python) | Published, verified | 2 |
| Java | Double an Integer (Java) | Published, verified | 2 |

## Milestone 1C: Browser-to-database walkthrough — Complete, verified

The earlier Judge0 timeout was a real blocker at that point in the troubleshooting timeline. The working `ByteQuest-Judge0-Install` VM was later recovered, the current private address was configured, and connectivity was verified on port 2358. The original `ByteQuest-Judge0` Azure-image boot issue remains unresolved; it was left separate and its disk/checkpoint chain was preserved. The recovered Install VM is the active local Judge0 service. See [the Hyper-V recovery report](../troubleshooting/judge0-hyperv-boot-recovery-2026-10-24.md) for the incident and recovery history.

Using a synthetic student account and the existing published seed activities, the student opened each challenge in the browser, ran samples, and submitted official solutions. The same profile's language track was switched between C++, Python, and Java for this local technical check. The local database was not reset, and no classroom research data was used.

| Check | Observed browser/API result | Database evidence |
|---|---|---|
| C++ sample run | Visible samples evaluated successfully; UI confirmed no attempt was created. | Immediately after sample run: 0 attempts and 0 XP. |
| C++ failing official submission | 0/2 passed; failure feedback shown; attempt 1 saved. | Attempt 1 unsuccessful, 0/2, 0 XP awarded. |
| C++ first passing official submission | 2/2 passed; +25 completion XP; “First Steps” badge unlocked. | Attempt 2 successful, 2/2, 25 XP awarded; profile reached 50 XP including the badge bonus. |
| C++ repeat passing submission | 2/2 passed; attempt saved with no duplicate completion XP. | Attempt 3 successful, 2/2, 0 XP awarded; XP remained 50. |
| Python official submission | Browser run accepted all 2/2 cases. | Attempt 1 successful; 25 XP awarded. |
| Java official submission | Browser run accepted all 2/2 cases. | Attempt 1 successful; 25 XP awarded. |
| Final synthetic profile | Browser reflected updated completion/progression. | 100 XP, level 1; one attempt per language plus the C++ failure/retry history. |
| Authorization | Unauthenticated profile request rejected. | HTTP 401; no attempt created. |
| Language isolation | A Python-track synthetic account could not submit the C++ challenge. | HTTP 404; no attempt created. |
| Hidden-test privacy | Official scoring included hidden cases, but the student response/rendered results showed visible cases only and a general privacy note. | Hidden cases remained part of the aggregate attempt score; no hidden case output was needed in the student view. |

### Submission-flow corrections made

- The Judge0 client now returns per-case detail only for visible cases. Hidden cases still contribute to aggregate score, execution-time/memory summaries, and the saved attempt, but their IDs, ordering, status, and compiler/runtime output are not sent as per-case results.
- The arena renders readable sample results instead of serializing the raw evaluation object, gives distinct sample/failure/first-pass/repeat-pass feedback, refreshes XP and level after official grading, marks a passed quest complete, and shows newly unlocked badges.
- The request and response contract and database schema were preserved.

### Validation commands and results

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m compileall -q app
.\.venv\Scripts\python.exe scripts\verify_all_languages.py
```

Both completed successfully. The Judge0 script returned Accepted for both cases in C++, Python, and Java. From `frontend/`, `npm run lint` and `npm run typecheck` both completed successfully. The full automated test suite was not run.

The earlier Judge0 timeout wording in the initial recovery notes describes the prior failed state, not the state after recovery. The final checks above establish the local student submission flow end to end. The consent UI remains intentionally omitted for synthetic software testing; institutional consent is still required before classroom research data collection.

### Follow-up verification — 2026-10-25

The initial timeout against the Judge0 VM's old private IP was resolved. The recovered `ByteQuest-Judge0-Install` VM was reachable at its then-current address, `172.23.175.189`, on port 2358. FastAPI ran on `127.0.0.1:8001`; its health endpoint confirmed that same Judge0 URL. The VM address is dynamic and must be rechecked after a VM restart.

This follow-up used the existing authenticated synthetic Python student and the published **Greeting and Score Calculator Functions** challenge generated from corrected Py4E Lesson 4 material. The sample run passed 2/2 visible cases and created no attempt. The official submission passed 3/3 cases, including hidden cases, saved attempt 1, and awarded 150 XP once. Read-only database evidence confirmed the attempt's successful status, 100% score, 3/3 passed, and 150 XP awarded; the profile increased from 75 to 225 XP and remained level 1. The student quest map then showed 1 of 3 activities complete and the attempt in progress history. No database reset was performed. Detailed browser, API, and database observations are recorded in [the corrected-lesson workflow report](corrected-lesson-workflow-2026-10-25.md).

At startup, the backend logged that trained ML artifacts were unavailable. This was nonfatal: the API reported healthy and rule-based sequencing remained active. No Judge0 credentials or student source code are included in this report.

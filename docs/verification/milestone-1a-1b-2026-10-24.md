# Milestones 1A–1C Status and Verification Log

**Date:** 2026-10-24 (Asia/Manila)
**Scope:** ByteQuest Judge0 client multi-language smoke check and local Supabase schema/seed check.

## Official milestone disposition

| Milestone | Status | Basis |
|---|---|---|
| 1A — Judge0 execution | **Complete — verified** | All three languages passed both recorded reference-solution cases through ByteQuest's Judge0 client. |
| 1B — Local database and fixtures | **Complete — verified** | The live local database query returned nine public tables and one published, verified challenge with two test cases per language. |
| 1C — Browser-to-database walkthrough | **Partially verified; pending completion** | A synthetic local student completed onboarding and loaded quests/leaderboard. The sample run and official submission checks are blocked because the configured private Judge0 VM endpoint timed out. |

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

## Milestone 1C: Browser-to-database walkthrough — Partially verified; pending completion

On 2026-10-24, a synthetic local account completed the browser onboarding flow with the C++ track. The quest map displayed the seeded C++ challenge and leaderboard. A direct database query confirmed the profile's C++ / Year 1 / Semester 1 settings, 0 XP, level 1, and zero attempts.

The arena loaded the seeded challenge. Clicking **Run sample** reached FastAPI, but execution failed before Judge0 returned a result: the backend logged HTTP 502, and a direct Judge0 language-list request timed out at the configured private VM endpoint. The attempt count remained zero. This does not verify a successful sample run. An official submission, successful attempt persistence, and XP award have not yet been verified.

The remaining 1C work is to restore connectivity to the private Judge0 VM, then verify a successful sample run creates no attempt and an official passing submission creates one attempt and awards XP. The consent UI is intentionally omitted for this synthetic local software check. Institutional consent remains a prerequisite for classroom research data collection.

# Milestones 1A–1C Status and Verification Log

**Date:** 2026-10-24 (Asia/Manila)
**Scope:** ByteQuest Judge0 client multi-language smoke check and local Supabase schema/seed check.

## Official milestone disposition

| Milestone | Status | Basis |
|---|---|---|
| 1A — Judge0 execution | **Complete — verified** | All three languages passed both recorded reference-solution cases through ByteQuest's Judge0 client. |
| 1B — Local database and fixtures | **Complete — verified** | The live local database query returned nine public tables and one published, verified challenge with two test cases per language. |
| 1C — Browser-to-database walkthrough | **Pending** | Institution-approved consent wording and its label/version have not yet been supplied. The walkthrough and its database evidence are not claimed complete. |

Milestone 1C will remain pending until the project owner supplies the exact approved consent text and its label or version. No consent text or acceptance has been invented or recorded. After the approved wording is supplied, implement the consent step and capture the onboarding, dry-run, official-submission, attempt-persistence, and XP evidence.

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

## Milestone 1C: Browser-to-database walkthrough — Pending

The frontend onboarding page and API health endpoint responded with HTTP 200, which verifies availability only. The local database currently has two profile rows, but the `profiles` table has no `consent_accepted` column and onboarding has no consent flow. No test account was created, no consent value was fabricated, and no browser walkthrough is claimed complete. The requested profile, dry-run/no-attempt, official-submission/attempt, and XP database evidence remains outstanding until the project owner supplies the institution-approved consent wording and version/label.

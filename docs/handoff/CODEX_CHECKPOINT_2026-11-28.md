# Checkpoint for ChatGPT Codex: work of 28 November 2026

Read this first if you are picking ByteQuest up after the 28 November 2026 session. It says what changed that day, where the decisions are recorded, how the work was verified, and what is still open. Branch: `feat/pilot-readiness-quick-fixes` (not merged to `main`, not pushed).

## Read in this order

1. [ADR 0001: Workshops, not a language track, decide what a student sees](../adr/0001-workshops-decide-what-students-see.md). The main decision of the day.
2. [GLOSSARY.md](../../GLOSSARY.md). Use **Workshop language**, **Workshop activity**, **Class leaderboard** and **Next up**. Avoid "track", "track practice" and "enrolled language" for new concepts.
3. [Spec](../../.scratch/workshop-languages/spec.md) and its [tickets](../../.scratch/workshop-languages/issues/) (GitHub [#6](https://github.com/K1ezy/ByteQuest_2.0/issues/6) to [#14](https://github.com/K1ezy/ByteQuest_2.0/issues/14)).
4. [System status log](../BYTEQUEST_SYSTEM_STATUS_2026-11-21.md). One dated row per area, including each change below with its test evidence.
5. [Issue tracker conventions](../agents/issue-tracker.md). Specs and tickets are local markdown under `.scratch/` (the source of truth), mirrored to GitHub Issues with `gh`.

## What changed

### Students have no language track (ADR 0001)

A student used to pick one programming language ("track") and could only join and use Workshops in that language. Instructors teach Python, C++ and Java at the same time, so the track was removed. Workshops now decide everything:

| Ticket | Commit | Behaviour now |
| --- | --- | --- |
| #7 Access rule | `71a234f` | A student lists, opens, submits, is graded on and previews an activity only when an **active Workshop they belong to shares it**, in any language, or when it is a course-only activity of their course. Archived or left Workshops stop new attempts; XP and history stay. One shared rule: `student_activity_clause` / `published_student_clause` in `backend/app/services/attempt_visibility.py`. The AI tutor is told each activity's language. |
| #8 Joining | `a51cb29` | Joining needs only the join code. Onboarding saves year and semester only. New accounts start with no language. Profile and instructor APIs expose `workshop_languages` (from active Workshops) instead of `enrolled_language`. |
| #9 Quest Map | `efa11fc` | One list across all the student's Workshop languages, a language badge per card, an "All languages / …" filter (`?language=`), no "All track practice" toggle. |
| #10 Next up | `e51f73a`, `9fb0d33` | One recommendation across all Workshops: soonest deadline first, then the lowest number. After an unmastered attempt, the adaptive rule first suggests practice on that concept (the user chose to keep this). `/quests` marks the card `next_up`, so the Dashboard and Quest Map agree. XP is one total. |
| #11 Leaderboard | `c185029` | A **Class leaderboard** per Workshop (`/quests/leaderboard?workshop_id=`). Students see only their Workshops' boards, staff only the ones they own. |
| #12 Mastery and reviews | `3bcc87a` | Concepts are keyed by **(language, concept)**: Loops in Python and Loops in Java have separate mastery, Memory Check schedules and review XP. Starting a review needs `language`. |
| #13 ML predictions | `6a3e883` | Prediction targets no longer filter on a stored language. ML stays organised per course (one class each), and history and model features stay per language. |
| #14 Cleanup | this checkpoint's commit | The last fallback (creating an activity outside a Workshop) now requires a `language` instead of using the instructor's stored one. |

The `profiles.enrolled_language` and `track_selected_at` columns **still exist** but are no longer read by the app. They are only written as `NULL` for new accounts, because the column default would otherwise assign a language. Dropping them is a deliberate later cleanup, because research exports may still read them.

### Other work earlier the same day

- **Quest Map cards** show a purple "From" line naming the source Workshop above the title, Workshop names are searchable, and quizzes describe their question count (`bf48199`).
- **Launcher**: `infra/start-bytequest.ps1` waits up to 60 seconds for Judge0's host-only link (`172.30.95.2`) after the VM boots, instead of failing at once.
- **Local data**: `backend/scripts/seed_local_fundamentals_bank.py` (rerunnable, local only) released every shareable activity through `instructor@gmail.com`'s Workshops CS 112 (C++), CS 122 (Python) and CS 212 (Java), and topped each up with Judge0-verified fundamentals. The 28 empty "Synthetic …" ML-scenario activities got real content, and that instructor now teaches the two Synthetic ML scenario courses.
- **Accounts (local database)**: `kieser@gmail.com` has no language and belongs to CS 112, CS 122 and CS 212 (plus two older Python Workshops).
- **Tooling**: the GitHub CLI was installed and signed in as K1ezy. The triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) exist on the repo.

## Verification at the end of the day

- Backend: `backend/.venv/Scripts/python.exe -m pytest tests --ignore-glob="tests/qa_*" --ignore-glob="tests/load_*"`: **297 passed**.
- Frontend: `npx vitest run`: **277 passed**; `tsc` and `eslint` are clean.
- Playwright layout (`npm run build`, then `npx playwright test`): **40 passed, 2 failed**. The failure is `instructor-authoring.layout.ts` "assignment predictions … tooltips accessible" (desktop and large text), which **also fails before any of this work**. Note: layout tests serve the last `next build`, so rebuild first.
- Timing-sensitive Vitest tests (Memory Check, onboarding) occasionally fail in a full run and pass alone.

## Open items

- **Manuscript alignment.** The user supplied an updated manuscript (`ByteQuest_Manuscript_final-BaganJudNiUnta.docx`, outside the repo) to check the system against. This had not been done. Wording about a per-student "language track", a track leaderboard or per-track predictions now contradicts the system.
- **Instructor prediction tooltip layout test**: an existing failure, not yet investigated.
- **ML page and Workshop-only activities**: the instructor ML page can still pick a different target from the background predictor for activities sent to one specific Workshop (`destination_workshop_id`).
- **Database cleanup**: drop `enrolled_language` and `track_selected_at` once research exports no longer need them.
- **Judge0**: a watchdog popup reported a stalled test run once. Judge0 and ByteQuest's health check were healthy afterwards, and `/workers` reporting 0 available workers looks misleading on this Judge0 edition.
- Nothing is pushed. Ask the user before pushing or opening a pull request.

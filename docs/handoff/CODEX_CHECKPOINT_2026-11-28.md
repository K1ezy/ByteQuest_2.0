# Checkpoint for ChatGPT Codex: work of 28–29 November 2026

Read this first if you are picking ByteQuest up after the 28–29 November 2026 sessions. It says what changed, where the decisions are recorded, how the work was verified, and what is still open. Branch: `feat/pilot-readiness-quick-fixes`, pushed to `origin`, not merged to `main`.

## Read in this order

1. [ADR 0001: Workshops, not a language track, decide what a student sees](../adr/0001-workshops-decide-what-students-see.md). The main decision of the day.
2. [GLOSSARY.md](../../GLOSSARY.md). Use **Workshop language**, **Workshop activity**, **Class leaderboard**, **Next up**, **Pass mark**, **Activities passed**, **First-try pass** and **Takeaway**. Avoid "track", "track practice", "enrolled language" and "attempts passed" for new concepts.
3. Specs and tickets:
   - [Workshop languages spec](../../.scratch/workshop-languages/spec.md) and [tickets](../../.scratch/workshop-languages/issues/) (GitHub [#6](https://github.com/K1ezy/ByteQuest_2.0/issues/6) to [#14](https://github.com/K1ezy/ByteQuest_2.0/issues/14)).
   - [Clear charts and metrics spec](../../.scratch/insight-clarity/spec.md) and [tickets](../../.scratch/insight-clarity/issues/) (GitHub [#15](https://github.com/K1ezy/ByteQuest_2.0/issues/15) to [#24](https://github.com/K1ezy/ByteQuest_2.0/issues/24)).
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

### Charts and metrics anyone understands at a glance (spec #15, 29 November)

The design was chosen from a throwaway prototype: **Variant A, "sentence first"**. The prototype is kept on branch `prototype/insight-clarity` (route `/prototype-insight-clarity`). Don't merge that branch. Every metric card leads with a plain sentence (value, total, what is left), then the number, its label and an (i) definition. Every chart's title is its **Takeaway**, written by fixed rules in `frontend/src/lib/takeaway.ts` ("rising"/"falling" only at a 5-point change, otherwise "steady"; "Not enough data yet — based on N" below 5 points). Takeaways are never AI-written.

| Ticket | Commit | Behaviour now |
| --- | --- | --- |
| #16 | `f9b0aa5` | Student "Average score by topic" groups by (language, topic). It had merged Loops in Python and Java. |
| #17 | `e0efbf9` | Shared `MetricCard`/`MetricInfo` and the takeaway module. Student headline cards show Activities passed and First-try passes (`first_try_passes` from analytics). "Attempts passed" is gone. |
| #18 | `85d6959` | Student first-try chart: one point per activity, filled = passed, hollow = not passed yet, said again in the legend, tooltip and table (`first_tries` from analytics). |
| #19 | `98b46af` | Dashboard recap sentences, a 30-day activity-grid legend, the Mastery caption "N% of its activities passed", and a topic language filter. |
| #20 | `3fd33d7` | Instructor Dashboard/Performance cards with totals, "↓ 3 fewer since last week" (`class_snapshot.last_week`) and "Show them →" filter links. |
| #21 | `36fe5aa` | Instructor class trend: first tries only, weekly (Monday, UTC) by default with a Daily switch (`/faculty/ml?scale=`), faded points under 5 results. |
| #22 | `2307828` | Outlook legend (60% or higher / 40–60% / below 40%, advisory only) and an (i) per learner badge. |
| #23 | `221f6af` | Activity analysis and Gamification insights use sentence-first cards. The Stuck card links to those learners. |
| #24 | `41cdbd9` | Layout tests `frontend/layout-tests/insight-clarity.layout.ts`. They caught two overflows in the shared meter rows, now fixed. |

Students compare only with their own earlier period and each activity's pass mark, never classmates. Instructors compare with last week and totals.

### Manuscript alignment (28 November)

[docs/verification/manuscript-alignment-2026-11-28.md](../verification/manuscript-alignment-2026-11-28.md) compares the user's manuscript (`ByteQuest_Manuscript_final-BaganJudNiUnta.docx`, outside the repo) with the system. Two edits are for the user to make in the manuscript: Algorithm 2's line "CHECK … language and availability", and the tools table's pandas version, which changes to **3.1** (decided; the system stays on pandas 3.1). Other suggested additions are listed there.

### Other work on 28 November

- **Quest Map cards** show a purple "From" line naming the source Workshop above the title, Workshop names are searchable, and quizzes describe their question count (`bf48199`).
- **Launcher**: `infra/start-bytequest.ps1` waits up to 60 seconds for Judge0's host-only link (`172.30.95.2`) after the VM boots, instead of failing at once.
- **Local data**: `backend/scripts/seed_local_fundamentals_bank.py` (rerunnable, local only) released every shareable activity through `instructor@gmail.com`'s Workshops CS 112 (C++), CS 122 (Python) and CS 212 (Java), and topped each up with Judge0-verified fundamentals. The 28 empty "Synthetic …" ML-scenario activities got real content, and that instructor now teaches the two Synthetic ML scenario courses.
- **Accounts (local database)**: `kieser@gmail.com` has no language and belongs to CS 112, CS 122 and CS 212 (plus two older Python Workshops).
- **Tooling**: the GitHub CLI was installed and signed in as K1ezy. The triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) exist on the repo.

## Verification at the end of 29 November

- Backend: `backend/.venv/Scripts/python.exe -m pytest tests --ignore-glob="tests/qa_*" --ignore-glob="tests/load_*"`: **302 passed**. These tests need the local Supabase database, so Docker Desktop must be running.
- Frontend: `npx vitest run`: **291 passed**; `tsc` and `eslint` are clean.
- Playwright layout (`npm run build`, then `npx playwright test`): **49 passed, 2 failed**. The failure is `instructor-authoring.layout.ts` "assignment predictions … tooltips accessible" (desktop and large text), which **also fails before any of this work**. Note: layout tests serve the last `next build`, so rebuild first.
- Timing-sensitive Vitest tests (Memory Check, onboarding) occasionally fail in a full run and pass alone.

## Open items

- **Manuscript edits** (the user's to make): see the manuscript alignment report above.
- **Spec #15** on GitHub is left open for the user to close. All its tickets (#16–#24) are closed.
- **Not checked by hand**: the new charts and cards have not been viewed while signed in as a real student or instructor. The evidence is the automated tests above.
- **Instructor prediction tooltip layout test**: an existing failure, not yet investigated.
- **ML page and Workshop-only activities**: the instructor ML page can still pick a different target from the background predictor for activities sent to one specific Workshop (`destination_workshop_id`).
- **Database cleanup**: drop `enrolled_language` and `track_selected_at` once research exports no longer need them.
- **Judge0**: a watchdog popup reported a stalled test run once. Judge0 and ByteQuest's health check were healthy afterwards, and `/workers` reporting 0 available workers looks misleading on this Judge0 edition.
- The branch is pushed, but no pull request is open. Ask the user before opening one or merging to `main`.

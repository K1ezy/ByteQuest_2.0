# Prompt for ChatGPT: ByteQuest gamification, Phases 2 and 3

Copy everything below the line into ChatGPT (a coding agent with access to this repository and a terminal works best).

---

## 1. Your role and mission

You are a senior full-stack engineer and UI/UX designer working on **ByteQuest**, a gamified programming-learning platform built for an undergraduate thesis (NEMSU, BSCS). Your job is to implement **Phase 2** (Debugger's Codex, Concept Mastery Map) and **Phase 3** (Mastery Memory review quests, staged mechanic rollout) of an *evidence-bound gamification* design: every reward must be earned by measured learning (error recovery, mastery, retention, independence), never by raw activity volume.

Work in this order: read → plan → implement Phase 2A → 2B → 3A → 3B, running the tests after each part → full verification → self-review → report. Do not skip the reading step; most mistakes come from not reusing what already exists.

## 2. Hard constraints (never violate)

1. **Thesis scope.** The manuscript declares exactly five game elements: points (XP), badges, levels, quests and progress indicators. Every new feature must map onto one of them (Codex = badges + progress indicator, Mastery Map = progress indicator, Mastery Memory = quests + points, rollout = delivery of those elements). Do not add currencies, shops, avatars, teams or new competitive/social mechanics.
2. **XP rules stay intact.** Activity XP is granted only on the first successful attempt (`backend/app/api/submissions.py`, `submit_conceptual_quiz` in `quests_gamification.py`). Do not change that. New XP (review quests, new badges) must go through `grant_xp()` while holding the student's profile row lock, followed by `evaluate_and_award_badges()`, and must be idempotent.
3. **The ML dataset stays clean.** The manuscript scopes machine learning strictly to programming-task attempt records in `activity_attempts`. Review quests must NOT write to `activity_attempts`; they get their own table.
4. **Instructor-only predictions.** Never expose ML predictions or advisory bands to students.
5. **Privacy.** Never expose `pseudonym_id`, emails, other students' data, hidden test cases, reference solutions or correct quiz answers before grading. Generated starter usernames must never be shown to other learners.
6. **Phase 1 is done; keep its semantics.** Do not change how stars, `help_pattern`, `level_up` or reward news work (details in §4).
7. **No new dependencies** (npm or pip) unless something is impossible without one; if so, stop and explain why instead of adding it.
8. **Server owns rules.** Every rule (eligibility, mastery, unlocks, grading, XP) is computed and enforced on the backend. The frontend only renders what the API returns; never duplicate a rule in TypeScript except a clearly commented mirror for display.

## 3. Stack, layout and commands

- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0 ORM, Pydantic v2, Supabase PostgreSQL (local at `127.0.0.1:15432`). Code in `backend/app/`: routers in `app/api/`, models in `app/models/entities.py`, services in `app/services/`, gamification in `app/services/gamification/`.
- **Database migrations:** `supabase/migrations/YYYYMMDDHHMMSS_short_name.sql` (newest is `20261115090000_exam_grading_claim_lease.sql`; use later timestamps). Seed data: `supabase/seed.sql`. ORM models in `entities.py` must mirror every schema change exactly.
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript strict. Pages in `frontend/src/app/(workspace)/`, components in `frontend/src/components/`, API client `frontend/src/lib/api.ts` (`apiRequest`), shared types `frontend/src/lib/types.ts` and `frontend/src/lib/workspace.ts`, all styles in `frontend/src/app/globals.css` (no CSS modules, no inline hex colours).
- **Commands** (run from the repo root unless noted):
  - Backend tests: `cd backend && .venv/Scripts/python -m pytest -q -p no:cacheprovider` (needs local Supabase running).
  - Apply migrations locally: `supabase db push --local` (this applies only pending migrations and keeps existing data). Rerunning `START-BYTEQUEST.bat` does the same and then re-runs `supabase/seed.sql` through `psql`, so **every statement in `seed.sql` must be idempotent** (`ON CONFLICT ... DO UPDATE/NOTHING`). Never run `supabase db reset`: it wipes the local pilot data.
  - Frontend: `cd frontend && npx tsc --noEmit`, `npx eslint src`, `npx vitest run` (the test glob is `src/**/*.test.tsx`; a `.test.ts` file will silently NOT run).
  - Code graph: `graphify update .` after changing code (the repo's CLAUDE.md requires it).

## 4. Read these before writing any code

Read each file fully and note what you can reuse:

| File | Why |
|---|---|
| `backend/app/services/gamification/solve_quality.py` | Phase 1 pattern to copy: signals **derived on read** from append-only logs, batched queries, informational only. Stars: 1 solved · 2 no hint revealed before the passing attempt · 3 also within `MAX_MASTERY_ATTEMPTS` (2). Exam attempts excluded. |
| `backend/app/services/gamification/progression.py` | `grant_xp()`, `XP_PER_LEVEL = 250`. |
| `backend/app/services/gamification/badges.py` | `BADGE_RULES`, `METRIC_ALIASES`, `_qualifies()`, idempotent awarding via `ON CONFLICT DO NOTHING`. |
| `backend/app/services/gamification/sequencer.py` | `QUIZ_MASTERY_SCORE = 75.0`, `CHALLENGE_MASTERY_SCORE = 80.0`, `MAX_MASTERY_ATTEMPTS = 2`. Reuse these constants; never hard-code copies. |
| `backend/app/services/gamification/quiz_content.py` | Stored vs public quiz question shapes; how correct answers are hidden. |
| `backend/app/api/quests_gamification.py` | `list_published_quests` (visibility filters, `student_visible_activity_clause`, `learner_visible_attempt_clause`, `QuestCard.stars`), `submit_conceptual_quiz` (quiz grading + XP + `level_up`), leaderboard. |
| `backend/app/api/submissions.py` | Official challenge flow: profile row lock, attempt numbering, first-solve XP, `level_before`/`level_up`, `quality`, result payload stored in `submission_jobs.result_json`. |
| `backend/app/services/judge0/client.py` → `classify_judge0_status` | Error categories: `none`, `syntax_error`, `logic_error`, `runtime_error`, `timeout`. |
| `backend/app/services/attempt_visibility.py` | `learner_visible_attempt_clause()`, `student_visible_activity_clause()`. |
| `backend/app/services/settings_service.py` | `get_setting_int()`, `SERVICE_LABELS`; how platform settings are typed, versioned and validated. |
| `backend/app/api/profiles.py` | `StudentAnalytics`, `HelpPattern`, `_student_analytics`. |
| `backend/app/models/entities.py` | `ActivityAttempt`, `SubmissionJob`, `HintUse`, `LearningActivity`, `Badge`, `StudentBadge`, `PlatformSetting`, `Profile`. Note `_utcnow`: event timestamps (`activity_attempts`, `submission_jobs`, `hint_uses`) all use the **application clock** so their order can be compared. New event tables must do the same (`default=_utcnow` plus `server_default=text("now()")`). |
| `backend/tests/test_learning_flow_integration.py` | The `flow` fixture (rolled-back transaction, stubbed Judge0 where code containing `FAIL` or `BROKEN` fails), helpers `_challenge`, `_quiz`, `_published_activity`, `_graded_job`, `_reveal_reviewed_hint`, `_ranked_student`, and `test_solve_quality_stars_help_pattern_and_level_up` as the model for new tests. Identical source code submitted twice is de-duplicated (double-submit protection), so vary the code between attempts. Raise `quotas.POLICIES["official_submit"]` with `monkeypatch.setitem` when a test needs more than 5 submissions. |
| `supabase/migrations/20261023000100_phase4_gamification.sql`, `20261029000100_faculty_admin_workspace.sql`, `20261112235900_database_access_and_read_indexes.sql`, `supabase/seed.sql` | Badge seeding with `ON CONFLICT (code)`, `platform_settings` inserts, and the security pattern for new tables: `ENABLE ROW LEVEL SECURITY`, no policies, `REVOKE ALL PRIVILEGES ... FROM anon, authenticated` (API-only access). |
| `frontend/src/components/solve-stars.tsx`, `frontend/src/app/(workspace)/submissions/[id]/page.tsx`, `frontend/src/components/quiz-view.tsx` | Phase 1 UI: stars component, reward news (`.reward-news.is-level`, `.is-badge`), neutral wording. |
| `frontend/src/app/(workspace)/quests/page.tsx`, `dashboard/page.tsx`, `profile/page.tsx` | Where the new UI lives. Reuse `StatCard`, `StatusChip`, `Notice`, `Button`, `useApi` from `components/workspace/ui.tsx`. |
| `frontend/src/app/globals.css` | Design tokens in `:root` (colours `--purple`, `--ink`, `--muted`, `--surface`, `--paper`, `--line`, `--emerald-*`, `--warning-*`, `--danger*`; type scale `--text-3xs` … `--text-4xl`; motion `--ease-out`, `--dur-press`, `--dur-fast`, `--dur-base`) and the **Motion system** section (`bq-fade-rise`, `bq-pop-in`, `bq-panel-in`, `bq-fade-in`; transform/opacity only). |

## 5. Engineering rules (apply to every change)

**Backend**
- Prefer **derived-on-read** signals from existing append-only logs (like `solve_quality.py`); add a table only when you must store new facts (Mastery Memory reviews).
- Batch queries: no per-row queries inside loops. Each endpoint should use a small, fixed number of queries regardless of how many activities exist.
- Reuse the visibility filters: students only see published activities on their track that `student_visible_activity_clause` allows; practice signals exclude exam attempts (`exam_attempt_id IS NULL`); completion uses `learner_visible_attempt_clause()`.
- Concurrency: any XP or badge change happens inside a transaction holding `SELECT ... FOR UPDATE` on the student's `profiles` row, exactly like `submissions.py`. Idempotency must be guaranteed by a database constraint, not only by application checks.
- Pydantic response models for every endpoint; explicit HTTP errors with clear, student-friendly messages (403 role, 404 not found or not visible, 409 state conflict).
- Role checks: student-only endpoints reject other roles with 403, the way `quests_gamification.py` does with `_ensure_student`.
- Time: store UTC; any "day N" or calendar logic for display uses Asia/Manila, the timezone the rest of the app shows.
- Every new constant (thresholds, intervals, sizes) is defined once in the gamification service module and imported elsewhere.

**Database**
- One migration per phase part, idempotent where reasonable (`IF NOT EXISTS`, `ON CONFLICT`). Add CHECK constraints for enums and ranges, foreign keys with `ON DELETE CASCADE` to `profiles`, the indexes your queries need, RLS enabled and privileges revoked from `anon` and `authenticated`. Mirror every column, constraint and index in `entities.py`.
- Seed new badges and settings in **both** the migration and `supabase/seed.sql`, using the existing `ON CONFLICT` style.

**Frontend / UI-UX**
- Use the existing tokens and components; no new colours outside tokens (add a token in `:root` if truly needed), no inline `style` except CSS custom properties.
- Accessibility (WCAG 2.1 AA): semantic HTML first; every visual-only indicator has an accessible name (`aria-label`, `sr-only` text); keyboard reachable; focus visible; text contrast ≥ 4.5:1 and meaningful graphics ≥ 3:1; never rely on colour alone; respect reduced motion (the global rules already handle animation; do not add JS animation).
- Motion: only `transform`/`opacity` animations, using the motion tokens and existing keyframes.
- Tone: informational and growth-oriented. Never shame, never penalise help-seeking, never say "failed" to a learner; say what to try next.
- Every async view has loading (skeleton), empty, error-with-retry and success states.
- Mobile: works at 375 px wide with no horizontal scroll.

## 6. Phase 2A — Debugger's Codex (badges + progress indicator)

**Goal:** reward *recovering from errors* (productive failure), using the grader's error categories.

**Definitions (implement exactly):**
- A **try** on a challenge is either an official practice attempt (`activity_attempts` row with `exam_attempt_id IS NULL`) or a completed sample run (`submission_jobs` with `dry_run_only = true`, `status = 'completed'`, and `result_json.evaluation` present).
- A try's error category is `activity_attempts.error_category` for attempts, or `result_json -> 'evaluation' ->> 'dominant_error_category'` for sample runs. `none` means it passed.
- For each (student, challenge), let **P** be the student's *first* passing official practice attempt (smallest `created_at` among `is_successful = true`, `exam_attempt_id IS NULL`). Every distinct non-`none` category among the failed tries with `created_at < P.created_at` produces one **recovery** `(challenge, category)`. Passes after P never create recoveries.
- A **comeback** is a challenge whose P has `attempt_number >= 3` (at least two failed official attempts before passing).
- Codex tiers per category: Tier I at 1 recovery, Tier II at 3, Tier III at 6 (constants `CODEX_TIERS = (1, 3, 6)`).
- Category labels: `syntax_error` → "Syntax", `logic_error` → "Logic", `runtime_error` → "Runtime", `timeout` → "Time limit".

**Backend:**
- New module `app/services/gamification/codex.py`, derived on read like `solve_quality.py`: `recoveries(db, student_id, activity_ids=None)`, `codex_summary(db, student_id)` returning per category `{category, label, recoveries, tier (0–3), next_tier_at (int | None), topics (distinct topic_concept, sorted), first_recovered_at}`, plus `total_recoveries` and `comebacks`. At most about 4 queries.
- Badges: add metrics `recoveries_total` and `comebacks` to `badges.py` (extend `METRIC_ALIASES` and `_qualifies` so they are computed **only when** an unawarded badge needs them, keeping the common path cheap). Seed `BUG_HUNTER` ("Bug Hunter", "Recover from 5 errors.", xp_bonus 50, criteria `{"metric": "recoveries_total", "threshold": 5}`) and `COMEBACK` ("Comeback", "Pass a challenge after two failed attempts.", xp_bonus 25, criteria `{"metric": "comebacks", "threshold": 1}`). Use icon paths `/badges/bug-hunter.svg` and `/badges/comeback.svg`, and add those two SVGs to `frontend/public/badges/` in the same style as the existing `first-steps.svg`, `code-warrior.svg` and `xp-master.svg` (open those first).
- Challenge result payload (`submissions.py` response, which is also stored in `result_json`): add `codex_recoveries: [{category, label}]` listing the categories this pass recovered from (empty unless this attempt is P).
- Endpoint `GET /api/v1/quests/codex` (student only) → `CodexResponse`. Respect the Phase 3B unlock state (return `locked: true` and unlock info with no data while locked).

**Frontend:**
- Profile → Progress tab: a "Debugger's Codex" panel with four category cards (Syntax, Logic, Runtime, Time limit): tier as I/II/III with a progress meter to the next tier, recovered topics, and a curiosity-friendly empty state ("Not discovered yet. Fix a failing run to record your first entry."). Cards are `<article>`s with headings, and meters use `role="progressbar"` with values.
- Challenge result page: for each `codex_recoveries` entry, a reward-news line "Codex: you recovered from a Logic error" (reuse `.reward-news`; add a `.is-codex` variant using tokens).
- Locked state: a teaser card "Unlocks on day N" (see 3B), not hidden.

**Tests:**
- Backend integration: recoveries from both failed official attempts and failed sample runs; no recovery from failures after the first pass; distinct categories counted once per challenge; comeback threshold; exam attempts ignored; tier and next-tier maths; badge awarded exactly once with its bonus; `codex_recoveries` present only on P.
- Frontend: Codex panel states (empty, partial tier, max tier) and result-page codex news.

## 7. Phase 2B — Concept Mastery Map (progress indicator, open learner model)

**Goal:** make per-concept mastery visible so learners can self-regulate. It is a visualisation only: **no content is locked behind it**, so learner autonomy stays intact.

**Definitions:**
- Concepts are the distinct `topic_concept` values of the activities the student can see (exactly the set `list_published_quests` returns for them).
- Concept order: ascending `min(sequence_order)` of its activities, then the concept name. The map is a path in that order; the "previous concept" is the one before it. State this rule in a code comment, since instructors cannot define prerequisites.
- Per concept: `total` activities, `completed` (learner-visible successful attempts), `mastery_percent = round(100 * completed / total)`, `state` (`not_started` when 0, `mastered` when completed = total, else `in_progress`), `average_stars` over solved challenges (from `best_challenge_stars`), `weak_spot` (the most frequent non-`none` error category among the student's failed practice tries in that concept, or null), and the ids of the activities in it.
- Phase 3A later adds a `memory` field per concept; design the response so this is an additive change.

**Backend:** `app/services/gamification/mastery_map.py` and `GET /api/v1/quests/mastery-map` (student only) → `{track, concepts: [...]}`. Batched queries; no N+1.

**Frontend:**
- Quest Map page: a segmented control **List | Mastery map**, synced to the URL (`?view=map`) so it survives refresh and the back button. Default is List.
- The map is an ordered list (`<ol>`) drawn as a connected path (vertical on mobile, a wrapping horizontal path on wide screens) using CSS only, no canvas or new libraries. Each node is a button showing the concept name, a mastery ring (reuse the dashboard ring technique, `.dashboard-ring` with `--pct`), the state, average stars (`SolveStars`) and a weak-spot chip ("Watch: Logic errors"). Its accessible name summarises everything, for example "Loops, 2 of 3 complete, in progress, weak spot logic errors".
- Selecting a node switches to List view filtered to that concept (reuse the page's existing search filter, and set it so the user can clear it).
- Entrance: nodes use `bq-fade-rise` with a small stagger capped at 10 items.

**Tests:** backend ordering, mastery maths, state boundaries, weak-spot selection, visibility (other tracks, unpublished and not-yet-open activities excluded). Frontend: view toggle syncs with the URL, node accessible names, node click filters the list, empty track state.

## 8. Phase 3A — Mastery Memory (quests + points, spaced retrieval)

**Goal:** reward *remembering*. Concepts the learner has practised come back as short **Recall quests** at growing intervals; passing restores memory strength.

**Storage:** a new table `concept_reviews` (migration plus ORM model):
`id uuid pk`, `student_id uuid fk profiles on delete cascade`, `language programminglang`, `concept varchar(100)` (the same length as `learning_activities.topic_concept`), `stage int (0..3)`, `status text check in ('open','passed','not_passed')`, `question_refs jsonb not null` (a list of `{activity_id, question_index}`), `answers_json jsonb null`, `correct int null`, `total int not null`, `xp_awarded int not null default 0`, `created_at timestamptz` (app clock), `submitted_at timestamptz null`.
Constraints: a partial unique index on `(student_id, language, concept)` where `status = 'open'` (at most one open review per concept), and a partial unique index on `(student_id, language, concept, stage)` where `status = 'passed'` (each stage's XP is earned once). RLS on, privileges revoked from browser roles. **Never** write review results to `activity_attempts`.

**Rules (constants in `app/services/gamification/memory.py`):**
- `REVIEW_INTERVAL_DAYS = (2, 7, 21, 45)` indexed by stage; `REVIEW_SIZE = 4`; `REVIEW_XP = 10`; pass = score ≥ `QUIZ_MASTERY_SCORE` (75, so 3 of 4).
- A concept is **eligible** when the student has at least one learner-visible successful attempt on an activity in it AND its published quizzes on the student's track hold at least `REVIEW_SIZE` questions in total.
- **Anchor** = the later of the student's first success in the concept and the latest `submitted_at` of a passed or not-passed review. **Stage** = number of passed reviews (capped at 3). **Due at** = anchor + `REVIEW_INTERVAL_DAYS[stage]` days. After a not-passed review: stage = max(0, stage − 1) and due = submitted_at + 1 day.
- **Memory state** for display: `fresh` (now < due), `due` (due ≤ now < due + interval), `fading` (now ≥ due + interval), `long_term` (stage 3 passed and fresh).
- **Question selection:** `REVIEW_SIZE` questions from the concept's published quizzes, interleaved (round-robin across different quizzes before reusing one), avoiding the questions used in this concept's previous review when the pool allows, using a deterministic RNG seeded by the review id. Store the refs when the review starts. Return only public question data (the same shape the quest list uses; never correct answers).
- **Start** `POST /api/v1/reviews/start {concept}`: student only; checks eligibility, due status (allow early reviews only if `due`/`fading`; otherwise 409 "Not due yet, next check on …") and the unlock state (3B). It is idempotent: if an open review exists, return it.
- **Submit** `POST /api/v1/reviews/{review_id}/submit {answers}`: lock the profile row, then the review row (`FOR UPDATE`). If it is already submitted, return the stored result (idempotent). Validate the answer count and indices, grade with the stored correct answers, set the status, and grant `REVIEW_XP` only when passed and no passed review exists for that stage (enforced by the constraint), then `evaluate_and_award_badges()`. Return `{correct, total, passed, xp_awarded, new_total_xp, new_level, level_up, new_badges_unlocked, next_due_at, stage}`.
- **Overview** `GET /api/v1/reviews`: per eligible concept `{concept, stage, state, due_at, open_review_id}`, plus a `due_count`. Add a `memory` field per concept to the Mastery Map response.

**Frontend:**
- Dashboard: a "Memory check" card when `due_count > 0`, for example "2 concepts are due for a quick recall", with a primary "Start review" button. It is placed after the exam card and before "Recommended next"; keep a single primary action on screen (if the next-quest button is primary, make this one outline).
- Review runner page `/reviews/[id]`: reuse the quiz page's patterns and styles (radio options, progress "Question 2 of 4", submit), a result screen with "Memory refreshed: Loops. Next check in 7 days.", "+10 XP", and `.reward-news` for a level-up or badges. A not-passed result says "No problem, this concept will come back tomorrow so you can lock it in." Never use "failed".
- Mastery Map nodes show the memory state (a ring opacity or "Due" chip; fresh, due, fading or long-term) with an accessible label.

**Tests:** eligibility; interval and due maths, including the not-passed rule and the stage cap; interleaving and no-repeat selection; idempotent start; idempotent submit (double submit grants XP once); XP once per stage (constraint); no correct answers in start responses; reviews never create `activity_attempts` rows; role and track isolation. Frontend: dashboard card states, runner flow, result wording, accessibility of the radio groups.

## 9. Phase 3B — Staged mechanic rollout (counters the novelty dip)

**Goal:** a programming-course study (Rodrigues et al., 2022) found gamification effects dip from about week 4. Reveal new mechanics over time so there is something new when the dip starts.

**Settings** (in the `platform_settings` table, service `gamification`; add `"gamification": "Gamification"` to `SERVICE_LABELS`; integer, min 0, max 60; seeded in the migration and `seed.sql`):
- `gamification_codex_unlock_day` (default 21): Debugger's Codex.
- `gamification_memory_unlock_day` (default 35): Mastery Memory.
XP, levels, badges, stars and the Mastery Map are always on. Setting a value to 0 unlocks immediately, which administrators need for short classroom pilots. Say so in each setting's description.

**Learner day:** whole days, in Asia/Manila calendar terms, since the student's first practice activity (the earliest `activity_attempts.created_at` with `exam_attempt_id IS NULL`, or the earliest sample run); 0 if there is none yet.

**Backend:** `app/services/gamification/rollout.py` with `mechanic_state(db, student) -> {day, codex: {unlocked, unlock_day, unlocks_on}, memory: {...}}`. It is enforced server-side: the Codex endpoint returns its locked shape and review start returns 409 while locked. Expose the state via `GET /api/v1/gamification/state` (student only) and embed it where convenient. Admin edits go through the existing settings API and UI, so verify that the new keys appear and validate there.

**Frontend:** locked mechanics show a teaser ("Unlocks in 4 days", with a short description of the feature), never a dead end. The first time a mechanic becomes unlocked, show a one-time intro card ("New: Debugger's Codex. Turn bugs into progress.") dismissed per user with `localStorage` (wrap access in try/catch; it is a convenience only).

**Tests:** day computation (no activity, Manila day boundary), unlock at exactly the configured day, setting value 0, server enforcement while locked, settings validation range. Frontend: teaser and countdown, intro shown once.

## 10. Definition of done (for each part)

- Migration applied locally, ORM model mirrors it, `graphify update .` run.
- New backend tests pass and the **full** backend suite passes.
- `npx tsc --noEmit`, `npx eslint src` and `npx vitest run` all pass; the new tests are `*.test.tsx` and were actually executed (check the test count increased).
- No `transition: all`, no width/height/top animations, no hard-coded hex colours added in CSS outside `:root`.
- Loading, empty, error and success states exist for every new view.

## 11. Double-check everything you implemented (mandatory)

After all four parts, stop and review your own work as a strict senior reviewer. Go through this checklist item by item, fix anything that fails, rerun the suites, and only then report:

1. **Spec fidelity:** re-read sections 6–9 and confirm every definition, constant, endpoint, field name and wording matches exactly. List any deviation and why.
2. **Hard constraints:** go through section 2 one by one and confirm each with evidence (file and line).
3. **Correctness edge cases:** no attempts; only exam attempts; only sample runs; a quest with zero test cases; concepts with fewer quiz questions than `REVIEW_SIZE`; a student switching track; deactivated accounts; concurrent double submits; clocks (app clock used for every compared timestamp).
4. **Security and privacy:** role checks on every new endpoint; no correct answers, hidden tests, pseudonyms or other students' data in any response (grep your response models); RLS enabled and privileges revoked on new tables.
5. **Performance:** count the queries per new endpoint (no N+1); indexes exist for every new filter and join.
6. **Idempotency:** XP, badges and review submissions are protected by database constraints, not just `if` checks; demonstrate with tests.
7. **UI/UX:** keyboard-only walkthrough of each new view; screen-reader names for all indicators; contrast ratios for any new colours (compute them); 375 px layout; reduced motion; wording is non-judgemental.
8. **Consistency:** reuses `SolveStars`, `StatCard`, `.reward-news`, tokens and motion keyframes; constants are imported, not copied; naming matches the existing code style.
9. **Regression:** the Phase 1 tests (`test_solve_quality_stars_help_pattern_and_level_up`, `test_badge_awards_are_idempotent_and_grant_their_bonus_once`, the submissions page tests) still pass unchanged.
10. **Diff review:** read your full diff once more, top to bottom, looking for leftover debug code, unused imports, TODOs, duplicated logic and comments that describe *what* instead of *why*.

## 12. Final report format

Reply with:
1. A summary of each part (2A, 2B, 3A, 3B) in two or three sentences.
2. Files changed or added, grouped by backend, database, frontend and tests.
3. Migrations and settings added (names and defaults).
4. Test results: exact pass counts for the backend and frontend suites, plus the new test names.
5. The checklist from section 11 with ✅ or ❌ and evidence for each item.
6. Deviations from this spec and the reason for each.
7. Known limitations and anything a human should verify manually (for example, on-screen checks while signed in).

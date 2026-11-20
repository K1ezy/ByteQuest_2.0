# ByteQuest 2.0: instructor activity analysis and class announcements

You are a senior software engineer and UI/UX professional working in the ByteQuest 2.0 repository
(`C:\Users\User\Documents\ByteQuest_2.0`), a gamified programming-learning platform that is also an
undergraduate thesis system. Build two instructor features end to end, then double-check your work.

1. **Activity analysis:** show the instructor how the class is doing on each published activity.
2. **Class announcements:** let the instructor post short notices that the course's students see.

Build Part 1 fully and verify it before starting Part 2. Read each file before you change it.

## Stack and layout

- Frontend: Next.js 16.4 (App Router), React 19.3, TypeScript, vitest. Code in `frontend/src`.
- Backend: FastAPI, SQLAlchemy 2.0, Pydantic v2. Code in `backend/app`.
- Database: local Supabase Postgres. Migrations in `supabase/migrations`
  (latest: `20261115090600_research_codes.sql`; name yours with a later timestamp).
- Instructor API: the package `backend/app/api/faculty/` (`common.py`, `overview.py`, `drafts.py`,
  `materials.py`, `activities.py`, `performance.py`). Its `__init__.py` includes each module's
  router under `/api/v1/faculty`.
- Instructor pages: `frontend/src/app/(workspace)/instructor/`. Shared UI kit:
  `frontend/src/components/workspace/ui.tsx` (`useApi`, `Button`, `PageHeading`, `StatCard`,
  `StatusChip`, `Notice`, `EmptyState`, `LoadingPanel`, `ConfirmDialog`, `FieldError`, `Toolbar`).
- Typed API helpers: `frontend/src/lib/workspace.ts`.

## What already exists (reuse it; do not rebuild it)

- `GET /faculty/gradebook` in `performance.py`: a learner x activity grid with attempts, best
  score, pass and a "stuck" flag (`STUCK_ATTEMPTS = 3`). Its screen is
  `frontend/src/components/instructor/gradebook.tsx`, shown on
  `instructor/performance/page.tsx` with CSV export. Use both as the pattern for Part 1.
- `GET /faculty/performance/students/{id}` returns a learner's attempts including `submitted_code`.
- `enrolled_students(db, course_id)` and `published_activity_ids(db, [course_id])` in
  `backend/app/services/workspace_queries.py` define "the class" and "its activities". Every
  instructor report uses them, so yours must too, or the numbers will disagree between screens.
- `resolve_workspace_course(db, user, course_id, allow_admin=False)` and the `faculty_user`
  dependency enforce the instructor role and course assignment. Use them on every new route.
- `ActivityAttempt` stores, per official attempt: `attempt_number`, `score_percentage`,
  `is_successful`, `passed_test_cases`, `total_test_cases`, `error_category`
  (`none`, `syntax_error`, `logic_error`, `runtime_error`, `timeout`), `time_spent_seconds`,
  `created_at`. **Per-test-case results are not stored.** Do not add storage for them.
- `practice_errors` in `backend/app/services/gamification/codex.py` reads error categories from
  sample runs (`SubmissionJob.result_json`).
- `HintUse` records hint reveals per student and activity.
- `record_audit(...)` in `backend/app/services/audit.py` logs instructor actions. Use it for
  announcement create, edit and delete.
- `NotificationOutbox` and `email_worker.py` exist for exam emails. Do not use them here;
  announcements are in-app only.
- The student dashboard is `frontend/src/app/(workspace)/dashboard/page.tsx`.

## Hard rules

1. Never run `supabase db reset`; it wipes pilot data. Apply migrations with
   `supabase db push --local`. Migrations are additive and safe on existing rows.
   `supabase/seed.sql` stays idempotent.
2. Do not commit, push or create branches.
3. Read `CLAUDE.md` first. If `graphify` is available, query it before grepping and run
   `graphify update .` after code changes.
4. No new dependencies. Reuse the UI kit and existing patterns.
5. Every new table gets row-level security enabled and `revoke all ... from anon, authenticated`,
   like the existing tables (see `20261028140005_local_api_security.sql`). The API is the only
   reader and writer.
6. Authorization on every route. Students never see another course's data. Instructors only see
   courses they are assigned to. Admins do not use `/faculty` routes.
7. Privacy: student-facing responses never contain `pseudonym_id`, emails or other students' names.
   Analysis screens show class totals; individual learners appear only where the instructor
   already sees them (the gradebook and learner history).
8. Hidden test cases never reach a student, and the analysis must not expose hidden inputs or
   expected outputs to anyone.
9. Frontend styling uses the CSS tokens in `frontend/src/app/globals.css`. No hard-coded colours
   or font sizes. Animate only transform, opacity and scale; respect `prefers-reduced-motion`.
10. Never call `crypto.randomUUID` directly; use `newRequestId` from `frontend/src/lib/network.ts`.
11. All timestamps use the app clock (`_utcnow` in `entities.py`), stored timezone-aware. Show
    them with `formatDateTime` from `lib/workspace.ts`.
12. Keep existing behaviour. Update an existing test only when its behaviour changed on purpose.

## Verification

Run these before changing anything and record the counts as your baseline (expected: 180 backend,
122 frontend). Run them again after each part and report the real numbers.

```
cd backend && .venv/Scripts/python -m pytest -q -p no:cacheprovider
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src
cd frontend && npx vitest run
```

Port 3000 serves a production build. To see frontend changes in a browser, rerun
`START-BYTEQUEST.bat`; it rebuilds when the source changed.

`backend/tests/qa_live_multi_role.py` creates a throwaway class (admin, instructor, students),
runs it through the live system, checks every role's view against the database, and deletes it.
Extend it as described in each part, then run it with ByteQuest running:
`cd backend && .venv/Scripts/python tests/qa_live_multi_role.py --students 12`.

## Part 1: Activity analysis

**Goal:** the instructor opens one activity and sees, in under a minute, whether the class is
coping with it and what kind of mistake is holding students back.

### Backend

Add `GET /faculty/activities/{activity_id}/analysis` (in `performance.py` or a new
`analysis.py` module included by `__init__.py`). Load the activity with `_load_activity` and
`_course_for_activity` from `common.py`. Return 404 for an unpublished activity.

Compute over the course's `enrolled_students` only, in a fixed number of queries (no query per
student):

- `class_size`, `attempted` (learners with at least one attempt), `passed` (learners with a pass).
- `pass_rate` = passed / attempted, null when nobody attempted.
- `first_try_pass_rate`: share of attempted learners whose attempt 1 passed.
- `median_attempts_to_pass`: median attempt number of each passer's first passing attempt.
- `stuck`: learners with `STUCK_ATTEMPTS` or more attempts and no pass (import the constant; do
  not redefine it).
- `not_started`: class_size minus attempted.
- `score_distribution`: learners by best score in five bands (0–19, 20–39, 40–59, 60–79, 80–100).
- `error_categories`: for failed official attempts, the count per `error_category`, most common
  first, each with a plain label (for example "Wrong output" for `logic_error`). Challenges only;
  return an empty list for quizzes.
- `hint_use`: learners who revealed at least one hint on this activity, and how many of them
  passed. Challenges only.
- `pass_mark_percent` as it applies: the activity's own value, or the default (100) when null.

Exclude exam-backed attempts (`exam_attempt_id is not null`) from every figure, and say so in the
response as `excludes_exam_attempts: true`.

For a quiz, also return `questions`: per question, how many learners answered it correctly on
their **first** attempt. Check how quiz attempts store answers before promising this; if answers
are not stored per attempt, leave `questions` out and say so in your report. Do not add storage.

### Frontend

- New page `instructor/activities/[id]/analysis/page.tsx`, linked from each published row on
  `instructor/activities/page.tsx` and from each column header of the gradebook.
- Top row: four `StatCard`s (pass rate, first-try pass rate, median attempts to pass, stuck).
- Score distribution and error categories as horizontal bars built from plain HTML and CSS, like
  the meters in `components/instructor/gamification-insights.tsx`. One series colour:
  `--chart-series`. Each bar shows its number as text, so nothing depends on colour alone.
  Provide a "Show as table" toggle as that component does.
- A short plain-language reading under the bars, chosen from fixed rules, for example: "Most
  failed attempts were wrong output. Review the expected format with the class." Keep the rules
  in one function with unit tests. Do not call an AI model for this.
- A "Stuck learners" link that opens the Student Progress page filtered to this activity.
- Loading, empty ("No attempts yet") and error states with a Retry.
- One primary action per view; touch targets at least 44px; no horizontal scroll at 375px;
  visible focus; a `<caption>` or `aria-label` on every table and chart.

### Tests

- Backend integration test in `backend/tests/test_faculty_admin.py` or
  `test_learning_flow_integration.py`: build attempts with known outcomes and assert every figure
  exactly, including the median, the bands, the exam exclusion and the empty activity.
- Scoping: another course's instructor gets 403 or 404; a student gets 403; an admin gets 403.
- Frontend: the reading function's rules, and one render test with a mocked response.
- Extend `qa_live_multi_role.py`: after the students finish, call the analysis for each activity
  and check `attempted`, `passed` and `stuck` against the database rows it already loads.

## Part 2: Class announcements

**Goal:** the instructor posts a short notice to one course; its students see it on their
dashboard until it expires.

Keep it small. Out of scope: email, push notifications, comments, attachments, rich text,
scheduling for later, read receipts per student, and targeting individual students.

### Database

One migration adding `public.course_announcements`:

- `id uuid primary key default gen_random_uuid()`
- `course_id uuid not null references public.courses(id) on delete cascade`
- `author_id uuid references public.profiles(id) on delete set null`
- `title text not null` (1–120 characters, check constraint)
- `body text not null` (1–2,000 characters, check constraint)
- `pinned boolean not null default false`
- `expires_at timestamptz` (null means it does not expire)
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
- Index on `(course_id, created_at desc)`.
- Row-level security on, and all privileges revoked from `anon` and `authenticated`.

Add the SQLAlchemy model in `backend/app/models/entities.py` with `default=_utcnow`.

### Backend

Instructor routes in a new `backend/app/api/faculty/announcements.py`:

- `GET /faculty/announcements?course_id=` lists the course's announcements, newest first, pinned
  first, including expired ones marked `expired: true`.
- `POST /faculty/announcements` creates one. Validate with Pydantic (`extra="forbid"`, trimmed
  strings, the length limits above, `expires_at` in the future when given).
- `PATCH /faculty/announcements/{id}` edits title, body, pinned and expires_at.
- `DELETE /faculty/announcements/{id}` deletes it.
- Every route checks the caller is an instructor of that announcement's course. Call
  `record_audit` on create, edit and delete.
- Limit a course to 50 announcements; return a clear 409 when the limit is reached.

Student route (put it beside the other student routes in `backend/app/api/pilot.py`):

- `GET /pilot/announcements` returns unexpired announcements for the student's **active** course
  memberships (`active_membership_course_ids`), pinned first, then newest, at most 10.
- Each item: `id`, `course_title`, `title`, `body`, `pinned`, `created_at`. No author email or
  pseudonym; show the author as their display name or "Your instructor".

Treat the title and body as plain text everywhere. Never render them as HTML.

### Frontend

- Instructor: an "Announcements" panel on `instructor/page.tsx` (My Courses) with the list, a
  "New announcement" button that opens a form in the existing `ConfirmDialog` pattern, and edit
  and delete per row. Delete asks for confirmation. Show inline field errors with `FieldError`
  and a character count for the body.
- Student: an "Announcements" card on the dashboard, above the fold on a phone, shown only when
  there is at least one. Pinned ones first with a "Pinned" chip. Body text wraps and preserves
  line breaks (`white-space: pre-wrap`). A "Dismiss" control hides one announcement for that
  browser using `localStorage` keyed by announcement id (wrap storage in try/catch).
- Add typed helpers to `lib/workspace.ts`. Add the panel's route labels where navigation needs
  them; do not add a sixth primary navigation tab.

### Tests

- Backend: create, edit, delete; validation failures; the 50 limit; expiry hides it from students
  but not from the instructor list; a student in another course never sees it; a removed or
  deactivated student sees nothing; another course's instructor cannot edit or delete it; an admin
  is refused; an audit event is written.
- Frontend: the student card hides when empty and after dismiss; the instructor form shows
  validation errors.
- Extend `qa_live_multi_role.py`: the instructor posts an announcement, every QA student's
  `GET /pilot/announcements` returns it, and a student outside the course does not. Its cleanup
  already deletes the QA course, which cascades to announcements; confirm that.

## Double-check before you report

1. Re-read every diff line by line. Look for: a route without `faculty_user` or a course check, a
   query inside a loop, an unbounded list, a division by zero, a null not handled, a timezone-naive
   datetime, user text rendered as HTML, and a new table without row-level security.
2. Run all verification commands and the live QA run. Fix every failure; do not weaken a test to
   make it pass.
3. Rerun `START-BYTEQUEST.bat` and open the new screens as an instructor and as a student at
   desktop width and at 375px. Check the browser console is free of errors.
4. Confirm the gradebook, Student Progress and the new analysis show the same counts for the same
   activity.

## Final report

Write `docs/reviews/instructor-analysis-announcements-report.md` with:

1. What you built in each part, with file paths.
2. Baseline and final pass/fail counts for each verification command, and the live QA result.
3. Any figure or feature you left out and why (for example per-question quiz results).
4. Anything you could not verify, stated plainly.
5. Follow-ups you recommend, by priority.

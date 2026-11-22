# ByteQuest Insights, part 4 of 4: administrators

Prompt for ChatGPT. Work in `C:\Users\User\Documents\ByteQuest_2.0` on the current branch. Run this after `docs/prompts/chatgpt-insights-foundation.md` is done and verified; it does not depend on the instructor part. Read `CLAUDE.md`, check the working tree for existing changes, and read each file named below before editing it. Run `graphify query "<question>"` before you grep, and `graphify update .` after code changes. Keep the work local for review: do not commit, push or create branches.

Preserve every existing feature and behaviour unless this plan changes it on purpose. Extend the current components, CSS tokens and tests. Do not add dependencies. This part needs no migration. Never run `supabase db reset`. Frontend paths are under `frontend/src/` unless they start with `backend/`, `docs/` or `frontend/scripts/`.

## Goal

An administrator sees, for every course, whether it is set up and being used, and gets one action to fix each problem. They see aggregates only, never an individual learner. The boundary stays: grading, drafts and learner detail belong to the assigned instructors, and admins do not use `/faculty` routes.

## Already in place: extend, do not rebuild

| Feature | Where |
|---|---|
| System Overview: stat cards, action queue, service health, recent changes | `app/(workspace)/admin/page.tsx`, `GET /admin/dashboard` (`backend/app/api/admin.py`, line 109) |
| Monitoring: services, jobs, audit trail | `app/(workspace)/admin/monitoring/page.tsx`, `GET /admin/monitoring`, `GET /admin/audit` |
| Courses, assigning instructors and enrolling students, assignments, accounts needing action, activity availability | `/admin/courses`, `/admin/assignments`, `/admin/accounts?status=attention`, `/admin/activities?status=attention` |
| Prediction settings | `/admin/configuration`, the "prediction" group in `backend/app/services/settings_service.py` |
| Class figures for one course: enrolled, `active_7d`, not started (`need_follow_up`), `average_completion_percent`, published activities | `class_snapshot`, `enrolled_students` and `published_activity_ids` in `backend/app/services/workspace_queries.py` |
| Research consent | `consented_student_ids` in `backend/app/services/ml_predictor/consent.py` |
| Forecast status, platform-wide, with labels | `request.app.state.ml_shadow_status` (`backend/app/api/faculty_ml.py`, around line 231); `READINESS_MESSAGES` in `app/(workspace)/instructor/ml/types.ts` |
| Admin route guard | `admin_user` in `backend/app/api/admin.py` |
| From the foundation: `NotEnoughData`, `MeasureDefinitions`, `UpdatedAt`, the labels map; the admin profile without its duplicate audit list | `components/insights/ui.tsx`, `lib/insight-metrics.ts` |

## Course health endpoint

Add `GET /admin/course-health` in `backend/app/api/admin.py`, guarded by `admin_user`.

- **Response:**
  - one row per course, active courses first
  - generated time
  - the platform forecast status, once
- **Each row:**
  - course id, code, title and status
  - assigned instructor count and display names
  - enrolled
  - Active (7 days)
  - Not started
  - published activities
  - Activities passed
  - Research consent (consented of enrolled)
- **Same definitions everywhere:** take every figure from `class_snapshot`, so the admin and instructor screens agree. Count consent with `consented_student_ids` over `enrolled_students`, which respects a later withdrawal.
- **Fewer than 5 enrolled:** return enrolled and published activities, but null for Active, Not started, Activities passed and consent, plus `status: "insufficient_data"`.
- **Privacy:** no learner names, usernames, emails or pseudonyms anywhere in the response. Test the response keys.
- **Scale:** call `class_snapshot` once per course. Add `# shortcut: one snapshot per course, batch the queries when courses exceed about 50`.

## Course health on System Overview

- Add a **Course health** section on `/admin`, below the stat cards.
- Show the forecast status once, above the table, with its `READINESS_MESSAGES` text.
- Put the table in `.ws-table-wrap` with a `<caption>`. Columns:
  1. Course
  2. Instructor
  3. Enrolled
  4. Active (7 days)
  5. Not started
  6. Published
  7. Activities passed
  8. Research consent
  9. Action
- Cells with too few learners show **Not enough data yet**.
- **Actions:** each row gets one action, from the first rule that applies:
  1. No instructor assigned: **Assign instructor**, to `/admin/assignments`.
  2. No students enrolled: **Enrol students**, to `/admin/courses`.
  3. No published activities: **Check activity availability**, to `/admin/activities?status=attention`.
  4. Not started is at least half of enrolled: **Review student accounts**, to `/admin/accounts?status=attention`.
  5. Otherwise: "No action needed", as muted text.

  Preselect the course in the target screen if that screen already supports it. Keep the rules in one function with unit tests.
- **Sort:** rows needing action first, then by course code.
- **States:** a skeleton while loading, an error with Retry, and an empty state that links to Create course. Add `MeasureDefinitions` for the columns and `UpdatedAt`.
- Use the existing `ws-*` kit (`StatusChip`, `EmptyState`, `Notice`) as the rest of the admin workspace does.

## Handheld rules

Follow `docs/prompts/chatgpt-handheld-layout.md`:

- One breakpoint scale. Use its shared breakpoint module if it exists; otherwise add no new width.
- 44×44px touch targets on coarse pointers, including each row's action.
- Hover-only styling inside `@media (hover: hover)`.
- Design tokens only.

On a phone the table scrolls inside its wrapper and the page does not widen. Tablets show the full table.

## Verification and rollout

- Run these before and after, and report the real numbers:

  ```
  cd backend && .venv/Scripts/python -m pytest -q -p no:cacheprovider
  cd frontend && npx tsc --noEmit
  cd frontend && npx eslint src
  cd frontend && npx vitest run
  ```

- Backend tests in `backend/tests/test_faculty_admin.py`:
  - Each row's figures equal `class_snapshot` for that course.
  - Suppression below 5 enrolled.
  - Consent drops after a withdrawal.
  - A course with no instructor or no published activities.
  - Instructors and students get 403.
  - No identity fields appear in the response.
- Frontend tests: the action rules, the table with a suppressed row, and the empty and error states.
- Extend `backend/tests/qa_live_multi_role.py`: the admin calls `/admin/course-health`, and the QA course's row matches the instructor's `/faculty/dashboard` counts. Run it with `--students 12`.
- Extend `frontend/scripts/qa-responsive.mjs` with `/admin` at its viewports.
- Report what changed, test counts and anything you could not verify.

## Out of scope

- Admin access to `/faculty` routes or to instructor insight pages
- Any learner-level data for admins
- Model evaluation for admins; it stays on the instructor page
- Ranking or comparing instructors
- Editing settings, enrolments or assignments from the table
- Notifications or email
- Student and instructor work (parts 2 and 3)

Use the existing design tokens, components and dependencies, and add none.

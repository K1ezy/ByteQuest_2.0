# ChatGPT 6.2 prompt: finish the ByteQuest Workshop classroom (slices 1–8)

Written 11/21/26 by the Claude Code session that planned the feature and shipped slice 0.
Paste everything below the line into ChatGPT 6.2 working in this repository.

---

You are taking over an in-progress feature in **ByteQuest**, a thesis-grade
gamified programming-practice platform. Your job is to build and finish the
**Workshop classroom** described in `docs/WORKSHOP_CLASSROOM_PLAN.md`, slices 1
to 8, one slice at a time, each with tests. Slice 0 (the rename) is already done
and committed. Work carefully: other sessions have uncommitted work in this same
folder, and the local database holds real local data.

## 1. Read these first, in this order

1. `CLAUDE.md` and `AGENTS.md` at the repository root (project rules).
2. `docs/WORKSHOP_CLASSROOM_PLAN.md`: **the source of truth for this work.**
   Sections 2 (screen map), 3 (rules), 4 (data), 5 (API), 6 (routes), 7 (slices)
   and 10 (decisions W1–W12).
3. `docs/INSTRUCTOR_PHASE1_PLAN.md`, section **Courses and Workshops**: the
   boundary you must not break.
4. `docs/BYTEQUEST_SYSTEM_STATUS_2026-11-21.md`: the current system snapshot.
5. `docs/LOCAL_API_SECURITY.md`: access matrix, quotas, validation rules.

## 2. What already exists (verified 11/21/26)

- **Repository:** `C:\Users\User\Documents\ByteQuest_2.0`, branch
  `fix/ml-pr-auc-student-disjoint-split`. Commit `5e3602b` holds slice 0.
- **Stack:**
  - Next.js 16 and React 19 in `frontend/`.
  - FastAPI and SQLAlchemy in `backend/`, with its virtualenv in `backend/.venv`.
  - Local Supabase in Docker, project `bytequest-local`: API on 15431, Postgres on 15432, Studio on 15433 (excluded by the launcher), Mailpit on 15434.
  - The ByteQuest API runs on `http://127.0.0.1:8000` and the frontend on `:3000`.
- **Workshop data:**
  - Tables `workshops`, `workshop_members` and `workshop_activities`, plus `exam_assignments.workshop_id`.
  - Models `Workshop`, `WorkshopMember`, `WorkshopActivity` and `ExamAssignment` in `backend/app/models/entities.py`.
  - Each workshop has a name, a description, a language, an 8-character `join_code` and `created_by`.
- **API:** `backend/app/api/workshops.py`, prefix `/api/v1/workshops`.
  - `GET ""` lists your workshops.
  - `POST ""` creates one (instructor or admin, quota `workshop_create` 5/hour).
  - `POST /join` joins one (quota `workshop_join` 12/hour; a student's `enrolled_language` must match the workshop's, else 409).
  - `POST /{workshop_id}/activities` adds activities.
  - `WorkshopView` shows `join_code` to the owner or an admin only. A workshop that isn't yours returns 404.
- **Access rules:** `backend/app/services/attempt_visibility.py`.
  - `workshop_shareable_activity_clause(owner_id)` decides which activities a workshop may share: global ones, or ones from a course the owner actively teaches.
  - `student_activity_clause` lets a student reach an activity through course membership or a workshop holding it.
- **Roster:** `GET /api/v1/pilot/instructor/workshops/{workshop_id}/students` in `backend/app/api/pilot.py`. There is no frontend caller, but `test_learning_flow_integration.py` uses it for an authorization check. Slice 6 replaces it.
- **Exams:** `backend/app/api/exams.py` takes `workshop_ids` and returns `workshops`. The frontend screen is `frontend/src/components/instructor-exams.tsx`.
- **Frontend:**
  - `frontend/src/app/(workspace)/workshops/page.tsx` only re-exports `../quests/page`.
  - `frontend/src/app/(workspace)/quests/page.tsx` (about 660 lines) switches on `pathname === "/workshops"`. It holds the card grid, the `?group=<id>` detail view, one dialog for create/join/add, and the copy-code button.
  - The `Workshop` type is in `frontend/src/lib/types.ts`.
  - `frontend/src/lib/navigation.ts` maps legacy `?group=` links to `/workshops`.
  - Sign-in supports return links: `/onboarding?redirect=<path>`.
- **Design tokens:** `frontend/src/app/globals.css`, with `--paper`, `--surface`, `--green`, `--purple`, `--line`, the `--text-*` sizes and the Byte Bounce brand font. Existing workshop classes start with `qm-`. Illustrations are in `frontend/public/illustrations/`.

## 3. Hard rules

1. **Shared working tree.** About 120 files have uncommitted changes from other sessions (ML Phase A, sign-up, insights, gamification). Never revert, reformat, stash, reset, check out or switch branches. Edit only what your slice needs. When a file you change already has other uncommitted edits, keep them.
2. **Commits:** commit only when the user asks. Stage only your own changes; where a file mixes your edits with someone else's, stage just your hunks. Add no AI co-author or attribution lines.
3. **Database:** add new migrations under `supabase/migrations/` with a later timestamp than `20261121070000`, and apply them with `supabase migration up --local`. **Never run `supabase db reset`**: it erases local data. Every new table gets the same browser-grant revocation as the others (see `supabase/migrations/20261028140005_local_api_security.sql`).
4. **graphify:** if `graphify-out/graph.json` exists, run `graphify query "<question>"` before your first code search, and `graphify update .` after code changes.
5. **Security never gets simplified away:**
   - Pydantic mutation models use `ConfigDict(extra="forbid")`.
   - Role checks use `profiles.role` from the database.
   - A workshop that isn't yours returns 404.
   - New write actions that can be abused reuse `app.core.quotas.reserve`.
   - Join codes stay out of URLs except the explicit invite link, and out of logs.
6. **Courses and Workshops stay separate:**
   - Joining a workshop never creates course membership, and course membership never adds workshop membership.
   - Workshops get no `course_id`, no due dates and no grades.
   - Course enrollment stays admin-only, with no join codes.
7. **Design: inspired by Google Classroom's patterns, not a copy.** Do not reuse its illustrations, colours, Material styling, the "Classroom" name or its wording. Use ByteQuest tokens and components.
8. **Accessibility:**
   - Dialogs trap and restore focus and close on Escape.
   - Notices use `role="status"` and errors `role="alert"`.
   - Menus and tabs work by keyboard, and touch targets are at least 44px.
   - Layouts hold at phone width (375px) with no horizontal scroll.
9. **Tests use synthetic accounts.** Gemini stays mocked. Outbound email stays off.
10. **Pitfall from slice 0:** `backend/app/api/workshops.py` is imported as the module name `workshops` in tests. A local variable called `workshops` inside a test that uses the module causes an UnboundLocalError. Name such variables `listed` or similar.

## 4. Decided behaviour (W1–W12, all accepted by the user)

- **W1:** the Classroom "class" is the ByteQuest **Workshop**. Code names are already `workshop`.
- **W2:** Create Workshop asks for Name\* (3–80), Language\* (python, cpp or java) and Description (≤ 500). There is no Section, Subject, Level, Room or course link.
- **W3:** the Join dialog shows "Signed in as" with the username and the language track, an 8-character code field (hyphens and lower case accepted), and short rules. There is no Switch account button.
- **W4:** the workshop page has the tabs **Board**, **Activities**, **People** and **Progress** (owner and admin only), plus **Settings** (owner and admin only).
- **W5:** Board announcements come from the owner only. Students read them but cannot post or comment.
- **W6:** activities are grouped by an optional topic and ordered by position. There are no workshop due dates; each activity keeps its own schedule.
- **W7:** in People, students see classmates by username only. Owners and admins also see the display name, School ID and year/block.
- **W8:** Progress is a read-only grid of student × activity showing Solved, Attempted or Not started, with a completion %. Exam scores stay on the Exams pages.
- **W9:** Settings covers editing the name and description, joining on/off, resetting the code, copying the invite link, a full-screen code view, and archive/restore. **There is no hard delete.**
- **W10:** a student can leave and the owner can remove a student. Both are refused (409) while the student has an `ExamAttempt` with `status == "active"` and no `submitted_at` for an exam assigned through this workshop. There is no ban list; resetting the code keeps a removed student out.
- **W11:** banner art is chosen automatically from the language, with no picker.
- **W12:** the routes are `/workshops`, `/workshops/join/[code]`, `/workshops/[id]`, `/workshops/[id]/activities`, `/workshops/[id]/people`, `/workshops/[id]/progress` and `/workshops/[id]/settings`. Old `/workshops?group=<id>` links redirect to `/workshops/<id>`.

**Other rules:**
- An archived workshop is hidden from the default list and shown with `?archived=true`. It is read-only: no joins, announcements or activity changes. Members keep access to its activities.
- An archived workshop, or one with `joining_enabled = false`, refuses joins with a 409 and the message "This workshop isn't accepting new members."
- An admin may manage any workshop.

## 5. Slices

Work them in order. Each one ends green before the next starts.

### Slice 1: data and API (start here)
- **Migration:**
  - `workshops`: add `joining_enabled boolean not null default true`, `archived_at timestamptz null`, and `updated_at timestamptz not null default now()`.
  - `workshop_activities`: add `topic varchar(80) null`, `position integer not null default 0`, and `added_at timestamptz not null default now()`.
  - Create `workshop_announcements`: `id uuid` PK, `workshop_id` FK cascade, `author_id` FK to profiles with set null, `body text` 1–2000 characters checked, `pinned boolean default false`, `created_at` and `updated_at`. Index `(workshop_id, created_at desc)` and revoke browser grants.
- **Models:** match the migration in `entities.py`.
- **Endpoints in `workshops.py`:**
  - `GET /{id}`: detail for members.
  - `PATCH /{id}`: owner edits the name, description and `joining_enabled`.
  - `POST /{id}/code`: owner resets the code, using the same unique-retry loop as create.
  - `POST /{id}/archive` and `POST /{id}/restore`.
  - `GET ?archived=true`.
  - `GET /{id}/people`: role-shaped output per W7.
  - `DELETE /{id}/members/{profile_id}`: owner removes a student.
  - `DELETE /{id}/membership`: a student leaves.
  - `PATCH /{id}/activities/{activity_id}`: topic and position.
  - `DELETE /{id}/activities/{activity_id}`.
  - Join refusals per section 4.
- **Rules:** archived workshops reject every write except restore. Make `WorkshopView` carry `archived`, `joining_enabled` and `owner_name`, and add any fields the frontend needs without breaking existing callers.
- **Tests:** add backend tests for every endpoint, covering owner, other instructor (404), student, admin, archived, joining off, the leave/remove exam guard, and `extra` fields rejected (422).

### Slice 2: home and dialogs
- Give `/workshops` its own page instead of re-exporting the Quest Map, and move the workshop branches out of `quests/page.tsx`.
- **Keep the concept-filter behaviour in `quests/page.tsx`:** the search box owns its text, `?concept=` is in the URL, and its test is in `page.test.tsx`.
- Build the card grid with Teaching and Joined groups and an Archived filter. Each card shows the banner, name, owner, language chip and counts.
- Redesign the Create and Join dialogs per W2 and W3.
- Add the invite link `/workshops/join/[code]`, which asks the user to confirm before joining and sends signed-out users through `/onboarding?redirect=`.
- Add the full-screen code view.

### Slice 3: workshop shell and Activities
- Build a shared layout with the banner and the tabs.
- Add Activities grouped by topic, with reordering through buttons and keyboard (drag and drop is optional).
- The owner's **Add** menu offers *Published activity*, *Exam* (link to the existing exam assignment), and *Topic*.
- Reuse the existing quest card for activity rows.

### Slice 4: People
Build per W7. The owner can remove a student behind a confirmation dialog, and a student can leave.

### Slice 5: Board
- Owner announcements: create, edit, pin, delete.
- An **Upcoming** card lists workshop activities whose own `closes_at` falls within 7 days, plus exam windows assigned to the workshop.

### Slice 6: Progress
- Add `GET /api/v1/workshops/{id}/progress` and a grid with a sticky student column and a phone layout.
- Remove the pilot roster endpoint and move its authorization test over to the new endpoint.

### Slice 7: Settings
Build per W9, with confirmations for reset and archive.

### Slice 8: docs and checks
- Update `docs/LOCAL_E2E.md`, `docs/NAVIGATION.md`, `docs/LOCAL_API_SECURITY.md` and the status file, with dates written like 11/21/26.
- Run `graphify update .`.
- Do a browser walk at desktop width and at 375px.

## 6. How to verify each slice

- **Backend:** from `backend/`, run `.venv/Scripts/python.exe -m pytest -q`. The suite should stay at 272 passed or more.
- **Frontend:** from `frontend/`, run `npx tsc --noEmit -p .`, `npx eslint <changed files>` and `npx vitest run <changed tests>`.
- **Restart the API after backend changes** (the running uvicorn doesn't reload):
  1. Stop the python process listening on 8000.
  2. Start it the way `infra/start-bytequest.ps1` phase 5 does: `backend/.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`, with logs going to `logs/api.log` and `logs/api.err.log`.
  3. Wait for `GET /readyz` to return 200.
  4. If a model change affects grading, restart the grading worker supervisor `infra/run-grading-worker.ps1` too.
- **Live check:** from `backend/`, run `.venv/Scripts/python.exe tests/qa_live_multi_role.py --students 4`. It needs the API, the worker and Judge0; at slice 0 it passed 21 of 21 checks. It cleans up its throwaway accounts.
- **UI:** open the page in a browser and check keyboard use, phone width and the empty, loading and error states.

## 7. Report after each slice

Give a short report covering:
- what changed, by file;
- the tests run and their exact results;
- anything you skipped or could not verify;
- risks.

Then stop and ask before starting the next slice or committing.

# Workshops: Create, Join and the Workshop page

**Plan, 11/21/26. The Workshop feature now includes optional classroom details. Workshops remain independent of courses.**

Google Classroom's *class* is ByteQuest's **Workshop**. "Create class" becomes
**Create Workshop** and "Join class" becomes **Join Workshop**. Both actions and
the name already exist in ByteQuest, so this plan grows the current Workshop
into a full classroom space instead of adding a second concept.

We borrow Classroom's *patterns*: a code-based join dialog, a banner header, a
tabbed workshop page, a code card, a people list, and a settings page. We do not
copy its look, illustrations, colours, Material styling or wording. Screens use
ByteQuest's own tokens (paper, green, purple), the Byte Bounce brand font and
the quest-scroll illustration style already in `frontend/public/illustrations`.

## 1. What exists today

| Piece | Where | What it does |
| --- | --- | --- |
| Data | `workshops`, `workshop_members`, `workshop_activities` in [entities.py](../backend/app/models/entities.py) (renamed from `quest_group*` on 11/21/26) | A workshop has a name, a description, a language, an 8-character join code and its creator. Members and shared activities are separate tables. |
| API | [workshops.py](../backend/app/api/workshops.py), under `/api/v1/workshops` | List my workshops, create (instructor or admin, 5/hour), join by code (12/hour, the student's track must match), add published activities. |
| Roster | `GET /instructor/workshops/{id}/students` in [pilot.py](../backend/app/api/pilot.py) | The owner sees each student's username, level and completed-activity count. |
| Exams | `exam_assignments.workshop_id` | Exams are already assigned to workshops. |
| Access | `student_activity_clause` in [attempt_visibility.py](../backend/app/services/attempt_visibility.py) | A student reaches an activity through a course or through a workshop that shares it. |
| UI | `/workshops` re-exports [quests/page.tsx](../frontend/src/app/(workspace)/quests/page.tsx) (655 lines) | Card grid, `?group=` detail view, one dialog for create, join and add, and a copy-code button. |
| Sign-in return | `?redirect=` on `/onboarding` | An invite link can send a signed-out user through sign-in and back. |

**Missing:** editing a workshop, archiving, leaving, removing a student, resetting
or disabling the code, an invite link, announcements, a people list, a progress
grid, topics and a settings page.

## 2. Screen map

| Classroom screen | ByteQuest version | Change from Classroom |
| --- | --- | --- |
| Home with class cards | `/workshops` card grid. Each card shows a banner, the name, the owner, a language chip, the member and activity counts, and the next item closing. | ByteQuest banner art per language. Instructors see **Teaching** and **Joined** groups. |
| Join class dialog | **Join Workshop** dialog. A "Signed in as" block shows the username **and the language track**, then the code field and three short rules. | The track is shown because a code for another language is refused. There is no "Switch account" button; signing out is in the account menu. |
| "Using Classroom at a school?" notice | Dropped. | Not relevant: everyone signs in with a ByteQuest account. |
| Create class dialog (name, section, level, subject, room) | **Create Workshop** asks for a Workshop name and Programming language. Block, Year level, Subject and Room are optional. | Classroom details describe the workshop. Joining uses the invite code and the student’s programming track. |
| Stream | **Board** tab: the banner, a code card (owner only), an **Upcoming** card, and announcements from the instructor. | Students read announcements but do not post or comment in v1. |
| Classwork with its Create menu | **Activities** tab. The owner's **Add** menu offers *Published activity*, *Exam* and *Topic*. Activities are grouped under topics and can be reordered. | There is no assignment authoring here: activities are still made and verified in Instructor Studio. |
| People | **People** tab: Instructor, then Students. The owner can remove a student and copy the invite link. | Students see classmates by username only, as on the leaderboard. |
| Marks | **Progress** tab (owner only): a student × activity grid showing Solved, Attempted or Not started, plus a completion %. | Read-only. Exam scores stay on the Exams pages. |
| Class settings | **Workshop settings** (owner): details, invitation (code on/off, reset, copy link, show full screen) and **Archive**. | No stream permissions, Meet link or marking settings. |
| Display class code | Full-screen code view for a projector: the large code and the short link. | Same idea, ByteQuest styling. |
| Account settings and notifications | Dropped. | `/account` already exists, and outbound email is off. |

## 3. Rules

- **Who creates:** instructors and admins, as today. The creator is the owner, and an admin can manage any workshop.
- **Joining:** the code is 8 characters from the current unambiguous alphabet. Hyphens and lower case are accepted. The 12/hour quota stays. A student whose track does not match gets the current clear 409 message. An archived workshop, or one with joining turned off, refuses with "This workshop isn't accepting new members."
- **Invite link:** `/workshops/join/ABCD2345` fills in the code and asks the student to confirm. A signed-out visitor goes through `/onboarding?redirect=…` and comes back. Nothing joins without a click.
- **Leaving and removal:** a student can leave, and the owner can remove a student. Attempts, XP and badges stay with the student. Leaving or removal is blocked while the student has an exam attempt in progress from this workshop. A removed student can rejoin with the code; the owner resets the code to stop that.
- **Archive:** archiving hides the workshop from the main list (an **Archived** filter shows it), stops joins and new announcements, and makes it read-only. Members keep access to its activities so their history stays intact. The owner can restore it. **There is no hard delete**, because exams and research records point at workshops.
- **Privacy:** the People tab shows instructors the display name, username, School ID and year/block. Students see usernames only.
- **Separate from courses:** courses are admin-made and admin-enrolled, have no join code, and own official grades and due dates. Workshops are instructor-made, joined by code, and own none of those. Joining one never adds membership in the other. The full boundary is in [Courses and Workshops](INSTRUCTOR_PHASE1_PLAN.md#courses-and-workshops).

## 4. Rename `quest_group` to `workshop`, then the data changes

**The rename comes first, as its own slice with no behaviour change.** That keeps
its large but mechanical diff separate from the feature work, which is how the
churn stays reviewable. It is a single cutover with no aliases, no compatibility
routes and no leftover `quest_group` names in live code. Old migrations stay as
written, because they are history; one new migration does the renaming.

| Layer | Before | After |
| --- | --- | --- |
| Tables | `quest_groups`, `quest_group_members`, `quest_group_activities` | `workshops`, `workshop_members`, `workshop_activities` |
| Columns | `group_id` in the member, activity and `exam_assignments` tables | `workshop_id` |
| Constraints and indexes | `uq_quest_group_member`, `uq_quest_group_activity`, `uq_exam_assignment_group`, `ix_quest_group_*` and the primary-key and FK names | The same with `workshop` in the name. |
| Models | `QuestGroup`, `QuestGroupMember`, `QuestGroupActivity`, `QuestGroupView`, `CreateQuestGroup`, `JoinQuestGroup` | `Workshop`, `WorkshopMember`, `WorkshopActivity`, `WorkshopView`, `CreateWorkshop`, `JoinWorkshop` |
| API | `/api/v1/quest-groups`, `quest_groups.py`, `quest_groups_router` | `/api/v1/workshops`, `workshops.py`, `workshops_router` |
| Exam API | `group_ids` in the request, `groups` in the catalog and detail | `workshop_ids` and `workshops` |
| Pilot roster | `GET /api/v1/pilot/instructor/groups/{id}/students` (no frontend caller, but an authorization test uses it) | Renamed to `/api/v1/pilot/instructor/workshops/{id}/students` so the test keeps its coverage. `GET /api/v1/workshops/{id}/progress` replaces it in slice 6. |
| Quotas | `group_create`, `group_join` | `workshop_create`, `workshop_join`. Counters restart, which is harmless. |
| Frontend | `QuestGroup` type, `/quest-groups` calls, `groups` in the exam screen | `Workshop`, `/workshops`, `workshops` |
| Error text | "No quest matches that code", "Quest group not found", "Quest not found" | "No workshop matches that code" and "Workshop not found" |

**Files the rename touches (measured 11/21/26):**
- Backend app: `quest_groups.py`, `exams.py`, `pilot.py`, `main.py`, `entities.py`, `attempt_visibility.py` and `quotas.py`.
- Seeds and smoke scripts: `seed_local_quest_demo.py`, `seed_local_python_quest_demo.py`, `seed_local_python_fundamentals_expansion.py` and `smoke_local_quest_demo.py`.
- Tests: `test_api_security.py`, `test_learning_flow_integration.py`, `test_pilot_regressions.py`, `qa_live_multi_role.py` and `qa_mixed_exam_load.py`.
- Frontend: `quests/page.tsx`, `types.ts`, `instructor-exams.tsx` and its test.
- Docs: `LOCAL_E2E.md`, `DATABASE_REVIEW_2026-11-12.md`, the manuscript checklist, the DeepSeek guide and `INSTRUCTOR_PHASE1_PLAN.md`.

The rename migration uses `ALTER TABLE … RENAME`, which keeps the rows, foreign
keys, indexes and revoked browser grants. It runs with `supabase migration up
--local`, never a reset. It is done when the full backend suite, the frontend
tests and a live join-and-exam walk pass, and a search for `quest_group`,
`QuestGroup` and `quest-groups` finds only old migrations.

**Then the additive feature migration:**

| Table | Change |
| --- | --- |
| `workshops` | Add `joining_enabled` boolean not null default true, `archived_at` timestamptz null and `updated_at` timestamptz. |
| `workshop_activities` | Add `topic` varchar(80) null, `position` integer not null default 0 and `added_at` timestamptz. |
| `workshop_announcements` (new) | `id`, `workshop_id` (FK, cascade), `author_id`, `body` (≤ 2000 characters), `pinned`, `created_at` and `updated_at`. Browser grants are revoked like the other ByteQuest tables. |

## 5. API changes (all under `/api/v1/workshops`)

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `GET ?archived=true` | member | List archived workshops. |
| `GET /{id}` | member | Detail: owner name, topics, ordered activities and flags. |
| `PATCH /{id}` | owner | Edit the name, description and `joining_enabled`. |
| `POST /{id}/code` | owner | Reset the join code. |
| `POST /{id}/archive`, `POST /{id}/restore` | owner | Archive or restore. |
| `GET /{id}/people` | member | Role-shaped people list (see Privacy). |
| `DELETE /{id}/members/{profile_id}` | owner | Remove a student. |
| `DELETE /{id}/membership` | student | Leave. |
| `PATCH /{id}/activities/{activity_id}`, `DELETE …` | owner | Set the topic and position, or take an activity out of the workshop. |
| `GET /{id}/progress` | owner | The progress grid. It replaces the pilot roster endpoint, which is removed in the same slice. |
| `GET/POST/PATCH/DELETE /{id}/announcements` | members read, owner writes | Board announcements. |

Every mutation keeps `extra="forbid"` models, the existing quotas, and the 404
used today for a workshop that is not yours.

## 6. Frontend structure

| Route | Content |
| --- | --- |
| `/workshops` | Home: card grid, Teaching/Joined groups, Archived filter, **Create Workshop** or **Join Workshop**. |
| `/workshops/join/[code]` | Invite-link confirmation. |
| `/workshops/[id]` | Board. |
| `/workshops/[id]/activities` | Activities by topic. |
| `/workshops/[id]/people` | People. |
| `/workshops/[id]/progress` | Progress (owner). |
| `/workshops/[id]/settings` | Settings (owner). |

All of these share a layout with the banner and the tabs. The old
`/workshops?group=<id>` URL redirects to `/workshops/<id>`. The workshop
branches come out of `quests/page.tsx`, and the Activities tab reuses its quest
card. Every tab keeps the current accessibility rules: dialog focus, Escape to
close, `role="status"` notices and keyboard-reachable menus.

## 7. Delivery slices (each ships with tests)

0. **Rename (done 11/21/26):** `quest_group` becomes `workshop` across the database, API, frontend, scripts, tests and docs (section 4). There is no behaviour change, and the full suites must pass.
1. **Data and API:** the feature migration, models, PATCH, archive and restore, code reset, leave, remove and the join refusals. Backend tests.
2. **Home and dialogs:** the new `/workshops` home, the redesigned Create and Join dialogs, the invite link and the full-screen code. The quests page loses its workshop branches.
3. **Workshop shell and Activities:** the banner and tab layout, plus Activities with topics, ordering and removal.
4. **People.**
5. **Board:** announcements and the Upcoming card (activities closing within 7 days, and exam windows).
6. **Progress grid.**
7. **Settings page.**
8. **Docs and checks:** update `LOCAL_E2E.md`, `NAVIGATION.md` and the status file, run `graphify update .`, and do a browser walk on desktop and phone width.

## 8. Out of scope for v1

Co-instructors, student posts and comments, per-workshop due dates, entering
marks, a calendar, Meet/Drive-style integrations, email notifications, guardian
summaries, rubrics, banner pickers or photo uploads, a workshop leaderboard,
and hard delete.

## 9. Conflicts and risks

- **X1 (fixed 11/21/26):** the uncommitted concept-filter edits in `quests/page.tsx` let the search box take its text from the URL, so a keystroke typed while the URL updated could vanish. The box now keeps its own text, a regression test covers it, and the edits are ready to commit. Splitting the workshop code out must keep them.
- **X2 (resolved 11/21/26):** [INSTRUCTOR_PHASE1_PLAN.md](INSTRUCTOR_PHASE1_PLAN.md) no longer plans sections. The course is the teaching unit, its roster stays admin-managed with no join code, and its [Courses and Workshops](INSTRUCTOR_PHASE1_PLAN.md#courses-and-workshops) section sets the boundary.
- **X3:** `LOCAL_E2E.md` tells testers to join from `/quests`. It needs the new path.
- **X4:** removal while an exam is assigned. Leaving is blocked only during an in-progress attempt, so a student who leaves earlier loses access to exams not yet started through that workshop.
- Workshop membership is not an ML feature, so the research data is unaffected.

## 10. Decisions to critique

| # | Decision | Recommendation |
| --- | --- | --- |
| W1 | Classroom "class" = ByteQuest **Workshop**. Rename `quest_group` to `workshop` everywhere as slice 0, with no aliases left behind. | **Decided 11/21/26** |
| W2 | Create fields are Workshop name, Programming language, and optional Block, Year level, Subject and Room. | **Updated 11/21/26** |
| W3 | Join dialog shows the username and the track, with no Switch account button. | Yes |
| W4 | Four tabs: Board, Activities, People, Progress (Progress for the owner only). | Yes |
| W5 | Board posts come from instructors only; no student posts or comments in v1. | Yes |
| W6 | Activities are grouped by topic and ordered; no per-workshop due dates. | Yes |
| W7 | Students see classmates by username only. | Yes |
| W8 | Progress is a read-only solved/attempted grid; exam scores stay in Exams. | Yes |
| W9 | Settings cover details, code on/off/reset, link, full screen and archive; no hard delete. | Yes |
| W10 | Leave and remove are allowed, but blocked during an in-progress exam attempt; there is no ban list. | Yes |
| W11 | Banner art comes automatically from the language, with no picker in v1. | Yes |
| W12 | Clean URLs (`/workshops/[id]/…`), with the old `?group=` link redirecting. | Yes |

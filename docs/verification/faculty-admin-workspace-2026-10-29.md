# Faculty and administrator workspace — implementation log and continued work

Date: 2026-10-29 (Asia/Manila)
Repository: `C:\Users\User\Documents\ByteQuest_2.0` (the real ByteQuest 2.0 app)
Handoff source: `C:\Users\User\Documents\Codex\2026-10-29\i-want-you-to-generate-these\outputs\ByteQuest-DeepSeek-Handoff\bytequest-handoff\`

This document is written so another agent can continue without re-doing discovery. It records what
was built, what was verified with evidence, what local data was created for verification, and what
remains.

---

## 1. Status at handoff

The faculty and administrator experiences are implemented end to end in the existing application:
new backend APIs, new database objects, a shared role-aware shell that reuses the student Quest Map
chrome, and all faculty/admin pages. The student quest map was not re-scoped or rewritten.

Last verified results (run at the end of this work):

| Check | Command | Result |
|---|---|---|
| Backend tests | `cd backend; .\.venv\Scripts\python.exe -m pytest -q` | **45 passed** in 27.09s |
| Frontend typecheck | `cd frontend; npx tsc --noEmit` | **clean** |
| Frontend lint | `cd frontend; npx eslint .` | **clean** |
| Production build | `cd frontend; npm run build` | **succeeded**, all 28 routes including `/faculty/*` and `/admin/*` |
| Migration | `supabase migration up` | applied `20261029000100_faculty_admin_workspace.sql` |
| Live UI flows | headless Edge + CDP scripts in `logs/` | see §7 |

Not finished: the administrator configuration/conflict UI walkthrough and administrator availability
UI walkthrough were **not completed** (the config flow was interrupted; no settings change was saved —
`job_retry_limit` is still value `3`, version `1`). Narrow-width screenshots and a formal keyboard-only
pass were not performed. See §9.

The dev server and API are running at handoff:

- frontend `http://127.0.0.1:3000` (Next dev, process 31232; started as managed job `pwsh-31e040dcc8774510`)
- backend `http://127.0.0.1:8001` (uvicorn with reload, process 18864)
- local Supabase `http://127.0.0.1:54321`
- headless Edge with CDP on `http://127.0.0.1:9222` (may be closed when the session ends; restart per §8)

If the dev server is not running: `cd frontend; npm run dev`. The API: see `README.md`/`docs/LOCAL_E2E.md`.

---

## 2. Repository discovery (recorded before changes)

- **frontend**: Next.js `16.4.2` (App Router, Turbopack), React 19, TypeScript, no Tailwind — one
  hand-written `src/app/globals.css` (now ~6.3k lines) with a purple/lavender override layer at the
  end. Single API client `src/lib/api.ts` (`apiRequest`, `ApiError`). Auth through Supabase JS in
  `src/lib/supabase.ts`; note it uses **sessionStorage** and deletes legacy `sb-*-auth-token` keys from
  localStorage. One sign-out hook `src/hooks/use-sign-out.ts`.
- Student shell lives in `src/app/quests/page.tsx`: `quest-map-page` → `qm-topbar` → `qm-layout` →
  `qm-sidebar` (active purple pill) → `qm-content`. This shell and its classes were reused.
- Existing instructor screen: `src/app/instructor/page.tsx` (590 lines, legacy studio) plus
  `/instructor/exams`. The student sidebar’s “Faculty & Instructor” entry rendered
  `src/components/faculty-view.tsx`, a small card.
- **backend**: FastAPI with routers `/api/v1/{quests,quest-groups,instructor,pilot,submission-jobs,exams,profile,chat,ml-analytics}`;
  JWT verification and `get_current_user`/`require_instructor` in `app/core/security.py`; SQLAlchemy
  models in `app/models/entities.py`; ~10 Supabase migrations; pytest integration suite using one
  rolled-back outer transaction and a stubbed Judge0 transport.
- **Before this work there was no** course, enrollment/assignment, audit, operational settings or
  processing-job table, and no administrator UI. Documents/activities were scoped only by
  `uploaded_by`/`created_by`, and generated drafts stored no citations.

Source precedence used:

1. Current app data model and existing student behaviour (preserved).
2. System Design PDF role matrix and workflows (implemented where the app allowed).
3. Student screenshots for appearance (palette, active pill, panels, chips).
4. HTML prototype for interaction patterns (not copied as state).

---

## 3. Architecture and conflict decisions

Immersive/important decisions another agent must know:

1. **Courses are introduced as the faculty/admin authorization boundary, not as a replacement for
   language tracks.** One course per language already in use is backfilled (`CPP-TRACK`,
   `PYTHON-TRACK`); existing materials/activities are assigned by `language_tag`/`language`; existing
   instructor/admin authors become instructor members; existing students are enrolled in their track.
   The student `/quests` endpoint and UI were **not** changed to filter by course. This is a deliberate
   preservation of existing student behaviour and differs from the PDF’s “published enrolled-course
   content” wording.
2. **Admin cannot perform academic review.** All `/api/v1/faculty/*` routes depend on a strict
   `require_course_instructor` (role must be `instructor`), so an administrator receives
   `403 faculty_instructor_required` even though `get_current_user` would allow them. Admin has its
   own operations API without answer keys, hidden tests, draft approval or grades.
3. **Drafts store citation snapshots in `learning_activities.generation_json`** (JSONB) rather than
   the PDF’s separate `GENERATION`/`GENERATION_SOURCE` tables. Each citation contains chunk id,
   document id/title/version, page number and excerpt, so archiving a material preserves evidence.
   It is written by the existing RAG generation path in `backend/app/api/rag_instructor.py`.
4. **Instructor ownership checks became course-assignment checks.** `_may_manage_document` /
   `_may_manage_activity` allow the author, an assigned instructor on the activity/document course, or
   an administrator, so a newly assigned faculty member can review/cite/publish existing course
   material. This changed the legacy `/api/v1/instructor/*` routes too.
5. **Course creation exists in the API but not in the admin UI**
   (`POST /api/v1/admin/courses`). See §9.
6. **Active navigation pill was restyled globally** (`.quest-map-page .qm-sidebar a.is-active`) to the
   solid purple gradient + white text + green inset accent shown in the student screenshots. This
   affects the student Quest Map appearance too (visual only).
7. **Student chat launcher is hidden on `/faculty` and `/admin`** (`chat-shell.tsx`), because those
   workspaces own their chrome and the launcher overlapped the sticky action bar.
8. **Verification data was written to the local developer database** (accounts, one published draft,
   one draft, one scanned material, one scheduled activity). See §8 for cleanup SQL.

---

## 4. Backend changes

### 4.1 Migration

`supabase/migrations/20261029000100_faculty_admin_workspace.sql`

- `profiles`: `account_status` (`active|deactivated`), `deactivated_at`, `display_name`, `email`.
- `courses` (`id, code UQ, title, description, status, created_by, created_at`).
- `course_members` (`id, course_id, profile_id, member_role instructor|student, status active|pending|removed, assigned_by, assigned_at, updated_at`, unique course/profile/role).
- `instructional_documents`: `course_id`, `processing_error`, `uploaded_original_name`, `indexed_at`.
- `learning_activities`: `course_id`, `generation_json`, `content_version`, `opens_at`, `closes_at`,
  `published_at`, `archived_at`, `version_number`, `version_of`, `rejection_reason`.
- `platform_settings` (versioned operational settings, seeded:
  `job_retry_limit=3`, `pdf_upload_max_mb=10`, `rag_top_k=5`, `rag_similarity_threshold='0.35'`,
  `prediction_min_history=3`).
- `processing_jobs` (`service, job_type, status queued|running|completed|failed, document_id,
  activity_id, requested_by, attempts, max_attempts, retryable, cause, trace_id, timestamps`).
- `audit_events` (`id bigint identity, actor_id, actor_role, action, entity_type, entity_id, course_id,
  summary, metadata jsonb, created_at`).
- Backfill DO block described in §3.1. Note: it uses `initcap()` so the C++ course is titled
  “Cpp Programming Track” (cosmetic fix pending).

### 4.2 Models and security

- `backend/app/models/entities.py`: added columns above + `Course`, `CourseMember`, `ProcessingJob`,
  `PlatformSetting`, `AuditEvent`.
- `backend/app/core/security.py`: every protected request now rejects `account_status != 'active'`
  with `403 {code: "account_deactivated"}`.
- `backend/app/api/profiles.py`: `/profile/me` now returns `display_name` (needed by the new shell).
- `backend/app/main.py`: registers `faculty` and `admin` routers.

### 4.3 New services

- `app/services/course_access.py` — server-side authorization: `require_course_instructor` (strict
  faculty), `require_administrator`, `courses_for_user`, `require_course_access`, `resolve_workspace_course`,
  `has_course_role`, `may_manage_course`, `default_instructor_course_id`, `membership_map`.
- `app/services/workspace_common.py` — shared derived states/serializers: `activity_state`
  (`draft|scheduled|open|closed|archived`), `draft_state` (`pending|ready|rejected|published`),
  `material_state` (`ready|processing|needs_review|failed|archived`), `citation_list`,
  `student_preview` (never answer keys/hidden tests), `activity_detail`, date/ISO helpers.
- `app/services/workspace_queries.py` — the single source of truth for the “count equals list”
  requirement: `filter_drafts/filter_materials/filter_activities`, matching `*_status_counts`,
  `scoped_activities/scoped_materials`, `class_snapshot`, `enrolled_students`, `account_emails`,
  `passing_attempts_by_student`, `latest_predictions`.
- `app/services/audit.py` — `record_audit`.
- `app/services/settings_service.py` — typed settings, optimistic version check, `409 version_conflict`
  with `latest`, range validation, audit.
- `app/services/monitoring.py` — `service_health` for API / RAG indexing / code-assessment runner /
  prediction, each `healthy|stale|failed|unavailable` with last-checked, cause and trace; job/audit
  queries.
- `app/services/materials.py` — material lifecycle: validation, private storage upload, processing job,
  page-preserving chunk indexing, honest failure states (`needs_review` for unsearchable PDFs,
  `failed` for transient indexing errors), retry only for retryable failures, version replacement,
  archive/restore, metadata.
- `app/services/account_provisioning.py` — Supabase Auth admin invite
  (`POST {SUPABASE_URL}/auth/v1/invite`), profile construction, rollback on DB failure.
- `app/services/ai_rag/embeddings.py` — extracted `embed_chunks_bounded` (bounded concurrency), now
  shared by the legacy upload path and the new material service.

### 4.4 Faculty API (`backend/app/api/faculty.py`, prefix `/api/v1/faculty`)

Every route requires an active `instructor` account and an active `instructor` membership on the
resolved course.

| Method | Path | Purpose |
|---|---|---|
| GET | `/courses` | Assigned courses with student/draft/attention counts |
| GET | `/dashboard?course_id=` | Counts, prioritized action queue with exact hrefs, upcoming, class snapshot, recent audit |
| GET | `/drafts?course_id=&status=&material_id=&date_from=&date_to=&search=` | Review queue; `status=open|pending|ready|rejected|published|all` |
| GET | `/drafts/{id}` | Editable draft + citations + material + student preview |
| PATCH | `/drafts/{id}` | Save revision (never publishes); `content_version` optimistic lock; sets `reviewed_by=null` |
| POST | `/drafts/{id}/reject` | Required reason ≥5 chars; keeps draft, adds `rejection_reason`, audit |
| POST | `/drafts/{id}/approve` | Requires `confirm` + `student_preview_confirmed`; publishes, sets reviewer, sequence, audit |
| GET | `/materials?course_id=&status=&search=` | Current versions with nested version history and draft counts |
| POST | `/materials` | Multipart upload; records processing job and honest failure states |
| POST | `/materials/{id}/versions` | Replace source with a new version (same family, citations preserved) |
| GET | `/materials/{id}/download` | 60-second signed URL from private storage |
| PATCH | `/materials/{id}` | Metadata only |
| POST | `/materials/{id}/archive` / `restore` / `retry` | Archive preserves citations; retry only when `retryable` |
| GET | `/activities?course_id=&status=&type=&search=` | Draft/scheduled/open/closed/archived |
| POST | `/activities` | Create draft (quiz or challenge) |
| GET | `/activities/{id}` | Full editable activity + versions + lock state |
| PATCH | `/activities/{id}` | Details/content with `content_version`; `409 grading_locked` once attempts exist |
| POST | `/activities/{id}/schedule` | Opens/closes validation |
| POST | `/activities/{id}/preview` | Student preview, schedule, grading summary (no keys) |
| POST | `/activities/{id}/verify` | Judge0 reference-solution validation (challenges) |
| POST | `/activities/{id}/publish` | Requires confirmations; validates quiz 3–10 questions, challenge tests + Judge0 |
| POST | `/activities/{id}/versions` | Clone as next draft version; archives previous on publish |
| GET | `/performance?course_id=&activity_id=&search=` | Class summary, learners, saved/unavailable predictions |
| GET | `/performance/students/{id}?course_id=` | Learner attempt history, progress, prediction as-of/reason |

### 4.5 Administrator API (`backend/app/api/admin.py`, prefix `/api/v1/admin`)

Requires an active `admin` account.

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard` | Accounts needing action, failed jobs, availability changes, service health, action queue, recent changes |
| GET | `/accounts?search=&role=&status=&attention` | `status=attention|active|deactivated|all` |
| GET | `/accounts/{id}/impact` | Access impact before deactivation |
| POST | `/accounts` | Provision via Supabase invite; duplicate email 409, invalid role 422, self-email 409 |
| POST | `/accounts/{id}/deactivate` / `reactivate` | Confirmation required; self-deactivation 409; audit |
| GET/POST | `/courses` | List / create course (no UI yet) |
| GET | `/assignments?course_id=&role=&status=&search=` | |
| POST | `/assignments` | Role mismatch 422 (student cannot be instructor), duplicate 409, pending 409 |
| POST | `/assignments/{id}/confirm` / `remove` | |
| GET/POST | `/materials` | Upload (no academic review) |
| PATCH | `/materials/{id}` | Metadata only |
| POST | `/materials/{id}/archive` / `restore` / `retry` | |
| GET | `/materials/{id}/download` | Signed URL |
| GET | `/activities?course_id=&status=&type=&search=` | `status=attention` = scheduled + closed |
| GET | `/activities/{id}/impact` | Enrolled students, attempts, preserved-records note |
| POST | `/activities/{id}/availability` | opens/closes/closed with confirm; audit |
| POST | `/activities/{id}/archive` | |
| GET | `/settings` | Grouped by service with value/description/version/last editor |
| PATCH | `/settings/{key}` | `expected_version`; 409 returns latest; 422 range validation |
| GET | `/monitoring?service=&status=&search=&audit_search=` | Service health, filtered jobs, audit |
| POST | `/jobs/{id}/retry` | Only `failed` + `retryable`, otherwise 409 with cause/trace |
| GET | `/audit?search=` | Read-only audit |

Coded errors use `{"detail": {"code", "message", "field?"}}`; the existing `apiRequest` surfaces
`message` and `code` through `ApiError`.

### 4.6 RAG generation changes (`backend/app/api/rag_instructor.py`)

- `_retrieve_document_sources` performs vector retrieval with settings-driven `rag_top_k` and
  `rag_similarity_threshold`, returns chunk id/page/excerpt, and stores them via
  `_generation_payload` into `learning_activities.generation_json`.
- New generated quizzes/challenges inherit `course_id` from the source document.
- `_may_manage_document` / `_may_manage_activity` replaced author-only checks.
- Legacy document upload assigns the uploader’s first instructor course.
- Publishing sets `published_at`.

---

## 5. Frontend changes

### 5.1 Shared library and components

- `src/lib/workspace.ts` — all typed API calls and response types; `formatDateTime`, `toDateTimeInput`,
  `fromDateTimeInput`, state label maps, `friendlyLoadError`.
- `src/components/workspace/workspace-provider.tsx` — role-aware shell:
  - fetches `/profile/me` and assigned/all courses;
  - role gate and “no course assignment” / “course access lost” states;
  - white `qm-topbar`, ByteQuest/Quest Map brand, role pill, course selector (faculty only),
    account menu (accessibility, student Quest Map, sign out), `qm-sidebar` with role-specific nav,
    breadcrumb, `qm-content`;
  - URL-based course context (`?course=`) preserved by `courseHref`;
  - unsaved-edit guard (`beforeunload` + course switch confirm);
  - `WorkspaceSuspense` for `useSearchParams` prerender safety;
  - `safeReturnTo` for validated list→detail→list navigation.
- `src/components/workspace/ui.tsx` — `useApi` hook, `PageHeading`, `StatCard`, `StatusChip`,
  `Notice` (live region), `EmptyState`, `LoadingPanel`, `Toolbar`, `SearchField`, `SelectField`,
  `FieldError`, accessible `ConfirmDialog` (focus trap, Escape, default focus Cancel, focus return),
  `TableShell`, `Button`.
- `src/components/workspace/student-preview.tsx` — the student-visible preview; never renders answer
  keys or hidden tests.
- `src/lib/types.ts` — `Profile.display_name` added.

### 5.2 Faculty routes

- `/faculty` — dashboard (stat cards link to the exact filtered lists, action queue, class snapshot,
  upcoming, recent audit, empty states).
- `/faculty/review` — review queue with status chips/counts, material, date-range and search filters
  in the URL, empty/error states.
- `/faculty/review/[id]` — side-by-side draft editor and cited PDF page excerpts; citation selection
  highlights the excerpt; Save revision, Reject (required reason), Approve and publish (summary +
  student preview + checkbox); published state read-only; unsaved guard; retry after failed save.
- `/faculty/materials` — upload/replace/edit/archive/restore/retry/download; processing states,
  causes, versions, linked draft counts.
- `/faculty/activities` — counts by state, filters, inline create form.
- `/faculty/activities/[id]` — Details → Content & tests → Schedule → Preview step indicator,
  challenge tests + Judge0 verify, quiz keys editor, publish confirmation with preview, grading lock
  banner and “Create new version”.
- `/faculty/performance` — summary cards, activity filter, learner table with saved prediction/as-of
  or explicit unavailable reason, learner history dialog.
- `/faculty/accessibility` — reuses the existing `AccessibilitySettings`.

### 5.3 Administrator routes

- `/admin` — four status cards, action queue with deep links, service health, recent changes,
  academic-boundary note.
- `/admin/accounts` — search/role/status filters, create form (email, role, display name, course
  access), inline duplicate email without clearing values, deactivate with access-impact dialog,
  reactivate, self-deactivation disabled with explanation.
- `/admin/assignments` — course/role/status/search filters, assign form with role mismatch and
  duplicate handling, confirm pending, remove access with consequence dialog.
- `/admin/materials` — operational upload, metadata edit, archive/restore, retry, download; course
  filter and processing states.
- `/admin/activities` — availability chips (including “Needs attention”), course/type/search filters,
  impact-before-change dialog for opens/closes/closed, archive confirmation.
- `/admin/configuration` — settings grouped by service with current value/description/version/last
  editor, review-before-save dialog, inline validation, version-conflict panel comparing proposed vs
  latest with “Reload latest value”.
- `/admin/monitoring` — four health cards with last-checked/trace, job filters, retry only for
  failed+retryable, job cause detail panel, read-only searchable audit trail.
- `/admin/accessibility` — reuses the existing `AccessibilitySettings`.

### 5.4 Navigation and shell integration

- `src/components/site-header.tsx` hides the global header on `/faculty/*` and `/admin/*`.
- `src/app/quests/page.tsx` faculty entry now routes instructors to `/faculty` and administrators to
  `/admin` (label becomes “Administration” for admins); students keep the existing explainer card.
- `src/components/faculty-view.tsx` now offers both the new faculty workspace and the legacy
  Instructor Studio.
- `src/app/instructor/page.tsx` gained a primary link to `/faculty`.
- `src/components/chat/chat-shell.tsx` hides the chat launcher in role workspaces.
- `src/app/globals.css` gained a large `FACULTY AND ADMINISTRATOR WORKSPACE` section plus refinement
  rules (danger button, material action grid, responsive tables, 1200/1024/850/640 breakpoints,
  high-contrast and reduced-motion support).

---

## 6. Tests added

`backend/tests/test_faculty_admin.py` (15 tests, real local Supabase, one rolled-back transaction per
test) covers:

1. students blocked from faculty/admin surfaces;
2. faculty scoped to assigned courses (403 on another course/draft);
3. administrator blocked from academic faculty routes but allowed operational material routes;
4. draft save never publishes; stale `content_version` 409; approval requires confirmation; approval
   publishes, records reviewer, writes audit, removes the item from the open queue;
5. reject requires a reason and returns the item to the queue as `rejected`;
6. grading content locks after an attempt; new version 2 unlocks and is editable;
7. activity preview hides reference solution/answer keys;
8. dashboard counts equal destination list counts and queue hrefs carry the course;
9. performance is course-scoped, cross-course student 404, prediction unavailable with reason;
10. duplicate email and assignment conflicts are inline (`duplicate_email`, `role_mismatch`,
    `duplicate_assignment`);
11. account creation provisions profile + membership (invite stubbed);
12. failed-job retry only when retryable, with trace id; successful retry returns completed;
13. settings version conflict returns latest, range validation 422, save bumps version and audits;
14. deactivation blocks the account on the next protected request; self-deactivation refused;
15. monitoring reports real states (`failed` for the failed RAG job), filtered job counts match, audit
    is searchable.

The existing 30 tests still pass, including role/course isolation of the legacy instructor and student
flows. Total 45.

No new frontend unit tests were added; the repo has `frontend/scripts/test-recovery.mjs` only.

---

## 7. Verification evidence (live app)

Screenshots are in `logs/shots/` (git-ignored). The headless browser scripts are `logs/cdp-shot.mjs`,
`logs/cdp-flow.mjs`, `logs/cdp-check.mjs` (git-ignored).

Visually inspected (1440px wide):

- `faculty-dashboard.png` — shell, topbar, course selector, active purple pill, stat cards, queue,
  class snapshot; matches the supplied student language.
- `faculty-review-queue.png` — status chips/counts, filters, draft row with material/citations.
- `faculty-draft.png` — draft editor left, citations right (active excerpt in mint), student preview,
  sticky Save/Reject/Approve bar.
- `faculty-materials.png` — material rows, processing note for unsearchable PDF, versions, actions.
- `faculty-activities.png` — state counts, scheduled/open entries, Judge0 and grading-lock chips.
- `faculty-performance.png` — summary cards, learner table, prediction unavailable reason.
- `admin-dashboard.png` — four cards, action queue, live service health, recent audit.
- `admin-accounts.png` — filters, account table, duplicate-safe create form, danger actions.
- `admin-assignments.png` — account/course/status table.
- `flow-admin-job-detail.png` — monitoring health cards, failed job cause + trace, **no Retry** for a
  non-retryable job, audit trail.
- `flow-admin-account-created.png`, `flow-admin-assignment-saved.png`,
  `flow-admin-duplicate-email.png` — account provisioning, assignment confirmation, inline duplicate
  error with preserved email.
- `flow-permission--faculty.png` (student opens `/faculty`) and `flow-permission--admin.png`
  (instructor opens `/admin`) — role gates with correct next actions.
- `flow-draft-saved.png`, `flow-draft-published.png` — revision save (stays draft) and publication.
- `flow-activity-editor.png`, `flow-activity-content.png`, `flow-activity-preview.png` — create →
  editor → content → preview with completion indicators.

End-to-end flows verified through the UI (headless Edge, real API/data):

1. **Faculty review → revise → publish**: opened a real Gemini-generated draft with 5 page citations,
   switched citation (excerpt changed), edited title, Save revision → notice “Revision saved…” while
   `review_status` stayed `draft`, then Approve and publish with preview checkbox → published, audit
   `draft.published`, reviewer recorded, item left the open queue. Verified again in SQL.
2. **Faculty create activity**: created a quiz from the UI, landed in the 4-step editor, opened Content
   and Preview steps, saw student view without answer keys and the publication checklist.
3. **Admin create account → assign course**: provisioned `new.instructor.*@bytequest.test` through the
   Supabase invite, followed the row’s “Assign course” link, saved instructor access, saw confirmation.
   Repeated creation with the same email produced an inline `duplicate_email` error and kept the form
   value.
4. **Admin failed job**: a real scanned (no text layer) PDF upload created material
   `needs_review` + a failed non-retryable job with trace `RAG-816E69D5`; monitoring showed the cause
   and trace and correctly hid Retry; job detail confirmed “No — correct the input instead”.
5. **Role gates**: student `/faculty` and instructor `/admin` show the designed access panels; server
   tests confirm 403 for the APIs.
6. **Counts parity**: dashboard count (1 draft, 1 attention material, 1 upcoming) matched the filtered
   lists; after publishing the draft the counts updated from the same queries.

Real local data created for verification (see §8):

- accounts `faculty.verify@bytequest.test`, `admin.verify@bytequest.test`, `student.verify@bytequest.test`
  (password `VerifyPass123!`), plus two invited `new.instructor.*@bytequest.test` accounts;
- a real Gemini quiz draft generated from “Py4E - Lesson 4 - Functions”, later revised and published;
- a draft “Verification loops quiz” created through the UI;
- “Week 6 scanned handout” material (needs review) and its failed job;
- “Count Vowels” schedule set to open 2026-10-30 and close 2026-11-06 (Asia/Manila display).

---

## 8. How to continue (commands, accounts, cleanup)

### Start services

```powershell
cd C:\Users\User\Documents\ByteQuest_2.0
supabase status                     # local stack; if needed: supabase start
# API (from backend): .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
# Frontend: cd frontend; npm run dev
```

Apply migrations after pulling: `supabase migration up`.

### Verification login accounts

| Role | Email | Password |
|---|---|---|
| Faculty | `faculty.verify@bytequest.test` | `VerifyPass123!` |
| Admin | `admin.verify@bytequest.test` | `VerifyPass123!` |
| Student | `student.verify@bytequest.test` | `VerifyPass123!` |

These were created with Supabase admin API + SQL profile updates. Remove them when done:

```sql
delete from public.course_members where profile_id in
  (select id from public.profiles where email like '%.verify@bytequest.test'
     or email like 'new.instructor.%@bytequest.test');
delete from public.profiles where email like '%.verify@bytequest.test'
   or email like 'new.instructor.%@bytequest.test';
delete from auth.users where email like '%.verify@bytequest.test'
   or email like 'new.instructor.%@bytequest.test';
```

Verification materials/activities/jobs (delete in FK order if desired):

```sql
delete from public.processing_jobs where trace_id = 'RAG-816E69D5';
delete from public.audit_events where entity_id in
  (select id::text from public.learning_activities where title like 'Verification loops quiz')
  or summary like '%Week 6 scanned handout%';
delete from public.learning_activities where title like 'Verification loops quiz'
   or title like 'Python Defining and Calling Functions Assessment%';
delete from public.instructional_documents where title = 'Week 6 scanned handout';
```

Or reset local data only if acceptable: `supabase db reset` (destroys local accounts/progress — the
project README advises against this when data matters).

### Screenshot tooling

```powershell
# headless Edge
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --remote-debugging-port=9222 `
  --user-data-dir="$env:TEMP\bq-edge-profile" about:blank

# single page
node logs\cdp-shot.mjs "http://127.0.0.1:3000/faculty" "logs\shots\faculty-dashboard.png" 1440 1000 faculty.verify@bytequest.test
# scripted flows: faculty-draft <draftId> <courseId>, faculty-create <courseId>, admin-failed-job,
#                  admin-account <courseId>, admin-config, admin-availability,
#                  permission <email> <path>
node logs\cdp-flow.mjs admin-availability
```

The scripts inject the Supabase session into **sessionStorage** under `sb-127-auth-token` (the app does
not persist auth in localStorage).

Course id for the Python track in the current local DB:
`ee5226b2-822d-431d-bd78-1a746e7afabf`.

---

## 9. Remaining work

### P0 — finish verification (no new features)

1. **Administrator configuration UI walkthrough** (was interrupted; nothing saved):
   `node logs\cdp-flow.mjs admin-config` until “saved as version” and the conflict panel
   (“Another administrator saved this setting first”). The backend conflict path is already covered by
   `test_configuration_version_conflict_and_validation`.
2. **Administrator availability UI walkthrough**:
   `node logs\cdp-flow.mjs admin-availability` (implemented, not yet run). Confirm the impact dialog,
   save, and updated state.
3. **Narrow-width screenshots** at ~768px and ~400px for faculty dashboard, draft workspace (split
   becomes one column), materials, admin dashboard/accounts/monitoring; check that the sidebar becomes
   a drawer, tables stack with `data-label`, sticky action bar becomes static, and no horizontal scroll
   appears.
4. **Keyboard-only pass**: Tab order through topbar → sidebar → filters → rows → dialogs; Escape closes
   dialogs; focus returns to trigger; focus ring visible; live regions announce save/publish errors.
5. **Failure/conflict recovery in the UI**:
   - stale `content_version` on draft save (open two tabs or bump via API) → notice + retry keeps edits;
   - service failure (stop API or use CDP offline) → page keeps filters and offers Retry;
   - citation unavailable state (temporarily blank a citation excerpt in DB) → citation id + retry.
6. **Faculty material happy path + retryable failure**: upload a normal searchable PDF through
   `/faculty/materials`; verify needs-review replacement; produce a retryable failure only via a test
   or fault injection (normal Gemini/configuration failures are hard to trigger locally).
7. **Administrator materials/activities screenshots** (pages exist, not visually inspected).
8. **Account deactivate/reactivate through the UI** (API-tested): confirm the impact dialog, immediate
   blocked session, and reactivate restoring assignments.

### P1 — functional gaps / decisions

1. **Admin course-creation UI is missing** even though `POST /api/v1/admin/courses` exists. Add a
   “New course” form to `/admin/assignments` or a Courses page, with duplicate-code inline error.
2. **`prediction_min_history` is seeded but not enforced.** `performance` currently shows every saved
   prediction. Either enforce the minimum prior graded tasks before displaying a prediction or remove
   the setting from configuration. This is a real correctness/UX gap.
3. **Student content is not course-scoped** (deliberate, §3.1). If the PDF’s enrolled-course model is
   required, add enrollment checks to `/api/v1/quests` and quest groups — this is a major change that
   will alter existing student behaviour and needs an explicit product decision.
4. **Legacy `/instructor` duplication.** Decide whether to redirect it to `/faculty`, keep it as
   “advanced generation studio”, or migrate its remaining unique features (exam builder is separate).
5. **Course title cosmetic**: backfill creates “Cpp Programming Track”; use “C++ Programming Track”.
6. **Admin accounts list has no pagination** (27+ rows locally). Add paging or server-side pagination
   before a real cohort.
7. **Configuration type for `rag_similarity_threshold`** is stored as JSON string with numeric bounds;
   the UI uses a text input. Consider a decimal type.
8. **`processing_jobs` only records RAG indexing.** Code-runner/prediction health is derived from
   `submission_jobs` / `ml_predictions`; either document this clearly or write job rows from those
   workers.
9. **Admin activity archive has no restore** (PDF requirement only asks for archive; confirm intended).
10. **Self-registered profiles have no `profiles.email`**; the account/assignment lists fall back to
    `auth.users`. Consider setting `email` on first login or on profile creation to avoid the extra
    join and empty emails in other views.
11. **Invitation email delivery** should be checked in the local inbox (inbucket/Mailpit) and the
    redirect/set-password URL configured for the target deployment.
12. **Active sidebar pill styling changed for students too.** Confirm with the product owner; if it
    should be workspace-only, scope the selector to `.workspace-shell`.
13. **Audit summaries**: existing rows created before the readable-schedule change still show raw ISO
    timestamps. New rows use `2026-10-30 00:05 UTC` style.
14. **No server-side rate limiting on the new admin/faculty endpoints** beyond existing quotas; consider
    if abuse surface matters.

### P2 — tests and cleanup

1. Add frontend tests (there is no React test runner yet): shell role gates, focus trap/focus return,
   unsaved guard, count/list parity, duplicate-email form preservation.
2. Add backend tests for: admin dashboard count parity, material upload failure path (monkeypatch
   extraction/embedding), settings last-editor display, audit search, monitoring stale/unavailable
   branches, invitation failure rollback.
3. Re-run all checks after any change (commands in §1).
4. Remove/ignore verification artifacts (`logs/` is already git-ignored; the verification accounts and
   records are in the local DB only).
5. Update `README.md`/`docs/LOCAL_E2E.md` with the new role entry points and API surface if this work
   is kept (currently only this log exists).
6. Consider adding a `docs/` note listing the new endpoints for future agents; this document is the
   current contract reference.

---

## 10. Files created or modified (this work)

Backend:

- `supabase/migrations/20261029000100_faculty_admin_workspace.sql` (new)
- `backend/app/models/entities.py`
- `backend/app/core/security.py`
- `backend/app/api/profiles.py`
- `backend/app/api/rag_instructor.py`
- `backend/app/api/faculty.py` (new)
- `backend/app/api/admin.py` (new)
- `backend/app/main.py`
- `backend/app/services/course_access.py` (new)
- `backend/app/services/workspace_common.py` (new)
- `backend/app/services/workspace_queries.py` (new)
- `backend/app/services/audit.py` (new)
- `backend/app/services/settings_service.py` (new)
- `backend/app/services/monitoring.py` (new)
- `backend/app/services/materials.py` (new)
- `backend/app/services/account_provisioning.py` (new)
- `backend/app/services/ai_rag/embeddings.py` (shared bounded embedding)
- `backend/tests/test_faculty_admin.py` (new)

Frontend:

- `frontend/src/lib/workspace.ts` (new)
- `frontend/src/lib/types.ts`
- `frontend/src/components/workspace/workspace-provider.tsx` (new)
- `frontend/src/components/workspace/ui.tsx` (new)
- `frontend/src/components/workspace/student-preview.tsx` (new)
- `frontend/src/app/faculty/layout.tsx`, `page.tsx`, `review/page.tsx`, `review/[id]/page.tsx`,
  `materials/page.tsx`, `activities/page.tsx`, `activities/[id]/page.tsx`, `performance/page.tsx`,
  `accessibility/page.tsx` (new)
- `frontend/src/app/admin/layout.tsx`, `page.tsx`, `accounts/page.tsx`, `assignments/page.tsx`,
  `materials/page.tsx`, `activities/page.tsx`, `configuration/page.tsx`, `monitoring/page.tsx`,
  `accessibility/page.tsx` (new)
- `frontend/src/app/globals.css` (workspace section + refinements)
- `frontend/src/components/site-header.tsx`
- `frontend/src/components/faculty-view.tsx`
- `frontend/src/app/quests/page.tsx`
- `frontend/src/app/instructor/page.tsx`
- `frontend/src/components/chat/chat-shell.tsx`

Verification helpers (git-ignored): `logs/cdp-shot.mjs`, `logs/cdp-flow.mjs`, `logs/cdp-check.mjs`,
`logs/shots/*.png`, `logs/scanned-handout.pdf`, `logs/system-design-extract.txt`, `logs/pdfpages/*`.

---

## 11. Quick current-state checklist

- [x] Migration applied and backfilled; existing student data untouched.
- [x] Server-side role + account-status + course-assignment checks on every new protected route.
- [x] Faculty dashboard/review/materials/activities/performance implemented.
- [x] Administrator dashboard/accounts/assignments/materials/activities/configuration/monitoring
      implemented.
- [x] Shared shell matches student visual language (white topbar, pale lavender page, light sidebar,
      purple active pill, white bordered panels, green positive states).
- [x] Draft approval is deliberate and audited; saving never publishes.
- [x] Grading lock after attempts with new-version path.
- [x] Dashboard counts derive from the same filters as destination lists.
- [x] Error/empty/loading states on every page; dialogs trap/return focus.
- [x] Backend 47 tests pass; typecheck/lint/build pass.
- [x] Admin configuration save and stale-version conflict panel verified live; retry limit restored to 3.
- [x] Admin availability change verified live; Count Vowels restored to its original schedule.
- [x] Keyboard skip navigation and dialog focus/Escape behavior verified.
- [x] Admin materials and activities reviewed at the desktop width; searchable PDF upload indexed successfully. A transient failure was staged on the newly uploaded local fixture and faculty Retry processing returned it to Ready. The local verification PDF, jobs and audit entries were then removed.
- [x] `prediction_min_history` now gates new shadow predictions by distinct prior graded activities in the same topic; follow-up migration clarifies its description.
- [x] Admin course-creation UI and API test added; a local verification course was created, checked in the directory and then removed.
- [x] Frontend component tests cover notice semantics, search submission, dialog keyboard behavior, and the mobile navigation toggle.
- [ ] 768/400 px screenshots: the available in-app browser viewport override reported 1280 px after both requested sizes, so visual evidence at those widths could not be captured in this pass. Responsive CSS rules are present at 850/640 px.

Source review of the small-screen rules found and fixed a reversed mobile menu state. The navigation now starts closed, reports its expanded state accurately, closes after choosing a page, and positions its drawer relative to the layout below the wrapping top bar. The 400 px behavior is covered by a component interaction test with a small-screen media query; actual 768/400 px screenshots remain to be captured in a browser that honors viewport sizing.

### Continuation decision on student course scope

The student quest map remains language-track scoped for this release. The new courses backfill those tracks, while existing student sequencing, badges, and prior attempts continue to use the track. Re-scoping the student APIs to course membership would change access and progress rules and needs its own migration and compatibility checks. The faculty and administrator workspace already enforces course membership server-side.

### Additional navigation fix

Onboarding now routes instructors to `/faculty` and administrators to `/admin`. The previous `/instructor` landing page remains available for legacy generation features, but it is no longer the default after sign-in.

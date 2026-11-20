# Phase 0 — ByteQuest instructor audit

Reviewed the current working tree, the 12 supplied desktop screenshots, and the running local API. The instructor workspace already supports course-scoped review, grading analysis, announcements, and exams. The most consequential gaps are course context while data reloads, consistent Manila scheduling, and the distinction between course rosters and workshop groups.

## Design system and data flow

- The app uses Next.js App Router, React, strict TypeScript, and global CSS. The branding font is local ByteBounce. Body and headings use the system stack (Segoe UI on Windows), and code and eyebrow labels use monospace. The effective workspace tokens include indigo ink `#21163a`, pale canvas `#f8f7fb`, white surfaces, purple actions `#5927a6`, and semantic green, amber, and red states. Workspace panels use 12 px corners, 18 px padding, and a subtle shadow. Navigation uses hand-authored SVG icons. The app sets a light color scheme and offers high contrast, text scaling, a legible font, and reduced motion. [Styles](../frontend/src/app/globals.css) · [Root layout](../frontend/src/app/layout.tsx) · [Dependencies](../frontend/package.json)
- Shared components include `PageHeading`, `Button`, `StatCard`, `StatusChip`, `Notice`, `EmptyState`, `LoadingPanel`, filter controls, table wrappers, confirmation dialogs, and toasts. The shared shell has a sticky header, desktop sidebar, phone bottom tabs, Chat Assistant, and Account menu. `WorkspaceProvider` renders the instructor course picker in content and carries course context through the URL. The existing CSS uses 150 ms and 220 ms motion tokens, route fades, and overlay entrances with reduced-motion support. [Workspace components](../frontend/src/components/workspace/ui.tsx) · [Course context](../frontend/src/components/workspace/workspace-provider.tsx) · [App shell](../frontend/src/components/app-shell.tsx)
- Instructor pages primarily fetch on the client through `useApi` and `apiRequest`. Supabase Auth supplies the bearer token, and requests use `cache: "no-store"`. Mutations generally refresh the affected view through `reload` or component-specific refresh. The shell builds a sign-in return link. The dependency manifest has no Tailwind, shadcn/ui, Zod, or third-party animation package. CSS already supplies motion primitives. [API client](../frontend/src/lib/api.ts) · [Workspace API wrappers](../frontend/src/lib/workspace.ts) · [Session shell](../frontend/src/components/app-shell.tsx)

## Current screens and feature coverage

| Area | Existing route and behavior | Gap against the brief |
| --- | --- | --- |
| Dashboard | `/instructor` has course context, four status cards, action queue, class snapshot, upcoming openings, recent staff audit events, and announcements. | Weekly active learners, submissions today, deadline tracking, explainable intervention list, learner activity feed, dashboard charts, and the full quick-action set. The current “active learners” count represents the roster. |
| Classes and students | `/workshops` supports group creation, join codes, and activity assignment. Course creation and memberships are managed under `/admin/courses` and `/admin/assignments`. | Instructor-managed course or section lifecycle, join-code rotation, manual roster changes, and a paginated roster with sorting and filters. |
| Lessons and materials | `/instructor/materials` supports PDF upload, versioning, processing status, retry, download, archive, and restore. `/instructor/materials/studio` is the authoring studio. | Composable modules and lesson ordering and publication lifecycle, plus byte-level upload progress. |
| Activities | `/instructor/activities`, `/instructor/activities/[id]`, and `/instructor/preview` cover manual quiz/challenge creation, student preview, scheduling, Judge0 validation, test visibility, grading locks, and new versions. | Late penalties, extensions, and multi-class assignment for arbitrary course sections. Current group assignment and new versions cover portions of the requested workflow. |
| AI generation | The studio generates a draft from a selected PDF. `/instructor/review` and `/instructor/review/[id]` support editing, source excerpts, rejection, approval, and publication. | Multi-material selection, question-to-passage mapping in the editor, single-item regeneration, and an explicit partial-result recovery flow. |
| Submissions, progress, and reporting | `/instructor/performance` shows learner results, attempt history, and a best-score CSV gradebook. `/instructor/activities/[id]/analysis` shows activity outcomes and question analysis. `/instructor/ml` is a separate advisory and research surface. | A dedicated submissions filter/detail workflow, grading overrides with reasons, feedback, instructor reruns, a unified learner profile, class topic mastery views, and a print-friendly report. |
| Gamification and chat | `/instructor/gamification` shows aggregate engagement, solve quality, recall, and debugging data. The shell exposes Chat Assistant. | Per-class XP, badge and leaderboard settings, plus aggregate tutor topic insights if included later. |
| Announcements and notifications | The dashboard can create, edit, pin, expire, and remove course announcements. Student dashboard delivery is wired through `/api/v1/pilot/announcements`. | Scheduled first publication, an instructor in-app inbox, and notification preferences. |
| Exams | `/instructor/exams` supports timed exams, group assignment, publishing a snapshot, release, and retake grants. | Empty states lack direct links to the steps that unlock exam creation. Eligibility uses workshop and activity ownership, so the course activity list and exam catalog can legitimately show different data. |
| Profile | Shared `/profile` includes account editing and the Supabase password-reset flow. `/account/accessibility` holds shared accessibility preferences. | Instructor notification settings. |

[Instructor routes](<../frontend/src/app/(workspace)/instructor>) · [Navigation and labels](../frontend/src/lib/navigation.ts) · [Workshop API](../backend/app/api/quest_groups.py) · [Admin routes](../backend/app/api/admin.py)

The student recommendation path calls `determine_track_recommendation`. The optional ML shadow scorer is disabled by default and runs after the authoritative attempt and recommendation commit. The instructor ML screens are therefore an existing research feature. They are separate from the requested explainable “needs help” list. Gemini is configured as `gemini-3.5-flash-lite` by default. Judge0 has its own client and timeout settings. [Rule-based sequencer](../backend/app/services/gamification/sequencer.py) · [Shadow scorer](../backend/app/services/ml_predictor/shadow.py) · [Backend configuration](../backend/app/core/config.py)

## Supabase data and authorization

| Data | Current tables and relationships |
| --- | --- |
| Identity and course access | `profiles`, `courses`, `course_members`. Membership carries active/pending/removed status and student/instructor role. Existing language tracks were backfilled into courses and memberships. |
| Instructor workshops | `quest_groups`, `quest_group_members`, `quest_group_activities`. Groups have their own creator, language, join code, memberships, and activity associations. |
| Materials and retrieval | `instructional_documents`, `document_chunks`, `processing_jobs`. Documents have course and version metadata. Chunks support retrieval over uploaded material. |
| Authored and graded work | `learning_activities`, `test_cases`, `activity_attempts`, `activity_drafts`, `submission_jobs`. `learning_activities` carries course, review, availability, and version data. `activity_drafts` stores learner work in progress. The instructor review queue works on draft `learning_activities`. |
| Learning, hints, and research | `badges`, `student_badges`, `challenge_hints`, `hint_uses`, `concept_reviews`, `ml_predictions`, `research_consents`. |
| Exams and delivery | `exams`, `exam_items`, `exam_assignments`, `exam_attempts`, `exam_retake_grants`, `exam_sample_runs`, `notification_outbox`. Exam assignments link to workshop groups. |
| Instructor operations | `course_announcements`, `audit_events`, `platform_settings`. Announcements are course-scoped. Settings currently belong to platform administration. |

[Core schema](../supabase/migrations/20261022000000_core_schema.sql) · [Course model and indexes](../supabase/migrations/20261029000100_faculty_admin_workspace.sql) · [Workshop schema](../supabase/migrations/20261027000100_quest_groups.sql) · [Drafts and jobs](../supabase/migrations/20261028000100_pilot_core.sql) · [Exam schema](../supabase/migrations/20261028000200_pilot_exams.sql) · [Announcements](../supabase/migrations/20261115175945_course_announcements.sql)

The faculty workspace validates the authenticated profile, requires instructor role, and resolves active course assignments server-side. Other teaching routers share instructor/admin access and add resource ownership or assignment checks according to their existing contracts. The API queries Postgres through SQLAlchemy. Migrations enable RLS and revoke direct browser-role access on relevant API-managed tables, including course memberships and announcements. Preserve the application ownership checks when extending that model. The currently deployed RLS and database-role grants were outside this verification. [JWT and role checks](../backend/app/core/security.py) · [Course access](../backend/app/services/course_access.py) · [DB session](../backend/app/core/database.py) · [Database grants and indexes](../supabase/migrations/20261112235900_database_access_and_read_indexes.sql)

## Current FastAPI inventory

All paths below are relative to `/api/v1`. Braces denote path parameters. The local OpenAPI inventory agreed with the current source for the instructor-facing routes below.

| Family | Methods and paths |
| --- | --- |
| Faculty overview | `GET /faculty/courses`, `GET /faculty/dashboard` |
| Faculty review | `GET /faculty/drafts`, `GET/PATCH /faculty/drafts/{activity_id}`, `POST /faculty/drafts/{activity_id}/reject`, `POST /faculty/drafts/{activity_id}/approve` |
| Faculty materials | `GET/POST /faculty/materials`, `PATCH /faculty/materials/{document_id}`, `GET /faculty/materials/{document_id}/download`, `POST /faculty/materials/{document_id}/{versions,archive,restore,retry}` |
| Faculty activities | `GET/POST /faculty/activities`, `GET/PATCH /faculty/activities/{activity_id}`, `POST /faculty/activities/{activity_id}/{verify,schedule,publish,versions}`, `GET /faculty/activities/{activity_id}/{preview,analysis}` |
| Faculty results | `GET /faculty/performance`, `GET /faculty/performance/students/{student_id}`, `GET /faculty/gradebook`, `GET /faculty/gamification-insights` |
| Faculty announcements | `GET/POST /faculty/announcements`, `PATCH/DELETE /faculty/announcements/{announcement_id}`, `GET /pilot/announcements` for enrolled students |
| AI studio | `GET /instructor/workspace`, `GET/PATCH /instructor/activities/{activity_id}`, `PATCH /instructor/activities/{activity_id}/{quiz,review,publish}`, `POST /instructor/activities/{activity_id}/verify` |
| AI materials and generation | `POST /instructor/documents/upload`, `PATCH /instructor/documents/{doc_id}`, `GET /instructor/documents/{doc_id}/download`, `POST /instructor/documents/{doc_id}/{versions,archive,restore,reprocess,generate-challenge,generate-quiz}` |
| Workshops and hints | `GET/POST /quest-groups`, `POST /quest-groups/join`, `POST /quest-groups/{group_id}/activities`, `GET /pilot/instructor/groups/{group_id}/students`, `GET/PUT /pilot/instructor/activities/{activity_id}/hints`, `POST /pilot/instructor/activities/{activity_id}/close` |
| Exams | `GET/POST /exams/instructor`, `GET /exams/instructor/catalog`, `GET /exams/instructor/{exam_id}`, `POST /exams/instructor/{exam_id}/{publish,release}`, `POST /exams/instructor/{exam_id}/retakes/{student_id}` |
| Research and advisory analytics | `GET /faculty/ml`, `GET /faculty/ml/students/{student_id}`, `GET /faculty/ml/evaluation`, `GET /predict/instructor/analytics` |
| Shared dependencies | `GET/POST /admin/courses`, `GET/POST /admin/assignments`, `POST /admin/assignments/{membership_id}/{confirm,remove}`, `GET/PATCH /profile/me`, `POST/DELETE /profile/me/avatar`, `POST /submission-jobs`, `GET /submission-jobs/{job_id}` |

[Faculty router](../backend/app/api/faculty/__init__.py) · [AI studio](../backend/app/api/rag_instructor.py) · [Exams](../backend/app/api/exams.py) · [Pilot](../backend/app/api/pilot.py) · [ML analytics](../backend/app/api/faculty_ml.py)

## Findings

| ID | Severity | Evidence, impact, and acceptance check |
| --- | --- | --- |
| I-01 | High | `useApi` keeps its last data on a path change or fetch error. Performance and Gradebook read that data directly, and CSV stays actionable during a course switch. An instructor can mistakenly use or distribute the previous course’s grades. Bind displayed rows, drawers, and export to the selected course. Test a delayed request and a failed request after switching between two assigned courses. [Fetch hook](../frontend/src/components/workspace/ui.tsx) · [Gradebook](../frontend/src/components/instructor/gradebook.tsx) |
| I-02 | High | The activity editor labels date inputs Asia/Manila and converts them using the browser timezone. Instructors using another device timezone can schedule the wrong instant. Apply explicit Manila conversion at the instructor boundary and verify UTC round-trips for activity, announcement, and exam dates. [Date helpers](../frontend/src/lib/workspace.ts) · [Activity editor](<../frontend/src/app/(workspace)/instructor/activities/[id]/page.tsx>) · [Exam conversion](../frontend/src/components/instructor-exams.tsx) |
| I-03 | High | CSV escaping handles quotes and delimiters. It leaves formula-like spreadsheet cells in user-authored text unchanged. Neutralize formulas in text fields and keep scores numeric. Cover names and activity headings in export tests. [CSV serialization](../frontend/src/components/instructor/gradebook.tsx) |
| I-04 | High | Activity and draft saves compare a fetched `content_version` before doing a separate write. Two concurrent saves can both pass the comparison. Announcement updates lock the row and accept writes without an expected revision. Exercise concurrent saves on Postgres and verify the losing editor retains its input. [Activity update](../backend/app/api/faculty/activities.py) · [Draft update](../backend/app/api/faculty/drafts.py) · [Announcement update](../backend/app/api/faculty/announcements.py) |
| I-05 | Medium | Screenshots 11–12 show a disabled exam publish action and plain prerequisite text. The catalog filters to groups and published activities the instructor created. Add direct links to Workshops and the publishing workflow, and explain what is eligible after the instructor selects a group. [Exam UI](../frontend/src/components/instructor-exams.tsx) · [Exam catalog](../backend/app/api/exams.py) |
| I-06 | Medium | Screenshots 2, 4, and 6–8 show the sidebar scrolling away, secondary destinations looking like ungrouped text links, and the gradebook extending past the visible columns. The shared shell currently uses phone bottom tabs. Check persistent course context, a labeled Builder subnavigation, and keyboard access to the wide gradebook at narrow widths. [Shell](../frontend/src/components/app-shell.tsx) · [Styles](../frontend/src/app/globals.css) |
| I-07 | Medium | The common loader is a spinner. Retry, empty-state actions, and unsaved-change handling differ by screen. Existing warnings cover browser unload and course switches in the editor flows. The workspace lacks per-widget error boundaries for the dashboard. Cover loading, empty, failure, success, and internal navigation with the same interaction rules. [Workspace components](../frontend/src/components/workspace/ui.tsx) · [Course provider](../frontend/src/components/workspace/workspace-provider.tsx) |
| I-08 | Medium | Performance and gradebook can fetch the full roster and grade matrix. Several other lists cap results without pagination, and dashboard audit actor lookups run per event. Paginate records at the API boundary, preserve totals independently of the visible page, and measure the gradebook at representative course sizes. [Performance queries](../backend/app/api/faculty/performance.py) · [Shared queries](../backend/app/services/workspace_queries.py) · [Dashboard query](../backend/app/api/faculty/overview.py) |
| I-09 | Medium | Several routes return unmodeled dicts and errors use a mix of string, object, and validation-array detail. The client has TypeScript interfaces and manual validation, which do not validate responses at runtime. Honor the requested Zod/Pydantic contracts in the implementation phases while preserving current callers. [API parsing](../frontend/src/lib/api.ts) · [Faculty activities](../backend/app/api/faculty/activities.py) · [Faculty announcements](../backend/app/api/faculty/announcements.py) |

### Desktop scorecard

| Dimension | Score out of 4 | Evidence |
| --- | --- | --- |
| Product clarity | 3 | The five destinations and current course make the workspace recognizable. Moving between course assignments and workshop groups is less clear. |
| Hierarchy and navigation | 2 | Dashboard cards and action queue scan well. Builder links and the legacy exam form need the same navigation and action patterns. |
| Typography and visual consistency | 3 | Brand, typography, panels, and statuses are consistent on the main surfaces. The course picker and exam form use different control patterns. |
| Task feedback and data resilience | 2 | Review locks, status labels, and recoverable material failures are visible. Course changes and certain empty/error/loading states need clearer feedback. |
| Keyboard, contrast, mobile, and motion | Pending | Source contains focus and reduced-motion support. The screenshots cover desktop states only. |

## Decisions for Phase 1

1. Should instructors create class sections inside admin-managed courses, manage selected courses directly, or extend Workshops into sections? Can a course or section have more than one instructor? This sets the boundary for rosters, assignment, visibility, and exports.
2. Should manual grading change the official score only, or also recalculate mastery, XP, recommendations, and leaderboard totals? Should a Judge0 re-run replace a prior result or add an audited result?
3. Should the existing Machine Learning screen remain accessible under Progress as a research tool? The requested instructor intervention list can use rule-based evidence independently.

No repository files are needed to start the plan. Before claiming deployment parity, verify applied migrations and effective RLS grants in the target environment. Before claiming accessibility or student/admin compatibility across the redesign, verify with role-specific test accounts, keyboard, 320 px and 200% zoom checks, reduced motion, and complete publish/grade/release flows.

## Verification

- `npm run test:components -- --reporter=dot` passed all 129 tests in 32 files. `npx tsc --noEmit --incremental false` and `npm run lint` passed.
- `python -m pytest -q tests/test_faculty_admin.py tests/test_ml_exam_features.py tests/test_auth_jwks.py` passed all 50 tests using the repository virtual environment. The run emitted five Starlette deprecation warnings. Covered examples include student denial, unassigned instructor denial, course-scoped performance, draft publication, and announcement ownership.
- The local OpenAPI endpoint returned the instructor route inventory and an anonymous request to `GET /api/v1/faculty/courses` returned `401`. Authenticated browser flows, production RLS, live Gemini/Judge0 failure handling, and contrast compliance remain unverified.

**Verdict:** Correct the course-data, timezone, CSV, and concurrent-edit issues before expanding the affected workflows. The existing review, versioning, and assignment checks provide the baseline for the redesign.

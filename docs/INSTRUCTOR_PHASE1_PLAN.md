# Phase 1 — ByteQuest instructor redesign plan

The instructor workspace will organize teaching around the existing admin-managed courses. **There is no section layer: the course is the teaching unit (revised 11/21/26).** A course's roster is its admin-managed course membership. The Dashboard will surface work that needs attention today. Analytics will explain class performance, identify learners who need help, and show what to reteach.

This document proposes contracts and workflows for Phase 2. Paths, tables, and models marked as planned are design decisions. Existing route and data references come from the [Phase 0 audit](../.design/checkup-report.md).

## Courses and Workshops

Courses and Workshops do different jobs and share no membership, so neither can stand in for the other. The [Workshop plan](WORKSHOP_CLASSROOM_PLAN.md) covers the Workshop side.

| | Course | Workshop |
| --- | --- | --- |
| Purpose | Official teaching: assignments with due dates, grades, overrides, the gradebook, lessons, materials and course analytics. | An optional practice group: a curated list of published activities, an exam audience, a board and a progress view. |
| Who creates it | An admin. | An instructor or an admin. |
| Who is in it | Students and instructors an admin assigns through `course_members`. Every active instructor on the course is a co-instructor with the same teaching rights. | The creator, plus students who join with its code. The owner can remove a student. |
| Join code | None. | Yes. |
| Owns content | Yes: activities, lessons, materials and topics. | No. It points at published activities that are global or come from a course its owner teaches. |
| Schedule and grades | Due dates, late policy, extensions and official final grades. | None of its own. Each activity keeps its own schedule, and exams keep their own results. |

**Rules that keep them apart:**
- Joining a Workshop never creates course membership, and course membership never adds anyone to a Workshop.
- A Workshop has no course link. Its activity picker draws on the courses its owner teaches.
- Course enrollment stays with the admin, with no self-service code. Any code-based group is a Workshop.
- Official grades, due dates and the gradebook exist only on courses. A Workshop's progress view reads solved and attempted facts only.

## Step A checkpoint and caller verification

Local Git checkpoint `9f4e35c` on `codex/bytequest-step-a-checkpoint` captures the tracked and non-ignored working tree, including the pre-existing work in progress. The active branch and staging index were kept in place. The checkpoint covers source and repository documents. Local credentials, database data, build output, and ignored files require their existing backup procedures.

| Method and route | Repository caller | Verification |
| --- | --- | --- |
| `POST /api/v1/faculty/activities/{activity_id}/schedule` | The instructor activity editor calls `scheduleActivity` with the revision from the loaded activity. Two integration calls cover a blocked faculty reopen and a valid reschedule. | The shared helper sends `content_version`. Both test calls supply it. Step A also saved the same deadline from real signed-in New York and UTC browser sessions. [Editor](<../frontend/src/app/(workspace)/instructor/activities/[id]/page.tsx>) · [API helper](../frontend/src/lib/workspace.ts) · [Integration tests](../backend/tests/test_learning_flow_integration.py) |
| `PATCH /api/v1/faculty/announcements/{announcement_id}` | `CourseAnnouncements` calls `updateCourseAnnouncement` with the item's `updated_at`. Frontend and backend tests cover edit payloads, stale edits, authorization, validation, and clearing expiry. | `expected_updated_at` is copied from the loaded ISO timestamp so subsecond precision is preserved. The API returns the new timestamp on success. [Editor](../frontend/src/components/instructor/course-announcements.tsx) · [Component tests](../frontend/src/components/instructor/course-announcements.test.tsx) · [API tests](../backend/tests/test_faculty_admin.py) |
| Adjacent student, admin, and script paths | Student Dashboard reads `GET /api/v1/pilot/announcements`. Admin availability uses `POST /api/v1/admin/activities/{activity_id}/availability`. The live multi-role QA script creates announcements with `POST /api/v1/faculty/announcements` and reads the student feed. | These contracts are unaffected. The repository search found no additional writers to the two tokenized methods. [Student dashboard](<../frontend/src/app/(workspace)/dashboard/page.tsx>) · [Admin handler](../backend/app/api/admin.py) · [QA script](../backend/tests/qa_live_multi_role.py) |

The preflight rerun passed five backend tests and six frontend component tests. TypeScript passed. That covers faculty and admin reopening behavior, ordinary faculty scheduling, announcement edits and reads, and the local RLS checks. The full live QA script was inspected for callers.

For release, stage and switch the matching frontend and API together, smoke-test both revision-token routes, and run the RLS probe against the migrated hosted Supabase project before enabling public traffic. The existing pytest fixture checks local Postgres and refuses non-loopback targets. Phase 2 supplies the hosted-safe verification procedure and a course permission matrix. [Deployment checklist](PHASE7_DEPLOYMENT_READINESS.md)

## Sitemap and routes

Keep ByteQuest's existing purple design tokens, controls, icons, and CSS motion. Use an instructor-only shell variant with a collapsible desktop sidebar, a phone drawer, and shared account, chat, search, and notification controls. The header carries the course selector. Deep pages show breadcrumbs and return links that preserve course and filters. The existing student and admin shells supply design patterns and remain on their current routes.

Each data-driven screen reserves its final layout with a skeleton, offers an actionable empty state, and exposes a plain error with Retry. Saves show field-level errors or success, disable duplicate submission, and retain unsaved input on conflicts. Navigation warns before discarding edits, archive actions require confirmation, and expired sessions return through validated in-app links. Reuse the current client request and auth plumbing with course-scoped cache/request keys. Keep cursor state in the URL when it represents a useful return point.

| Route under `/instructor` | Screen and entry point |
| --- | --- |
| `/instructor` | Dashboard. Needs attention, upcoming deadlines, and four direct actions for activity, AI draft, notice, and PDF. |
| `/instructor/courses` | My Courses. Lists the instructor's assigned courses with roster counts and status. An admin creates and staffs courses. |
| `/instructor/courses/[courseId]` | Roster. Read-only search, sort, status and paging over the admin-managed enrollment. A missing student is an admin task, and the screen says so. |
| `/instructor/courses/[courseId]/settings` | The admin-assigned co-instructors (read-only) and course-specific teaching configuration such as gamification settings. |
| `/instructor/courses/[courseId]/students/[studentId]` | Learner drill-down. Analytics can open the same view in a drawer and offer this deep link. |
| `/instructor/materials` and `/instructor/materials/[documentId]` | Course PDFs, upload/version history, processing, retry, archive/restore. |
| `/instructor/lessons` and `/instructor/lessons/[lessonId]` | Modules and lesson order, draft editor, preview, publish/unpublish within the course. |
| `/instructor/activities`, `/instructor/activities/new`, and `/instructor/activities/[activityId]` | Quest & Workshop Builder, new activity, editor. Keep Workshops as a link to the shared `/workshops` route. |
| `/instructor/activities/[activityId]/analysis` and `/instructor/preview` | Activity analysis deep link into Analytics with course and activity preselected. Existing student preview remains a safe author view. |
| `/instructor/materials/studio`, `/instructor/review`, and `/instructor/review/[draftId]` | Generate with selected PDFs, review queue, and review editor with source evidence. Dashboard shortcuts link directly into these routes. |
| `/instructor/submissions` and `/instructor/submissions/[submissionId]` | Filtered queue and review. Include waiting jobs, scored attempts, feedback, and provisional Judge0 reruns. |
| `/instructor/analytics` | Class overview with subtabs Overview, Activities, Needs help, and Engagement. The URL holds date filters, selected activity/topic, and tab. |
| `/instructor/performance` | Gradebook and progress export, with a link to Analytics carrying the active course. Preserve existing bookmarks and clarify gradebook terminology in navigation. |
| `/instructor/gamification` | Gamification Insights with aggregate usage and a course settings entry. Engagement in Analytics links here for mechanic-level detail. |
| `/instructor/announcements` and `/instructor/notifications` | Course announcements and instructor inbox. A notification opens the scoped record that produced it. |
| `/instructor/exams` | Existing exam authoring, publication, result release, and retakes. Workshops stay available for existing exam assignments. |
| `/instructor/settings` | Instructor preferences, with links to shared `/profile` and `/account/accessibility`. |
| `/instructor/ml` | Preserved research code behind a server-controlled flag defaulting to OFF. Hide navigation and links. A direct route and its instructor-facing API must also check the flag and research authorization. |

## Priorities, size, and thesis evidence

Build in the order below. **S** is a contained change of roughly 1–2 implementation days, **M** spans one substantial workflow across layers, and **L** spans schema, API, UI, and integration verification. Estimates assume the current team and cover design complexity, with calibration after the first vertical slice.

| Order | Priority | Feature | Size | Thesis evidence for functionality, usability, performance, and reliability |
| --- | --- | --- | --- | --- |
| 1 | MUST-HAVE | My Courses, read-only rosters, co-instructor access and course-scoped routes | M | Open every assigned course and its roster, measure roster tasks, check indexed paging, and exercise role denial on representative data. |
| 2 | MUST-HAVE | Instructor shell, navigation and ML research flag | M | Complete deep-link and signed-in flows, measure task discovery and mobile navigation, check initial route weight, and exercise flag-off, stale selection and session expiry. |
| 3 | MUST-HAVE | Activities, assignments, scheduling and Judge0 | L | Publish a verified challenge to two courses, measure editor task success, record verification and publishing latency, and test failed cases, retries, late rules and conflicts. |
| 4 | MUST-HAVE | Lessons, modules, PDF processing | L | Reorder and publish a module and retry a failed PDF, observe upload recovery, measure job and list times, and verify safe retries, citation versions and accessible reordering. |
| 5 | MUST-HAVE | AI quiz and challenge generation and review | L | Generate traceable drafts and publish after review, observe item editing, record generation latency by status, and test partial results, provider failure and retained edits. |
| 6 | MUST-HAVE | Submissions, manual grades, reruns and feedback | L | Trace official/final grades, observe two-step rerun and override, measure queue and detail latency, and verify idempotency, audit completeness and XP integrity. |
| 7 | MUST-HAVE | Shared metric definitions, final-score Gradebook and reports | L | Match Gradebook, CSV and Analytics against known fixtures, observe export/print tasks, measure query and stream size, and test suppression, access and correct grade revisions. |
| 8 | MUST-HAVE | Analytics and learner drill-down | L | Answer the three instructor questions with measured accuracy and time, test drill-down and keyboard use, profile widget latency, and verify widget isolation and concurrent refresh. |
| 9 | MUST-HAVE | Dashboard and announcements | M | Complete the daily action queue and scheduled notice flow, observe the number of clicks, measure first useful render, and test visibility boundaries and retry. |
| 10 | MUST-HAVE | Notifications, instructor profile and settings | M | Complete inbox, preference and password flows, observe comprehension of unread states, measure notification lag, and test deduplication and auth recovery. |
| 11 | MUST-HAVE | Course gamification controls | M | Verify XP and badge rules and leaderboard visibility, observe the settings preview, profile rank queries, and test that privacy and XP remain consistent through retries. |
| 12 | MUST-HAVE | Preserve existing exam workflows and validate regression | M | Walk through publish, grade, release and retake, observe prerequisites, time result generation, and test released-result access and retake history. |
| 13 | NICE-TO-HAVE | Chatbot topic totals | M | Optional after Analytics. Use derived topic tags and privacy thresholds for cohort totals. |
| 14 | NICE-TO-HAVE | Realtime dashboard updates | M | Optional after polling and refresh behavior is proven, with the same course guard on subscriptions. |

Use task completion, error recovery, time on task, and participant feedback for usability. Capture actual query timings and service failure/retry outcomes alongside the acceptance tests. Report pilot results against the three instructor questions, with rule-based intervention evidence. The research ML flag remains a separate decision.

## Dashboard and Analytics division

The Dashboard answers **What needs my attention today?** It shows actionable counts for review drafts, processing failures, upcoming deadlines, and help flags. Each item has an owner-visible next action. A short recent course activity list shows new events and links to the relevant queue. It takes the same published metric data as Analytics for any requested number also used there.

Analytics answers **How is the class doing? Who needs help? What should I reteach?** All charts, comparisons, topic mastery, and student progress breakdowns live here. Dashboard links pass the existing `course` context. Examples are Analytics with `range=7d&tab=needs-help` for intervention counts, `range=7d&tab=activities` plus the activity ID for a deadline, and the submissions queue with its status filter for grading work. Review and PDF recovery counts lead to their own work queues.

## Wireframes

### Dashboard desktop

```text
+--------------------------------------------------------------------+
| ByteQuest   [Course v]                 Search   Inbox   Account     |
+--------------+-----------------------------------------------------+
| Dashboard    | Today in CS 101                       [Refresh]     |
| Courses      | [Review drafts] [PDF issues] [Deadlines] [Need help] |
| Builder      | [Create activity] [Generate quiz] [Post] [Upload]   |
| Submissions  +-------------------------------+---------------------+
| Analytics    | Needs attention               | Upcoming deadlines  |
| Gradebook    | Draft / failed PDF / learner  | Due dates in Manila |
| More         | Item reason and next action   | [View activity]     |
|              +-------------------------------+---------------------+
|              | Recent course activity                [View all]   |
+--------------+-----------------------------------------------------+
```

The first viewport prioritizes pending instructor work and common actions. Each card links to the corresponding queue or prefiltered Analytics view. Dates show Asia/Manila and the queue keeps its filter when the user returns.

### Dashboard phone

```text
+---------------------------------+
| [Menu] ByteQuest         [Inbox]|
| [Course v]                      |
| Today in CS 101                 |
| [Review drafts] [PDF issues]    |
| [Deadlines]     [Need help]     |
| [Create activity] [Actions v]  |
| Needs attention                 |
| Draft name       [Review]      |
| PDF issue        [Retry]       |
| Upcoming deadlines             |
| Recent course activity          |
+---------------------------------+
```

The phone layout keeps scope and a primary action visible without opening navigation. Two compact rows of counts lead to the same queues. Each list row wraps its reason and exposes a labeled touch target.

### Analytics desktop

```text
+--------------------------------------------------------------------+
| ByteQuest   [Course v]                 Search   Inbox   Account     |
+--------------+-----------------------------------------------------+
| Navigation   | Analytics                         Updated 10:24 AM |
|              | [Date range v] [Topic v] [Activity v] [Clear]      |
|              | Overview | Activities | Needs help | Engagement     |
|              | [Active] [Completion] [Avg score] [On time] [Work] |
|              +-------------------------------+---------------------+
|              | Submissions over time         | Score distribution  |
|              | Takeaway      [Table] [CSV]   | Takeaway [Table][CSV]|
|              +-------------------------------+---------------------+
|              | Learners x topics    [View table] [CSV]             |
|              | Learner     Loops     Strings     Functions        |
|              | Open a cell to see the learner's attempts           |
+--------------+-----------------------------------------------------+
```

One filter bar drives every visible widget. Overview keeps the five KPI comparisons above the trend and histogram, followed by mastery. Activities, Needs help, and Engagement give each question a dedicated view and retain its filter context.

### Analytics phone

```text
+---------------------------------+
| [Menu] Analytics         [Inbox]|
| [Course v] [Filters (2)]        |
| 30 days / Loops   Updated 10:24 |
| [Overview v]                    |
| [Active]      [Completion]     |
| [Avg score]   [On time]        |
| [Submissions]                  |
| Submissions over time      [i] |
| Takeaway     [Table] [CSV]     |
| Trend chart                    |
| Score distribution             |
| Topic mastery [Choose topic v] |
+---------------------------------+
```

Filters open in a keyboard-accessible sheet and active values stay visible. Widgets stack with reserved heights, and the mastery view starts with one topic column plus learner. A focused learner detail uses a full-height sheet and offers a full-page link.

### Learner drill-down

```text
+----------------------------------------------------+
| CS 101 / Learners / Learner name           [Close] |
| Last active   Course XP earned    Level   Badges   |
| Needs help: rule evidence              [View work] |
| Topic scores  |  Course peer median               |
| Attempt timeline                                   |
| Date / activity / final score / judge result       |
| Current recommendation and reason                  |
| [Open submission] [View activity / reteach topic]  |
+----------------------------------------------------+
```

The learner's evidence and current recommendation sit above the timeline. Topic or heatmap entry points carry the same topic filter. The comparison to the course median is restricted to authorized instructors and applies sample thresholds.

### Activity editor

```text
+-----------------------------------------------------------------+
| CS 101 / Activities / Draft title      [Version] [Preview]       |
| Details | Content & tests | Assign & schedule | Review          |
+--------------------------------------+--------------------------+
| Title, topic, Markdown and language  | Student-facing preview   |
| Starter / reference solution        | Assignment destinations  |
| Visible and hidden case editors     | Revision / judge status  |
| Limits, difficulty, pass mark, XP   | UTC saved / Manila input |
+--------------------------------------+--------------------------+
| [Save draft]       [Validate in Judge0]         [Publish]       |
+-----------------------------------------------------------------+
```

Use the current editor's layout and verification conventions. Keep grading locks, visible/hidden cases, and publication prerequisites visible beside the work. The confirmed publish step names every target course and its schedule.

### Submission review

```text
+-----------------------------------------------------------------+
| Submissions / Learner / Attempt       [Previous] [Next]          |
| Received at / On-time status / Auto grade / Final grade          |
+--------------------------------------+--------------------------+
| Code or quiz response                | Judge0 results           |
| Read-only viewer, line numbers       | Test status / time / RAM |
| and syntax highlighting              | Attempt history         |
+--------------------------------------+--------------------------+
| [Give feedback] [Override with reason] [Run again]               |
| Rerun comparison when ready             [Confirm new result]   |
+-----------------------------------------------------------------+
```

Keep original auto and current final grade visible while reviewing evidence. The final-grade action shows its impact on pass status and potential XP before saving. A rerun receives a separate preview and explicit confirmation.

### Other screen layouts

| Screen | Layout |
| --- | --- |
| Courses and roster | The course list and roster counts sit at the top. Inside a course, lead with roster search. Show co-instructors and teaching settings in the settings tab. Enrollment and staffing changes point to the admin. |
| Materials, lessons and modules | Show processing or publishing status next to each item. The material detail pairs the PDF state and retry with version history. The lesson editor pairs module order with a draft/preview panel and offers keyboard move-up/down controls alongside drag and drop. |
| AI studio and review | Put source selection above the generation settings, job status, and draft link. The review queue shows status and blockers. On a draft, put citations beside the selected question and preserve the current item during a regeneration. |
| Gradebook and reports | Put scope, filters, export, and print view above the matrix. Keep learner identity readable while activity columns scroll. A phone view starts by activity or learner, with links to the same detail data. |
| Announcements and notifications | Announcements show scheduled, pinned, and expired states alongside the composer. Inbox puts unread scoped events first, with a direct link to each source and separate preferences. |
| Settings, gamification and exams | Group profile and communication preferences into separate cards. Show reward/leaderboard previews near settings. Put exam prerequisites and links above the existing catalog and timed exam actions. |

## Main user flows

1. **Open a course → check the roster.** Open My Courses and choose an admin-assigned course. The roster lists the students an admin enrolled. Search, sort, and open a learner. A missing student is an admin enrollment task, so the empty or missing state names the admin as the next step. A group that students join with a code is a Workshop, not a course.
2. **Create activity → validate → publish.** Choose a course, create a coding challenge, edit the prompt and preview, enter starter/reference code, limits, and cases. Save a revision and run Judge0 on that exact content, including hidden cases. Fix failures or retry a timed-out run. Choose courses, Manila availability, late policy, and optional extensions. Read the student preview and confirm publication only after successful validation of the saved revision.
3. **Generate AI quiz → review → publish.** Choose approved indexed PDFs, topic, and generation settings. The job returns draft items and per-question source passages. Open the review editor, inspect each citation, modify/delete/regenerate selected items, and keep the original while a regeneration runs. Recover from timeouts, invalid output, quota or partial results in the same draft. Save and preview, choose the course assignments, then approve and publish the reviewed revision.
4. **Review submission → override.** Filter the course queue and open a submission. Inspect code or quiz answers, visible and instructor-only verdicts, time, memory, and history. Enter a final score and reason, review previous and proposed grade and pass status, and confirm. The backend adds an audit event, keeps the original grade, and recomputes dependent views and one-time XP in the same transaction. A Judge0 rerun creates a candidate first. Confirmation is a separate action.
5. **Spot a struggling learner → act.** Open the Dashboard's needs-help link with a 7-day filter. Sort Analytics by severity and read the rule and its evidence. Open the learner's drill-down, carry the topic filter, then open the relevant attempts or activity analysis. Leave feedback on an attempt or use the activity/lesson links to prepare a targeted reteach. The list refreshes after grading changes and retains the selected filters when the instructor returns.

## Course data model and grade integrity

The current `courses` and `course_members` remain the admin-managed course catalog and the only membership boundary for official teaching. There is no section layer. Course IDs are immutable. Course-owned records carry `course_id`, and each reference to another course-owned record is checked against the same course. Workshops stay separate, as set out in [Courses and Workshops](#courses-and-workshops). [Current course models](../backend/app/models/entities.py) · [Workspace migration](../supabase/migrations/20261029000100_faculty_admin_workspace.sql)

| Planned table | Key columns and constraints | Indexes and lifecycle |
| --- | --- | --- |
| `course_members` (existing, extended) | Existing `course_id`, `profile_id`, `member_role` (`instructor` or `student`), `status`, `assigned_by`, `assigned_at`, `updated_at`. Add `ended_at` and a revision. Several active instructors on one course are co-instructors with equal teaching rights. | Existing unique course/profile/role. Add `(course_id,member_role,status)` for roster paging. Writes stay admin-only and audited. Preserve ended memberships for history and check `ended_at >= assigned_at`. |
| `course_activities` | UUID `id` PK, `course_id`, `activity_id` of the fixed grading version, assignment status, opens/due/close times, late policy and penalty, pass mark and reward snapshot, revision, author and timestamps. Same-course FK to the activity. | Unique course/activity-version assignment, `(course_id,status,due_at,id)` and `(activity_id,course_id)`. Archive or create an explicit new version if grading is locked. |
| `course_activity_extensions` | `(course_activity_id,student_id)` PK, `extended_due_at`, reason, actor, timestamps, revision. Validate the active course membership when issuing the extension. | `(student_id,course_activity_id)`. Track prior changes in the audit log and store the effective due instant on official receipts. |
| `modules`, `lessons`, `lesson_progress` | Course-owned module and lesson IDs, order and revision. A lesson publishes a revision within its course. Progress ties the published lesson revision, the student, and stable started/finished timestamps. | Unique position within parent, unique progress row per learner/lesson revision, `(lesson_id,finished_at,student_id)`. Keep prior published revisions and completion history. |
| `course_topics`, `activity_topics`, `lesson_topics` | Stable course topic UUID, key and label, with same-course associations to activity/lesson versions. Backfill from verified existing topic labels. | Unique course/key and unique entity/topic association. Index topic → entity for filter joins. |
| `grading_reruns`, `attempt_grade_events`, `activity_xp_awards` | Reruns store UUID, attempt ID, immutable submission and grading snapshot IDs, job state, results, actor, and promotion time. Grade events store attempt ID, event type, original and before/after score or pass facts, instructor, reason, created/published time, revision and idempotency key. XP ledger stores `(student_id,activity_reward_id)` as unique grant key, award, triggering attempt/event and grant time. | `(attempt_id,created_at,id)` for reruns and grade events, unique confirm/idempotency constraints, indexed queued jobs. XP unique key is enforced across courses and activity versions. |
| `course_gamification_settings`, `instructor_notifications`, `instructor_notification_preferences` | Course settings capture enabled badges, XP overrides and course leaderboard mode. Notifications include recipient, course, category, authorized record reference, timestamps, and deduplication key. Preferences belong to the authenticated profile. | One settings row per course, one preferences row per instructor, `(recipient_id,read_at,created_at,id)` for inbox. Use a unique event/recipient/type key. |
| `tutor_topic_events` (optional) | Course/topic ID, UTC time, purpose-scoped learner pseudonym for deduplication, and retention boundary. The event carries no message body. | `(course_id,occurred_at,topic_id)` for windows. Enforce the approved retention policy and expose only aggregate output. |

Extend existing tables where a relationship already fits. Official `submission_jobs` and `activity_attempts` carry `course_activity_id`, submission receipt time, effective due time, and the applied late policy. Add the same scope to learner draft recovery where a student can have work in two assignments. `course_announcements` gains a scheduled publication time. `audit_events` gains course attribution. Use existing `processing_jobs`, drafts, and versioned PDFs for generation and materials. Add per-item provenance to existing authoring records, which already carry their course. Where a challenge has multiple languages, group activity variants while keeping the runtime, reference solution, and verification snapshot specific to each language. Any added course reference is validated server-side against the selected course, assignment, and membership.

- **Grade history.** Keep the original automated grade and grader evidence immutable. A confirmed rerun becomes the current official automated result. Keep manual overrides as separate audited events and use the latest active override as the final score. An explicit, reasoned override removal restores the current official automated grade. A correction is revision-checked and invalidates the Gradebook, Analytics, and rule-based recommendation data for that course.
- **Pass and XP.** Use the captured pass rule and full-precision effective score. Preserve the existing exact all-tests behavior at the 100% challenge threshold for automated grades. A manual score of 100 is an explicit academic decision and may pass. In the same transaction, insert the one-time XP award on a qualifying pass, increment XP only if the insert succeeds, and record the reason if a later correction changes pass status. Never subtract awarded XP. Seed the ledger from recorded `xp_awarded` evidence on historical attempts without updating profile XP. Preserve and flag historical discrepancies for reconciliation. [Current pass rule](../backend/app/services/pass_mark.py) · [Current attempts and XP](../backend/app/models/entities.py)
- **Scoring after due.** A server-stamped receipt determines lateness against the effective due date stored with that receipt. Blocked late work is rejected before enqueue. Accepted late assignments apply their published penalty once to the automated result and retain the raw score. Manual grades explicitly replace the effective score. Extensions affect future receipts, with any historical correction handled as a separate audited grade change.

### Migration and rollback

1. **Inventory and back up.** Record counts and stable IDs for courses, members, materials, activities/versions, submitted attempts, grades, XP, and exams. Use a separate hosted recovery project or local restore for the rehearsal. Flag course-less rows, track-derived access, historical attempts without membership, release-restricted exams, and courses with zero active instructors.
2. **Expand.** Add tables, nullable scope fields, indexes and policy helpers. Apply browser-role restrictions before introducing rows. Preserve legacy routes and original fields. Introduce additive code for course assignment snapshot writes and explicit read fallbacks behind a release flag. Rollback at this point can switch the app pair back while retaining the additive schema.
3. **Link existing records.** Add one `course_activities` row for each existing course activity and version, using its existing dates and publication status. Backfill `course_members.ended_at` from stored evidence, and keep removed members for historical attribution without marking them active. Link practice attempts, learner drafts, and jobs through their explicit course-bound activity. Preserve the original course and activity IDs, published state, scores, time, cases, roster rows, notifications, and audit rows. Keep existing exam and workshop records separate and conserve release/retake history. Record unmatched or ambiguous records for review. Never infer a course from an identity or language alone.
4. **Reconcile and cut over.** Run bounded backfill batches with restartable keys. Compare enrollment and submission counts, sample hashes for grading records, best scores, deadlines, eligibility, the learning flow, and legacy exports. Verify no access broadens through fallback. Enable course assignment scheduling only after all writers stamp a verified `course_activity_id` and the role tests pass on the target schema. When policy changes make a result historical, keep the saved snapshot.
5. **Roll back safely.** Gate or pause course-assignment mutations, roll the matching frontend/API or feature flags together, and retain new rows, grade history and the XP ledger. After final grade events exist, use a compatibility build that honors scoped reads and effective grades. Preserve exports of new records and previous audit timestamps. Use reverse migrations only while the additive tables contain no required data or after a verified archival/recovery rehearsal. Keep a forward recovery path for work already submitted.

### RLS and authorization

All faculty course routes verify the authenticated active instructor profile and an active instructor row in `course_members` on every request. Every co-instructor on a course has the same teaching rights: teach, schedule, grade, and view class analytics. Course records, staffing, and enrollment stay admin-only. Student operations use their own active course membership. Keep explicit SQLAlchemy route checks, and exercise policies through a role that cannot bypass RLS. Service/worker access is independently scoped by job scope and trusted server credentials. The admin provisioning surface remains separate.

Keep current direct browser table grants closed. Add row policies as defense in depth for the scoped API role where appropriate. Resolve recursive membership checks through narrowly callable private helpers that bind the caller from verified identity and fix their search path. Default to invoker views and functions for analytics. Restrict any operational functions to the API role, and supply trusted caller identity in the transaction from the validated access token. Reviews and grader telemetry stay on authenticated API responses.

| Table or table group | Reads | Inserts and writes |
| --- | --- | --- |
| `course_members` | Course instructors see their course roster and co-instructors. A student sees their own memberships. | Admin only, through the existing provisioning surface. There is no self-service join. |
| `course_activities`, `course_activity_extensions` | Course instructors, and enrolled students for visible assignments and their own extension. | Course instructors; validate both scope relationships for every insert and change. |
| `modules`, `lessons`, `lesson_progress` | Course instructors for editable course content. A student sees their courses' published lessons and their own progress. | Course instructors author and publish. Progress writes are student-owned via the validated lesson action. |
| `course_topics`, `activity_topics`, `lesson_topics` | Assigned staff in query scope and safe topic labels for the student's assigned content. | Assigned staff using same-course joins. Curated course-level taxonomy operations stay with authorized course staff. |
| `grading_reruns`, `attempt_grade_events`, `activity_xp_awards` | Assigned staff on the original submission's course. Students receive their own released grade and award through safe endpoints. | Assigned staff initiate or confirm revisions; queue workers persist scoped job results. Grade and XP ledgers are append-only. |
| `course_gamification_settings` | Assigned staff, plus a student-safe settings projection for enrolled learners. | Assigned staff using expected revision. Settings cannot reduce previously earned XP. |
| `instructor_notifications`, `instructor_notification_preferences` | Recipient only. Inbox row also requires current permission to its course. | Scoped internal worker inserts. Recipient can mark read and edit their own preferences. |
| `tutor_topic_events` (optional) | Restricted aggregate SQL operation only. Staff receive suppressed totals for their course. | Trusted server writer scopes the event to the learner's active course and approved data purpose. |
| Existing tables with added course links | Apply the matching course guard for attempts, jobs, learner drafts, announcements, activity provenance, and audit history. | Preserve student/admin behavior with scoped policies and enforce same-course writes. Private answer keys, hidden-case payloads, and unconfirmed grades remain instructor-only. |

**Permission tests.** Use two courses, synthetic student and instructor identities, a second instructor on one course, and a deactivated account. Assert student denial for faculty APIs and other student/course rows, access to their own released outputs only, and inability to edit membership or grades. Assert an outside instructor gets `403` and cannot fetch by UUID, export, join a different course's resource to an authorized ID, or read cached payloads after removal. Assert both instructors on a course can teach, grade, and export there with equal rights, and that neither can change staffing or enrollment. Assert that Workshop membership grants no course access and course membership grants no Workshop access. Run direct PostgREST probes using real role tokens and hosted-safe database-role probes against the migrated Supabase project. Verify direct access is denied or exposes only permitted rows, and record FastAPI results separately. Direct probes use synthetic data and the actual grants without a temporary hosted grant.

## Analytics

### Filters and shared facts

- The URL holds `course`, `range` (`7d`, `30d`, `term`, `custom`), `from`, `to`, `topic`, `activity`, and display `tab`. The server verifies that every selected ID belongs to the chosen scope. Changing course clears incompatible topic/activity/student selections, aborts old requests, and drops the old render immediately. Browser Back/Forward and shared links reconstruct the same view after permission checks.
- Use half-open Manila calendar intervals converted to UTC for querying. A custom end date is inclusive in the UI and becomes the following Manila midnight in the API. Restrict interactive requests to one term or 366 days, whichever is lower for custom filters, and cap row and export sizes. Compare to the immediately preceding equal-length period. Compare the current incomplete day to the same local clock cutoff. Disable delta if a comparable cohort or denominator is unavailable. Treat event-time attribution and latest effective grade as separate dimensions.
- Create one versioned metric dictionary in the backend. Publish metric IDs, units, help text, small-sample status and definitions to the frontend. Compose scoped SQL facts for eligibility, official receipts, final grades, and learning events, then share the same aggregate functions across Dashboard, Analytics, Gradebook, and CSV. Client code formats values and never recalculates scores. The Gradebook and CSV use the same per-learner/assignment numerator and denominator. Record `as_of` and a course data revision for consistent refresh/export. If the requested revision is stale, refresh the scope and offer export of the refreshed data rather than silently mixing revisions.
- A `receipt` is an accepted official practice submission. For queued coding work use `submission_jobs.created_at` and link its eventual attempt through `submission_job_id`. For synchronous quiz/practice work use the server-stamped attempt receipt. Count each receipt once. Exclude sample runs, candidate reruns, and exam attempts from practice metrics. `graded` means a durable result with a final score. `eligible pairs` are distinct learner/assignment opportunities with overlapping assignment and enrollment visibility within the window, attributed to the historical course. Capture assignment policy and codes at receipt time when grades depend on them. Published lesson events can contribute to engagement and completion.
- Return `status=insufficient_data` and the text **Not enough data yet** for aggregate metrics with fewer than five supporting learners or eligible attempts, using the appropriate denominator for the metric. Apply the policy to bins, peer median, comparison periods, exports, tooltips, and computed takeaways. Merge sparse buckets or suppress related totals when simple subtraction would recover a hidden value. Individual authorized attempts and exact rule evidence remain available to the responsible instructor. A zero with adequate observation is displayed as zero. Missing telemetry is labeled unavailable.

### Metric dictionary

All score calculations use the current effective final score at the report revision. Late accepted work uses the stored effective grade. Each denominator is computed from the same course, range, topic, and activity scope as its numerator. Apply the common minimum-sample rule to every aggregate below.

| Metric | Plain-English meaning | Formula | Data source | Edge cases |
| --- | --- | --- | --- | --- |
| Active learners | Learners who did work in the window. | Count distinct learners with at least one recorded learning event in the filtered interval. | Official receipts, tracked lesson progress, and scoped sample runs where available. | Deduplicate repeated events. Login alone is insufficient. Empty temporal coverage is unavailable. |
| Completion rate | Eligible work completed by the end of the window. | Passed eligible learner/activity pairs plus finished learner/lesson pairs, divided by all eligible pairs. | Assignment windows and roster intervals, effective attempt grades, `lesson_progress`. | Once per pair. Previously completed work counts if eligible and complete by cutoff. A grading correction can change pass history at a new report revision. |
| Average score | Typical best grade among work with scores. | Mean of each scored learner/activity pair's best final score from receipts in the window. | Good standing course scope, receipt and final-grade views. | Omit ungraded and never-started pairs. Repeated attempts contribute only their best score per pair. |
| On-time rate | Share of dated official submissions received by their applicable due time. | On-time eligible receipts / official receipts with a known effective due time. | Receipt timestamp, deadline and extension snapshot. | Compare before or at due instant. Exclude undated work and unknown historical due dates. Queued grading does not affect receipt timing. |
| Submissions | How many pieces of work students turned in. | Count distinct official receipts in the window, with period delta. | Job → attempt link and synchronous attempt receipts. | Count queued receipts once. Failed infrastructure jobs keep the receipt with separate processing status. |
| Submissions over time | On which Manila dates work arrived. | Group the official submission count by Manila day or week, with interval-aligned empty buckets. | Same receipt source and date functions. | Server chooses day/week by window length. Render unavailable or suppressed buckets as gaps. |
| Score distribution | Where recorded best scores fall. | Bucket the same scored pairs used in Average score in fixed ranges, including 100 in the last bin. | Final-score view and best-per-pair projection. | Missing scores stay out of buckets and out of the denominator. Ties use stable bin order. |
| Topic mastery | How much assigned work a learner has mastered on a topic. | For each learner/topic, mastered eligible activity pairs / eligible activity pairs. Topic summary uses pooled eligible pairs. | Canonical activity-topic mapping, course assignments, final pass facts. | Display sample status if there are too few scored attempts. Multi-tag activity counts once per matching topic. Topic totals are separate cohort measures. Cells link to scoped attempts. |
| Activity pass rate | Who has passed among learners who tried the activity. | Distinct learners with a final pass / distinct learners with a graded attempt on the activity. | Course assignment and effective grade facts. | Count each learner once. Keep zero attempts and draft work outside the denominator. |
| Attempts to first pass | How many submissions it took successful learners. | Average rank of the earliest final pass among a learner's graded official receipts for the activity. | Ordered receipt and grade facts. | Include earlier graded attempts since assignment opened for learners whose first pass falls in the window. Reruns do not add attempts. Use receipt time and ID to break ties. |
| Time to first pass | How long successful learners worked from first submission to first pass. | Mean elapsed time from first official receipt to first passing receipt for the same eligible learners. | Original server-stamped receipt times. | Same-receipt pass is zero elapsed. Separate grade queue delay from learner progress. Exclude missing receipt times. |
| Activity late rate | How often students turned in work after the deadline on an activity. | Late dated receipts / all dated official receipts for the activity. | Same on-time fact projection. | User-level extensions and undated work use the same rule as the KPI. |
| Judge0 outcome | How the grader classified coding runs. | One final engine class per graded coding attempt. Return counts and shares for accepted, wrong answer, compile error, runtime error, time limit exceeded, and other known verdicts. | Stored official grader summary/status. | A confirmed rerun replaces grader telemetry for that attempt. Manual scoring leaves engine results intact. Exclude service failures and missing telemetry from student-error rates. |
| Most-failed test cases | Which concepts students miss within a challenge. | Per frozen case, count failed executions / recorded executions and sort by failures, then failure rate and stable ID. | Official run telemetry, immutable case identity and a case label or concept tag. | Partial execution and unreached cases stay out of the denominator. Staff-only aggregate labels may describe a skill without exposing hidden expected outputs. Historical telemetry with no trustworthy case ID is unavailable. |
| Hardest activities | The lowest-performing activities worth a closer look. | Sort eligible activities by lowest pass rate, then higher attempts-to-first-pass, then stable ID. | Activity pass and time projections. | Filter out sparse rows before ranking. Show with learner count, sample status, and explicit tie-break. |
| Learners who need help | Which learners meet explainable intervention rules. | Count/list each flagged learner once, sorting by configured severity, evidence recency and learner ID. | Shared rule-based engine and scoped official facts. | Example rule `repeated_failed_topic` is three final failures on the same topic in the past seven Manila days. Return rule ID, version, threshold, observed count, period and evidence references. A later pass can resolve an applicable flag. Predictions play no part. |
| Last active and inactive 7+ days | Which learners have stopped practicing. | Latest qualifying activity per learner through the end of the window. Inactive includes learners with no such event for seven Manila days after joining. | Same scoped learning event view and enrollment intervals. | Display never active distinctly. Exclude inactive or removed enrollments from current roster workload. Respect the selected topic/activity scope. |
| Learning streak | How many consecutive Manila days a learner practiced. | Count consecutive local dates with qualifying work, up to the current early-day grace rule. | SQL learning day buckets and existing streak logic if applicable. | Apply one streak definition to staff and learner views for the same scope. Show course streak separately from existing account-wide streak. |
| Lessons started vs finished | Which lessons learners began and completed. | Count distinct learner/lesson pairs with a first start or completion in the window. | `lesson_progress` and assignment versions. | A finish may fall in a later window than its start. Keep both counts independent. |
| Student topic scores and course median | The learner's best scores on a topic and comparable peer grades. | Average the learner's best final grades per eligible scored activity on that topic. Compare with the median of the same calculation for other learners active in the course. | Gradebook projection, course topics and course roster. | Show comparison only with at least five peers with scores. Student attempts remain individualized and instructor-only at this view. |
| XP, level and badges | The learner's progress in ByteQuest and earned rewards in the course. | Sum confirmed course-attributed XP award rows, read current level and show recorded badge grants. | XP ledger, profiles, `student_badges`. | Distinguish global level and previously awarded badges from course rewards. Never subtract XP after scoring corrections. |
| Chatbot topic totals | Topics students most often ask the tutor about. | Count permitted topic tags per course and window and show the largest supported categories. | Optional derived tags with learner deduplication and scope. | Require at least five learners in a category. Expose only group totals. Exclude message text and personal identifiers from the response and CSV. |

### API and data performance

The proposed faculty base is `F = /api/v1/faculty`, and the course scope is `S = F/courses/{course_id}`. Each Analytics endpoint accepts the path course, `range`, `from`, `to`, `topic_id`, and `activity_id`, with cursor fields on lists. Normalized date windows are returned by the API. Chart CSV uses `format=csv` on the same widget and follows the same suppression and authorization rules. Use a common envelope with widget data, `status`, `as_of`, `data_revision`, validated filters, metric definitions, support counts when permitted, and `next_cursor` for paged rows.

| Method and path | Response shape above the common envelope | Permission |
| --- | --- | --- |
| `GET S/analytics/summary` | `activeLearners`, `completion`, `averageScore`, `onTime`, `submissions`, each with current, previous and delta values plus units. | Active instructor with course membership. |
| `GET S/analytics/submission-trend` | Dated buckets with local labels, sample status, count, and computed takeaway. | Same course guard. |
| `GET S/analytics/score-distribution` | Fixed score bins, counts, support state and takeaway. | Same course guard. |
| `GET S/analytics/topic-mastery` | Bounded topic columns and paginated learner rows with cells, evidence link and cohort topic summary. | Same course guard and course-only learner lookup. |
| `GET S/analytics/activities` | Ranked rows with four activity metrics, labels, sample states, and stable sorting key. | Same course guard and same-course assignment checks. |
| `GET S/analytics/judge0-outcomes` | Selected activity/version verdict buckets and counts. | Same course guard and version eligibility check. |
| `GET S/analytics/test-case-results` | Ranked frozen case labels, attempts with telemetry and failure facts. | Same as Judge0 outcomes. Instructor-only projection strips raw hidden inputs and outputs. |
| `GET S/analytics/needs-help` | Paged learner flags with rule evidence, severity, reason, and drill-down link. | Same course guard. |
| `GET S/analytics/engagement` | Latest active/streak rows, seven-day inactivity status and lesson start/finish summary with pageable evidence. | Same course guard. |
| `GET S/analytics/students/{student_id}` | Identity, topic scores with peer comparison, XP, level, badges, rule-based recommendations and attempt timeline cursor. Optional topic from a clicked cell. | Resolve the student through the selected course's applicable membership; archived history stays scoped to the instructor's role. |
| `GET S/analytics/chatbot-topics` | Suppressed cohort totals by topic, with no per-learner endpoint. Optional. | Same course guard, plus enabled feature and approved data scope. |

Use parameterized SQL views or RPCs for each metric. An indexed scope lookup precedes joins on receipt time and assignment, a stable per-learner/assignment window projection resolves best grade, and one grouped query supplies each widget's dataset. Index `(course_activity_id, received_at, id)` and `(course_activity_id, student_id, received_at, id)` for facts and the effective-grade lookup by attempt. Index lesson progress by assignment/time and course memberships by course/student and interval. Verify actual query plans and avoid per-row permission or learner queries. Add a time budget per widget, bounded CSV streams with formula-safe cells, and modest caches keyed by filters, definitions revision, course data revision, and the authorized scope. Recheck membership on every request and before export. Advance the course data revision inside the same transaction as a change to its metric inputs. Read the revision and results in one consistent database snapshot. Use a 409 for a stale requested data revision and refresh the visible widget group at a consistent newer revision. Page large gradebooks and student columns to bound the first load.

**Acceptance data.** Seed six synthetic learners in one course with five eligible graded pairs and final grades 100, 80, 60, 50, and 40. Verify an average of **66%**, three passes if the documented test pass mark is 60%, a **60% completion rate** for those five eligible pairs, and **80% on time** for four of five dated receipts. Include a second attempt that changes best score without increasing the Gradebook denominator, and compare Calendar windows for receipts on either side of Manila midnight. Use a separate suppressed cohort with four participants and confirm exports, related chart series, and deltas respect the threshold. Include missing telemetry, late penalties, withdrawn students, same-course extensions, UTC/New York browsers, deduplicated XP, and an unconfirmed rerun with no grade effect. Verify exports and Gradebook return matching inputs at the same revision. Force one widget's SQL to fail and verify the others remain usable.

### Chart library and motion

The frontend package manifest, lockfile, and installed direct dependencies show no charting package. Gamification Insights uses an in-repo SVG chart and a table fallback. **Recommend Recharts** for Analytics line charts and histograms, imported inside the client-side Analytics route. Its SVG primitives support the current tokens, keyboard interactions, custom labels, and configurable animation. Keep the mastery heatmap as a semantic HTML table with interactive cells and a compact phone topic view. Use current CSS for surrounding transitions, and evaluate shipped size and keyboard behavior before adopting the dependency. Approval is required before adding Recharts. [Existing chart](../frontend/src/components/instructor/gamification-insights.tsx) · [Recharts line chart](https://recharts.github.io/en-US/api/LineChart/) · [Recharts bar chart](https://recharts.github.io/en-US/api/BarChart/) · [Recharts animation settings](https://recharts.github.io/en-US/guide/animations/)

Each widget has a title, computed one-line takeaway, keyboard-reachable metric explanation, accessible **View as table**, CSV, and its own error boundary with retry. Preserve reserved plot and axis size for skeletons and show a direct next action when the scope is empty. Use labels, line styles or patterns alongside design token colors. Custom tooltips follow the pointer or anchor to the keyboard-focused point, and the text alternative conveys the same values. Whole-page **Last updated** reports the latest consistent revision in Asia/Manila. A locally retried widget shows its status if newer data is waiting for a scope refresh.

| Widget | First load | New filters in same course | New course | Reduced motion |
| --- | --- | --- | --- | --- |
| KPI cards | Reserve card size, stagger short fades, count up for about 500 ms. | Dim the old value and show a thin progress line. Animate from previous values after the new revision succeeds. | Abort/clear; show card skeletons. | Swap final values immediately, no count-up. |
| Submission trend | Draw 220–260 ms after axes fit in a reserved height. | Retain dimmed line and loading bar. Match day/week keys; crossfade when bucket units change. | Clear points and show chart skeleton. | Render final axes and line together. |
| Score histogram and Judge0 outcome bars | Grow bars in 180–250 ms. Keep units and bin labels visible. | Dim old bars and interpolate heights by bin or verdict key. | Clear bars and show chart skeleton. | Render final heights immediately. |
| Topic mastery matrix | Fade whole table in. Keep focusable cell positions stable. | Keep dimmed rows with loading line. Update cells by learner/topic key without reflowing stand-in values. | Clear learner rows immediately; reserve header and row sizes. | Replace cells on data arrival. |
| Activity ranks, failed cases, needs help and engagement | Short row fade for first visible page, no delays on keyboard interaction. | Keep previous results dimmed with a progress bar. Replace by stable key and preserve focus if the row survives. | Clear rows and show their list skeletons. | Instant replacement with a concise live-region update. |
| Student drawer and tabs | Slide drawer in from the right over 220 ms, with focus capture and restored trigger. Crossfade tab content around 150 ms. | Keep the active selection and reserve detail dimensions. | Close and clear details before displaying new scope. | Open/close and switch tabs instantly. |

Honor browser `prefers-reduced-motion` and the in-app reduced-motion setting. Keep table content and explanatory controls interactive during visual transitions, while export and drill-down actions use the last verified filter context or wait for the new data. Screen readers hear the final KPI result once. On a failed same-course refresh, identify the timestamp and filters of the data still visible alongside Retry. On a failed course change, show the new course's error state and no previous course data.

## Other instructor API contracts

These are the proposed course-aware contracts, plus preserved shared/legacy entry points where they are needed by the sitemap. `F` and `S` use the same prefixes as Analytics. Use Pydantic request/response models and Zod parsing at the UI boundary. Return standard error details with `code`, `message`, optional `field_errors`, and retry metadata. Every instructor route can return `401 unauthenticated`, `403 forbidden`, `404 not_found` within authorized scope, or `422 invalid_input`. The table lists additional contract-specific errors. Protected JSON and exports use private/no-store headers. Validate local UTC conversions on the server, and apply expected revisions to edits and idempotency keys to creation, scheduling jobs, publication, and grade changes where retry could duplicate work.

Permission labels used below are **Staff** for an active instructor assigned to the target course (every co-instructor has the same rights) and **Self** for the authenticated profile. For multiple target courses, verify the grant on every course before any mutation. Course records, staffing, and enrollment are admin operations and do not appear here.

| Method and path | Request → response | Permission and additional errors |
| --- | --- | --- |
| `GET F/courses` | Cursor/search → assigned course summaries, roster counts and last/default selection. | Staff. Preserve existing response compatibility for current callers. |
| `GET S` | Path scope → course detail, the caller's capabilities, co-instructors and safe teaching settings. | Staff. |
| `GET S/roster` | Search, sort, state, cursor → the admin-managed enrolled students. | Staff. Read-only; fields limited to what roster review needs. |
| `GET S/dashboard` | Optional date context → prioritized action queue counts, deadlines, recent scoped events, and route links. | Staff. Read the relevant shared metric facts. |
| `GET S/search` | Query, entity kind, cursor → authorized learners, lessons, activities and materials. | Staff. Bound page size. |
| `GET S/topics`, `POST S/topics` | Search/cursor or scoped validated topic label → available tags or created tag. | Staff for reads and eligible course staff for course taxonomy changes. `409 topic_exists`. |
| `GET S/materials`, `POST S/materials` | Search/status/cursor or multipart PDF + metadata → page or queued processing job. | Staff. `413 file_too_large`, `415 unsupported_file`, `429 rate_limited`, `503 storage_unavailable`. |
| `GET S/materials/{document_id}`, `PATCH S/materials/{document_id}` | Resource ID or metadata + revision → version history and job state or saved revision. | Staff. Same course/library scope. `409 version_conflict`. |
| `GET S/materials/{document_id}/download` | Scoped document ID → expiring download link. | Staff with material access. `503 storage_unavailable`. |
| `POST S/materials/{document_id}/versions` | Replacement multipart PDF and revision → queued new version. | Staff. Same upload errors and `409 version_conflict`. |
| `POST S/materials/{document_id}/retry`, `/archive`, `/restore` | Revision, explicit lifecycle action → updated status or processing job. | Staff. `409 invalid_state` or `version_conflict`, `503 processing_unavailable`. |
| `GET S/modules`, `POST S/modules`, `PATCH S/modules/{module_id}` | Search/page or title, position and revision → ordered module list or saved module. | Staff. `409 version_conflict`. |
| `POST S/modules/reorder`, `POST S/modules/{module_id}/lessons/reorder` | Ordered IDs and expected collection revision → updated order. | Staff. `409 version_conflict`; verify ID set and scope. |
| `GET S/lessons`, `POST S/lessons` | Module/status/page or draft fields and topic IDs → list or draft editor model. | Staff. |
| `GET S/lessons/{lesson_id}`, `PATCH S/lessons/{lesson_id}` | Version or draft edits/revision → lesson plus preview metadata. | Staff. `409 version_conflict` or `published_revision_locked`. |
| `POST S/lessons/{lesson_id}/publish`, `/unpublish`, `/archive` | Expected revision, course IDs and confirmation where applicable → lifecycle and visible assignments. | Staff in every target course. `409 invalid_state`, `version_conflict`, or `history_locked`. |
| `GET S/activities`, `POST S/activities` | Search/status/type/page or editor fields, language variants, topics and grading cases → page or private draft. | Staff. `409 invalid_version` on conflicting clone. |
| `GET S/activities/{activity_id}`, `PATCH S/activities/{activity_id}` | Resource or expected revision and authoring fields → editor detail and updated verification state. | Staff with source authority. `409 grading_locked` or `version_conflict`. |
| `POST S/activities/{activity_id}/verify` | Saved content revision and runtime → Judge0 verification job. | Staff. `409 version_conflict`, `429 rate_limited`, `503 judge_unavailable`. A result pins the exact grading snapshot. |
| `GET S/jobs/{job_id}` | Scoped ID → queued, processing, ready, partial or failed with sanitized diagnostics. | Staff in job scope. Applies to material, generation, and verification jobs. |
| `GET S/activities/{activity_id}/preview` | Optional assignment target → exact student-safe preview. | Staff. Preview redacts answer keys and hidden tests. |
| `GET/PUT S/activities/{activity_id}/hints` | Activity ID, or revised ordered hint content and expected version → existing hint model. | Staff with authoring authority. `409 version_conflict` or `grading_locked`. Reuse the current instructor hint workflow with explicit course scope. |
| `POST S/activities/{activity_id}/publish` | Verified/reviewed revision, assignment targets and preview confirmation → published assignments and state. | Staff in origin and every target course. `409 validation_required`, `version_conflict` or `already_published`. |
| `POST S/activities/{activity_id}/duplicate`, `/versions` | Target course IDs, title or expected source version → new unpublished draft. | Staff in source and target scopes. `409 version_conflict`. Independent duplicate and same-family version have different reward identities. |
| `PATCH S/assignments/{assignment_id}/schedule` | UTC open, due and close instants, late policy and expected revision → assignment availability/revision. | Staff. `409 version_conflict`, `grading_locked` or `solution_exposed`. |
| `PUT S/assignments/{assignment_id}/extensions/{student_id}`, `DELETE S/assignments/{assignment_id}/extensions/{student_id}` | Effective UTC due time, reason and expected revision or removal revision → updated extension or `204`. | Staff. `409 version_conflict` or `policy_conflict`. |
| `POST S/assignments/{assignment_id}/archive` | Revision + confirmation → archived assignment and retained historical grades. | Staff. `409 version_conflict` or `invalid_state`. |
| `POST S/generation-jobs` | Material version IDs, activity kind, topic, generation settings and idempotency key → job ID. | Staff with each material grant. `409 material_not_ready`, `429 rate_limited`, `502 invalid_provider_output`, `503 generation_unavailable`, `504 provider_timeout`. Retain validated partial results and draft edits. |
| `GET S/drafts`, `GET S/drafts/{draft_id}`, `PATCH S/drafts/{draft_id}` | Search/review state/page, optional draft ID, or saved revision + item changes → draft list, editable draft and item citations, or saved revision. | Staff in origin course. `409 version_conflict` or `grading_locked`. |
| `POST S/drafts/{draft_id}/items/{item_id}/regenerate` | Selected item/sources, draft revision → job and provisional replacement; accept through PATCH. | Staff. Same generation errors, plus `409 version_conflict`. |
| `POST S/drafts/{draft_id}/reject`, `/approve` | Reason or validated content revision, preview and course assignments → reviewed state and audit entry. | Staff in origin and target scopes. `409 version_conflict` or `validation_required`. |
| `GET S/submissions`, `GET S/submissions/{submission_id}` | Filters for activity, student, status, late flag, score range and cursor, or receipt/attempt drill-down → summary page or code/answers, original and final grades, cases, runtime, memory, and related attempts. | Staff. Source lookup must match the original course assignment and enrollment. |
| `POST S/submissions/{submission_id}/feedback` | Written feedback, expected revision, visibility → feedback event and updated revision. | Staff. `409 version_conflict`. |
| `POST S/submissions/{submission_id}/overrides`, `/overrides/revoke` | Effective score or override removal, required reason, expected grade revision, idempotency key → original/current/final grade, pass, XP delta and audit receipt. | Staff. `409 version_conflict` or `not_graded`. |
| `POST S/submissions/{submission_id}/reruns`, `GET S/submissions/{submission_id}/reruns/{run_id}` | Expected original revision or scoped job ID → queue status or candidate result, excluding effect on official score. | Staff. `409 run_in_progress` or `unsupported_submission`, `429 rate_limited`, `503 judge_unavailable`. |
| `POST S/submissions/{submission_id}/reruns/{run_id}/confirm` | Expected grade revision, reason, optional explicit override treatment and idempotency key → confirmed official result, audit and XP receipt. | Staff. `409 version_conflict`, `rerun_not_ready` or `snapshot_changed`. |
| `GET S/gradebook`, `GET S/reports/progress` | Filters/cursor and optional `format=csv` plus data revision → gradebook page, student progress summary, or streamed CSV. | Staff. `409 snapshot_changed`, `413 export_too_large`. Print mode uses the same filtered dataset and print CSS. |
| `GET S/gamification-insights`, `GET S/gamification-settings`, `PATCH S/gamification-settings` | Date filters or settings revision + XP, badge and leaderboard choices → aggregate data, settings or saved revision. | Staff. `409 version_conflict`, `422 invalid_reward_setting`. Apply leaderboard visibility at the student-safe boundary. |
| `GET S/announcements`, `POST S/announcements`, `PATCH S/announcements/{announcement_id}` | List filters or plain text, pin, publish and expiry times, expected update timestamp for edit → scoped feed or saved row. | Staff. `409 announcement_limit` or `version_conflict`. |
| `POST S/announcements/{announcement_id}/archive` | Expected timestamp and confirmation → archived announcement. | Staff. `409 version_conflict` or `invalid_state`. Preserve the existing course-level announcement contract during compatibility rollout. |
| `GET F/notifications`, `PATCH F/notifications/{notification_id}` | Scope/read state/cursor or read state update → inbox or saved read state. | Self instructor and applicable scope. `409 version_conflict` if using an expected revision. |
| `GET F/preferences`, `PATCH F/preferences` | Preference projection or channels, rules and expected revision → instructor preferences. | Self instructor. `409 version_conflict`. |
| `GET /api/v1/profile/me`, `PATCH /api/v1/profile/me`, `POST/DELETE /api/v1/profile/me/avatar` | Current profile, editable identity fields or avatar upload/removal → updated profile. Password changes use the existing Supabase Auth flow. | Self. Existing profile/auth errors including `409 username_taken`, file size/type limits and expired recovery session. |
| `GET/POST /api/v1/exams/instructor`, `GET /api/v1/exams/instructor/catalog`, `GET /api/v1/exams/instructor/{exam_id}` | Existing list and catalog, or exam title, Manila schedule, groups and scored activity IDs → exam list, eligible items or management detail. | Existing instructor ownership or existing admin exam scope. `409 invalid_exam_state` where applicable. |
| `POST /api/v1/exams/instructor/{exam_id}/publish`, `/release`, `/retakes/{student_id}` | Existing exam action, or retake dates and duration → state change, released results or retake grant. | Existing authorized exam owner/admin and assigned learner. `409 invalid_exam_state` or grading pending. |
| `GET/POST /api/v1/workshops`, `POST /api/v1/workshops/join`, `POST /api/v1/workshops/{workshop_id}/activities` | Existing workshop list/create, join code, or activity assignment → `WorkshopView`. | Existing group owner, eligible member, or approved shared admin path according to operation. Workshops stay separate from courses (see [Courses and Workshops](#courses-and-workshops)). |
| `GET F/ml`, `GET F/ml/students/{student_id}`, `GET F/ml/evaluation`, `GET /api/v1/predict/instructor/analytics` | Existing research data contracts controlled by the instructor research feature flag. | Flag defaults OFF and gates direct access. With it enabled, require existing research authorization and assignment scope. |

Existing faculty course-level endpoints keep their course scope and gain the assignment context (`course_activity_id`) only where a record needs it. Document the new endpoint contracts and rollout in Phase 2. Student compatibility work extends the existing quest, lesson, submission, announcement, and exam entry points with explicit course assignment context where applicable. Workshop entry points stay outside course scope.

## Risks and open decisions

| Question or risk | Recommended answer |
| --- | --- |
| Who can enroll a student in a course? | Only an admin, through course membership. Courses have no join code; a code-based group is a Workshop. Give a student who is missing from a course an actionable message naming the admin. |
| Can a learner be in two courses? | Yes, where admin enrollment allows it. Each new receipt carries one `course_activity_id`, so history stays with its course and each learner counts once per course report. |
| What happens when an instructor leaves a course? | The admin ends their course membership, and the remaining co-instructors keep teaching. A course with no active instructor shows on the admin side as needing assignment. |
| How are ambiguous historical rows handled? | Preserve originals and enumerate unmatched IDs. Skip analytics where scope or evidence is uncertain. |
| What does a rerun do if an override is already active? | Keep the override as the final grade until an instructor explicitly removes it. Show both candidate automated score and current final grade before confirmation. |
| Does final-score completion replace earlier student-visible pass behavior? | Use the shared effective pass fact everywhere for course learning. Preserve existing behavior for work with no course assignment through the compatibility adapter, and carry forward already awarded XP and exam release privacy. |
| How should course leaderboards handle existing global XP and privacy? | Keep course XP earned and account-wide XP distinct. Apply course rank top-N/anonymized settings to the course view. Leave existing global leaderboard policy to the admin settings. |
| Can exams be assigned directly to a course in the first release? | Preserve current Workshop-based exam workflows. Plan direct course exam assignment as a separate migration once exam-grade scoping is verified. |
| What is available for old per-test Judge0 results? | Confirm saved telemetry fields against representative sanitized rows in Phase 2. Show historical unavailability where case IDs were never captured, and instrument stable case IDs for new work. |
| Could reporting slow down grading? | Start with bounded indexed fact queries, measure against the expected class size and concurrent grading. Add rollups only where measurements justify them. Monitor query budgets and keep widget failures local. |
| What must be true before adding a chart dependency? | Approve Recharts, then check React/Next compatibility, bundle size, keyboard fallback and reduced motion in an Analytics-only prototype. |
| How do the local and hosted security checks tie together? | Run the same role matrix and API probes on local and hosted migrated Supabase with synthetic identities. Preserve evidence and use the deployment checklist before opening real access. |
| Can an admin availability change invalidate an already opened faculty editor? | The legacy admin endpoint writes the same dates without advancing the faculty content revision. Consolidate availability mutations on the assignment revision in Phase 2, keep the existing admin request contract, and test an admin change followed by a stale instructor save. Cover the same revision protection in legacy activity and closure adapters. |

## How to test this plan

Review each main flow against the wireframes and confirm every action has a matching route and permission. Walk the course-assignment backfill with an outside instructor and an ambiguous historical attempt. Recompute the known metrics by hand and confirm report terminology, suppression, and grade overrides make sense for a faculty user. Use the hosted deployment checklist to review rollout and rollback before implementation.

## Files changed

- This design and implementation plan.
- The [deployment readiness checklist](PHASE7_DEPLOYMENT_READINESS.md) for the paired release and hosted RLS gate.

## Assumptions

**ASSUMPTION:** Existing course membership stays admin-managed, there is no section layer, Workshops stay separate, and practice Analytics excludes exam results in the first release. Phase 2 will measure exact historical coverage and present schema/API details for all additive changes. ByteQuest remains the product name and ByteBounce remains its font.

## Next step

Wait for **go** before Phase 2 database/backend work. Request a separate Recharts decision before adding the dependency in the frontend phase.

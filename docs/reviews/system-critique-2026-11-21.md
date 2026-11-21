# ByteQuest 2.0 system critique — 21 November 2026

The [later PC snapshot](../BYTEQUEST_SYSTEM_STATUS_2026-11-21.md) records the restored phone side rail and subsequent verification. The score and findings below belong to the earlier review.

This review covers the working tree on `fix/ml-pr-auc-student-disjoint-split` as it stood on 21 November 2026, including the uncommitted dockable navigation rail and the Insights overhaul. It is read-only: no code was changed. The reviewer read the source, the migrations, the 20 November status snapshot, the 17 November readiness review, the remediation checklist and the Insights decision notes. The UI was checked using the responsive QA screenshots in `output/insights-responsive/` (taken 21 November). The live app at `localhost:3000` was reachable, but the reviewer did not sign in because no test account was supplied, so role screens come from those screenshots rather than a live walkthrough. UI/UX checks follow the `ui-ux-pro-max` priority list: accessibility, touch, layout, type and colour, navigation, then charts.

## Verdict

ByteQuest is a solid engineering effort with an unusually honest product voice. Course scoping, grading integrity and exam safety all show careful, well-tested design. The main weakness is that the product grew sideways. The same jobs have two or three implementations: authoring APIs, materials pages, UI kits and instructor navigation. Those copies now disagree about labels, policy and even what students see. The next gain comes from consolidation, not new features.

## Scorecard

| Area | Score | Justification |
|---|---:|---|
| Architecture and layering | 6/10 | Services and `course_access` are well separated, but there are two parallel authoring APIs and 1,400-line route modules (`admin.py`, `rag_instructor.py`). |
| Security and authorization | 7.5/10 | Course access is enforced in one place, JWTs are verified locally, RLS denies by default and quotas exist. However, the admin publish policy differs between the two APIs. |
| Data integrity | 8.5/10 | Content versions, verification fingerprints, durable jobs, idempotent XP and the exam embargo are enforced on the server and tested. |
| Error handling | 7/10 | Faculty and admin routes return coded `{code, message}` errors. Learner, exam and Studio routes return plain strings. The client accepts both. |
| Tests | 7.5/10 | 266 backend integration tests run against real Postgres, plus 195 vitest tests. The three largest instructor and admin screens have no component tests. |
| Performance | 7/10 | The gradebook has been benchmarked (144 ms at 120×60) and Monaco and charts load lazily. Hosted latency and Web Vitals have not been measured. |
| Duplication and dead code | 4/10 | Three draft-editing flows, three materials APIs, two near-copy Materials pages, two UI kits and two instructor navigations. |
| Operability | 6.5/10 | Runbooks, the launcher and monitoring are strong for the local stack. `/readyz` checks only the database, and the hosted stack is unproven (40%). |
| Information architecture and navigation | 5/10 | One instructor page has two names. Five instructor destinations cannot be reached from phone navigation. |
| Visual consistency (UI kits) | 5/10 | Consecutive instructor screens switch between the `ic-*` and `ws-*` kits, and the exam page uses its own inline-styled palette. |
| Accessibility | 6.5/10 | Skip link, focus traps, high-contrast and legible modes, and reduced-motion support are present. The exam page's inline px and hex values get around those modes. |
| Mobile and tablet | 6/10 | No horizontal overflow was observed. However, the side rail takes about 18% of a 375 px screen, and Insights screenshots captured skeletons. |
| Student UX | 7/10 | Run sample and Submit are clearly separated and the copy is honest. The Arena hides the visible samples the instructor preview shows. |
| Instructor UX | 6/10 | Powerful, but drafts can be edited in three places and the ML page is mostly methodology text while forecasting is off. |
| Admin UX | 6.5/10 | A clear operations overview with honest counts. The phone header packs sub-navigation into plain text links. |
| Copy and microcopy | 7.5/10 | Plain, specific and honest about unavailable features. Minor issues: the "Notifications" label and the double space in the back link. |
| **Overall** | **6.5/10** | Trustworthy core and good safety engineering, held back by duplicated surfaces that now contradict each other. |

## Findings by severity

Severity meanings: **High** means fix before the hosted pilot. **Medium** means it causes real friction or a maintenance trap. **Low** means polish.

### High

**H1. The instructor's Student preview shows sample cases that real students never see.**
Evidence: `backend/app/services/workspace_common.py:165-174` adds `sample_cases` to the preview payload, and `frontend/src/components/workspace/student-preview.tsx:51` renders them. The student quest payload contains no test cases: `is_hidden` is never read in `backend/app/api/quests_gamification.py`. The Arena shows samples only when the instructor typed "Example input:/output:" lines into the prose (`frontend/src/lib/problem-statement.ts:6`, `frontend/src/components/arena.tsx:655`). The 21 November QA screenshot `desktop-arena.png` shows "Read one whole number and print twice its value." with no sample.
Why it matters: publication now requires a visible sample (`activity_publishing.py:43`), yet learners can only find it by spending a Run. The preview tells the instructor the opposite. This also explains the status doc's open "Do this given activity" finding.
Smallest fix: return the non-hidden cases' `stdin` and `expected_stdout` in the student quest detail (reuse the `workspace_common` comprehension) and render them with the preview's sample block. Then delete the regex parser, or keep it only as a fallback. Add one API test asserting that hidden cases never appear.

**H2. A draft can be edited, verified and published through three separate flows and two APIs.** *(duplicate)*
Evidence:
- Studio: `frontend/src/components/instructor-studio.tsx:212-308` calls `/api/v1/instructor/activities/{id}`, `/verify`, `/review`, `/quiz` and `/publish` (`backend/app/api/rag_instructor.py:646-866, 1365`).
- Activity editor: `frontend/src/lib/workspace.ts` calls `/api/v1/faculty/activities/{id}`, `/verify` and `/publish` (`backend/app/api/faculty/activities.py:233-512`).
- Review drafts: `/api/v1/faculty/drafts/{id}/approve` (`faculty/drafts.py:289`), with its 978-line page `instructor/review/[id]/page.tsx`.

Both verify routes re-implement the fingerprint guard (`rag_instructor.py:754-802` and `faculty/activities.py:326-395`), and their error formats differ (62 plain-string `detail`s in `rag_instructor.py`, coded errors in `faculty/`).
Why it matters: every rule change (the visible-sample rule, the stale verification fix) has to land in two places. Instructors also meet two different review vocabularies.
Smallest fix: keep Studio only for *generation* (`/documents/{id}/generate-*`). After a draft is generated, send the instructor to the existing Review drafts / activity editor page, then delete Studio's edit, verify, review and publish UI and the matching `rag_instructor` routes. That removes about 700 backend lines and half of `instructor-studio.tsx`.

**H3. Admins are blocked from the faculty API but can publish any course's activity through the Studio API.**
Evidence: faculty routes pass `allow_admin=False` everywhere (`faculty/common.py:165`, `activities.py:43,113`), and `require_course_instructor` says "Academic review is limited to assigned faculty" (`services/course_access.py:102-113`). Studio publish uses `require_instructor`, which accepts admins (`core/security.py:188-197`). Its `may_manage_instructional_content` check reduces to `has_course_role`, which returns `True` for any admin (`course_access.py:71-73`). Studio is exposed to admins at `/admin/teaching/studio`. No test covers either outcome.
Why it matters: a written policy that is enforced on one path and not the other is an authorization defect in either direction.
Smallest fix: decide the policy. If academic review belongs to faculty, call `require_course_instructor` in the Studio publish and review routes and add a negative test. H2's consolidation removes the second path entirely.

**H4. Instructor navigation has two different menus with different names, and phones lose five destinations.** *(duplicate)*
Evidence: the desktop sidebar has 10 items (Dashboard, Activities, Review drafts, Materials, Exams, Announcements, Progress, Gradebook, Gamification, Model evaluation; `components/instructor/course-navigation-links.tsx:6-18`). The phone rail renders `primaryNavigation.instructor` with 5 items under different names: Courses, Builder, Progress, Insights, Exams (`lib/navigation.ts:15-17`, `course-shell.tsx:66-67`). So `/instructor` is called "Dashboard", "My Courses" and "Courses", and `/instructor/activities` is called "Activities", "Builder" and "Quest & Workshop Builder". The rail's "Insights" opens Gamification only. Review drafts, Materials, Announcements, Gradebook and Model evaluation have no phone navigation entry. The phone rail also marks the current item by exact path (`pathname === href`, line 67), so nothing is highlighted on `/instructor/activities/123`.
Why it matters: instructors switching between a laptop and a phone cannot build a mental model, and some workflows (reviewing drafts, announcements) are only reachable on a phone through in-page links.
Smallest fix: make `course-navigation-links.tsx` the one source. On phones, show its groups in a "More" sheet or the dockable drawer, use `isCurrent` for the active state, and remove `primaryNavigation.instructor`'s separate labels.

### Medium

**M1. Two UI kits split the instructor workspace screen by screen.** *(duplicate)*
Evidence: `components/instructor/course-ui.tsx` (`PageHeader`, `StatStrip`, `StatusBadge`, `InlineEmpty`, `InlineError`, `StatSkeleton`) is used by the Dashboard, Activities list, Performance, Gamification and ML pages. `components/workspace/ui.tsx` provides the matching `PageHeading`, `StatCard`, `StatusChip`, `EmptyState`, `Notice` and `LoadingPanel`, used by the Activity editor, Materials, Review and every admin page. Going from Activities (list) to an activity (editor) changes the header, buttons, status chips and error pattern.
Why it matters: the product feels like two apps, and each fix to a shared pattern lands twice.
Smallest fix: pick `course-ui`'s visual language (it is the newer, tested one), add the two missing pieces (`ConfirmDialog`, `SearchField`) as re-exports, and migrate the four `ws-*` instructor pages first. Admin can follow. The Insights notes already list this follow-up (decision 5).

**M2. Admin and instructor Materials pages are near-copies, and a third materials API is effectively unused.** *(duplicate, dead code)*
Evidence: `admin/materials/page.tsx` (432 lines) shares 255 identical lines with `instructor/materials/page.tsx` (603 lines). The backend has `/faculty/materials`, `/admin/materials` and Studio's `/instructor/documents` upload, PATCH, versions, download, archive, restore and reprocess routes (`rag_instructor.py:869-1125`). The UI calls none of the Studio document routes; only `test_learning_flow_integration.py` uploads through them.
Smallest fix: extract one `MaterialsManager` component with a `scope` prop. Delete the seven unused Studio document routes and point the test fixture at `/faculty/materials`.

**M3. The exam page bypasses the accessibility settings.**
Evidence: `app/(workspace)/exams/[id]/page.tsx` has 55 `style={{…}}` blocks and 66 hard-coded hex colours (for example lines 240-283: `#162322`, `#4a5d58`, `fontSize: "14px"`). High-contrast mode only swaps tokens and border colours (`globals.css:1198-1215`), and Large text scales the root `font-size`, which fixed `px` values ignore.
Why it matters: the timed exam is the most stressful screen, and it is where a student who turned on Large text or High contrast loses both.
Smallest fix: move those styles into `globals.css` classes that use existing tokens and `rem`. Add the exam page to the contrast pass in `qa-responsive.mjs`, which already toggles `bytequest:a11y-contrast`.

**M4. On phones, the side rail takes about 18% of the width.**
Evidence: in `admin-admin.png` and `instructor-ml.png` (375 px), a roughly 68 px left rail permanently narrows content, and "Teaching" sits at the rail's bottom edge. The admin phone header shows "Configuration Monitoring" as two plain text links above the page eyebrow.
Why it matters: the `ui-ux-pro-max` layout and navigation rules call for a bottom bar of five or fewer items on phones, so content keeps the full width and targets stay in thumb reach.
Smallest fix: below 600 px, render the dockable rail as a bottom bar (five items plus "More"), and keep left/right docking for tablet and desktop. Move the admin sub-links into the "More" sheet.

**M5. The Model evaluation page is a thesis appendix inside an instructor's daily navigation.**
Evidence: `instructor-ml.png` shows "Forecast scoring is turned off", "No saved predictions", "No approved model report", then Methodology (split, preprocessing). The page sits in the instructor's primary nav (`course-navigation-links.tsx:16-17`).
Why it matters: instructors get no action from it while forecasting is off, and it competes with Gradebook for attention.
Smallest fix: hide the nav entry while forecasting is off and no approved report exists (the API already knows both). Keep the route for the research committee.

**M6. Error contracts are inconsistent across routers.**
Evidence: `rag_instructor.py` (62), `exams.py` (36), `pilot.py` (23) and others raise `HTTPException(..., detail="…")`, while `admin.py` and `faculty/*` raise coded dicts. `frontend/src/lib/api.ts:80-98` handles both, so `ApiError.code` is undefined on learner and exam errors.
Why it matters: the UI cannot branch on a code such as `exam_closed` without string matching.
Smallest fix: add codes to learner and exam errors when they are next edited. H2's deletion removes the largest offender.

**M7. The largest instructor and admin screens have no component tests.**
Evidence: no test file sits next to `instructor/review/[id]/page.tsx` (978 lines), `components/instructor-studio.tsx` (433), `admin/accounts/page.tsx` (482) or `instructor/materials/page.tsx` (603). The publication-sample rule is covered separately in `components/workspace/publication-sample.test.tsx`.
Smallest fix: after H2 and M2 shrink these screens, add one happy-path and one error-path test each for Review drafts and the shared Materials manager.

### Low

**L1. `/readyz` checks only the database** (`backend/app/main.py:156-161`). Admin Monitoring already separates the worker and Judge0. For the hosted uptime check, either expose a combined `/readyz?deep=1` that includes worker heartbeat age, or point the external monitor at the monitoring summary.

**L2. Students see a locked feature first on Progress.** `profile/page.tsx:650` puts the Debugger's Codex first, and for new students it reads "Unlocks on day 21". Move the locked card below the activity stats, or collapse it to one line.

**L3. Two stat cards sit in a four-column grid** (`desktop-student-profile-normal.png`), leaving half the row empty. Use `auto-fit` so cards fill the row.

**L4. `StatStrip` hard-codes `aria-label="Course statistics"`** (`course-ui.tsx:50`) on the Gamification and ML pages too. Accept a `label` prop.

**L5. The bell is labelled "Notifications" but opens Recent activity** (`course-shell.tsx:60`). Rename the label to "Recent course activity" to match its tooltip, since the inbox is out of scope.

**L6. The Arena back link reads "Back to  Quest Map"** with a double space (`app-shell.tsx:163`, where a trailing space in `bq-back-prefix` meets the label).

**L7. QA screenshots captured skeletons** (`instructor-instructor.png`). `qa-responsive.mjs` should wait for the absence of `[role=status][aria-label^="Loading"]` before capturing, or the screenshots prove nothing about loaded layout.

## What is working well (keep)

- **A single authorization chokepoint.** Every faculty read and write resolves through `services/course_access.py`, and the codes are specific (`course_forbidden`, `no_course_assignment`).
- **Integrity under concurrency.** Verification is tied to a fingerprint and a content version, a `with_for_update` re-check runs after Judge0 returns (`faculty/activities.py:362-371`), grading jobs are durable, and XP is idempotent. All 10 of the 17 November defects are closed, with regression tests.
- **RLS that denies by default.** RLS is enabled with no policies, the frontend never calls `supabase.from()`, and private data lives in `bytequest_private`.
- **Honest copy.** Unavailable features say why ("Forecast scoring is turned off. Historical results remain available."). Practice and Official are explained beside their buttons.
- **Accessibility groundwork.** Skip link, modal focus trap in `ConfirmDialog`, high-contrast, large and legible modes, many reduced-motion blocks and a `forced-colors` block.

## Top 5 things to do next

1. **Show visible samples in the Arena (H1).** This is a one-endpoint, one-component change that fixes the biggest learner-facing gap and makes the preview truthful.
2. **Collapse authoring to one path (H2, H3, M2).** Keep Studio for generation only, delete its edit, verify, publish and document routes, and decide and test the admin publish policy. This is the biggest cut in code and in confusion.
3. **One instructor navigation (H4).** Use `course-navigation-links` everywhere, with a phone "More" sheet and prefix-based active state.
4. **Unify the instructor UI kit (M1), starting with the four `ws-*` instructor pages,** and fix the exam page's inline styles at the same time (M3).
5. **Phone layout pass (M4, L7).** Bottom bar below 600 px, wait for loaded content in the QA script, then re-run `qa-responsive.mjs` at 375 px with contrast on and off.

## Not verified in this review

- There was no live signed-in walkthrough, because no credentials were available to this session. The role screens come from the 21 November QA screenshots.
- No tests were run. Counts come from the task brief (backend 266, vitest 195).
- RLS was checked by reading the migrations, not by querying the live database.
- Hosted deployment, load and Web Vitals are out of scope, as the status doc already records.

## Implementation status (21 November 2026, same day)

The top 5 were implemented in the working tree. Nothing is committed. Backend 266 tests, vitest 196, TypeScript and ESLint pass, with one existing `exhaustive-deps` warning carried over from the original Materials page. The running local app is a production build, so these changes were not checked in a browser.

- **H1, Arena samples.** `GET /quests?details_for=` now returns `sample_cases` (visible cases only), and the Arena shows them. Examples typed into the statement are used only as a fallback.
- **H2, H3 and M2, one authoring path.** The decision was faculty only. Studio now only generates drafts (`/instructor/workspace` and `/instructor/documents/{id}/generate-*`, instructors only) and links each draft to Review drafts. Its edit, verify, review, publish and document routes were deleted. Judge0 verification now lives in a single service, `services/challenge_verification.verify_saved_challenge`, used by the faculty route and the seed scripts. The admin Authoring Studio page is gone. Hint editing moved to the activity editor and is scoped to the course. The admin and instructor Materials pages now share `components/materials-manager.tsx`. As a side effect, admins can choose the language track when uploading, which was previously always Python.
- **H4, one instructor navigation.** `lib/navigation.ts` (`instructorNavigation`) is the only definition. Phones show Dashboard, Activities, Progress and Exams, plus a More sheet with every page. The active tab now also matches sub-pages.
- **M1 and M3, UI kit and exam page.** The activity editor, Review drafts and draft pages use `PageHeader`. Each `StatStrip` takes its own label. The exam page has no hex colours and no px font sizes left.
- **M4 and L7, phones.** At 600 px and narrower the dock is a bottom tab bar and cannot be dragged. `qa-responsive.mjs` waits for skeletons to clear and checks the phone bottom bar.

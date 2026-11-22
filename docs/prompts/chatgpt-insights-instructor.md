# ByteQuest Insights, part 3 of 4: instructors

Prompt for ChatGPT. Work in `C:\Users\User\Documents\ByteQuest_2.0` on the current branch. Run this after `docs/prompts/chatgpt-insights-foundation.md` is done and verified. Read `CLAUDE.md`, check the working tree for existing changes, and read each file named below before editing it. Run `graphify query "<question>"` before you grep, and `graphify update .` after code changes. Keep the work local for review: do not commit, push or create branches.

Preserve every existing feature and behaviour unless this plan changes it on purpose. Extend the current components, CSS tokens and tests. Do not add dependencies. This part needs no migration. Never run `supabase db reset`. Frontend paths are under `frontend/src/` unless they start with `backend/`, `docs/` or `frontend/scripts/`.

## Goal

An instructor finds every class insight under **Insights** and every learner in **Student Progress**. Each figure has one name, and each view points to the next teaching action. Insight pages share one UI kit, `course-ui`.

## Already in place: extend, do not rebuild

| Feature | Where |
|---|---|
| My Courses stat strip, Needs your attention, Students to check, Coming up | `app/(workspace)/instructor/page.tsx`, `GET /faculty/dashboard` (`backend/app/api/faculty/overview.py`), `class_snapshot` in `backend/app/services/workspace_queries.py` |
| Student Progress roster, learner history drawer with submitted code, filters for activity, `stuck` and `notStarted` | `app/(workspace)/instructor/performance/page.tsx`, `GET /faculty/performance`, `GET /faculty/performance/students/{id}` (`backend/app/api/faculty/performance.py`) |
| Gradebook: attempted and passed per activity, `stuck` per cell, CSV, practice attempts only | `components/instructor/gradebook.tsx`, `GET /faculty/gradebook`, `STUCK_ATTEMPTS` (`performance.py`, line 211) |
| Activity Analysis | `components/instructor/activity-analysis.tsx`, `GET /faculty/activities/{id}/analysis` |
| Gamification Insights, already on `course-ui` | `app/(workspace)/instructor/gamification/page.tsx`, `components/instructor/gamification-insights.tsx` |
| Forecasts, the learner drawer with forecast and history, the class score trend with periods, Model evaluation | `app/(workspace)/instructor/ml/` (`page.tsx`, `insights.tsx`, `evaluation.tsx`, `types.ts`), `backend/app/api/faculty_ml.py` |
| Exam results and retakes, shared with `/admin/teaching/exams` | `components/instructor-exams.tsx`, `GET /exams/instructor/{exam_id}` (`backend/app/api/exams.py`, line 253), `ExamItem`, `ExamAttempt`, `ActivityAttempt.exam_attempt_id` |
| The `course-ui` kit | `components/instructor/course-ui.tsx` (`PageHeader`, `StatStrip`, `Section`, `InlineError`, `InlineEmpty`, `RowSkeleton`, `StatSkeleton`) |
| The Insights navigation group | `components/instructor/course-navigation-links.tsx` (lines 16–17), `lib/navigation.ts` (lines 16 and 97) |
| Scope and authorization | `enrolled_students`, `published_activity_ids`, `practice_attempt_clause`, `resolve_workspace_course(..., allow_admin=False)`, `faculty_user` |
| From the foundation: the line chart, `MeterList`, `NotEnoughData`, `MeasureDefinitions`, `UpdatedAt`, the labels map; the Sequencer panel removed | `components/insights/`, `lib/insight-metrics.ts` |

## One kit: course-ui

- Move Model evaluation, Activity Analysis and the Student Progress summary to `course-ui`:
  - `PageHeader` with a Refresh button styled like Gamification Insights
  - `StatStrip`
  - `Section`
  - `InlineError` with Retry
  - `InlineEmpty`
  - the skeletons
- Keep tables in `.ws-table-wrap` and drawers in `ConfirmDialog`.
- Use the foundation widgets for meters, charts, definitions and "Updated …".
- Do not move other instructor pages in this part.

## Renamed figures

Change labels only. Keep the API field names.

- **My Courses** and **Student Progress:**
  - "Average mastery" becomes **Activities passed**, with the note "avg of N published activities".
  - "Need follow-up" becomes **Not started**.
- **Student Progress:**
  - "Average latest score" becomes **Latest activity average**, with the activity's title. Return the title from the performance summary beside `average_score`.
  - The roster column "Mastered" becomes **Activities passed**.
- **Machine Learning:** remove the "Average recorded score" card. The class score trend shows the same history.
- Use `lib/insight-metrics.ts` for every label and definition.

## Student Progress: the only roster and learner drawer

Today two rosters and two learner drawers exist, one here and one on Machine Learning → Learner insights. Merge them here.

- **Class trend:** the class score trend and its period filter (7 days, 30 days, 90 days, all time) go at the top.
  - Draw it with the foundation line chart: three series (quiz, coding challenge, released exam) on `--chart-series`, `--chart-series-2` and `--chart-series-3`, each with its own dash.
  - Read it from `GET /faculty/ml?course_id&period`.
  - The period changes the reported history only, as it does today.
- **Outlook:** while `readiness.forecasts_available` is true, the roster gains an **Outlook** column and an Outlook filter.
  - Filter options with their counts: May need support, Continue practicing, Likely to pass, Unavailable. These replace the "Available forecasts" and "May need support" cards.
  - Join the forecast to the roster rows by `student_id`, from the same `GET /faculty/ml` response.
  - When forecasts are unavailable, show one muted line with the reason (`READINESS_MESSAGES`) and a link to Model evaluation, and no column.
- **Learner drawer:** one drawer, in this order:
  1. Activities passed (x of y), level and XP
  2. personal score trend
  3. attempts with submitted code, plus released exam results
  4. **Forecast**: `ForecastDetails`, the teaching action, saved forecasts, and `FORECAST_REASONS` when none is available
  - It reads `GET /faculty/performance/students/{id}` and `GET /faculty/ml/students/{id}?period=`.
  - Guard against a stale response as `insights.tsx` does with `detailRequest`.
  - Keep the consent and readiness rules exactly as they are.
- **Moving the ML code:**
  - Move `ForecastDetails`, `SavedForecastItem`, `outlookOf` and `forecastTone` from `instructor/ml/insights.tsx`.
  - Replace its hand-drawn `Trend` with the line chart, then delete `insights.tsx`.
  - Keep `types.ts`.
  - Remove the footnote "Open Machine Learning for forecasts".
- **Links:** keep the existing filter URLs (`activity`, `stuck`, `notStarted`), because My Courses and Activity Analysis link to them.

## Model evaluation

- `/instructor/ml` becomes one page with no tabs, titled **Model evaluation**. It has:
  - the forecast status notice
  - "Observed outcomes in this course"
  - the approved training report
- If `GET /faculty/ml/evaluation` does not return the readiness status, add the existing readiness object to its response instead of calling `/faculty/ml` from this page.
- Old links keep working:
  - `?tab=insights` goes to `/instructor/performance`, keeping the course.
  - `?tab=evaluation` opens this page.
- In the Insights group, rename "Machine learning" to **Model evaluation**, and change the `ml` label in `lib/navigation.ts`. Keep the route and the `/faculty/ml` redirect.
- Replace the ROC and precision-recall `CurveChart` with the line chart: two models plus a dashed reference line, and no hex values. Confusion matrices stay as tables.

## Activity health in the Activities list

Today each published row on `/instructor/activities` only links to Analysis.

- **Backend:**
  - Move the Gradebook's grouped query (learner × activity: attempts, best score, passed) into a helper beside `class_snapshot`.
  - Use it for `GET /faculty/gradebook` and for a `health` object on each published item in `GET /faculty/activities`. The object holds attempted, passed, stuck, not started and pass rate.
  - Practice attempts only, as the Gradebook does.
  - One grouped query per request, not one per activity.
- **Rows:** each published row shows, as text, "12 of 20 passed · 3 stuck · 5 not started". Add a "Needs attention" `StatusChip` when stuck is 1 or more.
  - The stuck count links to `/instructor/performance?activity=<id>&stuck=1`.
  - The Analysis button stays the primary action.
- **Sort:** add a "Needs attention first" sort to the existing filters: stuck descending, then pass rate ascending, then title.
- The Gradebook, Activity Analysis and the list must show the same attempted, passed and stuck for an activity.

## Inactive 7+ days

Today only **Not started** exists.

- **Definition:** started (at least one practice attempt on a published activity) and not active in the same 7-day window that `active_7d` uses. Then Active (7 days) + Inactive 7+ days + Not started = Enrolled. Assert that.
- **Backend:**
  - Add `inactive_7d` to `class_snapshot`.
  - Add an `inactive=1` filter to `GET /faculty/performance`, beside `stuck` and `notStarted`, so the list and the count agree.
- **Student Progress:** add the "Inactive 7+ days" filter.
- **My Courses, Students to check:** add the row "N inactive for 7+ days", linking to `/instructor/performance?inactive=1#instructor-roster`, beside the existing "haven't started" row.

## Exam class summary

Today "Results and retakes" lists each learner's results only.

- **Backend:** extend `GET /exams/instructor/{exam_id}` with a `summary` once at least one result is released. Per learner, use the latest graded attempt with released results, so retakes count once.
  - submitted (of assigned learners)
  - average score as a percentage of the maximum
  - score bands in the five ranges Activity Analysis uses
  - for each exam item, learners who passed of learners who attempted
- **Per-item results:** before you promise them, check that they come from `ActivityAttempt` rows linked through `exam_attempt_id`. If they are not stored per item, show only the totals and bands, and say so in your report. Do not add storage.
- Show the summary above the learner list with `MeterList`. Hidden test inputs and expected outputs never appear.
- The component is shared with `/admin/teaching/exams`, so the summary shows there too. The route already allows admins.

## Handheld rules

Follow `docs/prompts/chatgpt-handheld-layout.md`:

- One breakpoint scale. Use its shared breakpoint module if it exists; otherwise add no new width.
- 44×44px touch targets on coarse pointers.
- Hover-only styling inside `@media (hover: hover)`.
- Design tokens only.

At 375px:
- the roster scrolls inside `.ws-table-wrap`
- the learner drawer fills the screen below 850px
- the health text in Activities wraps without widening the page

Tablets from 768 to 1366px show the full layout.

## Verification and rollout

- Run these before and after, and report the real numbers:

  ```
  cd backend && .venv/Scripts/python -m pytest -q -p no:cacheprovider
  cd frontend && npx tsc --noEmit
  cd frontend && npx eslint src
  cd frontend && npx vitest run
  ```

- Backend tests:
  - The Gradebook, the activity list `health` and Activity Analysis agree for the same attempts.
  - The Active + Inactive + Not started invariant holds.
  - The exam summary, with a retake, an unreleased attempt and an empty exam.
  - Scope: another course's instructor gets 403 or 404, a student 403, and an admin 403 on `/faculty` routes. The exam route still allows admins.
- Frontend tests:
  - Update `instructor/ml/page.test.tsx` and `evaluation.test.tsx` for the single page.
  - The Outlook column is hidden when forecasts are unavailable, and the filter counts are right.
  - The drawer's Forecast section.
  - Activity health text and sort.
  - The renamed labels.
  - The navigation label.
- Extend `backend/tests/qa_live_multi_role.py`:
  - each activity's `health` equals the Gradebook column
  - `inactive_7d` meets the invariant
  - the exam summary matches the attempts it loads

  Run it with `--students 12`.
- Extend `frontend/scripts/qa-responsive.mjs` with:
  - Student Progress, with the drawer open
  - Model evaluation
  - Activities
  - exam results
- Report what changed, test counts, whether per-item exam results were possible, and anything you could not verify.

## Out of scope

- Chat Assistant topic analytics
- Test-case analytics, course sections, on-time and late rates
- Training models, new forecasts, or changes to forecast thresholds and consent rules
- Messages or email to inactive learners
- Moving other instructor pages to `course-ui`, or merging the kits app-wide
- Student and admin work (parts 2 and 4)

Use the existing design tokens, components and dependencies, and add none.

# ByteQuest Insights, part 1 of 4: shared foundation

Prompt for ChatGPT. Work in `C:\Users\User\Documents\ByteQuest_2.0` on the current branch. Read `CLAUDE.md`, check the working tree for existing changes, and read each file named below before editing it. Run `graphify query "<question>"` before you grep, and `graphify update .` after code changes. Keep the work local for review: do not commit, push or create branches.

Preserve every existing feature and behaviour unless this plan changes it on purpose. Extend the current components, CSS tokens and tests. Do not add dependencies; Recharts is already installed. This part needs no migration. Never run `supabase db reset`. Frontend paths are under `frontend/src/` unless they start with `backend/`, `docs/` or `frontend/scripts/`.

## Goal

Every insight in ByteQuest appears in one place, uses one chart approach and one set of widgets, and names each figure after what it computes. This part builds the shared pieces and removes the duplicates that span roles. The student, instructor and admin prompts build on it.

Run the four prompts in this order, and verify each before starting the next:

1. `docs/prompts/chatgpt-insights-foundation.md` (this file)
2. `docs/prompts/chatgpt-insights-student.md`
3. `docs/prompts/chatgpt-insights-instructor.md`
4. `docs/prompts/chatgpt-insights-admin.md`

The student and admin parts do not depend on the instructor part.

## Already in place: extend, do not rebuild

| Feature | Where |
|---|---|
| Class gamification insights with a 5-learner "Not enough data yet" rule, `MeterList`, `InsufficientData` and a "How these measures are defined" panel | `components/instructor/gamification-insights.tsx`, `backend/app/services/gamification/insights.py` |
| Recharts line chart loaded with `next/dynamic`, CSS-variable colours, animation off under reduced motion | `components/instructor/engagement-chart.tsx` |
| Meter styles and chart tokens `--chart-series`, `--chart-grid`, `--chart-annotation` | `.insights-meters` and `:root` near line 4621 of `app/globals.css` |
| High contrast token overrides | `html[data-contrast="high"]` near line 1209 of `app/globals.css`; `components/accessibility-provider.tsx` |
| Activity Analysis with a rule-based reading (`analysisReading`) and its own copy of the meter markup (`AnalysisChart`) | `components/instructor/activity-analysis.tsx` |
| Model evaluation with consent and course-scope tests | `app/(workspace)/instructor/ml/evaluation.tsx`, `backend/app/api/faculty_ml.py`, `backend/tests/test_faculty_admin.py` (about lines 912–940 and 1595) |
| Profile analytics for each role, with Overview, role and Account tabs | `GET /profile/me/analytics` (`backend/app/api/profiles.py`), `app/(workspace)/profile/page.tsx`, `app/(workspace)/profile/page.test.tsx` |
| Manila date formatting | `formatManilaDateTime` in `lib/activity-date.ts`, `formatDateTime` in `lib/workspace.ts` |
| Handheld rules | `docs/prompts/chatgpt-handheld-layout.md` |

## Remove the duplicate Sequencer evaluation

The "Sequencer evaluation" panel repeats what Model evaluation already shows: the shadow status, prediction counts and accuracy on labelled predictions for both models.

- Delete `components/instructor-shadow-analytics.tsx`. Remove its import and render in `components/instructor-studio.tsx` (around line 371); it shows on `/instructor/materials/studio` and `/admin/teaching/studio`. Remove the `.shadow-analytics-*` and `.shadow-model-versions` rules from `app/globals.css` (around line 790).
- Delete `backend/app/api/ml_analytics.py` and its `include_router` in `backend/app/main.py`.
- In `backend/tests/test_faculty_admin.py`, remove the assertions on `/api/v1/predict/instructor/analytics` (about lines 647–650, 921–923 and 937–939). Before you remove each one, confirm that a matching `/faculty/ml/evaluation` assertion exists for the same case: another course's instructor refused, an admin refused, and consent revocation. Add any missing one to the evaluation tests.
- In `docs/MASTER_PLAN.md` (line 430), point SO-8 at `backend/app/api/faculty_ml.py` and `backend/app/services/ml_predictor/`.
- Leave dated verification records such as `docs/verification/phase-6-shadow-rollout-implementation-2026-10-25.md` unchanged; they record what was true then.

## Supersede the Phase 1 Analytics plan

- At the top of `## Analytics` in `docs/INSTRUCTOR_PHASE1_PLAN.md` (line 288), add one line: "Superseded by `docs/prompts/chatgpt-insights-*.md`. Sections, section-scoped analytics endpoints, on-time and late rates, test-case metrics and per-widget motion specifications are not planned." Do not edit the rest of that document.
- These rules from it apply in all four prompts:
  - Aggregates shown to someone who cannot see the individual learners say **Not enough data yet** below 5 learners.
  - Each figure has one backend definition. The client formats values and never recalculates them.
  - Each chart has a one-line takeaway, **View as table**, and its own error with **Retry**.

## Charts: two primitives

- **Over time or on two axes:** Recharts, loaded with `next/dynamic` and `ssr: false` as `engagement-chart.tsx` is. Students on phones then download it only when a chart is shown.
- **Counts and shares:** `.insights-meters`.
- Add one line-chart component in `components/insights/line-chart.tsx`, built from `engagement-chart.tsx`. Its props:
  - series: key, label, colour token and dash pattern
  - x values and their format
  - y domain
  - optional reference lines
  - an accessible label
  - a one-line summary

  Convert the engagement chart to it in this part. The instructor and student parts move the ML charts and the profile trend onto it.
- Tokens:
  - Add `--chart-series-2` and `--chart-series-3` to `:root`, taken from existing palette tokens.
  - Under `html[data-contrast="high"]`, give every chart token a value with at least 3:1 contrast against the surface for lines and 4.5:1 for text.
  - No hex values in components.
- Tell series apart by dash pattern as well as colour. Put the legend as text labels next to the chart.
- Every chart renders:
  - a skeleton that reserves its height
  - an empty state
  - an error with Retry
  - `role="img"` with the summary as its label
  - a `<details>` **View as table** with a `<caption>`

  Animation is off when `useAccessibility().preferences.reducedMotion` is set. Values never depend on a tooltip, because a tooltip cannot be relied on with touch.

## Shared insight widgets

Create `components/insights/ui.tsx` with the role-neutral pieces. Each one moves from where it lives now, so nothing is built twice:

- `MeterList`, moved from `gamification-insights.tsx`. Replace `AnalysisChart`'s copy of the meter markup in `activity-analysis.tsx` with it. Each row keeps its number as text.
- `NotEnoughData`, from `InsufficientData`, with one `SMALL_SAMPLE = 5` constant.
- `MeasureDefinitions`: the "How these measures are defined" `<details>`, reading its entries from the labels map below.
- `UpdatedAt`: "Updated …" in Manila time.

These pieces carry no page heading. Each caller wraps them in its own kit's section.

## Metric labels

Add `lib/insight-metrics.ts`. It holds one entry per figure, with a label and a one-line definition. Pages read labels from it; calculations stay in the backend. Entries:

| Key | Label | Definition |
|---|---|---|
| `activities_passed` | Activities passed | Average share of published activities each learner has passed |
| `latest_activity_average` | Latest activity average | Average of each learner's latest score on the most recently published activity |
| `not_started` | Not started | Enrolled learners with no attempt on a published activity |
| `active_7d` | Active (7 days) | Learners with a practice attempt in the last 7 days |
| `inactive_7d` | Inactive 7+ days | Learners who started but have no practice attempt in the last 7 days |
| `pass_rate` | Pass rate | Learners who passed the activity, of learners who attempted it |
| `first_try_pass_rate` | First-try pass rate | Learners whose first attempt passed, of learners who attempted |
| `median_attempts_to_pass` | Median attempts to pass | Median attempt number of each passer's first pass |
| `stuck` | Stuck | Learners with 3 or more attempts and no pass |
| `attempts_passed` | Attempts passed | Share of a student's own attempts that passed |
| `average_attempt_score` | Average attempt score | Average score across a student's own attempts |
| `self_solved` | Self-solved | Challenges passed without opening a hint |
| `tried_before_asking` | Tried before asking | Hinted challenges with a run or attempt before the first hint |
| `recall_pass_rate` | Recall pass rate | Recalls where at least two-thirds of questions were recalled |
| `consent_coverage` | Research consent | Enrolled learners with current research consent |

Reserve the word "mastery" for the student Mastery Map. Take the stuck threshold from the API (`stuck_after_attempts`) rather than writing 3.

## Profile: one role tab, each figure once

All profile changes for every role happen here, because they share `app/(workspace)/profile/page.tsx`.

- **Tabs:** keep the role tab (Progress, Teaching or Stewardship) and Account; remove Overview. `/profile` and `/profile?tab=overview` open the role tab. Keep `?tab=activity` and `?tab=account` working, because other pages link to them.
- **Student:** remove `StudentOverview`; the level ring and Recommended next already appear on the dashboard. Move the two figures unique to it to the top of Progress, renamed **Attempts passed** and **Average attempt score**.
- **Instructor:**
  - Remove `InstructorOverview` and the "Highest priority" `RecommendedAction`; My Courses already shows that work.
  - Merge the Teaching stat cards so each figure appears once: Courses, Learners taught, Activities created (with published as its hint), Drafts reviewed, Materials uploaded.
  - Remove the "Work waiting in your courses" `AttentionSummary`; it repeats "Needs your attention" on My Courses.
- **Admin:**
  - Remove `AdminOverview` and its `RecommendedAction`.
  - Keep the totals and Accounts by role once in Stewardship.
  - Remove "Operational work waiting" and "Recent platform activity"; System Overview shows both.
- **Every role** keeps its personal "Your recent work" timeline.
- Remove response fields and backend code that no screen reads any more, such as `next_action` and `attention` in `InstructorAnalytics` and `AdminAnalytics`. Grep callers and tests first. Keep `next_action` for students if anything still reads it.

## Handheld rules

Follow `docs/prompts/chatgpt-handheld-layout.md`:

- One breakpoint scale. Use its shared breakpoint module if it exists; otherwise add no new width and keep 850px as the handheld switch.
- 44×44px touch targets on coarse pointers.
- Hover-only styling inside `@media (hover: hover)`.
- Design tokens only.
- Tables stay in `.ws-table-wrap`.
- No page scrolls sideways at 320px.

## Verification and rollout

- Before changing anything, record baseline counts:

  ```
  cd backend && .venv/Scripts/python -m pytest -q -p no:cacheprovider
  cd frontend && npx tsc --noEmit
  cd frontend && npx eslint src
  cd frontend && npx vitest run
  ```

  Run them again at the end and report the real numbers.
- Add vitest coverage for:
  - the line chart: summary label, table toggle, no animation under reduced motion
  - `MeterList`
  - `MeasureDefinitions` reading the labels map
- Update `app/(workspace)/profile/page.test.tsx` for the two tabs and the redirect from `?tab=overview`. Keep the gamification and activity-analysis tests passing unchanged.
- Backend:
  - The shadow endpoint returns 404.
  - Every moved assertion passes against `/faculty/ml/evaluation`.
  - The profile analytics response for each role still passes its schema test.
- Run `frontend/scripts/qa-responsive.mjs` on `/profile` for each role, and on `/instructor/gamification`. Save screenshots with high contrast on and off.
- Report what changed, what was kept, test counts and anything you could not verify.

## Out of scope

- The student, instructor and admin changes in the other three prompts
- Merging the `course-ui` and `ws-*` kits app-wide (a separate follow-up)
- Dark mode; ByteQuest has none
- New dependencies, new tables or migrations
- Course sections
- Chat Assistant topic analytics
- Per-test-case storage

Use the existing design tokens, components and dependencies, and add none.

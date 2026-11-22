# ByteQuest UI/UX harmonization: slices 1–3 and ML slice planning

November 21, 2026

This log records the work done on 21 November 2026 under the [UI and UX harmonization plan](../BYTEQUEST_UI_UX_HARMONIZATION_PLAN.md): what changed, how it was checked, what was not checked, and what comes next.

## Checkpoint

| Commit | Time (local) | What it holds |
| --- | --- | --- |
| `5e3602b` | 17:20 | Earlier today: quest groups renamed to workshops, and the Workshop classroom plan. |
| `07df51d` | 23:07 | Local checkpoint: the in-progress work already on the branch, plus UI/UX slices 1–3 and the plan update. |

Both commits are on `fix/ml-pr-auc-student-disjoint-split` and have not been pushed. To see everything in the checkpoint, run `git show --stat 07df51d`. To compare against the start of the day, run `git diff 5e3602b 07df51d`.

## What the checkpoint contains

1. **Work already on the branch before the UI/UX session.** In outline:
   - The student-disjoint ML split: `ml_predictor` features, targets, predictor and shadow scoring, `faculty_ml.py`, and `ml_pipeline`. `ml_analytics.py`, `insights.tsx` and `instructor-shadow-analytics.tsx` were removed.
   - The Workshop classroom: workshops API, four Supabase migrations, workshop pages and components.
   - Student self-registration: a migration and `student-signup`.
   - The shared insights components (`components/insights`, `lib/insight-metrics.ts`).
   - Launcher scripts and documentation.

   The commit diff is the record for these. They are not described further here.
2. **UI/UX plan slices 1–3**, described below.
3. **Plan update.** Machine learning analytics is now slice 4, administrator slice 5, and cross-role release slice 6.

## Slice 1: shared foundation and help

| Change | What users see | Main files |
| --- | --- | --- |
| Sign-in focus | The Show password button shows a violet focus ring and is 44×44 px. A rule with `outline: none !important` had hidden its focus. | `app/onboarding/page.tsx`, `app/globals.css` |
| One vocabulary | "Review drafts" everywhere. The instructor bell's accessible name is "Recent course activity". Admin's "Workshop Builder" button reads "Workshops". | `lib/navigation.ts`, `instructor/review/*`, `instructor/course-shell.tsx`, `admin/teaching/page.tsx`, `docs/NAVIGATION.md` |
| Return to the source list | The Back button on a challenge or quiz names its destination and returns to it with its filters (Quest Map, Dashboard, a Workshop). Submission status never becomes the destination. Exams still go back to Exams. | `components/app-shell.tsx` |
| Tooltip rules | Only icon-only controls show their name on hover, and that name is no longer repeated as a description. Tapping a status chip opens its help. Long press works only on buttons, so links keep their native menu. Chips and stat cards with help can be focused. | `components/app-tooltips.tsx`, `components/workspace/ui.tsx` |
| Profile order | Recent progress comes before Debugger's Codex. | `profile/page.tsx` |
| Admin Overview | One service-health summary card that names any failing service. The header chip, the per-service list and the duplicate failed-jobs banner were removed. A new Overview · Monitoring · Configuration tab bar. | `admin/page.tsx`, `admin/layout.tsx`, `components/admin/section-nav.tsx` |

## Slice 2: student phone screens

| Change | What users see | Main files |
| --- | --- | --- |
| Dashboard priority | Open exam → grading in progress → Recommended next → announcements and notices → Memory Check and history. At 320×640 px, Recommended next moved from 1,631 px down to 363 px. Smaller greeting and compact Refresh on phones. "View submission status" is a button. The exam card icon is hidden on phones. | `dashboard/page.tsx`, `globals.css` |
| Quest Map | Search and filters come before the progress card. The type filters are one sideways-scrolling row. The progress card is more compact. | `quests/page.tsx`, `globals.css` |
| Submission status | The text matches the state ("recorded and passed", "Retry grading uses that same code"). One screen-reader announcement per state change. The actions come before the comparison panel. The job ID is a small "Support reference". | `submissions/[id]/page.tsx` |
| Exams | The start screen shows the closing time, the duration-or-closing rule, and results release. On screens at least 560 px tall, the timer, Submit and save status stay pinned. Submit opens a review with the unanswered count. The result page has full-size "All exams" and "Dashboard" buttons. | `exams/[id]/page.tsx`, `globals.css` |
| Touch targets | Small buttons (including Previous, Next and Reset code in the Arena) are 44 px tall on touch screens. | `globals.css` |
| Narrow-phone navigation | At 360 px or narrower, the side menu hides while a text field has focus, then returns on blur. This works on either docked side and is CSS only. | `globals.css` |
| Layout fixes | Profile "Average score by topic" names no longer collapse to one letter per line. The Leaderboard XP column fits, and the standing card stacks. | `globals.css` |
| Small copy | The Workshop board says "Times are shown in Asia/Manila". A note beside Temporary Chat says it isn't saved. | `workshops/workshop-board.tsx`, `chat/chat-workspace.tsx` |

## Slice 3: instructor

| Change | What users see | Main files |
| --- | --- | --- |
| Exams page | "Your exams" first, with a stage label (Draft, Scheduled, Open, Closed, then results held or released) and Manila times. Divided rows. A "New exam" heading. A confirmation before Release results. The "Instructor studio" header and "Back to workspace" link were removed. Retake window fields are labelled with Manila time. | `components/instructor-exams.tsx`, `globals.css` |
| Activity editor | The Schedule step names the audience (course and track) and the timing. An empty schedule counts as complete. A visible reason sits under the disabled Verify button. Verify has a short Judge0 definition. The publish dialog names the audience. | `instructor/activities/[id]/page.tsx`, `lib/workspace.ts` |
| Dashboard | A "How these measures are defined" panel (Active 7 days, Activities passed, Stuck). Recent activity reads as sentences ("created a course announcement"). | `instructor/page.tsx`, `lib/instructor-dashboard.ts` |
| Naming | Review drafts says "Upload PDF", the same as Materials. | `instructor/review/page.tsx` |
| Workshops | Staff choose the workshop language themselves, with no default from their own profile. A wrong-track join shows a "Change learning track" link. | `workshops/workshop-home.tsx` |

## Bugs found and fixed

- **Hidden keyboard focus on Show password.** A forced `outline: none` removed it.
- **Fake retake offer.** Right after submitting, the exam page showed "Start granted retake" using exam info loaded before the attempt. The server would have refused it. The button now needs exam info that already names the submitted attempt.
- **"Time ended" on manual submissions.** Reopening a submitted exam showed the deadline banner. It now appears only for auto-submission or a deadline reached in that tab. A precise fix would need the API to expose how an attempt was submitted, which is a product decision.
- **Editor lost its step.** Save, Verify or Schedule refreshed the activity and sent the instructor back to Details. The step now resets only when a different activity opens.
- **Workshop language default.** The create form pre-selected the instructor's own student track, which produced a workshop that the intended students couldn't join.
- **Collapsed layouts at 320 px.** Profile topic names showed one letter per line, and the Leaderboard XP column was pushed off screen.
- **Unreadable audit sentence.** "recorded Course announcement created." now reads "created a course announcement".

## How it was checked

- **Automated checks:** `npm run typecheck` is clean. `npm run lint` shows no errors; one warning was there before this work (`materials-manager.tsx`, missing `openUpload` dependency). `npm test` passed: 49 files and 222 tests, plus the four exam-recovery invariants.
- **Tests added or updated:**
  - Tooltip labels and touch behaviour.
  - Focus-page return destination.
  - Exam submit review, retake offer and the "Time ended" banner. The retake test was confirmed to fail without the fix.
  - Exam stage labels and the release confirmation.
  - Audit sentence phrasing.
  - Workshop language for staff.
- **Browser checks:**
  - Signed-in local sessions through the dev server at `http://127.0.0.1:3001`, which uses the API on port 8001 and only accepts the `127.0.0.1` origin.
  - Students at 320, 390, 430 px and 844×390 px. Instructor pages at 1280 and 390 px.
- **Throwaway QA classes** from `backend/tests/qa_live_multi_role.py --keep` (runs `ydlpi`, `pnnke` and `rugjm`). Each reported zero unexpected responses and was removed with `--cleanup`.
- **Slice 3 gate, checked in the app:**
  - A coding challenge created in the editor, verified with Judge0, published, and listed for a QA student.
  - A workshop created in the instructor UI and joined by a student with its code, including the wrong-track case.
  - Held exam results released through the new confirmation. The student saw 20/20 with points per task.

## Not checked

- Physical iOS and Android devices, VoiceOver, TalkBack and NVDA.
- Generating a draft from a PDF, because Gemini is off locally.
- Filled-in forecast and model-report screens, because forecasting is off locally.
- The editor step fix has no unit test; it was checked in the browser only.
- No before/after screenshots were saved, beyond those taken during the session.

## Decisions made today

- The plan is delivered in slices. Machine learning analytics was moved ahead as slice 4. Administrator is slice 5. Cross-role release and cleanup is slice 6.
- Slice 4 follows the Matt Pocock flow: setup, grill-with-docs, prototype if needed, spec, tickets, test-first implementation per ticket, code review, retro.
- One local checkpoint commit (`07df51d`) is the fixed point for the slice 4 tickets and their review.

## Next steps

1. Run `/setup-matt-pocock-skills`. The recommendation is local markdown issues in `.scratch/` and a single `GLOSSARY.md`.
2. Run `/compact we're going to grill the ML analytics slice`, then `/grill-with-docs`.
3. Run `/to-spec` and `/to-tickets`, then `/implement` for each ticket. The draft tickets are: a seeded local ML fixture; Model evaluation leading with purpose and status; learner forecasts with predicted and observed results kept apart; one chart pattern; the research consent flow; glossary and plan updates.
4. Slice 5 (administrator) waits as a ready-to-start session card with its own brief.

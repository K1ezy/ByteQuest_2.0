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

## Student flow checkpoint for 24 November 2026

- Student signup opens Dashboard with the language unset. The first successful workshop join saves the student's choice when it matches the workshop. Existing tracks are preserved.
- Profile holds personal progress and analytics. Dashboard shows upcoming work. Quest Map has All quests, Code challenges, Concept check quiz and Exams. Old exam list links redirect to the Exams view, and individual exam links still work.
- The rebuilt local app passed the signup, workshop join and exam walkthrough in Edge at 320 and 1440 px. The full suites passed 290 backend tests, 238 frontend tests and four exam recovery checks.

The [system status log](../BYTEQUEST_SYSTEM_STATUS_2026-11-21.md) records the local rollout and verification. The [navigation guide](../NAVIGATION.md) records the current routes.

## Quest Map deadlines and activity numbering, 24 November 2026

| Commit | Branch | What it holds |
| --- | --- | --- |
| `5c60057` | `feat/pilot-readiness-quick-fixes` | Deadlines on quest cards, and activity numbers without the word "Quest" or "Exam". Not pushed. |

To see the change, run `git show --stat 5c60057`.

| Change | What users see | Main files |
| --- | --- | --- |
| Quest deadlines | Code challenge and concept check quiz cards on the Quest Map end with the deadline date and time in Manila time, for example "Due Nov 25, 2026, 07:30 PM". After the deadline it reads "Closed Nov 25, 2026, 07:30 PM". Cards without a closing time show no line. Exam cards already showed "opens to closes" times and are unchanged. | `components/quest-card.tsx`, `lib/types.ts`, `backend/app/api/quests_gamification.py` (`/quests` now returns `closes_at`) |
| Activity numbers | The number reads "#3" instead of "Quest #3" or "Exam #3". | Quest Map cards (`components/quest-card.tsx`), exam cards (`components/student-exam-list.tsx`), and the headers of the code challenge (`components/arena.tsx`), concept check quiz (`components/quiz-view.tsx`) and exam (`exams/[id]/page.tsx`) pages |

The numbers themselves did not change: quests use the learner's own list order and exams their exam number. Workshop activity cards never showed a number.

**How it was checked.** All 239 frontend tests in 51 files passed, including a new Quest Map test for the Due line, the Closed line and a card without a deadline. TypeScript and lint on the changed files were clean. The quest-date backend integration test now also checks `closes_at`, and passed.

**Not checked.** The cards and page headers were not viewed in a signed-in browser. On exam cards and the exam page, "#2" now sits above the title without the word "Exam", so it carries less context there than on quest cards. Workshop activity cards share the quest card but get no deadline line, because the workshop API does not send `closes_at`.

### Fix: searching by number, 24 November 2026

| Change | What users see | Main files |
| --- | --- | --- |
| Number search | Typing `4` or `#4` in the Quest Map search shows quest #4 only. Before, the search ignored the card number and matched any title or topic containing a "4", so `4` could show #9. Words still search titles, topics and activity types as before. | `quests/page.tsx`, `components/quest-card.tsx` (one `questNumber` function now feeds both the card's "#" and the search) |

The numbering itself was already correct: the server numbers each learner's quests 1, 2, 3 in list order. A new Quest Map test reproduces the report (nine quests, #9 titled "Print 4 squares"); it failed on the old code and passes with the fix. All frontend tests, TypeScript and lint pass. Not checked in a signed-in browser.

### Preview window redesign, 24 November 2026

The side preview window that opens from a quest card's Preview button was redesigned. It still uses the same `/performance-preview` data, which is the student's own first-try results on similar activities, so no backend change was needed.

| Area | Before | After |
| --- | --- | --- |
| Header | Type and title | "#2" badge with the type, the title, and chips for topic, "Difficulty 1 of 5", XP and "Due …" (or "Closed …") |
| Results | "Workshop history", a big "1 of 1" and a plain bar | "Your record in this workshop" (or course), a ring with the first-try pass rate, "3 of 4 · Passed on the first try", a bar with a legend (Passed / Needed another try) and one plain-language reading such as "You usually pass these on your first try" |
| No history | "No comparable results yet." | The same line plus "This is your first of these code challenges here, so there's no pattern to show" |
| Exams | Average and pass count | Ring with the average, "Your average across N released exams", pass count with legend, pass mark |
| Before you start | One sentence | A three-step checklist for each type (challenge, quiz, exam) |

The reading describes past results only and is not a forecast: next-task predictions stay instructor-only, as the manuscript requires (p. 61). Main files: `components/activity-performance-preview.tsx`, `quests/page.tsx` (passes the card details), `globals.css`. Quest Map tests were updated for the new labels and cover the ring, chips, reading, empty state and checklist. Not checked in a signed-in browser.

## Implementation checklist checkpoint for 24 November 2026

The Git checkpoint is on `codex/bytequest-2026-11-24-checkpoint` and starts from local implementation commit `b2b74e0`. The [system status log](../BYTEQUEST_SYSTEM_STATUS_2026-11-21.md) tracks local runtime and release evidence.

- [x] **Student flow.** Signup opens Dashboard with the language unset. The first matching workshop join saves the student's language choice. Profile contains progress, mastery and rankings, and students open it from Account. The sidebar lists Dashboard, Quest Map and Workshops. Quest Map includes assigned exams and the Concept check quiz filter.
- [x] **Quest Map browsing and history.** Cards show due or closed times and activity numbers, and number search matches the visible number. Selecting a challenge, quiz or exam opens a right-side preview on desktop and expands inside the card on phones. The preview shows the learner's history for that activity type, the workshop or course source, a result breakdown and a preparation checklist. Outside click and Escape dismiss it.
- [x] **Exam pass marks.** Instructors set a whole-exam mark from 1% to 100% and can edit it until publication. Student history uses released scores and one latest released attempt per prior exam. Older published exams with no mark keep their scores. The local migration preserved all 66 existing exam attempts and their grades. [Migration](../../supabase/migrations/20261124140622_exam_pass_mark.sql)
- [x] **Quiz text containment.** Long questions and choices wrap inside the card. Review warnings, rows, and navigation fit the panel. The new browser suite exercises desktop, 320 CSS px and doubled root text size. The regression workflow runs it, and the frontend guidance requires extending it for changes to screens with dynamic text. [Frontend rule](../../frontend/AGENTS.md#text-and-layout-containment) · [Workflow](../../.github/workflows/regression.yml)
- [x] **Tutor and authoring changes.** Error explanations use learner submission context and course citations. Tutor and hint prompts keep guidance at the hint level. Instructor draft generation uses explicit course excerpts and more precise test case requirements. Gemini calls support the configured Flash-Lite thinking level.
- [x] **Local ML rehearsal.** The seeded four-section scenario supplies consented synthetic attempt and hint data for the ten-input export and model-comparison rehearsal. [ML workflow](../../ml_pipeline/README.md)

**Local evidence.** The checkpoint passed 294 backend tests, 244 frontend tests, four exam-recovery checks and TypeScript. Edge checked preview placement and activity links across phone and desktop widths before the latest visual redesign. Browser checks reproduced quiz overflow before the fix, then all six cases passed on development and isolated production builds. Edge also confirmed Account → Profile and the student sidebar at 320 and 1920 px. The [hosted pilot checklist](../KVM2_LIVE_PILOT_CHECKLIST.md) holds deployment acceptance work.

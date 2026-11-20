# Step C — Instructor visual verification

The [reference HTML](instructor-dashboard-reference.html) is the supplied static design. The Dashboard, Activities, and Gamification Insights share the compact instructor shell, flat sections, status strip, rows, buttons, and scoped responsive styles. Application screens use local ByteQuest data and the existing role-scoped APIs.

## Screenshot comparisons

Capture directory `output/instructor-step-c`. Each left/right comparison has the original 1440 × 900 or 390 × 844 viewport capture at full resolution. The additional full-page phone comparison includes the lower sections. The capture hides Next.js development chrome so it does not cover application controls.

| Page | Desktop comparison | Phone comparison |
| --- | --- | --- |
| Dashboard | `dashboard-comparison-desktop.png` | `dashboard-comparison-phone.png` and `dashboard-comparison-phone-full.png` |
| Activities | `activities-comparison-desktop.png` | `activities-comparison-phone.png` |
| Gamification | `gamification-comparison-desktop.png` | `gamification-comparison-phone.png` |

At 1440 px, the Dashboard has a 1280 px centered shell, 190 px sidebar, 24 px sidebar gap, and 652 px / 326 px content columns separated by 40 px. At 390 px, the content starts at 16 px, the stats are 2 × 2, and the document order is Needs your attention, Students to check, Coming up, Recent activity. Both widths have a 58.5 px top bar, matching the measured reference, and one filled primary button. The phone uses the existing five bottom destinations. Real activity titles, additional topics, and activity history change natural row lengths.

## Reference tokens and icons

| Reference property | ByteQuest token |
| --- | --- |
| `--page`, `--tint`, `--border` | `--surface`, `--paper`, `--line` |
| `--text-primary`, `--text-secondary`, `--text-muted` | `--ink`, `--muted`, `--muted-soft` |
| `--accent`, `--accent-tint`, `--on-accent` | `--purple`, `--purple-soft`, `--ink-inverse` |
| `--danger`, `--danger-tint` | `--danger`, `--danger-soft` |
| `--warning`, `--warning-tint` | `--warning-ink`, `--warning-soft` |
| `--success` | `--emerald-700` |
| `--radius` | The specified 8 px control radius. |

Contrast checks on the mapped tokens measured 4.65:1 for muted on the tinted strip, 14.77:1 for primary text on accent tint, 9.27:1 for the primary button, 5.14:1 for success on tint, 5.69:1 for the danger pill, and 5.51:1 for the warning pill.

| Reference icon | ByteQuest treatment |
| --- | --- |
| `home`, `clipboard-check`, `users`, `trophy` | Existing home, clipboard, group and trophy line shapes. |
| `message-circle` | Existing Chat Assistant bubble. |
| `code`, `file-text`, `inbox`, `table`, `chart-bar`, `bell` | Matching inline code, file, inbox, table, chart and bell outlines in the existing stroke style. |
| `chevron-down`, `chevron-right`, `plus`, `arrow-up`, `arrow-down` | Inline chevrons, plus and direction arrows. |
| `alert-triangle`, `user-pause`, upcoming calendar | Inline triangle, paused learner and calendar. |
| Judge0 passed, needs verification, grading locked | Check, warning and lock outlines with tooltips. |

Recharts is pinned to `3.10.1`, with `react-is` pinned to `19.3.1`. The engagement chart is loaded through `next/dynamic` only when the Gamification chart has sufficient data. The series comes from the existing CSS palette, the accessibility layer enables keyboard navigation, reduced-motion preferences disable animation, and the existing table route to the same data is available as **View as table**. [Recharts line chart options](https://recharts.github.io/en-US/api/LineChart/)

## Current routes and behavior

- Roster, Submissions, Gradebook, and Analytics currently open the appropriate existing Performance view or anchor. The not-started row filters the roster. The bell opens the real Recent activity feed. Announce opens the composer and its management link retains edit and delete access to course announcements.
- Failed PDF rows use the existing retry endpoint when the material permits retry. Replace opens the existing new-version PDF form. Analysis and New version use existing routes. Duplicate creates a draft through the existing detail and create APIs. Archive is visible in the menu and disabled for instructors pending backend support.
- Scheduled activity queue items show the dot label **Soon**, the description **This activity is scheduled to open soon.**, and **Open**. Rejected drafts use the description **This draft needs changes before you approve it.** Drafts without source evidence use **Draft. Students can't see it until you approve.** Any other queue kind keeps its returned status/detail and an **Open** link.
- Calendar-week activity and submission figures display **Weekly data unavailable** on the Dashboard. Gamification uses the same weekly availability rule and labels its separate lifetime practice count. The existing Gamification endpoint supplies learner-relative weeks and aggregate debugging evidence. Topic flags therefore link into the matching topic diagnostics until learner-level filters are available.
- The redundant PDF warning banner was removed from the redesigned Dashboard. The app source has no remaining `can cite it` copy.

## Phase 2 API and rollout list

| Planned API support | Current UI behavior |
| --- | --- |
| Shared calendar-week summary with current and preceding seven-day active learners and official submission receipts. Use the approved metric dictionary and Manila day windows. | The two weekly statistics show an unavailable value. No lifetime or learner-relative count is labeled as a calendar-week count. |
| Section-scoped `GET …/analytics/needs-help` with reason, topic, and authorized learner IDs and matching Student drill-down. | Topic rows open the filtered aggregate diagnostics. No-attempt rows already open a filtered roster. |
| Real instructor inbox `GET …/notifications` and read-state update. | The bell opens Recent activity. |
| Instructor-authorized archive for activities/assignments, with revision checking. | Archive appears disabled in the activity menu. |
| Structured audit actor display name, action label, and object title, plus section-scoped attention/deadline paging. | The dashboard formats available audit labels, suppresses obvious generated IDs and uses **Unknown user** where appropriate. Current lists use existing course API limits. |
| Shared instructor/admin availability revision check and cross-role regression test. | The existing schedule and admin availability contracts remain in place in Step C. |

## Test target checks

The pytest session guard rejects non-loopback database URLs and driver-level target overrides before collection can open an application session. QA cleanup now checks the same configured local services as setup. The Python seed entry points already check local development targets, and the launcher applies migrations with `--local`. Keep direct SQL seeding and linked reset commands outside the hosted workflow. A privileged operator can still explicitly submit arbitrary SQL to a hosted database. [Deployment checklist](../PHASE7_DEPLOYMENT_READINESS.md)

`npm test` passed 147 frontend tests and four exam recovery checks. `npm run lint`, TypeScript, and all 186 pytest tests passed. The database target guard rejected a synthetic hosted hostname and a loopback DSN with a remote `hostaddr` before test collection.

The signed-in Edge checks also passed at the 899/900 px breakpoint and at 320 px for Dashboard reflow. They exercised title-link-to-button keyboard order, focus outlines, the announcement dialog, and switching to an empty course without showing previous course rows. A separate supported-weeks fixture exercised lazy Recharts loading, its arrow-key tooltip, reduced-motion mode, and the table fallback. Temporary QA identities and course assignments were removed after capture.

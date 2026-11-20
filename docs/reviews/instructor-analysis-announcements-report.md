# Instructor activity analysis and class announcements

November 16, 2026 · Local ByteQuest on Windows

## Activity analysis

- The [activity analysis endpoint](../../backend/app/api/faculty/performance.py) reports practice participation, pass rates, first practice attempts, the median attempts to pass, learners who need follow-up, and best-score bands. Challenges add failed-attempt error categories and hint-use counts. Quizzes add correct-response counts from saved first-attempt answers.
- The [analysis screen](../../frontend/src/components/instructor/activity-analysis.tsx) is accessible from published activities and gradebook columns. It puts rates and denominators first, then shows labelled bar charts with table disclosures and a rule-based reading. The stuck-learner link opens [Student Progress](../../frontend/src/app/(workspace)/instructor/performance/page.tsx) with the activity and follow-up filters applied.
- Analysis, gradebook, and activity-filtered progress use the active class roster and exclude exam-backed attempts. Attempt order is calculated after excluding exam rows because the stored sequence can include exams. Scores use each learner’s best result. The displayed cutoff comes from the actual grading rule, including the quiz threshold of 75%.
- First-attempt quiz questions count saved answer records. Legacy attempts without saved answers stay in the activity totals but are excluded from the question denominator. An empty saved answer object counts as an unanswered attempt. Aggregates contain no learner identities, answer keys, or hidden grading cases. The report uses the attempt data already available in ByteQuest.

## Class announcements

- Instructors can create, edit, pin, expire, and delete notices on [My Courses](../../frontend/src/components/instructor/course-announcements.tsx). The form keeps entered text on failure, focuses the first invalid field, and confirms deletion. The panel waits for the selected course’s context before showing its controls.
- The [student dashboard card](../../frontend/src/components/student-announcements.tsx) shows the highest-priority notice first, offers a disclosure for the rest, and remembers dismissals in the current browser. Displayed messages use plain text with preserved line breaks. Notices disappear when expired or when the list is empty.
- The [faculty API](../../backend/app/api/faculty/announcements.py) requires an active instructor assignment and writes create, edit, and delete audit events in the same transaction as the change. A course-row lock serializes creation against the 50-notice limit. The [student API](../../backend/app/api/pilot.py) returns up to 10 unexpired notices from active student memberships and exposes only the fields needed by the card. [PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)
- The [migration](../../supabase/migrations/20261115175945_course_announcements.sql) adds the table, foreign keys, length checks, and a course/date index. The local database verified that row-level security is enabled and that the browser roles have no direct table grants. Existing records were retained during `supabase db push --local`. [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Verification

| Check | Baseline | Activity analysis | Final |
| --- | --- | --- | --- |
| `python -m pytest -q -p no:cacheprovider` against local Postgres | 180 passed | 180 passed and one new fixture failed on an invalid hint-source value. After correcting it to `reviewed`, the focused test passed. | 183 passed, 0 failed |
| `npx vitest run` | 122 passed | 125 passed | 129 passed, 0 failed |
| `npx tsc --noEmit` | Passed | Passed | Passed |
| `npx eslint src` | Passed | Passed | Passed |
| `START-BYTEQUEST.bat` | Running before work | Production build and startup passed | Production build and startup passed |
| `qa_live_multi_role.py --students 12` | — | 15 checks passed, 0 unexpected responses | 17 checks passed, 0 unexpected responses |

The live run compared attempt, pass, and stuck counts for two challenges and one quiz across Postgres, gradebook, Student Progress, and analysis. All 12 classmates received the pinned notice. The unenrolled student received an empty feed. Local timings were 47 ms p95 for the three analysis requests and 95 ms p95 for the 13 student announcement requests. These measurements cover one local run.

At 49 notices, two simultaneous live POST requests returned one 201 and one 409. The database held exactly 50 notices. Cleanup removed the temporary course, all 15 QA accounts, and the course’s announcement rows.

## Browser verification

- Signed in with the temporary instructor and student accounts in Microsoft Edge. Checked analysis, My Courses announcements, and the student dashboard at 1440 and 375 CSS px. The quiz report also reflowed at 320 px. The checked pages had no document-level horizontal overflow, and their marked touch actions measured at least 44 px high.
- Opened the chart table with Enter and observed the focus ring. Submitted an empty announcement, confirmed that focus moved to Title, then posted, edited, and deleted a pinned notice. The student received it as plain text with line breaks. Dismissal revealed the next notice and persisted across reload.
- The browser exposed a DELETE preflight failure that direct API requests could not exercise. The [CORS configuration](../../backend/app/main.py) now permits DELETE for the existing configured origins. The integration test also checks rejection of an untrusted origin. Browser deletion passed after the fix.
- The rerun after the mobile layout and CORS fixes recorded zero console errors for both roles. The analysis summary fits four metrics into two rows on a phone, and the student Dismiss button stays on one line.

## Remaining verification

1. Repeat the end-to-end browser flows on a physical phone with VoiceOver or TalkBack. This run used Edge viewport emulation and keyboard input.
2. Measure the analysis endpoint with a full term of attempts if deployments grow beyond the pilot class size. The current latency measurements cover 12 enrolled learners.

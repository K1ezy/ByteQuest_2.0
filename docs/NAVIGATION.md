# ByteQuest navigation

The baseline contains 34 page routes. Signed-in destinations share a sidebar and account menu. Profile, Accessibility, and Sign out are account actions. Chat Assistant opens from the top bar and has a full-page deep link.

| Audience | Primary destinations |
| --- | --- |
| Student | Dashboard, Quest Map, Exams, Workshops, Leaderboard |
| Instructor | My Courses, Quest & Workshop Builder, Student Progress & Submissions, Exams |
| Administrator | System Overview, Course & Instructor Management, User & Role Management, Content & Track Repository, Instructor Workspace |

## Existing routes

| Existing routes | Disposition |
| --- | --- |
| `/`, `/terms`, `/privacy`, `/onboarding` | Retained. Signed-in track setup uses the app shell. |
| `/profile`, `/account/research`, `/chat` | Retained as account or support destinations. |
| `/dashboard`, `/quests`, `/exams` | Retained. Dashboard absorbs Journey. |
| `/arena/[id]`, `/quiz/[id]`, `/exams/[id]`, `/submissions/[id]` | Retained as deep links. The three runners use a focus layout. |
| `/faculty` | Permanent redirect to `/instructor`. |
| `/faculty/activities`, `/faculty/activities/[id]`, `/faculty/materials`, `/faculty/ml`, `/faculty/performance`, `/faculty/review`, `/faculty/review/[id]` | Permanent redirects to the matching suffix under `/instructor`. |
| `/faculty/accessibility`, `/admin/accessibility` | Permanent redirects to `/account/accessibility`. |
| `/instructor` | My Courses. Legacy authoring is reachable through Materials and the authoring studio. |
| `/instructor/exams` | Retained as the Instructor exam management page. |
| `/admin`, `/admin/accounts`, `/admin/activities`, `/admin/assignments`, `/admin/configuration`, `/admin/courses`, `/admin/materials`, `/admin/monitoring` | Retained with section-level navigation. |

## Compatibility and new destinations

| Old Quest Map URL | Destination |
| --- | --- |
| `?view=leaderboard` | `/leaderboard` |
| `?view=journey` | `/dashboard` |
| `?view=activity-hub` | `/workshops` |
| `?view=accessibility` | `/account/accessibility` |
| `?view=faculty` | `/quests`, `/instructor`, or `/admin/teaching` according to the signed-in role |
| `?group=[id]` | `/workshops?group=[id]` |
| `?category=code-challenge`, `?category=lessons-review` | Retained as activity filters. |

Instructor Preview is at `/instructor/preview`. Administrator teaching tools are at `/admin/teaching`, with `/preview`, `/exams`, and `/studio` below it. Preview filters published content by language and performs no student writes.

Instructor Materials links to `/instructor/materials/studio` for PDF-to-activity generation and the existing authoring controls. Generated drafts can open directly in the Review Queue. Workshops retain create and membership actions permitted for the signed-in role.

The Quest Map supports `/` to focus search, `[` and `]` to select the previous or next activity, and Escape to clear selection. The activity runners keep their own controls. Instructor and Administrator exam management share the same component and API. Account Accessibility applies across all three workspaces.

## Local verification

- Edge covered the three role menus and all primary destinations, the Instructor assignment state and refresh, cross-role links, a signed-out exam return, the Exam and Arena exits, role-aware Quest Map links, category history, Student Preview, and keyboard menus at 1440, 768, and 390 px. High contrast and reduced motion were checked at 390 px.
- Edge covered PDF upload in Instructor Materials, generation and publication of a quiz through the Review Queue, and exam creation and publication. Live API checks covered PDF versioning, Gemini challenge generation with Judge0 verification, challenge review and publication, and exam results release using a closed fixture with no attempts.
- Frontend lint, type checking, production build, 62 frontend tests, four recovery invariants, and 93 backend tests passed. Student exam submission, grading, and results access as one browser workflow remain unverified.

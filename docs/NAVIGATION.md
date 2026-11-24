# ByteQuest navigation

Signed-in destinations share a sidebar and account menu. Profile, Accessibility, and Sign out are account actions. Chat Assistant opens from the top bar and has a full-page deep link.

| Audience | Primary destinations |
| --- | --- |
| Student | Dashboard, Quest Map, Workshops, Profile |
| Instructor | My Courses, Quest & Workshop Builder, Student Progress & Submissions, Exams |
| Administrator | System Overview, Course & Instructor Management, User & Role Management, Content & Track Repository, Instructor Workspace |

## Existing routes

| Existing routes | Disposition |
| --- | --- |
| `/`, `/terms`, `/privacy`, `/onboarding` | Retained. Students go to Dashboard after registration and sign-in, or return to the link that prompted sign-in. |
| `/profile` | Student Progress, Mastery, Rankings and Account. Students choose their first language while joining a workshop and can change it later in Edit profile. Staff retain their role-specific activity and Account tabs. |
| `/account/research`, `/chat` | Retained as account or support destinations. |
| `/dashboard`, `/quests` | Dashboard shows upcoming work. Quest Map contains All quests, Code challenges, Concept check quiz and Exams. |
| `/exams` | Redirects to the Exams view at `/quests?category=exams`. |
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
| `?view=leaderboard` and `/leaderboard` | `/profile?tab=rankings` |
| `?view=map` | `/profile?tab=mastery` |
| `?view=journey` | `/dashboard` |
| `?view=activity-hub` | `/workshops` |
| `?view=accessibility` | `/account/accessibility` |
| `?view=faculty` | `/quests`, `/instructor`, or `/admin/teaching` according to the signed-in role |
| `/quests?group=[id]`, `/workshops?group=[id]` | `/workshops/[id]` |
| `?category=code-challenge`, `?category=lessons-review` | Retained as activity filters. |

The former `/onboarding?mode=change_track` opens the student's language field in Edit profile.

Instructor Preview is at `/instructor/preview`. Administrator teaching tools are at `/admin/teaching`, with `/preview` and `/exams` below it. Preview filters published content by language and performs no student writes.

Instructor Materials links to `/instructor/materials/studio` for PDF-to-activity generation and the existing authoring controls. Generated drafts can open directly in Review drafts.

## Workshops (11/21/26)

Students have **Workshops** in their menu. Instructors open **Workshops** under **Teach** on desktop or through **More** on a phone. Administrators open it from **Instructor Workspace**.

| Route | Destination |
| --- | --- |
| `/workshops` | Teaching, joined or managed workshop cards. The Archived filter shows archived workshops. |
| `/workshops/join/[code]` | Invite confirmation. Signed-out visitors sign in and return here. |
| `/workshops/[id]` | Board with announcements, upcoming items and the owner’s invite controls. |
| `/workshops/[id]/activities`, `/workshops/[id]/people` | Shared activities by topic and the workshop roster. |
| `/workshops/[id]/progress`, `/workshops/[id]/settings` | Practice progress and workshop settings for the owner or administrator. |

The Quest Map supports `/` to focus search, `[` and `]` to select the previous or next activity, and Escape to clear selection. The activity runners keep their own controls. Instructor and Administrator exam management share the same component and API. Account Accessibility applies across all three workspaces.

## Local verification

- Edge covered the three role menus and all primary destinations, the Instructor assignment state and refresh, cross-role links, a signed-out exam return, the Exam and Arena exits, role-aware Quest Map links, category history, Student Preview, and keyboard menus at 1440, 768, and 390 px. High contrast and reduced motion were checked at 390 px.
- Edge covered PDF upload in Instructor Materials, generation and publication of a quiz through Review drafts, and exam creation and publication. Live API checks covered PDF versioning, Gemini challenge generation with Judge0 verification, challenge review and publication, and exam results release using a closed fixture with no attempts.
- Frontend lint, type checking, production build, 62 frontend tests, four recovery invariants, and 93 backend tests passed. Student exam submission, grading, and results access as one browser workflow remain unverified.

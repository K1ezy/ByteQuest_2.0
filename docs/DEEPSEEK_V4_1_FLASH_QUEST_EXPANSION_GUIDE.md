# ByteQuest 2.0: implementation guide and DeepSeek V4.1 Flash prompt

This guide is for extending four existing features: code challenges, lesson review, Create Quest, and Join Quest. It describes the repository as it exists on 29 October 2026. A **quest group** is a shared collection of published learning activities; an **activity** is either a coding challenge or a concept quiz. Keep that distinction when naming routes, models, and UI.

## 1. Current architecture

| Layer | Files | Existing behavior |
| --- | --- | --- |
| Quest browser and group dialog | `frontend/src/app/quests/page.tsx` | Loads `/quests`, `/quests/leaderboard`, and `/quest-groups`; filters by `category` and `group` URL parameters; Create, Join, and Add Activities dialogs live here. |
| Shared frontend contracts | `frontend/src/lib/types.ts` | `Quest`, `QuestGroup`, `Profile`, and language/role unions. |
| Authenticated HTTP | `frontend/src/lib/api.ts` | `apiRequest` adds the Supabase bearer token, JSON header, error handling, and `cache: "no-store"`. Use this for new UI calls. |
| Instructor content studio | `frontend/src/app/instructor/page.tsx` | Uploads PDFs, generates challenge/quiz drafts, edits them, confirms review, and publishes them. |
| Student coding and quiz UI | `frontend/src/components/arena.tsx`, `frontend/src/components/quiz-view.tsx` | Challenge editor/submission and question/review/submission flows. Route wrappers: `frontend/src/app/arena/[id]/page.tsx` and `frontend/src/app/quiz/[id]/page.tsx`. |
| Instructor content API | `backend/app/api/rag_instructor.py` | Document generation, draft editing, Judge0 verification, review confirmation, publication. |
| Public activity and quiz API | `backend/app/api/quests_gamification.py` | Safe published activity cards, quiz grading, progress, leaderboard. |
| Quest group API | `backend/app/api/quest_groups.py` | List memberships, create group, join by code, add published activities. |
| Submission pipeline | `backend/app/api/submission_jobs.py`, `backend/app/services/submission_worker.py`, `backend/app/api/pilot.py` | Queues student code submissions, grades them, stores drafts, hints and solution access. |
| Data model and migration | `backend/app/models/entities.py`, `supabase/migrations/20261027000100_quest_groups.sql` | `LearningActivity`, `QuestGroup`, `QuestGroupMember`, `QuestGroupActivity`, `TestCase`. |
| API registration | `backend/app/main.py` | Already includes quest, quest group, instructor, and submission routers. |

### Existing API contracts

| Action | Endpoint | Request / important rule |
| --- | --- | --- |
| List published activities | `GET /api/v1/quests` | Students see their enrolled language only. Quiz answers and challenge reference solutions/test cases must stay private. |
| Submit quiz | `POST /api/v1/quests/submit-quiz` | `{activity_id, answers: {question_id: option_key}, time_spent_seconds}`. Server grades and awards XP only on first mastery. |
| Generate challenge / quiz | `POST /api/v1/instructor/documents/{doc_id}/generate-challenge` or `/generate-quiz` | Multipart form: `topic_query`, `language`, `difficulty`. Requires a processed instructional document. |
| Edit challenge / quiz | `PATCH /api/v1/instructor/activities/{id}` or `/{id}/quiz` | Draft only. Editing clears prior review; challenge edits require Judge0 revalidation. |
| Confirm review / publish | `PATCH /api/v1/instructor/activities/{id}/review`, then `PATCH /api/v1/instructor/activities/{id}/publish` | Challenge needs at least three grading cases and verified reference solution. Quiz needs 3–10 valid questions. |
| List groups | `GET /api/v1/quest-groups` | Only groups joined by current user; invite code is returned only to owner/admin. |
| Create group | `POST /api/v1/quest-groups` | `{name, description, language, activity_ids}`. Instructor/admin only. Activity IDs may be empty; supplied IDs must be published and match language. Creator becomes a member. |
| Join group | `POST /api/v1/quest-groups/join` | `{code}`. Code is normalized to eight characters; student language must match group language. Rejoining is idempotent. |
| Add group activities | `POST /api/v1/quest-groups/{id}/activities` | `{activity_ids}`. Owner/admin only; published, same-language activities. |

## 2. Exact code touchpoints

### A. Add more code challenges

For **more content**, use the existing instructor workflow first: upload/choose a processed PDF, generate a challenge, edit its statement, starter/reference code and test cases, save, verify, confirm review, publish, then add the published activity to a group. No database change is required.

For **new challenge authoring features**, edit these locations:

1. `backend/app/api/rag_instructor.py`: `GeneratedChallengeSchema`, `DraftChallengeUpdate`, `_serialize_challenge`, `_challenge_validation_fingerprint`, `update_instructor_draft`, `reverify_instructor_draft`, `generate_ai_coding_challenge`, and `publish_learning_activity`. Any new grading-relevant field must be validated, saved, serialized to instructors, and included in the validation fingerprint so an edited draft cannot retain stale Judge0 approval.
2. `frontend/src/app/instructor/page.tsx`: `Challenge`/`TestCase` types, `generateChallenge`, `updateChallenge`, `updateTestCase`, `saveDraft`, `verifyDraft`, `setActivityReviewed`, `publishDraft`, and the corresponding editor JSX. Keep save → verify → review → publish as distinct states.
3. `backend/app/models/entities.py` and a **new** timestamped `supabase/migrations/*.sql` if persistence changes. Do not rewrite an applied migration. Check enum and nullability compatibility.
4. `backend/app/api/quests_gamification.py` `QuestCard` and `list_published_quests`, plus `frontend/src/lib/types.ts` `Quest`, only for **public** challenge metadata. Never serialize `reference_solution_code`, hidden test cases, or answer keys to this endpoint.
5. `frontend/src/components/arena.tsx`, `backend/app/api/submission_jobs.py`, and `backend/app/services/submission_worker.py` if student execution or grading behavior changes. Preserve Judge0 isolation, async job polling, and existing per-user limits.

### B. Expand Lessons Review

“Lessons Review” is the **quiz category**, selected with `/quests?category=lessons-review`; it is not a separate database entity. The category filter in `frontend/src/app/quests/page.tsx` checks `activity_type === "quiz"`, and opening a card routes to `/quiz/{id}`.

1. Authoring: `backend/app/api/rag_instructor.py` contains `GeneratedQuizSchema`, `DraftQuizUpdate`, `generate_ai_conceptual_quiz`, `update_instructor_quiz_draft`, review, and publish. `backend/app/services/gamification/quiz_content.py` validates stored question structure. Edit both when changing question formats; never allow malformed published quizzes.
2. Instructor UI: `frontend/src/app/instructor/page.tsx` contains `ConceptualQuiz`, `QuizQuestion`, `generateQuiz`, `updateQuiz`, `saveQuizDraft`, `setActivityReviewed`, and `publishQuiz`.
3. Student UI: `frontend/src/components/quiz-view.tsx` loads the public question list, stores in-progress answers in session storage, shows a review-before-submit step, and calls `/quests/submit-quiz`.
4. Grading: `backend/app/api/quests_gamification.py` validates question IDs/option keys, computes score and mastery, records attempt/XP/badges, and gets the next recommendation. `backend/app/services/gamification/sequencer.py` defines `QUIZ_MASTERY_SCORE` and sequencing rules. Add feedback or retry changes here, with server-side authority.
5. Public contract: `PublicQuizQuestion` intentionally excludes `correct_answer`. Keep answer keys private until a deliberate, authorized post-submission feedback design is implemented.

### C. Improve Create Quest

`frontend/src/app/quests/page.tsx` holds `actionMode`, group form state, `availableActivities`, `submitQuestAction`, the `+` menu, group cards, and dialog markup near the end of the file. `backend/app/api/quest_groups.py` defines `CreateQuestGroup`, `_published_activities`, `_group_view`, and `create_quest_group`. `frontend/src/lib/types.ts` defines `QuestGroup`.

Current rule: students can **preview** Create Quest but cannot save it. Faculty/admin can create it. Preserve this unless the product owner explicitly changes role policy. When extending the form (for example, cover image, schedule, capacity, or ordered activities), update frontend state/payload, Pydantic schema, ORM model, migration, response model, validation, and tests together. Decide whether a setting applies to the group or to each activity before adding columns. Keep server-side ownership checks; a disabled button is not access control.

### D. Improve Join Quest

`frontend/src/app/quests/page.tsx` owns the Join Quest dialog, `joinCode`, request, error handling, group state update, and navigation to `/quests?group={id}`. `backend/app/api/quest_groups.py` owns `JoinQuestGroup` and `join_quest_group`. The migration enforces unique group/member pairs. Existing backend normalization strips hyphens and uppercases the code; the UI currently uppercases text but leaves validation to the API.

When adding join enhancements, cover invalid/unknown codes, repeat joins, language mismatch, pending/busy state, and private code handling. New membership constraints belong in the API plus a new migration when data is needed. Do not expose `join_code` to nonowners in `QuestGroupView`. `backend/app/api/exams.py` and `backend/app/api/pilot.py` use group memberships for exams and instructor views, so test those paths after changing membership semantics.

## 3. Recommended implementation order

1. Confirm the desired behavior and acceptance criteria for each enhancement. Separate content additions from product feature changes.
2. Read `frontend/AGENTS.md` before changing frontend code. It requires checking the installed Next.js documentation under `frontend/node_modules/next/dist/docs/` because this project uses Next 16.4.2.
3. Inspect current files and relevant tests before editing. Keep existing API route names and response shapes unless a coordinated migration is necessary.
4. Implement backend schema/validation/data changes first, then frontend types and UI. Add a new Supabase migration only for a data-model change.
5. Add focused tests for behavior and authorization. Suggested files: `backend/tests/test_learning_flow_integration.py` (challenge/quiz/XP), `backend/tests/test_api_security.py` (permissions and data leakage), and a new `backend/tests/test_quest_groups.py` if group tests do not already cover the new cases. Add frontend tests only for meaningful interaction logic, using the existing frontend test setup.
6. Verify with `python -m pytest backend/tests -q`, `npm run typecheck`, `npm run lint`, and `npm run build` from `frontend/` as appropriate to the change. For runtime flows, follow `docs/LOCAL_E2E.md` and exercise instructor publication, student completion, group creation, and student joining in the local stack.
7. Report changed files, migration steps, test results, and any behavior that still needs a real Supabase/Judge0 runtime. Do not claim an end-to-end pass from static checks alone.

## 4. Ready-to-paste prompt for DeepSeek V4.1 Flash

Copy the prompt below into DeepSeek with access to this repository. Replace the bracketed feature request with your exact desired changes. The suggested request provides a complete starting scope if you do not have a more specific one.

```text
You are editing the ByteQuest 2.0 repository. Implement, do not merely propose, the following request:

[FEATURE REQUEST: Add a polished way for instructors to publish more coding challenges and lesson-review quizzes, assemble them into quest groups, and let students join by invite code. Improve the existing UI states, validation, and focused test coverage. Keep the current role policy: instructor/admin creates groups and publishes content; students join and complete activities. Do not invent an entirely new quest system.]

First inspect README.md, frontend/AGENTS.md, docs/DEEPSEEK_V4_1_FLASH_QUEST_EXPANSION_GUIDE.md, and the current code. This app uses Next.js 16.4.2, FastAPI, SQLAlchemy, Supabase/Postgres, and Judge0. Before editing frontend files, read the relevant installed Next documentation in frontend/node_modules/next/dist/docs/ per frontend/AGENTS.md.

Code map:
- frontend/src/app/quests/page.tsx: category/group filtering; Create Quest, Join Quest, and Add Activities UI and submitQuestAction().
- frontend/src/lib/types.ts: Quest and QuestGroup response types.
- frontend/src/lib/api.ts: authenticated API helper; use apiRequest for calls.
- frontend/src/app/instructor/page.tsx: challenge and quiz generation/edit/review/publish UI.
- frontend/src/components/arena.tsx: student coding challenge UI.
- frontend/src/components/quiz-view.tsx: student lesson-review quiz UI.
- backend/app/api/rag_instructor.py: content schemas, generation, draft save, Judge0 verification, instructor review, publication.
- backend/app/api/quests_gamification.py: published activity cards and server-side quiz grading.
- backend/app/api/quest_groups.py: list/create/join/add group activities and access rules.
- backend/app/api/submission_jobs.py and backend/app/services/submission_worker.py: challenge submission pipeline.
- backend/app/models/entities.py: activity, group, membership, and test-case ORM models.
- supabase/migrations/20261027000100_quest_groups.sql: existing group schema; add a NEW migration for changes.
- backend/tests/test_learning_flow_integration.py and backend/tests/test_api_security.py: existing integration/security patterns.

Existing contracts to preserve:
- A published activity is either ActivityKind.challenge or ActivityKind.quiz. "Lessons Review" filters published quizzes; it is not a third activity type.
- POST /api/v1/quest-groups is instructor/admin only; payload is {name, description, language, activity_ids}. Activities must be published and in the group's language. The creator becomes a member.
- POST /api/v1/quest-groups/join accepts {code}; normalize the eight-character invite code, allow repeat joining without duplicate memberships, and reject a student's mismatched language track.
- POST /api/v1/quest-groups/{id}/activities is owner/admin only.
- QuestGroupView reveals join_code only to owner/admin. GET /api/v1/quests must never expose challenge reference solutions, hidden tests, or quiz correct answers.
- Challenge publishing requires a saved, Judge0-verified draft and explicit instructor review. Quiz publishing requires valid 3–10 questions and explicit review. Editing invalidates review; grading-related challenge edits invalidate prior verification.
- Quiz grading, code grading, XP and badges are server-side. Preserve first-success XP semantics and existing access/rate limits.

Implement in this order:
1. Write a brief behavior/acceptance checklist from the feature request and inspect relevant code before modifying it.
2. Make the smallest coherent backend changes (schemas, route logic, ORM, new timestamped SQL migration only if needed).
3. Update shared TypeScript types and UI. Handle loading, success, invalid input, API errors, keyboard/accessibility, and empty states. Avoid unsafe casts or client-only permission checks.
4. Add focused tests for new behavior: role authorization, published and language validation, invalid/repeat invite codes, no secret fields in public responses, challenge verification/review lifecycle, quiz review/grading, and group membership effects where applicable. Do not add tests that only mirror JSX or implementation details.
5. Run backend tests and frontend typecheck/lint/build (or state precisely why a command could not run). Exercise local end-to-end flows if Supabase and Judge0 are available.
6. Return a concise summary of behavior, exact changed files, migration instructions, command results, and remaining limitations. If ambiguity blocks a product decision, state the assumption you used and continue with reversible work.

Do not replace existing routes or redesign the database without a demonstrated need. Do not edit old applied migrations. Do not expose private grading content or invite codes to unauthorized users. Ensure all new permissions are enforced by FastAPI, not only hidden in React.
```

## 5. Manual acceptance checklist

- Faculty creates and publishes a challenge; an enrolled student sees it under Code Challenges and can submit code. Public quest JSON has no reference solution or hidden test data.
- Faculty creates and publishes a quiz; an enrolled student sees it under Lessons Review, completes review-before-submit, gets server-graded results, and earns XP only on first mastery.
- Faculty creates a quest group with zero or more published same-language activities, receives an invite code, and can add activities later. A student cannot create a group under the current policy.
- A student joins with a valid code and sees the group activities. Bad code, unknown code, wrong language, and repeat join behave as specified. A student cannot see the invite code in group API responses.
- Group membership still works for any exam assignments or instructor group views that depend on it.

# ByteQuest 2.0: close the manuscript gaps, tidy the structure, then review and rate the system

You are a senior software engineer and UI/UX professional working in the ByteQuest 2.0 repository
(`C:\Users\User\Documents\ByteQuest_2.0`), a gamified programming-learning platform that is also an
undergraduate thesis system. A review rated it 8/10 for a classroom pilot, 6.5/10 for AI tutoring
and 6/10 for matching the thesis manuscript. Close those gaps without a rewrite, then review and
rate the system.

Work through the parts in order. Finish and verify one part before starting the next. Every fact
below about the current code was checked against the repository; trust it, but read each file
before you change it.

## Stack and layout

- Frontend: Next.js 16.4 (App Router), React 19.3, TypeScript, vitest. Code in `frontend/src`.
- Backend: FastAPI, SQLAlchemy 2.0, Pydantic v2. Code in `backend/app`.
- Database: local Supabase Postgres with pgvector. Migrations in `supabase/migrations`.
- Grading: Judge0 on a private VM (`backend/app/services/judge0/client.py`).
- AI: Gemini (`backend/app/services/ai_rag/`). ML: `backend/app/services/ml_predictor/`, `ml_pipeline/`.
- Manuscript: `C:\Users\User\Downloads\ByteQuest-Thesis-Manuscript-Compilation.pdf`
  (Chapter 3 is on PDF pages 39–83). Read the sections you align with before changing code.

## Hard rules

1. Never run `supabase db reset`; it wipes pilot data. Use `supabase db push --local`. Migrations
   are additive and safe on existing rows. `supabase/seed.sql` stays idempotent.
2. Do not commit, push or create branches.
3. Read `CLAUDE.md` first. If `graphify` is available, query it before grepping and run
   `graphify update .` after code changes.
4. Reuse what exists. No new dependencies unless a few lines cannot do the job; say why.
5. Never weaken validation, authorization, row-level security, rate limits, AI budgets or error
   handling. Hidden test cases never reach the browser or the AI.
6. Keep existing behaviour unless a part tells you to change it. Update a test only when its
   behaviour was changed on purpose.
7. Classmates only ever see chosen handles; never expose `pseudonym_id`, emails or real names to
   other students.
8. Frontend: use the CSS tokens in `frontend/src/app/globals.css` (no hard-coded colours or font
   sizes); animate only transform, opacity and scale with the existing `--ease-out`, `--dur-*`
   tokens; respect `prefers-reduced-motion`.
9. Gamification rules that must not change: XP only on first success; solve stars are
   informational; signals are derived at read time from append-only logs; timestamps use the app
   clock (`_utcnow`); staged unlock days come from `platform_settings`.
10. The app is reachable from a phone over a private network. Keep `frontend/src/lib/network.ts`:
    service URLs go through `reachableServiceUrl`, and request IDs through `newRequestId` (never
    call `crypto.randomUUID` directly; it fails on plain HTTP). Do not touch the launcher's
    `Test-BlocksLoopbackListener` or the ZeroTier relay scripts.

## Verification

Before changing anything, run these and record the counts as your baseline. Run them again after
every part and report the real numbers.

```
cd backend && .venv/Scripts/python -m pytest -q -p no:cacheprovider
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src
cd frontend && npx vitest run
pwsh -NoProfile -File infra/test-launcher-helpers.ps1
```

Port 3000 serves a production build. To see frontend changes in a browser, rerun
`START-BYTEQUEST.bat`; it rebuilds automatically when the source changes.

## Part 1: AI tutoring (highest priority)

The manuscript (SOP 2, Algorithm 1, ethics section, Figure 12) says the chatbot answers from the
course PDFs and the student's latest test results, and filters out complete code.

**What exists today, so you do not rebuild it:**
- `backend/app/api/chat.py` sends only the conversation and public activity details. Its system
  instruction already forbids full solutions and already treats context as untrusted data. It
  stores no transcript (by design, for privacy); keep it that way.
- Retrieval with page citations already exists in `_retrieve_document_sources` in
  `backend/app/api/rag_instructor.py` (pgvector `<=>` search, `rag_top_k` and
  `rag_similarity_threshold` from `platform_settings`, fallback when vector search fails).
- Every generated activity records `LearningActivity.source_document_id`. Documents have
  `course_id`, `language_tag`, `is_current` and `archived_at`.
- `LearningActivity.reference_solution_code` holds the reference solution.
- AI hints (`reveal_hint` in `backend/app/api/pilot.py`) call `explain_code_error` with the
  student's last failed sample run, refund the hint if Gemini fails, and are stored in
  `HintUse.body` with `source == "ai"`.
- The chat UI already shows a clear message when the provider returns 503.

**Build:**

1. **Shared retrieval service.** Move the retrieval query out of `rag_instructor.py` into a
   service under `backend/app/services/ai_rag/`, and make the instructor draft flow call it
   unchanged. Add a scoped entry point for students:
   - With an activity: search the current version of the activity's `source_document_id`.
   - Without one: search current, non-archived documents whose `course_id` is in the student's
     active courses (`active_membership_course_ids`). Never search another course's documents.
2. **Grounded chat.** For each student message, retrieve passages and add them to the system
   instruction inside the existing "untrusted data" framing. When an activity is given, also add the
   student's latest visible sample-run result for that activity (status and error category only,
   using the existing attempt-visibility rules; never hidden inputs or expected outputs).
   Return `sources: [{document_title, page_number}]` with the reply and show them under the
   assistant message in the chat UI (`frontend/src/components/chat/`). If retrieval finds nothing,
   or the embedding call fails, still answer, and return no sources. Never invent a citation.
3. **Solution filter.** One server-side function that checks every chat reply and AI hint before it
   is returned or stored. Block a reply when it contains code that reproduces the activity's
   `reference_solution_code` (normalised token similarity above a threshold you justify) or a
   complete runnable program for that activity. Replace a blocked reply with a short guidance
   message. Unit tests: a full solution is blocked; a short illustrative snippet passes; plain
   explanation passes; a reply with no activity context is never blocked.
4. **Grounded hints.** Pass the same scoped passages into `explain_code_error` for AI hints.
5. **Quota on failure.** `reserve()` in `backend/app/core/quotas.py` has no release, so a failed
   Gemini call still uses up a student's `student_ai` (3 per hour) or `chat_message` slot. Release
   the reservation when the provider fails, in one shared place.
6. **Evidence for SOP 2.** Chat is not stored, so do not export student chats. Add
   `backend/scripts/evaluate_ai_tutor.py`: it runs a fixed set of about 25 realistic student
   questions (stored in the script) against real published activities through the same chat and
   hint pipeline, and writes a CSV with the question, reply, sources and empty rubric columns:
   grounded in course material, correct, no full solution, helpful. It uses no student data.
7. **Tests:** retrieval never crosses courses, sources are returned, hidden tests never appear in
   any prompt, the filter cases above, the quota release, and the no-passages fallback.

## Part 2: Pilot-data changes (must land before any student data is collected)

1. **Pass mark.** Today the two grading paths disagree:
   - Practice passes only when every test passes (`is_all_passed` in
     `backend/app/services/judge0/client.py`).
   - Exams pass at a weighted 80% (`CHALLENGE_MASTERY_SCORE = 80.0` in
     `backend/app/services/sequencer.py`, used by `backend/app/services/exam_worker.py`).

   The manuscript says a submission passes when its weighted score meets the activity's pass mark.
   Add a nullable `pass_mark_percent` (1–100) to learning activities. NULL keeps today's behaviour
   exactly: 100 for practice and 80 for exams. Decide the pass in one service function used by both
   grading paths. The Judge0 client keeps returning the score; the caller decides the pass.
   Do not change quizzes (`QUIZ_MASTERY_SCORE`) or the sequencer's mastery logic. XP, stars, the
   Codex, badges, the recap and the insights all read `is_successful`, so they need no change; prove
   it with tests. Let instructors set the pass mark where they edit a challenge. Tests: NULL on both
   paths (unchanged), a lower mark, and the exact boundary.
2. **Both model probabilities.** `MLPrediction` already stores `logreg_prob` and `rf_prob`, but
   `_forecast` in `backend/app/api/faculty_ml.py` returns only the selected one. Return both and
   show both on the instructor screen. Keep the selected model's figure primary and the other
   secondary, so the screen does not add a second headline number.
3. **Judge0 network.** Nothing sets network access today. Send `enable_network: false` explicitly
   with every submission in `client.py`, and add a test that checks the request payload.
4. **Research codes (replaces "delete the pseudonym key").** The manuscript says the key linking
   pseudonyms to students is deleted when the study ends. There is no such key:
   `Profile.pseudonym_id` is `stu_<account UUID hex>` (`backend/app/core/security.py`), so anyone
   can turn it back into the account ID, and `ml_pipeline/train_compare.py` accepts it.
   - Add a `research_codes` table (student ID, random code; admin-only access under RLS).
   - Make research and ML exports use that code instead of `pseudonym_id`.
   - Add `backend/scripts/destroy_research_link.py`, admin-only, dry-run by default, deleting that
     table only with an explicit `--confirm` flag. Do not run it.
   - Leave `pseudonym_id` itself unchanged; instructor rosters use it.
5. **ML features: design note only.** The manuscript lists 10 features and predicts per task
   assignment at a cutoff. The code uses 13 features with one row per attempt. This needs the thesis
   adviser's decision, so change no ML code. Write `docs/ml-feature-alignment.md` with:
   - the 10 manuscript features, the current features read from the code, and a mapping;
   - the proposed cutoff ("before the first submission on that task") and label ("the first graded
     submission passes");
   - the files that would change.

## Part 3: Code structure (targeted; behaviour must stay identical)

1. Move the exam page's save and autosave logic from
   `frontend/src/app/(workspace)/exams/[id]/page.tsx` into a hook with its own test.
2. Split `backend/app/api/faculty.py` into modules by task. Keep every route path, response shape
   and permission check; the existing tests prove it.
3. **Materials duplication.** Both `/instructor/materials` (the library) and the Authoring Studio
   (`frontend/src/components/instructor-studio.tsx`) upload, replace, archive, restore and reprocess
   PDFs. Make the library the only place that manages PDFs. Make the Studio only pick a document,
   then generate and review activities, linking back to the library for file actions. Keep them as
   two screens; one combined page would put too many choices on one screen.
4. Leave `globals.css` structure alone; remove only rules you prove are unused.
5. List every other refactor you considered and skipped, and why.

## Part 4: Review and targeted fixes

These were reworked recently and follow the design rules already: tokens and merged colours, the
motion system, the profile header, the leaderboard, solve stars, the dashboard "Your recent progress"
card, and Gamification Insights. Review them, but change them only for a clear defect.

Review every other student, instructor and admin screen. Fix only clear, small defects:
- contrast below WCAG AA, missing labels or focus states;
- touch targets under 44px;
- a missing loading, empty or error state;
- more than one primary (filled) action in a view (Von Restorff, Hick's law);
- horizontal scroll at 375px or 768px.

Write anything larger up instead of changing it, naming the law it breaks (Hick, Fitts, Miller,
Jakob, Von Restorff, proximity, serial position, peak-end, Doherty, Tesler).

Backend, API and security are review-and-report, with fixes only for real defects:
- routes thin, logic in services;
- N+1 queries; transactions around multi-step writes; idempotent retries;
- consistent status codes and error shapes; validation on every input; pagination on lists;
- no field returned that the caller should not see;
- authorization on every route; row-level security on every table; rate and upload limits;
- secrets never logged; prompt-injection framing for every PDF or chat text sent to Gemini.

## Do not

- Deploy, change cloud projects, or touch ZeroTier, CORS origins or network settings.
- Rewrite the manuscript. List mismatches in the report instead.
- Turn gamification features on or off, or change unlock days.

## Final report

Re-read every diff and rerun all verification commands. If you can, open the changed screens in a
browser. Then write `docs/reviews/system-fix-report.md` with:

1. **Changes:** what changed in each part, with file paths.
2. **Tests:** baseline and final pass/fail counts for each command.
3. **Ratings:** out of 10, with one line of reasoning each, for:
   - grading and data integrity;
   - security and privacy;
   - testing;
   - ML pipeline;
   - gamification and student UX;
   - operations;
   - code structure;
   - accessibility;
   - AI tutoring;
   - overall pilot readiness;
   - match with the manuscript.
4. **Still to do:** remaining fixes and improvements, by priority, with effort.
5. **Manuscript mismatches:** each one left, and whether the system or the manuscript should change.
   Include that AI hints send the student's code to Gemini and chat sends what students type.
6. **Gaps:** anything you skipped, could not verify or were unsure about, stated plainly.

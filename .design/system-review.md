# ByteQuest 2.0 — Full system review

**Date:** 2026-11-14.
**Scope:** the whole repo plus the running local stack. It covers code, the live database, measured API and bundle performance, and a hands-on browser pass of the public and onboarding screens.
**Assumed load:** one class block, 30 or fewer students at once, used during lab hours, with a single VPS for the API and Judge0 and Supabase cloud for the database and auth.

## Ratings

| Area | Score | One-line reason |
|---|---:|---|
| Security and privacy | **8.5** | RLS on all 30 tables with zero browser grants, roles read from the database, open-redirect-proof sign-in, budget-capped and enrollment-gated AI |
| Performance and efficiency | **8** | API p95 under 60 ms locally, 30/30 submissions graded in ≤26.5 s; about 60 KB of unused Supabase code on every page |
| Correctness and data integrity | **7.5** | Durable, idempotent grading and a now-correct exam deadline; two publish endpoints still disagree |
| UI and UX | **7.5** | Excellent landing and onboarding, keeps your place after sign-in; mobile Arena, mixed vocabulary, two materials UIs |
| AI and ML | **7.5** | Instructor review gate, Judge0-verified generation, consent-gated data; tutor quality not yet measured |
| Testing | **7** | 119 backend tests on real Postgres plus 68 frontend tests; frontend tests not in CI, no coverage numbers |
| Accessibility | **7** *(provisional)* | Labeled fields, autocomplete, skip links, live regions; no screen-reader or zoom pass yet |
| Architecture and maintainability | **6.5** | Clear layers, but duplicated instructor pipelines, 1.5–1.7k-line files, and about 37% dead CSS |
| Operations and deployment | **6** | Self-healing launcher and restart policies; monitoring shows false failures, Judge0 DB never pruned, restore unrehearsed |
| **Overall: classroom pilot** | **7.5** | Ready for supervised practice. Fix items 1–4 before graded use. |
| **Overall: public 24/7 deployment** | **6.5** | Needs the capacity config, staging and a restore rehearsal |

## Evidence

| Measure | Result |
|---|---|
| Backend tests | 119 passed (real local Postgres, rolled back after each test) |
| Frontend tests | 68 Vitest + 4 recovery checks passed; lint, typecheck and build clean |
| API latency (loopback, 12 calls each) | p50 9–52 ms, p95 ≤57 ms; largest payload 9.3 KB |
| 30-student load (earlier run today) | 30/30 graded, slowest 26.45 s, acceptance p95 0.453 s, exactly 1 attempt per student |
| JavaScript per route (gzip) | 243 KB (landing) to 263 KB (onboarding); the Supabase chunk is 62 KB |
| Reflow | Landing and onboarding: no horizontal scroll at 390 px or 320 px; primary buttons are 48 px tall |
| Database security | 30/30 tables RLS on; 0 grants to `anon`/`authenticated`; 0 functions callable by `anon` |
| Dead CSS | 243 of 930 class selectors are unused anywhere in the app (about 2,350 lines) |

## What this repo does

ByteQuest is a gamified programming course for one university class. Students solve challenges and quizzes, get graded by a sandbox (Judge0) through a job queue, and earn XP. Instructors turn PDFs into AI-drafted challenges that they review, then publish and run timed exams. I assumed about 30 students working at the same time during a lab.

## Must fix

1. **Two "publish" buttons follow different rules** (`backend/app/api/rag_instructor.py:1442` vs `backend/app/api/faculty.py:649`)
   - **What this is:** The Instructor Studio publishes through `/instructor/activities/{id}/publish`. The Activities workspace publishes through `/faculty/activities/{id}/publish`. Both are live in the UI.
   - **Problem:** Only the faculty path archives the older version of a challenge, requires at least one grading test, and checks that the closing time is after the opening time. Publish a new version from the Studio, and the old and new versions both stay live. Students then see the challenge twice, and their attempts split across two IDs.
   - **Fix:** Make the Studio endpoint call the same `_publish_activity` helper (move it into `app/services/`), and delete its own copy of about 50 lines. Add one test: publishing a version through the Studio archives the old one.
   - **If we skip it:** Duplicate quests, plus progress and analytics split across two copies of one challenge.

2. **The production config can't keep up with a C++ class** (`infra/judge0.conf.example:13`, `infra/docker-compose.yml:95-96`)
   - **What this is:** `COUNT` is how many programs Judge0 runs at the same time. The compose file also gives the grading worker its database connections.
   - **Problem:** `COUNT=1` runs one program at a time. The measured Python run finished at 26.5 s, right at the 30 s target, and C++ has to compile first, so it will be slower. The worker gets 2 database connections (`1+1`) but runs 3 jobs at once, so the third job waits, times out, and re-queues.
   - **Fix:** `COUNT=3` on a 4-vCPU VPS, and `DB_POOL_SIZE: "5"` / `DB_MAX_OVERFLOW: "5"` on the worker. Config only. Then re-run `load_test_local_synthetic.py` on a C++ challenge.
   - **If we skip it:** At a "submit now" moment in a C++ lab, the last students wait minutes.

3. **The instructor's "completion" counts failed attempts** (`backend/app/services/workspace_queries.py:266-290`)
   - **What this is:** The class snapshot on the instructor overview.
   - **Problem:** "Completed" counts any activity a student *attempted*, including failures, while the score shown beside it only counts successes. A class where everyone tried and failed shows high completion next to "No graded attempts yet". The two numbers contradict each other on the same screen.
   - **Fix:** Count only `is_successful` attempts (and use the shared learner-visibility clause, as the rest of the app does). Label the number "Mastered". Add a test with a mix of passes, failures and no attempts.
   - **If we skip it:** Instructors make teaching decisions from a number that means something else.

4. **Monitoring says "Failed" while grading is healthy** (`backend/app/services/monitoring.py:63-80`)
   - **What this is:** The admin Overview's grading-service status.
   - **Problem:** It shows "Failed" if any of the last 50 jobs failed and none is running, even when every job since then succeeded. This morning's review saw "Services: Failed" while 30/30 jobs had just completed.
   - **Fix:** Report the newest job's result, the oldest queued age, and the failure rate over the last hour. Give the deliberately disabled ML service its own "Off" status.
   - **If we skip it:** Operators learn to ignore the red light, and then miss the real outage.

## Should fix

5. **Two separate instructor tools for materials** (`frontend/src/components/instructor-studio.tsx`, `backend/app/api/rag_instructor.py` vs `faculty.py` + `services/materials.py`)
   - **What this is:** Instructors can upload a PDF and publish from either "Materials" or "Studio" (`/instructor/materials/studio`, `/admin/teaching/studio`).
   - **Problem:** The two paths run different code. The Studio has its own upload pipeline with a hard-coded 10 MB limit, so the admin's upload-size setting is ignored there. Item 1 is the same drift in the publish path. Instructors also have to guess which tool to use.
   - **Fix:** Keep one pipeline (`services/materials.py`). Point the Studio's upload at it, or fold the Studio's generate step into Materials, then delete the duplicate endpoints.
   - **If we skip it:** Every rule must be written twice, and item 1 will happen again.

6. **Frontend tests don't run in CI** (`.github/workflows/regression.yml:48-54`)
   - **What this is:** CI runs lint, typecheck and build, but not `npm test`.
   - **Problem:** The 68 component tests and the 4 exam-recovery checks, including today's deadline tests, can break without anyone noticing.
   - **Fix:** Add `- run: npm test` after typecheck. One line.
   - **If we skip it:** The exam-deadline protection can quietly regress.

7. **Exam grading has no claim lease** (`backend/app/services/exam_worker.py:49-63`)
   - **What this is:** How the worker picks an exam attempt to grade.
   - **Problem:** A claimed attempt stays claimable while its status is `grading`. With two worker processes, both grade the same exam and call Judge0 twice. The final write is guarded, so grades aren't duplicated, but the work is.
   - **Fix:** Keep exactly one worker (as compose does now) until claims get an owner and expiry time.
   - **If we skip it:** Scaling the workers wastes Judge0 capacity at exam time.

8. **Judge0's own database grows forever** (no cleanup anywhere in `infra/` or `backend/`)
   - **What this is:** Judge0 stores every run in its own Postgres. ByteQuest keeps results in `activity_attempts` and never reads Judge0's copy.
   - **Problem:** Nothing deletes old runs. Running 24/7 for months, it fills the disk and takes Postgres down.
   - **Fix:** A monthly cron: `DELETE FROM submissions WHERE created_at < now() - interval '60 days'` in `judge0-db`.
   - **If we skip it:** A slow-motion outage, months after deployment.

9. **About 2,350 lines of unused CSS** (`frontend/src/app/globals.css`, 6,335 lines)
   - **What this is:** One global stylesheet for the whole app.
   - **Problem:** 243 of its 930 class names appear nowhere in the app, such as `site-header`, `main-nav` and `recommendation-card` (left over from the layout before the workspace redesign). Every visitor downloads them, and every future CSS change has to step around them.
   - **Fix:** Delete the rules whose selectors are all unused, then check the main screens in the browser.
   - **If we skip it:** Slower styling work and a larger CSS download.

10. **Every page ships the whole Supabase client, but only Auth is used** (`frontend/src/lib/supabase.ts:3`)
    - **What this is:** The browser library for sign-in.
    - **Problem:** `@supabase/supabase-js` bundles Realtime, PostgREST, Storage and Functions too, 62 KB gzipped on every page including the public landing page. The app makes 19 `.auth` calls and no other calls through it.
    - **Fix:** Import `GoTrueClient` from `@supabase/auth-js` (already installed as a sub-package) instead of `createClient`, then measure the landing page again.
    - **If we skip it:** A slower first visit on campus Wi-Fi, for nothing.

11. **The exam page mixes the save engine with the screen** (`frontend/src/app/(workspace)/exams/[id]/page.tsx`, 1,724 lines)
    - **What this is:** One component holds the autosave queue, the conflict logic, offline backups, the countdown, and all of the UI.
    - **Problem:** The deadline bug fixed today lived in how these parts interact. To test it, you have to render the whole page and wait in real time (4–6 s per test).
    - **Fix:** Move the save and deadline logic into a `useExamAutosave` hook, and test it on its own with fake timers.
    - **If we skip it:** The riskiest screen stays the hardest to change safely.

12. **On phones, the Arena editor starts below the fold** (`frontend/src/app/globals.css:6303`; measured in this morning's review)
    - **What this is:** The coding screen at 320 px wide.
    - **Problem:** The sticky header takes about 223 px, so the editor starts around 919 px down, and students scroll before they can type.
    - **Fix:** A compact header on narrow screens, with a Problem / Editor / Results switch. Keep Run sample and Submit separate.
    - **If we skip it:** Phone users, often the ones without laptops, get the worst coding experience.

13. **Passwords can be 6 characters** (`supabase/config.toml:177`)
    - **What this is:** The minimum password length for every account, including staff.
    - **Problem:** NIST guidance (SP 800-63B) is at least 8. Email confirmation is also off in this config.
    - **Fix:** Set the minimum to 8 here and in the production Supabase dashboard, turn on email confirmation there, and update the hint text on the sign-up form.
    - **If we skip it:** Staff accounts that can see every student's work are easier to guess.

## Nice to have

14. **Workshop list: 2 extra queries per workshop** (`backend/app/api/quest_groups.py:84`): batch the member counts and activity IDs into two queries total. It doesn't matter at a few workshops; it will as content grows.
15. **The dashboard repeats the navigation and says "Quest groups"** (`frontend/src/app/(workspace)/dashboard/page.tsx:38`), while the rest of the app says "Workshops". Use one word, and lead with Continue quest, deadlines and recent feedback.
16. **Sign-up copy** (`frontend/src/app/onboarding/page.tsx:474, 619`): the heading reads "Please create your ByteQuest account" (try "Create your account"), and the sign-up form shows "Forgot password?", which belongs on sign-in.
17. **The landing preview tells phone users to use arrow keys and a scroll wheel** (`frontend/src/components/featured-quest-window.tsx`). Hide that hint on touch screens and raise the 10–11 px labels to 12 px.

Smaller items left out: 3 (minor copy and spacing).

## Already strong (checked, not assumed)

- **Security:** RLS on every table with zero browser grants. Roles come from the database, never the token. Deactivation is enforced on every request. JWTs are verified locally through JWKS with an explicit algorithm list. AI is gated to enrolled students and runs on separate per-role budgets. Admins can only be granted, not self-registered. Frame-blocking headers are set, and uploads are checked by their real file type.
- **Sign-in return path:** it keeps your place, and `internalPath` blocks `//`, backslashes, control characters, encoded slashes and other origins, then allows only paths your role can open.
- **Grading:** a durable job queue with idempotency keys, an append-only attempts table, hidden test cases that never reach the browser, Judge0 failures retried instead of graded (G05), and one server-owned exam cutoff (BQ-01).
- **Landing and onboarding:** clear hierarchy, one primary action, full-width 48 px buttons on phones, no horizontal scroll at 320 px, labeled fields with `autocomplete`, and a skip link.

## Verdict

Healthy for a supervised practice pilot. Fix **1** (duplicate publish) and **3** (completion metric) before instructors rely on the dashboards, and **2** before a C++ class or a 24/7 deployment.

**Lean:** about −2,400 lines possible (dead CSS and the duplicate publish path), 0 dependencies added.

## Not checked

- **Signed-in screens in the browser.** The permission system blocked creating synthetic accounts, so the student, instructor and admin UI findings (items 12, 15) come from source code and this morning's walkthrough.
- A full timed exam in the browser, and screen-reader, zoom and contrast testing.
- Production: Supabase dashboard settings, database login privileges, Linux staging, WAN latency, a restore rehearsal, and C++ load.
- Test coverage percentage (no coverage tool is installed).
- Tutor answer quality and ML model validity.

# ByteQuest — Security & AI-Abuse Hardening (implementation brief)

You are a senior backend and security engineer working in the ByteQuest 2.0 repository: an undergraduate thesis project, a gamified programming-learning platform used by one NEMSU class block of at most 30 students. Implement the six tasks below exactly, verify each one, and report.

A review has already been done, and its findings were checked against the code and the live local database. **Do not re-audit the system.** Read only the code each task touches.

## Stack

- **Backend:** FastAPI + SQLAlchemy, Python 3.11, in `backend/` (venv at `backend/.venv`). Auth is Supabase JWT, in `backend/app/core/security.py`. Quotas are Postgres-backed, in `backend/app/core/quotas.py`.
- **Frontend:** Next.js 16 App Router + React 19 + TypeScript, in `frontend/`.
- **Database:** Supabase Postgres. Migrations are in `supabase/migrations/` (latest: `20261114100000_student_track_setup_completion.sql`). Local DB container: `supabase_db_bytequest-local`.
- **LLM:** Gemini `gemini-3.5-flash-lite`. Students use it for the chat tutor and AI hints; instructors use it for challenge generation.
- **Machine:** Windows, PowerShell 7.

## Rules for every task

1. The working tree has many uncommitted changes from earlier work. Do not revert, reformat or "clean up" any file or hunk a task doesn't need. Do not commit or push.
2. Make the smallest complete change. Reuse the helpers named below. Add no new dependencies, abstractions, config options or services. Keep each file's existing style and layering.
3. Never edit an existing migration. Add a new one.
4. Every behaviour change gets a regression test that fails without the fix. For tasks 1, 2, 3 and 5, prove it: temporarily revert your change, run the test and watch it fail, then restore.
5. Keep errors in the existing shape: `HTTPException(status_code, detail={"code": "...", "message": "..."})`. The frontend reads `detail.code` into `ApiError.code` (`frontend/src/lib/api.ts`).
6. If something in this brief contradicts the code you find, stop that task, explain the contradiction in your report, and carry on with the others. Do not guess.

## Verified facts (do not re-investigate)

- All 30 public tables have RLS on. `anon` and `authenticated` hold no table grants and no function EXECUTE grants. All admin and faculty routes check the user's role and limit them to their courses. **Do not change RLS, grants or route authorization.**
- Only admins create course enrollments (`CourseMember` with `member_role="student"`, `status="active"`, in `backend/app/api/admin.py`). Students cannot enroll themselves.
- Signup is open, and every new Supabase user gets a student profile automatically (`get_current_user`).
- PyJWT 2.15.1 (which includes `jwt.PyJWKClient`) and cryptography 50.0.2 are installed. No new packages are needed.
- Monaco loads from the self-hosted path `/monaco/vs`. The app contains no `<iframe>`.
- Baseline: backend `pytest -q` gives **95 passed**.

---

## Task 1 — Only enrolled students can use the AI chat tutor

**Problem.** `POST /api/v1/chat/messages` (`backend/app/api/chat.py`, `create_chat_message`) only requires a login. Anyone can sign up, with no school email and no confirmation, then use the tutor and help use up the shared daily budget.

**Change.**
- In `create_chat_message`, add a check before `db.rollback()`, `reserve("chat_message", ...)` and any provider call. If `current_user.role == UserRole.student` and `active_membership_course_ids(db, current_user.id, "student")` (from `app/services/course_access.py`) is empty, raise 403 with `detail={"code": "enrollment_required", "message": "The learning assistant is available once your instructor adds you to a class block."}`. Instructors and admins are not affected.
- In the frontend, update `mapChatError` in `frontend/src/components/chat/chat-provider.tsx`: when a 403 has `error.code === "enrollment_required"`, show that message and make it non-retryable. Keep the generic 403 message for other codes.

**Tests.** Put backend tests in `backend/tests/test_api_security.py`, following its existing chat test patterns. For the frontend, add a Vitest test next to chat-provider, or extend an existing one.
- An unenrolled student gets 403 `enrollment_required`. The Gemini boundary (`_generate_chat_reply`) is never called, and no `api_rate_counters` row is used.
- An enrolled student gets 200.
- An instructor with no course membership is still allowed.
- The frontend maps `enrollment_required` to the new message.

## Task 2 — Fair, separate AI budgets

**Problem.** These are the two defects in `POLICIES` (`backend/app/core/quotas.py`):
- `chat_message` allows 100 a day per account but only 300 a day in total, so three users can turn the tutor off for the whole class.
- `student_ai` and `instructor_ai` share one global bucket, `gemini_generation` (100 a day). Students using AI hints (up to 10 a day each) can lock instructors out of challenge generation until Manila midnight.

**Change.** Edit `POLICIES` only:

```python
"student_ai": (
    Rule("student_ai", "account", "hour", 3),
    Rule("student_ai", "account", "day", 10),
    Rule("student_generation", "global", "day", 300),
),
"chat_message": (
    Rule("chat_message", "account", "minute", 10),
    Rule("chat_message", "account", "day", 40),
    Rule("chat_generation", "global", "day", 1200),
),
"instructor_ai": (
    Rule("instructor_ai", "account", "hour", 2),
    Rule("instructor_ai", "account", "day", 8),
    Rule("instructor_generation", "global", "day", 100),
),
```

Add a one-line comment stating the rule: global cap = class size (30) × the per-student daily cap, so one user can't starve the class. Counters are keyed by bucket name and expire by themselves, so no migration is needed.

**Tests.**
- Some existing tests assert the old numbers or the `gemini_generation` bucket: `test_global_ai_cap_rejects_without_spending_account_buckets`, `test_chat_has_dedicated_account_and_global_quota`, and anything else `grep -rn "gemini_generation" backend/` finds. Update their expectations to the new policy. Do not delete them.
- Add a test that using up `student_ai`'s global bucket does not block `reserve("instructor_ai", ...)`, and the reverse.
- When done, `grep -rn "gemini_generation" backend/app` returns nothing.

## Task 3 — Verify Supabase's asymmetric JWTs locally (performance)

**Problem.** `get_current_user_payload` (`backend/app/core/security.py`) only verifies tokens locally with HS256, and only when `SUPABASE_JWT_SECRET` is set. The production template (`infra/backend.prod.env.example`) leaves that secret blank, and newer Supabase projects sign tokens with asymmetric keys anyway. So every API request, including the job-status polls every 2 seconds, makes an extra HTTPS call to `/auth/v1/user`. That adds roughly 100–300 ms per request from the VPS.

**Change.** Keep the existing order, and add one new step between the current two:
1. HS256 with the secret. Unchanged.
2. **New:** if the token header's `alg` is `ES256` or `RS256` and the header has a `kid`, verify the token with Supabase's JWKS at `f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"`.
   - Use one module-level `jwt.PyJWKClient(url, cache_keys=True, lifespan=600, timeout=settings.SUPABASE_AUTH_TIMEOUT_SECONDS)`, created the first time it's needed.
   - Decode with `algorithms=["ES256", "RS256"]`. This list must be explicit: never take the algorithm from the token header. Also pass `audience="authenticated"` and `options={"require": ["exp", "sub"]}`.
   - `PyJWKClient` fetches synchronously, so call `get_signing_key_from_jwt` through `await asyncio.to_thread(...)`. The event loop must never block.
3. The `/auth/v1/user` network fallback. Unchanged.

Also:
- Any JWKS failure (`jwt.PyJWKClientError`, a network error, an invalid signature, an expired token) falls through to step 3, the same way the HS256 branch does today. Auth must never return 500.
- Keep returning `TokenPayload` exactly as today. Authorization still comes from `Profile.role` in the database. Do not start trusting the token's `role` claim.
- Update the comment beside `SUPABASE_JWT_SECRET=` in `infra/backend.prod.env.example`: the secret is only needed for legacy HS256 projects, and asymmetric projects verify through JWKS automatically.

**Tests.** Create `backend/tests/test_auth_jwks.py`. Generate an EC P-256 key with `cryptography`, and monkeypatch the module's JWKS client so no real network call is made.
- A valid ES256 token is accepted, and the `/auth/v1/user` fallback is **not** called. Assert this.
- An expired token, a wrong `aud`, and a token signed by a different key are not accepted locally. They fall through, and with the fallback stubbed to fail, the result is 401.
- `alg: none`, and an HS256 token forged using the public key as the secret, are both rejected.
- The existing HS256 path still works.

## Task 4 — Administrators can never self-register

**Problem.** The signup trigger `bytequest_private.create_student_profile_on_signup()` (latest definition in `supabase/migrations/20261114075043_local_staff_registration.sql`) reads `registration_role` from `raw_user_meta_data`, which the browser supplies. It accepts `admin` whenever `bytequest_private.local_staff_registration` has an enabled row. Only `supabase/seed.sql` inserts that row. `supabase db push` doesn't run the seed, but `supabase db reset --linked` does. One wrong command against the cloud project, and anyone can become an administrator from the public signup page.

**Change.**
- **Migration.** Create `supabase/migrations/20261114120000_admin_registration_by_grant_only.sql`. It runs `CREATE OR REPLACE` on the same function, copied exactly from the latest definition, with one change: `admin` is always rejected with `RAISE EXCEPTION 'Administrator accounts are granted, not registered' USING ERRCODE = '22023'`. `student` stays allowed. `instructor` stays allowed only when the local flag is enabled. Keep `SECURITY DEFINER`, `SET search_path = ''` and every other check unchanged.
- **Local admin script.** In `infra/grant-local-instructor.ps1`, add a `-Role` parameter (`ValidateSet('instructor','admin')`, default `instructor`). A local admin is then created by promoting a student who has already signed up. Keep the script's hard-wired local container name, so it can never reach production. Keep it idempotent, with its existing output and error handling.
- **Onboarding page.** In `frontend/src/app/onboarding/page.tsx`, the **Administrator** button always goes to the `admin-info` screen, even when `NEXT_PUBLIC_LOCAL_STAFF_REGISTRATION === "true"`. Add one line on that screen telling local operators to run `infra/grant-local-instructor.ps1 -Role admin`. Remove `"admin"` from the role type in `frontend/src/lib/student-signup.ts`. Update `frontend/src/app/onboarding/page.test.tsx`.
- **Docs.** Find every doc that tells someone to self-register a local admin (`grep -rni "administrator" docs/ README.md`) and point it to the script instead. Add one warning line to `docs/PHASE7_DEPLOYMENT_READINESS.md`: never run `supabase db reset --linked`, because it runs `seed.sql` on production.

**Acceptance.**
- Apply the migration locally with `supabase migration up`. In the local DB container, inside a transaction you then roll back:
  - Insert an `auth.users` row whose `raw_user_meta_data` has `registration_role: "admin"`. It raises the new error.
  - `instructor` with the flag enabled succeeds.
  - `student` succeeds.

  Put the exact SQL you ran, and its output, in your report.
- The frontend tests pass.

## Task 5 — Chat activity context uses the shared visibility rule

**Problem.** `_safe_public_activity_context` (`backend/app/api/chat.py`) loads the activity with `db.get` and only checks `review_status` and language. Every other student path uses `student_visible_activity_clause` (in `backend/app/services/attempt_visibility.py`), which checks that the activity is not archived, has already opened, and belongs to the student's course. So a student who has the ID of an unopened, archived or other-block challenge can get its problem statement and starter code through the tutor.

**Change.** For students, load the activity with `db.query(LearningActivity).filter(LearningActivity.id == activity_id, student_visible_activity_clause(current_user.id)).first()`. Keep the existing `published` and language checks and the same 404 message. Leave instructors and admins as they are. The context check must still run before `reserve()`, so a refused request uses no quota.

**Tests.**
- A student asking about an unopened activity, an archived one and one from another course gets 404 each time. Gemini is not called and no quota is used.
- For a visible activity, the context is still included.

## Task 6 — Frontend security headers

**Problem.** `frontend/next.config.ts` sends no security headers. The API's Caddy edge already does.

**Change.** Add `async headers()` for `source: "/:path*"` with:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: frame-ancestors 'none'`. Only this one directive: a full CSP is out of scope, because Next.js inline scripts and Monaco workers need careful tuning.
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000`, only when `process.env.NODE_ENV === "production"`.

Keep the existing `redirects()` unchanged.

**Acceptance.** `npm run build` succeeds. With `npm run start`, `curl -sI http://127.0.0.1:3000/` shows the headers. The Arena page (Monaco editor) still loads and runs code.

---

## Out of scope: do not do these

- No Redis or other rate-limit infrastructure, and no moving quota values into config.
- No server-side chat transcripts. Chat history comes from the browser, and that is an accepted limitation.
- No changes to RLS, grants, admin/faculty authorization, Judge0, grading or the ML pipeline.
- No full CSP.
- No Gemini billing or Supabase dashboard changes. A human does those.
- No dependency upgrades or lockfile changes.

## Order and verification

Work in this order: **2 → 1 → 5 → 3 → 4 → 6**. After each task, run its focused tests. At the end, run this from the repo root:

```powershell
cd backend; .\.venv\Scripts\python.exe -m pytest -q; cd ..
cd frontend; npm run lint; npm run typecheck; npm test; npm run build; cd ..
```

The backend must finish at 95 tests plus your new ones, all passing. List every existing test you changed, with the reason.

## Final report (keep it short)

For each task, give:
- done or blocked
- the files changed
- the test that proves it, and confirmation that it failed before the fix
- anything that differed from this brief

Then give the full test totals, and a **"Human must do"** list containing exactly these:
1. Enable Gemini API billing and set a budget alert. On the free tier, Google may use prompts (students' code) to improve its products.
2. In the production Supabase dashboard, turn on email confirmation.
3. Never run `supabase db reset --linked`.
4. Restart the API and the grading worker after deploying.

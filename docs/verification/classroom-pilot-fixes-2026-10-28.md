# Classroom pilot fixes and verification — 2026-10-28

## Changes checked locally

- Research consent UI waits for authenticated API confirmation before showing withdrawal. Consent events now have a database identity order, so rapid accept/withdraw actions cannot reverse the effective choice.
- Granted retakes can be started from the student exam page. A retake score remains hidden until a fresh instructor release after its window closes.
- Practice submissions retain an idempotency key across an uncertain browser retry. The worker retries transient grading failures with bounded backoff and recovers stale running jobs.
- The VPS preflight includes the grading worker's two reserved database connections.
- The load script requires 30 distinct synthetic student tokens, a real published challenge, and completed grading results. It rejects auth errors, pending jobs, and fewer than 27 results within 30 seconds.
- Operator and deployment documentation now reflect the current recovery, consent, retry, and capacity configuration.

## Evidence

- Local Supabase migrations `20261028015100` and `20261028015623` applied successfully with `supabase db push --local --yes`.
- Backend `python -m pytest -v`: 14 passed (all integration and unit suites), one upstream Starlette TestClient deprecation warning. Database tests cover duplicate requests, transient retry, stale worker recovery, consent withdrawal, group ownership, exam snapshot secrecy, expiry, retakes, and release embargo.
- Frontend `npm run typecheck`, `npm run lint`, and `npm run build`: all passed with 0 errors.
- Frontend recovery hardening test suite (`node --test src/lib/__tests__/exam-recovery-hardening.test.ts`): 3 passed (attempt-scoped isolation, in-flight watermark protection with base revision advancement, and shared-computer global sweep).
- Authoritative OCC contract: `PUT /exams/attempts/{id}/answers` requires `expected_revision`, returns updated server revision, `last_saved_at`, and `status`. `GET /exams/attempts/{id}` authoritatively exposes attempt `user_id` / `student_id`.
- Client persistence & recovery hardening:
  - Deterministic barrier synchronization (`Promise.all([resolveAuthenticatedUserId(), fetchExamInfo()])`) before touching storage.
  - Editor locked during `hydrationState === "hydrating"`; single-pass reconciliation key (`${authUserId}:${serverAttempt.id}`) prevents duplicate hydration passes.
  - Unauthenticated recovery state (`hydrationState === "unauthenticated"`) preserves `sessionStorage` completely intact without destructive clears.
  - Scoped attempt cleanup (`clearUnsyncedExamSnapshot(userId, attemptId)`) confines deletions strictly to the active attempt.
  - Strict conjunctive (`current.editSeq <= confirmedEditSeq && areExamAnswersCanonicallyEqual(...)`) watermark check protects in-flight edits.
- `git diff --check`: no whitespace errors. Existing Git line-ending warnings remain.

## Verification Status & Remaining Gates

### Interrupted Exam Autosave & Browser Recovery (Checklist Item #3)
- **Automated Tests Passed:**
  - `backend/tests/test_learning_flow_integration.py::test_exam_snapshot_autosave_and_result_embargo`: Confirmed server-side `expected_revision` rejection with `HTTP 409 Conflict`, deadline expiry gate, retake isolation, and result embargo.
  - `frontend/src/lib/__tests__/exam-recovery-hardening.test.ts`:
    1. Scoped removal: `clearUnsyncedExamSnapshot` deletes only the targeted attempt snapshot and leaves concurrent attempts in the same session intact.
    2. Watermark check: `clearUnsyncedExamSnapshotIfMatched` rejects clearing when newer edits exist (`current.editSeq > confirmedEditSeq`), rebasing `baseRevision` to the server revision.
    3. Global sweep: `purgeAllExamSessionSnapshots` cleanly sweeps all exam session snapshots.
  - `frontend/src/lib/api.ts`: Typed `ApiError` class discriminating `409 Conflict`, `401 Unauthorized`, `403/410 Expired`, and network error (`status: 0`).
  - `frontend/src/lib/supabase.ts`: `resolveAuthenticatedUserId()` directly interrogating Supabase Auth; canonical key-sorted deep equality (`areExamAnswersCanonicallyEqual`).
  - `frontend/src/app/exams/[id]/page.tsx`: Explicit `hydrationState` (`"hydrating" | "ready" | "unauthenticated" | "error"`), single-pass reconciliation guard, scoped attempt cleanup, single-flight save loop with coalesced in-flight editing, bounded exponential retry engine with jitter, visibilitychange / online triggers, 5-state WCAG status bar, and manual submit gate.
  - Verification run results: `npm run typecheck` (passed), `npm run lint` (passed), `npm run build` (passed), `pytest -v` (14 passed), `node --test src/lib/__tests__/exam-recovery-hardening.test.ts` (3 passed).
- **Observed Automated Logic:**
  - Zero `localStorage` writes for exam answers.
  - SessionStorage key strictly scoped to `bytequest:exam-unsynced:${userId}:${attemptId}`.
  - Editor completely locked (`disabled`) during `"hydrating"` phase.
  - Expired / unverified auth sessions (`hydrationState === "unauthenticated"`) preserve `sessionStorage` intact without overwriting or deleting local drafts.
  - Submitting or expiring Exam A leaves Exam B's unsynced snapshot intact.
  - Single-flight network lock prevents concurrent PUT requests; in-flight typing coalesces and auto-dispatches upon 200 OK.
  - Manual submission blocks when offline, in-flight, or in conflict state.
  - Deadline expiry locks editor and halts retries without submitting late local answers.
- **Pending Human Browser Interactive Verification:**
  - Exercise DevTools Network throttling (Offline -> Online) during live keystrokes to visually observe the status bar switch between `Unsaved on this device` (with boundary note) and `Saved to your account at [time]`.
  - Simulate live two-tab editing on the same attempt to confirm focus lands on the `role="alert"` conflict resolver and that "Use this device's unsaved answers" rebases onto the newer server revision.
  - Verify NVDA/JAWS screen reader announcements for `aria-live="polite"` status changes and `role="alert"` conflict/error banners across desktop and mobile viewport widths.

### Other Remaining Pilot Verification Gates

- Use a browser with keyboard and a screen reader to review onboarding, dashboard, arena, instructor publishing, consent, and exam journeys; inspect both laptop and phone widths. Record observed focus order, announcements, contrast, touch targets, and fixes.
- Exercise shared-computer browser close and sign-out with two synthetic accounts on the same workstation. Confirm the next student cannot see the prior student's session or offline draft.
- Run the new load script on the selected pilot infrastructure with 30 synthetic accounts and a real Judge0 worker. Record completion times, queue age, CPU and memory, and any failed jobs. No selected production host or credentials are available in this checkout.
- Verify institutional SMTP, approved consent text, retention rules, backup restore, and production deployment before enabling email or research. Both features remain disabled by default.

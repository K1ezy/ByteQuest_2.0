# ByteQuest 2.0 Classroom Pilot Operator Runbook

This runbook guides lab administrators, instructors, and engineers through operating and verifying the ByteQuest 2.0 Classroom Pilot for a cohort of 30 concurrent students.

---

## 1. Hard Safety Gates (Enforced by Configuration)

Before launching any classroom session, verify the following safety gates:

| Gate | Configuration Setting | Expected Production Value | Purpose / Constraint |
| :--- | :--- | :--- | :--- |
| **Research Telemetry** | `ML_SHADOW_ENABLED`, `ML_SHADOW_RESEARCH_APPROVED`, `RESEARCH_CONSENT_ACTIVE` | `false` | Keep shadow scoring and research collection off until institutional approval, approved consent text, and data-handling rules are supplied. The withdrawal page must confirm a server response before reporting success. |
| **Outbound Email** | `EMAIL_ENABLED`, `OUTBOUND_EMAIL_ENABLED`, institutional SMTP | `false` | No external SMTP emails are dispatched. Supabase Auth password recovery needs separately configured institutional email delivery before it is usable in production. |
| **Hidden Answer Protection** | Serializer / Worker Gates | Automatic | Never serialize hidden test cases, expected outputs, or reference solutions to student endpoints (`pilot.py`, `submissions.py`, `exams.py`). Exam scores and breakdowns remain strictly embargoed until released by the instructor (`results_released = True`). |

The local quota and access matrix is recorded in [Local API security](LOCAL_API_SECURITY.md). The pilot uses Postgres counters shared by API workers; a 429 response includes `Retry-After` so students can wait without losing saved drafts. This does not configure a hosted Supabase project.
The local synthetic load runner can create and clean up 30 test accounts without a token file; see the security contract for its command. Keep `SUBMISSION_WORKER_CONCURRENCY=3` within the selected database and Judge0 limits.

---

## 2. Lab Station & Shared-Computer Protocol

Classroom computer labs frequently have students rotating across shared workstations.

### Student Sign-Out Procedure
When a student finishes a session:
1. Clicking **Sign Out** triggers `signOutSharedComputer()` in `frontend/src/lib/supabase.ts`.
2. This invokes `supabase.auth.signOut({ scope: 'local' })`.
3. All local drafts, autosaved code fragments, exam snapshots, and session tokens matching `bytequest:*`, `draft:*`, `exam:*`, and `sb-*` are purged from both `localStorage` and `sessionStorage`.
4. The workstation client is cleanly redirected to `/onboarding`.

---

## 3. Network Resilience & Live Draft Sync

### Classroom Wi-Fi Reconnect Banner
- If network connectivity drops, an assertive status banner appears: *"Connection lost — your code is being saved safely on this device and will sync automatically when reconnected."*
- Synced Draft Status Pill states:
  - `Syncing draft...` (in-flight network request)
  - `Draft synced at HH:MM:SS` (persisted on server)
  - `Saved locally (waiting for network)` (offline safe mode)
- On network restoration (`window.addEventListener('online')`), local drafts are automatically flushed to the server.

### Idempotent Submissions & Double-Click Protection
- The browser retains an idempotency key in session storage until the server acknowledges the job. The API also deduplicates identical work submitted within 15 seconds.
- Submissions queue into `submission_jobs`. A worker retries transient failures with bounded backoff, up to `SUBMISSION_MAX_RETRIES`; stale running jobs are recovered after 120 seconds.
- Open **Admin → Monitoring** to check the **ByteQuest grading worker**, **Judge0 sandbox**, and **Submission queue** separately. The worker writes a heartbeat every 15 seconds. A heartbeat older than 60 seconds is stale. The Judge0 check runs a small Python program and shares its result across Admin Overview and Monitoring for 15 seconds. Refresh after that interval to recheck it.
- Students can leave the results page and return to the same submission. If automatic retries are exhausted, **Retry grading** uses the original code and acceptance time, including after the challenge closes. If Judge0 is waiting through a cooldown, the worker schedules the next attempt after it ends.

---

## 4. Timed Exam Operations

### Instructor Workflow (`/instructor/exams`)
1. **Creation & Freeze:** Select reviewed activities and specify Manila time (`Asia/Manila`) window. Publishing freezes immutable snapshots (`snapshot_json`) on all `exam_items`. Mid-exam activity edits do not corrupt active student attempts.
2. **Retake Grants:** Instructors can grant individual student retakes (`allowed_attempts`) and custom retake windows for students who experienced verified technical issues.
3. **Score Release:** After the exam window closes and grading finishes, choose **Release results**. Students receive their score and points for each item. Exam answer keys, reference code, and hidden cases remain private. Instructors can use **Results and retakes** to review each attempt’s score, release state, and exam XP.
4. **Retake Release:** After the retake closes and grading finishes, use **Refresh exams** if the page was already open. Select **Release results** again to release the retake. The original score stays visible, and first-pass XP is awarded only once per activity.

### Student Exam Mode (`/exams/[id]`)
- Synchronized countdown timer driven by server time offset (`server_now`).
- 5-second debounced autosaves continuously persist answers.
- `visibilitychange` listener immediately flushes in-memory drafts when a student tabs away or minimizes the browser.
- The background worker marks expired attempts for grading after the final autosave grace period.
- ByteQuest pauses student chat and practice hints during timed exams and retakes. Help resumes after submission or at the server's answer-saving cutoff, with the student's practice hints still available.

---

## 5. Verification Commands

Run these verification suites before every pilot session:

```bash
# 1. Frontend validation (TypeScript typecheck + ESLint)
cd frontend
npm run typecheck
npm run lint
npm run build

# 2. Backend test suite (13 unit & flow integration tests)
cd backend
python -m pytest -v

# 3. Authenticated 30-student load test (requires 30 synthetic accounts)
export BYTEQUEST_STUDENT_TOKENS_FILE=/secure/path/tokens.json
export BYTEQUEST_ACTIVITY_ID=<published-challenge-uuid>
export BYTEQUEST_SOURCE_FILE=/secure/path/passing-solution.py
python tests/load_test_pilot.py
```

---

## 6. Incident Troubleshooting

| Symptom | Cause | Remedy |
| :--- | :--- | :--- |
| Student sees `409 Exam is not currently open` | Exam window is closed or retake window has not opened | Check the schedule in the instructor console; server time is authoritative. |
| Submission stuck in `queued` or `running` | ByteQuest worker unavailable, Judge0 unavailable, or grading delayed | Check **Admin → Monitoring**. Restart the ByteQuest worker if its heartbeat is stale. Check the sandbox service and queue if the Judge0 test fails. Stale running jobs are eligible for recovery after 120 seconds. |
| Student cannot reset password | Supabase Auth email delivery is not configured | Configure institutional SMTP and approved redirect URLs before enabling email recovery; use an authorized Supabase admin process for urgent account recovery. |

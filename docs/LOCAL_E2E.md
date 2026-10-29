# ByteQuest local end-to-end flow

This setup uses local Supabase and the private Ubuntu VM on D: running Judge0 Extra CE 1.13.1. It writes local Supabase settings to ignored `backend/.env.local` and `frontend/.env.local`; frontend configuration contains only the local Supabase anon key. The setup preserves the configured Judge0 URL/token and optional backend AI key. It does not write to the configured cloud database or start a second local Judge0 stack.

`infra/docker-compose.yml` is a later VPS template and requires the explicit `vps` profile. It is not part of this local setup.

## Start local services

### One-click Windows startup

From the repository root, double-click `START-BYTEQUEST.bat`. It starts Docker Desktop if needed and starts the `ByteQuest-Judge0-Install` Hyper-V VM while Docker initializes. Once Docker is ready, local Supabase initializes while Ubuntu continues booting. The Next.js frontend then starts while the launcher discovers the VM's current IP and checks Judge0. It updates the ignored local Judge0 endpoint, starts FastAPI and waits for the frontend to respond, then opens the sign-in screen. Each BAT launch creates a unique startup marker and signs out the current local browser session, so the app lands on authentication even when that browser was previously signed in. The account, database records, and sessions on other devices are not deleted. Sign-in is selected by default; the same screen lets you switch to account creation. Startup step headings include elapsed time so a slow cold-start stage is visible.

The launcher does not reset the local database, delete virtual disks, or modify VM checkpoints. It requests Windows administrator access before starting services because this machine requires elevated Hyper-V permissions both to manage the VM and read its guest IP. Approve the UAC prompt; if it was canceled, rerun the batch file and approve it. The launcher first checks Hyper-V's reported guest IP, then the Windows neighbor table using the VM NIC's MAC address. If neither has an address after 45 seconds, it pauses with clear instructions instead of waiting indefinitely: in the VM Connection window, sign in to Ubuntu and run `ip -4 -brief addr show eth0`, then enter the IPv4 address before `/` in the launcher window. Press Enter at that prompt to retry automatic discovery, or type `Q` to stop. If Judge0 needs to be started inside Ubuntu, the launcher opens an SSH session in its console; accept the VM host key if asked, then enter the Ubuntu password at the prompts. The password and Judge0 token are not written to the launcher or displayed. If Ubuntu is still booting or has no address, resolve that in the VM console before entering an IP. The launcher starts the separate grading worker after FastAPI becomes healthy and reuses it on later launches. Worker errors are written to `logs/submission-worker.err.log`.

Keep Docker Desktop and the Judge0 VM running while using ByteQuest. The VM Connection console window can be closed after Ubuntu has booted; it is only a display for the VM. FastAPI and Next.js each have a separate PowerShell window with logs; leave both open and press Ctrl+C in each to stop those development servers. The grading worker runs in the background and is reused on the next launch. Supabase runs in Docker and can be stopped later with `supabase stop` from the repository root.

The batch file requires PowerShell 7, Node.js 20.9 or newer with npm, the Supabase CLI, Docker Desktop, the backend virtual environment, and the installed frontend dependencies. It does not install missing prerequisites. If it reports an existing server has an outdated endpoint, stop that server window with Ctrl+C and run the batch file again. If it reports port 3000 is occupied, stop the process you recognize (usually an older Next.js terminal) and run the batch file again.

### Manual startup

1. Start Docker Desktop and wait for the engine to become ready.
2. From the repository root, run `powershell -ExecutionPolicy Bypass -File .\infra\start-local.ps1`. This starts Supabase, safely applies the idempotent seed data, and writes ignored local environment files without printing keys. It does not reset the database; existing local data is kept.
3. Configure the private VM endpoint with `powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\configure-judge0-vm.ps1`. Enter the VM's current URL when prompted (for example, `http://192.168.1.25:2358`). The helper keeps the existing token in ignored `backend/.env.local` and does not display it. If the Judge0 server token was rotated on the VM, or the client token is missing, run the script with `-SetApiToken` to securely enter the matching server token. The helper only updates ByteQuest's client configuration; it does not change the Judge0 server token. The VM address can change after a reboot, so confirm its current IP and port 2358 before configuring it. Restart FastAPI afterward.
4. In a terminal, run the API on the port reported by `start-local.ps1` (8000 by default):

   ```powershell
   Set-Location .\backend
   python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

   If the script reports a different port, replace `8000` in the command with that port. It writes the same port into `frontend/.env.local`. Do not use port 8000 if another local service already owns it.

5. In another terminal, start the grading worker. Keep this terminal open while students submit code or exams:

   ```powershell
   Set-Location .\backend
   .\.venv\Scripts\python.exe -m app.services.submission_worker
   ```

6. In another terminal, install and start the frontend:

   ```powershell
   Set-Location .\frontend
   npm install
   npm run dev
   ```

7. Open `http://localhost:3000/onboarding` to create a local student account and select its language track. This manual URL preserves a saved browser session; the BAT launcher adds its one-time startup marker to show authentication on launch. Supabase local email confirmation is disabled; if confirmation is enabled in a local override, email is viewable through Inbucket at `http://127.0.0.1:54324`.

## Local Quest Map demos

### Account-synced progression check

Before testing an existing local database after an update, run `supabase db push --local --yes` from the repository root. The normal `infra/start-local.ps1` startup applies pending local migrations. The [local API security contract](LOCAL_API_SECURITY.md) lists the account quotas, role matrix, exact CORS origins, and SQL access checks.

Use two synthetic student accounts on the same language track and a published quiz and code challenge. With account A, complete the quiz, confirm its attempt, XP, and any badge on `/dashboard`, then edit code in the arena and wait for **Synced to server**. Sign out and sign in as account B in the same browser: A's attempt and code must be absent. Add different code for B, sign out, then return to A in another browser or a private window. A's progress and code must return from the API. Finally, disconnect the network while editing A's code, reconnect, wait for sync, and refresh to confirm the latest draft returns. If the server draft cannot be loaded, the arena should show a retry message and hold new edits locally without submitting them until a refresh succeeds. Sign-out clears local draft backups on shared computers.

This check currently uses local Supabase on this computer. A cloud-hosted project must be configured, migrated, and checked separately before calling it cloud saving.

The regular Supabase seed currently includes badges only. After a local instructor account exists, run these commands from the repository root to add the curated C++ quiz and Python quiz/challenge journeys with their quest groups. Start the Judge0 VM before the Python seed; its challenge must pass real reference-solution validation before publication:

```powershell
.\backend\.venv\Scripts\python.exe .\backend\scripts\seed_local_quest_demo.py
.\backend\.venv\Scripts\python.exe .\backend\scripts\seed_local_python_quest_demo.py
.\backend\.venv\Scripts\python.exe .\backend\scripts\seed_local_python_fundamentals_expansion.py
```

Each script refuses non-local databases, creates a draft quiz, passes it through the existing instructor review and publish checks, and attaches it to a group owned by a local instructor. The Python script also creates **Add Two Numbers** with two visible and two hidden grading cases, verifies the saved reference solution in Judge0, reviews and publishes the challenge, then adds it to the same group. It prints the group's eight-character invite code. Running either script again reuses published demo content without resetting users or progress. If Judge0 is unavailable, the Python challenge stays a draft; start the VM and rerun the script.

The Python fundamentals expansion script is idempotent and depends on the Python demo group above. It adds three reviewed quizzes (**Python Data Types Check**, **Python Conditionals & Loops Check**, **Python Lists & Strings Check**) and three Judge0-verified challenges (**Even or Odd**, **Count Vowels**, **Sum from 1 to N**) to the same group. It interleaves them in track sequence and prints the resulting group activity count. Rerunning it reuses the existing published activities and never resets attempts or XP.

Sign in with a **C++ or Python student account**, open `/quests`, select **Join Quest**, and enter the matching printed code. Open the group card, start the **C++ Fundamentals Check** or **Python Fundamentals Check**, answer the three questions, and submit. For the Python journey, continue to **Add Two Numbers**, run the visible examples, then submit the solution officially. Return to `/dashboard` and refresh to see the completed activities, XP, recent attempts, and next recommendation. The instructor who owns the group can open it and use **Copy code** to share the invite code. Student **Create Quest** remains a preview; saving groups requires instructor or admin access.

For automated local checks that do not retain test membership, attempts, or XP, run `.\backend\.venv\Scripts\python.exe .\backend\scripts\smoke_local_quest_demo.py` and `.\backend\.venv\Scripts\python.exe .\backend\scripts\smoke_local_python_quest_demo.py` from the repository root. They check join, duplicate join, quiz grading, XP, and completion after reload inside rolled-back transactions. The Python check also calls real Judge0 for a sample run and an official submission, verifies hidden-case privacy, and reads the resulting dashboard and progress before rolling back. The Python smoke check needs a running Judge0 VM and a local Python student account.

## Instructor account

Open **Instructor studio** from the navigation, or go directly to `http://localhost:3000/instructor`. Choose **Continue to instructor sign in**. Existing instructors sign in there. For a new local instructor account, choose **Create an account**, register, then sign in once; every public sign-up starts with the student role.

When the signed-in page says the account is a student, use the exact email you signed in with and run this from PowerShell at the repository root:

```powershell
.\infra\grant-local-instructor.ps1 -Email 'your-login-email@example.test'
```

This helper only targets the project's running local Supabase container (`supabase_db_bytequest-local`); it cannot change a cloud database or another Supabase project. Then sign out and sign back in. Instructor accounts are sent straight to the instructor workspace, while student accounts receive a clear explanation and local setup command. The API still checks the stored role on every protected instructor operation; role is never accepted from the browser.

Upload a lesson PDF, generate a challenge, confirm Judge0 reports the reference solution as verified, and publish it. The server rejects publishing if the reference solution did not pass.

## Student submission flow

Sign back in with the student account, select the same language as the challenge, and open the published challenge from `/quests`. Edit the starter in Monaco, run the visible samples, then submit officially. A sample run evaluates visible cases only and does not create an `activity_attempts` row. An official submission evaluates the full test suite and appends an attempt with an increasing attempt number. Completion XP is awarded on the first passing official attempt only; failures and later passes are still recorded without duplicating that completion XP. The arena updates the displayed XP/level and quest completion after grading, shows visible case feedback and newly unlocked badges, and does not reveal hidden-case inputs or per-case results.

The verified local flow and recorded database evidence are in [the Milestone 1A–1C verification log](verification/milestone-1a-1b-2026-10-24.md). The corrected Py4E Functions lesson was also followed from retained PDF through published quiz/challenge to student attempts and progress; see [the corrected-lesson verification log](verification/corrected-lesson-workflow-2026-10-25.md). The Judge0 address is assigned dynamically by Hyper-V's Default Switch; confirm the current VM address and port 2358 before testing after a VM restart.

## Retained instructor documents and progress

The instructor workspace keeps uploaded PDFs in the private `bytequest-instructional-pdfs` storage bucket and displays each immutable document version, its processing state, size, and content hash. An instructor can download a short-lived link, reprocess the active version, upload a replacement as a new version, edit descriptive metadata, archive the active version, or restore an older version. Archive is reversible and preserves source files, chunks, version history, and linked activities. Published activities remain tied to the exact source document version that generated them.

In the student quest map, open **Progress** to review saved attempts, completion XP, level, badges, and the rule-based next recommendation. These values are fetched from the authenticated API after sign-in; sample runs are not attempt history, while official submissions append attempt records. The frontend hides hidden test case inputs and individual hidden-case output.

## Phase 6 shadow scoring status

The optional Phase 6 implementation records predictions only after an official code or quiz attempt has already committed. It never changes the student's Rule 9 recommendation, and the student response does not include model probabilities or candidate actions. The instructor workspace has an aggregate-only model evaluation panel; its API is instructor-authenticated and reports accuracy only for predictions with a later observed outcome.

Shadow scoring is disabled by default (`ML_SHADOW_ENABLED=false` and `ML_SHADOW_RESEARCH_APPROVED=false`). The service also requires an active approved consent version and each student's latest accepted consent for that version. The approval setting is an operator attestation, not institutional approval. Keep shadow scoring off until institutional approval, approved wording, retention rules, and a verified consent workflow exist. The local instructor panel's browser/API/database behavior still needs runtime verification; see the [Phase 6 implementation record](verification/phase-6-shadow-rollout-implementation-2026-10-25.md).

The document lifecycle and persisted progress were verified locally with synthetic accounts. Do not use classroom/student research data until institutional consent and the required study approvals are in place.

## Before deployment

- Replace local Supabase and the Hyper-V Judge0 VM with managed, backed-up services and stable network addresses.
- Provision private storage, strict bucket policies, production auth redirect URLs, and server-only credentials in the deployment secret store.
- Reconcile the production Judge0 CE image/configuration with the locally verified Extra CE image; keep database and Redis private and isolated.
- Run production build, migration/recovery rehearsal, security review, rate-limit and resource-limit checks, monitoring, and backup restore verification in a staging environment.
- Complete institutional consent and study approvals before any classroom pilot or research data collection.

The synthetic lesson fixture at `docs/fixtures/loops-intro.pdf` covers a running sum with a `for` loop and can be used for the instructor upload.

## Required local AI setting

PDF extraction and sandboxed execution work locally without cloud credentials. Challenge generation and embeddings need `GEMINI_API_KEY` in the existing backend environment. The setup script preserves that backend-only setting while replacing database, auth, and Judge0 endpoints with local values. Never copy a service-role key into `frontend/.env.local`.

## Exam Autosave & Conflict-Safe Recovery Verification

### Durability Boundary & Concurrency Guarantees
- **Session Recovery (`sessionStorage`):** Unsynced exam edits are stored solely in `window.sessionStorage` under the key `bytequest:exam-unsynced:${userId}:${attemptId}` and never in `localStorage`. They survive accidental refreshes or temporary Wi-Fi drops **within the same browser tab/session**, and are wiped on shared-computer sign-out or when the browser tab closes.
- **Account Recovery (FastAPI/Database):** Only answers confirmed with `Saved to your account at [time]` (via `PUT /exams/attempts/{id}/answers` with matching `expected_revision`) are stored in the database, available across devices, or submitted by the server exam expiry worker.
- **Barrier Synchronization Before Reconciliation:** On initial mount or page refresh, the frontend resolves the authenticated Supabase user ID (`resolveAuthenticatedUserId()`) and server attempt state in parallel before touching `sessionStorage` or enabling the editor. Reconciliation executes strictly once via `reconciledAttemptKeyRef`, preventing race conditions under delayed auth resolution or React Strict Mode double mounts.
- **Blast-Radius Attempt Isolation:** Attempt completion, manual submission, and deadline expiry invoke `clearUnsyncedExamSnapshot(userId, attemptId)` to remove **only** the snapshot for that specific attempt. Snapshots for other active attempts in the same session remain untouched. Full session purge (`purgeAllExamSessionSnapshots()`) is strictly reserved for shared-computer sign-out.
- **Monotonic Lamport Watermarking:** Save confirmations use a strict conjunctive check (`current.editSeq <= confirmedEditSeq && areExamAnswersCanonicallyEqual(...)`). If newer keystrokes occurred while a save was in flight (`current.editSeq > confirmedEditSeq`), the snapshot is preserved and its `baseRevision` is advanced to the confirmed server revision so the chained follow-up save flushes reliably.
- **Unauthenticated Session Safety:** If an auth session expires mid-exam or cannot be verified on refresh, the frontend enters the `unauthenticated` hydration state and displays an accessible recovery prompt without modifying or deleting `sessionStorage`. Signing back in within the same tab recovers all unsynced work.

### 8 Required Acceptance Checks

1. **Edits during network loss:**
   - Open an active exam attempt.
   - Open browser DevTools, switch to the **Network** tab, and set throttling to **Offline**.
   - Type new code in a challenge task or select an answer in a quiz task.
   - Verify the status bar immediately reflects `Unsaved on this device` alongside the boundary notice: *"Unsaved changes can recover in this browser tab, but only confirmed saves are stored in your account across devices or after closing this session."*
   - Verify `Last confirmed save: [time]` (or `Not yet saved to account`) remains visible.

2. **Reconnect recovery:**
   - With unsaved edits on the offline tab, toggle the DevTools Network throttling back to **Online** (or trigger a document `visibilitychange`).
   - Verify the single-flight queue automatically dispatches the coalesced pending save.
   - Verify the status bar transitions to `Saving` and then to `Saved to your account at [time]`, updating the confirmed timestamp.

3. **Refresh in the same session:**
   - Set Network to **Offline** and make answer edits.
   - Refresh the page with `F5` while still offline.
   - Verify the page hydrates from server attempt state, detects the matching `baseRevision` unsynced snapshot from `sessionStorage`, restores the local draft, and displays `Unsaved on this device`.
   - Set Network to **Online**; verify the pending save flushes and settles with `Saved to your account at [time]`.

4. **Two tabs editing one attempt (`409 Conflict`):**
   - Open the same student exam attempt in Tab A and Tab B.
   - In Tab B, edit code and wait for `Saved to your account at [time]`, advancing the server revision number.
   - In Tab A, type new edits. Tab A attempts to save with its older base revision and receives `409 Conflict`.
   - Verify Tab A halts automatic retries, displays `Resolve answer conflict` (`role="alert"`), and renders the high-contrast conflict banner.
   - Inspect both copies (local unsaved draft vs. server revision).
   - Test "Use this device's unsaved answers" to rebase onto the server revision and save, or "Keep account's saved answers" to revert to the server copy.

5. **Two different student accounts on a shared computer:**
   - Sign in as Student A and start an exam attempt. Make an unsaved edit while offline so `bytequest:exam-unsynced:${studentA_id}:${attemptA_id}` exists in `sessionStorage`.
   - Trigger shared-computer sign out (`signOutSharedComputer()`).
   - Sign in as Student B on the same workstation.
   - Inspect `window.sessionStorage` in DevTools: verify all `bytequest:exam-unsynced:*` keys were swept and Student B cannot access Student A's unsaved draft.

6. **Manual submission with an unsaved edit:**
   - With an active exam attempt, make an edit and immediately click `Submit exam`.
   - If connected, verify the UI awaits the in-flight save flush before submitting the attempt.
   - If offline or during a network failure, verify submission is blocked and an accessible alert is shown: *"Submission has not been confirmed because your latest answers could not be saved to your account. Your draft remains on this tab—please check your connection and try again."*
   - If in conflict state, verify submission is blocked and focuses the conflict resolver.

7. **Deadline expiry during an in-flight save:**
   - Wait until the authoritative exam countdown timer reaches `00:00` (or the server responds with attempt expiry).
   - Verify the editor locks immediately (`disabled`), automatic retries stop, `sessionStorage` is cleared, and the status bar displays `Time ended; latest server-saved answers submitted`.
   - Verify no late local draft is submitted over the server's final state.

8. **Granted retake isolation:**
   - As an instructor, grant a retake to the student via `POST /api/v1/exams/instructor/{exam_id}/retakes/{student_id}`.
   - As the student, open the exam page and click **Start granted retake**.
   - Verify a new attempt is created with a new attempt ID and `revision: 0`, completely isolated from the prior attempt's server state and session storage.

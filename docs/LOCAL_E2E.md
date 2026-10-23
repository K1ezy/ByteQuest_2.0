# ByteQuest local end-to-end flow

This setup uses local Supabase and the private Ubuntu VM on D: running Judge0 Extra CE 1.13.1. It writes local Supabase settings to ignored `backend/.env.local` and `frontend/.env.local`; frontend configuration contains only the local Supabase anon key. The setup preserves the configured Judge0 URL/token and optional backend AI key. It does not write to the configured cloud database or start a second local Judge0 stack.

`infra/docker-compose.yml` is a later VPS template and requires the explicit `vps` profile. It is not part of this local setup.

## Start local services

1. Start Docker Desktop and wait for the engine to become ready.
2. From the repository root, run `powershell -ExecutionPolicy Bypass -File .\infra\start-local.ps1`. This starts Supabase, safely applies the idempotent seed data, and writes ignored local environment files without printing keys. It does not reset the database; existing local data is kept.
3. Configure the private VM endpoint and token with `powershell -ExecutionPolicy Bypass -File .\infra\configure-judge0-vm.ps1` if they are not already present. The script prompts for the token without displaying it. The VM address can change after a reboot; use its current private IP.
4. In a terminal, run the API:

   ```powershell
   Set-Location .\backend
   python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

5. In another terminal, install and start the frontend:

   ```powershell
   Set-Location .\frontend
   npm install
   npm run dev
   ```

6. Open `http://localhost:3000/onboarding` to create a local student account and select its language track. Supabase local email confirmation is disabled; if confirmation is enabled in a local override, email is viewable through Inbucket at `http://127.0.0.1:54324`.

## Seed the coding fixtures

On a fresh local database, Supabase applies migrations and its seed data. `infra/start-local.ps1` also reapplies the idempotent local seed to an existing database without resetting users or attempts. The seed includes the badges, three published language challenges, and their test cases.

The seed challenge reference solutions are marked verified only after the same solutions pass `backend/scripts/verify_all_languages.py` against the configured VM.

## Instructor account

Register a second local account. The app creates student profiles on first API access. In local Supabase Studio (`http://127.0.0.1:54323`), run this SQL with the exact test email:

```sql
UPDATE public.profiles
SET role = 'instructor'
WHERE id = (SELECT id FROM auth.users WHERE email = 'instructor@example.test');
```

Sign out and back in with that account, then open `/instructor`. Upload a lesson PDF, generate a challenge, confirm Judge0 reports the reference solution as verified, and publish it. The server rejects publishing if the reference solution did not pass.

## Student submission flow

Sign back in with the student account, select the same language as the instructor challenge, and open the published challenge from `/quests`. Edit the starter in Monaco, run the visible samples, then submit officially. A sample run does not create an `activity_attempts` row. An official submission does, with a monotonically increasing attempt number; XP is awarded only for the first successful completion.

The synthetic lesson fixture at `docs/fixtures/loops-intro.pdf` covers a running sum with a `for` loop and can be used for the instructor upload.

## Required local AI setting

PDF extraction and sandboxed execution work locally without cloud credentials. Challenge generation and embeddings need `GEMINI_API_KEY` in the existing backend environment. The setup script preserves that backend-only setting while replacing database, auth, and Judge0 endpoints with local values. Never copy a service-role key into `frontend/.env.local`.

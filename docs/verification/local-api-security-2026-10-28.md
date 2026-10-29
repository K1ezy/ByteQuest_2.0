# Local API security verification — 2026-10-28

Scope: local Supabase, local FastAPI, local Next.js, and the private Judge0 VM.
No hosted Supabase, Vercel, or VPS resource was changed.

## Checks

- Applied `20261028140005_local_api_security.sql` with `supabase db push --local --yes`.
- Local SQL privilege checks: `anon` and `authenticated` have no `SELECT` on
  `public.profiles`; `anon` has no `SELECT` on `public.api_rate_counters` or
  `EXECUTE` on `match_document_chunks`. Local Auth and Storage schemas were not changed.
- Local REST Data API: anonymous profile read returned permission denied; a
  synthetic authenticated token also returned permission denied. FastAPI
  integration learning flows still passed.
- `supabase db advisors --local --type security --level warn`: no issues.
- Backend: 26 tests passed, covering quota concurrency, invite guesses,
  idempotent jobs, AI hint failure, PDF limits, CORS, body size, ownership,
  exam embargo, and learning flows. Frontend: lint, TypeScript, production
  build, and recovery invariants passed.

## 30-student local load

The first run with one serial grading worker completed 20/30 during the test;
10 requests hit the test client's 30-second read timeout. Its synthetic
accounts were removed after the append-only cleanup guard was handled.

After bounding the worker to three concurrent grading jobs, a second run used
two local Uvicorn workers, one grading-worker process, 30 distinct synthetic
student accounts, the published verified Python challenge, and real Judge0:

| Measure | Result |
| --- | ---: |
| Completed | 30/30 |
| Completed within 30 seconds | 30/30 |
| Median submit-to-result wait | 13.53 seconds |
| Maximum submit-to-result wait | 22.89 seconds |

The runner cleaned up all synthetic accounts. A follow-up local SQL check
reported zero remaining `load-*` accounts and the append-only attempt trigger
enabled. These timings describe this machine and current Judge0 VM; they do
not predict VPS performance.

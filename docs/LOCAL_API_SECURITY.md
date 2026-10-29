# Local API security contract

ByteQuest uses Supabase Auth for sign-in and FastAPI for application data. The
browser sends a bearer token to FastAPI. Role decisions use the database
`profiles.role`, never a browser field or JWT role claim. The frontend's Auth
session uses `sessionStorage` so closing the browser ends the local sign-in;
shared-computer sign-out also clears local draft backups.

## Access matrix

| API family | Anonymous | Student | Instructor | Admin |
| --- | --- | --- | --- | --- |
| `/health`, `/api/v1/health`, `/readyz` | Liveness/readiness only | Same | Same | Same |
| `/api/v1/profiles/me`, onboarding | 401 | Own profile | Own profile; onboarding role gate | Own profile; onboarding role gate |
| Published quests, alias leaderboard | 401 | Published track content | Published content | Published content |
| Progress, dashboard, drafts, hints, consent | 401 | Own data and published track activities | 403 | 403 |
| `/api/v1/submission-jobs` | 401 | Create and read own jobs | 403 for create, 404 for other jobs | 403 for create, 404 for other jobs |
| Quest groups | 401 | Join by code and list joined groups | Create and manage owned groups; list joined groups | May manage any group by ID |
| Instructor documents, activities, student group summary, analytics | 401 | 403 | Own documents, activities, and groups; aggregate analytics | Cross-instructor override |
| Instructor exam management | 401 | 403 | Own exams and groups | Cross-instructor override |
| Student exams and attempts | 401 | Assigned published exams and own attempts | No student attempt access | No student attempt access |

Foreign instructor resources return 404. A role mismatch on a non-resource
endpoint returns 403. Student responses never include hidden test inputs or
unreleased exam results. Research collection, shadow scoring, exports, and
outbound mail remain disabled until their separate approval gates.

## Quotas and validation

Quotas are atomic PostgreSQL counters shared by all API processes. Minute and
hour windows use UTC; daily windows reset at midnight Asia/Manila. HTTP 429
includes `Retry-After` and `detail.code=rate_limited`. If the quota database
cannot be reached, costly actions return a retryable 503. The frontend shows
the wait and retains entered work. The five-use hint learning rule is separate
from AI cost quotas: a failed AI hint spends provider quota, but not a hint.

| Action | Quota |
| --- | --- |
| Practice jobs and exam sample runs | 5/minute per student, separately |
| Practice quiz submissions | 10/minute per student |
| Group-code attempts, including invalid codes | 12/hour per account |
| Group creation | 5/hour per instructor |
| Instructor code verification | 5/minute per instructor |
| Student AI hints | 3/hour and 10/day per student |
| Instructor AI draft generation | 2/hour and 8/day per instructor |
| PDF upload, version, or reprocess | 5/hour and 20/day per instructor |
| All generative/help provider attempts | 100/day globally |
| Document chunk embedding attempts | 500/day globally |

Idempotent job replays, duplicate-click recovery, worker retries, drafts,
exam autosaves, and reads do not consume these quotas. All mutation JSON
models reject unknown fields. Requests are limited to 12 MiB. PDFs are limited
to 10 MiB, 100 pages, and 200,000 extracted characters before indexing.

## Local verification and future deployment

Run `supabase db push --local --yes` from the repository root after pulling a
new migration. `infra/start-local.ps1` does this during normal startup. Run
the backend tests from `backend` with `.venv/Scripts/python.exe -m pytest -q`.
With the local API and grading worker running, use
`.venv/Scripts/python.exe tests/load_test_local_synthetic.py` from `backend`
for the 30-student check. It requires a published verified challenge and
deletes its synthetic accounts after measuring results. The grading worker
defaults to three concurrent jobs; keep this bound aligned with local Judge0
capacity and the database connection budget.
The migration preserves Supabase Auth and private Storage; it revokes
`anon`/`authenticated` grants on ByteQuest tables, sequences, and app RPCs.
Verify with `has_table_privilege` and `has_function_privilege` in local SQL,
then check that signed-in FastAPI learning flows still work.

The local API allows exactly `http://localhost:3000` and
`http://127.0.0.1:3000`. Other devices need an explicitly configured origin.
For a future deployment, set an exact HTTPS `CORS_ORIGINS` value and review
Supabase Auth's built-in sign-in, signup, token-refresh, and email limits.
Institutional SMTP is required before production password-recovery email.
Apply migrations and security checks to that deployment only in its own
approved rollout; this local change does not alter a hosted project.

# ByteQuest 2.0 — Review remediation plan

Sources: [.design/review-report.md](../.design/review-report.md) (BQ-01…BQ-10) and [.design/system-review.md](../.design/system-review.md) (items 1–17). Each fix has a test that failed before it, unless it's marked as config or copy.

## Done

- [x] **BQ-01:** one server-authoritative exam cutoff, applied to autosave, grading and the browser. (3 backend + 2 page tests)
- [x] **BQ-02 / review #7:** exam grading claim lease (`exam_attempts.grading_claimed_at`, migration `20261115090000`). A second worker skips a fresh claim, and a crashed claim is retried after 10 minutes instead of in a tight loop. (1 test)
- [x] **BQ-04 / review #4:** runner health reflects current state. A job waiting more than 3 minutes shows as stale (worker down), only the newest finished job decides "failed", and the detail text shows the failure rate. Shadow ML switched off on purpose shows as `off` and doesn't count against health. (5 unit tests + API test)
- [x] **BQ-05 / review #3:** the instructor snapshot counts mastery (a passing attempt), not attempts. The average score uses each student's latest score with failures included. Both views are labeled "mastery". (1 test)
- [x] **BQ-07 (part) / review #14:** the workshop list uses 2 queries total instead of 2 per workshop. (Query-count test)
- [x] **BQ-08 (CI part) / review #6:** `npm test` runs in CI.
- [x] **BQ-10 / review #15:** the dashboard says "Workshops", recent attempts come before the shortcuts, and dashboard links use `/instructor/...` directly. (Test updated)
- [x] **Review #1:** the Studio and the workspace publish through one shared rule set (`services/activity_publishing.py`), so publishing a new version retires the old one. (1 test)
- [x] **Review #5 (rules part):** Studio uploads obey the admin's PDF size limit. (1 test)
- [x] **Review #2 (config):** Judge0 `COUNT=3` for a 4-vCPU VPS; grading worker DB pool 5 + 5.
- [x] **Review #8 (config):** a `judge0-pruner` compose service deletes Judge0 runs older than 60 days, daily.
- [x] **Review #9:** removed 365 unused CSS rules (−1,957 lines).
- [x] **Review #10:** the browser uses `@supabase/auth-js` only, about 37 KB gzip less on every route. The session key, URL and headers are pinned by a test and checked against local GoTrue.
- [x] **Review #13:** minimum password length 8 (`config.toml`, sign-up and reset forms).
- [x] **Review #16, #17:** sign-up heading and reset link; the landing hint is 12 px, passes WCAG AA contrast, and is hidden on touch screens.
- [x] **BQ-06 / review #12:** on stacked layouts the Focus topbar scrolls away, and a slim sticky Problem · Editor · Results jump bar (44 px targets) is shown. On phones the topbar also drops the repeated title, the language and role tags, and the "Back to" prefix. Checked signed in: the topbar went from 184 → 133 px at 320 and from 133 → 73 px (one row) at 390. Tapping Editor shows the code area and Run sample with nothing hidden under the bar, and nothing scrolls sideways.

- [x] **Launcher:** `START-BYTEQUEST.bat` now restarts the API on every run, as it already did the worker. Reusing a healthy API had kept serving yesterday's backend code after every change. If something it can't stop holds the port, it fails with a clear message.
- [x] **Signed-in role checks (2026-11-15):** instructor overview and Performance both show 7% mastery and agree; all action links go to `/instructor/...`. Admin shows "Services: Healthy", "3 of 3", prediction "Off", and the runner as healthy despite old failures. Fixed along the way: two leftover "completion" labels, the muted chip contrast (4.3:1 → 6.1:1), and long runner times now read in hours and days.
- [x] **Launcher: Supabase startup (2026-11-15):** the launcher waits for Postgres to be healthy before it asks `supabase status` for keys, and reads the keys from the containers when the CLI still gives nothing. It resumes stopped containers, and rebuilds the stack from its existing volumes when a required container is missing, stays unhealthy for 3 minutes, or loses its ports. Mailpit stays on, so local password resets work. Failures and rebuilds save each container's last 40 log lines, with keys masked, to `logs/startup-diagnostics.log`. The ZeroTier phone relay no longer counts as a port 3000 conflict. (Resume/rebuild, readiness and log-masking tests in `test-launcher-helpers.ps1`.)

## Still open

- [ ] **Review #5 (UI part):** decide whether to keep both the "Materials" and "Studio" screens, or merge them. This is a product decision.
- [ ] **Review #11:** move the exam page's save and deadline logic into a hook, ideally after the outstanding work is committed.
- [ ] **BQ-07 (rest):** reuse the workspace profile in the Arena, and split catalog summaries from per-activity detail. Measure before and after.
- [ ] **BQ-08 (rest):** a scripted, browser-to-worker exam acceptance run.
- [ ] **BQ-03:** ⚠ needs sign-off. Separate API, worker and migration database identities, verified in staging.
- [ ] **BQ-09:** a consent-withdrawal concurrency test before shadow scoring is enabled.

## Outside code

- **Production setup:** apply migration `20261115090000` to production. In the Supabase dashboard, set the minimum password length to 8 and turn on email confirmation. Enable Gemini billing.
- **Staging and recovery:** Linux staging, a restore rehearsal, and C++ load at 30 students.
- **Accessibility and AI evaluation:** a screen-reader pass, and tutor-quality evaluation.

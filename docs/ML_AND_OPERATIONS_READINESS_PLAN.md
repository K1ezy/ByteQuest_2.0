# ML evidence, operations and ML methodology: readiness plan

22 November 2026. This plan covers three areas from the [system review](reviews/system-review-2026-11-22.md):

- operations and reliability (review finding H1);
- ML evidence and readiness (H6);
- ML methodology.

It does not change the ML method. Chapter 3 stays frozen (D2 in the [ML improvement plan](ML_IMPROVEMENT_PLAN.md)). Every new analysis below is **supplementary**: it is reported beside the primary result and decides nothing.

## 1. Where things stand

### Operations

| # | Fact | Evidence |
|---|---|---|
| F1 | Docker Desktop does not start when you sign in to Windows. | `AutoStart: false` in `%APPDATA%\Docker\settings-store.json` |
| F2 | Once Docker is running, the stack comes back on its own. | The Supabase containers use the `unless-stopped` restart policy. |
| F3 | Docker stopped twice on 22 November, and the cause is unknown. | The Windows System log shows no sleep, shutdown or crash in the 10 hours before. Docker's own logs name no reason. |
| F4 | The public readiness check (`/readyz`) tests the database only. | `backend/app/main.py:156` |
| F5 | A deeper health check already exists. It tests Judge0 with a real run, the grading worker heartbeat, the runner queue, the tutor index and forecasting. | `service_health()` in `backend/app/services/monitoring.py`, shown on the admin pages |
| F6 | Nothing runs the F5 check on its own, and nothing raises an alert. | It only runs when an admin opens the page. There is no uptime monitor or error tracker. |
| F7 | No backup has been made and no restore has been rehearsed. | The [backup runbook](PHASE7_BACKUP_RESTORE_RUNBOOK.md) says "prepared, not executed". |
| F8 | None of the six hosted release gates is met (0 of 6). | [Release plan §5](SYSTEM_STATUS_AND_RELEASE_PLAN.md), [KVM 2 checklist](KVM2_LIVE_PILOT_CHECKLIST.md) |
| F9 | Grading under a full class has never been tested. The largest block is 4CS-C, with 20 students. | Gate G4 is open. |

### ML evidence

| # | Fact |
|---|---|
| F10 | The only trained run is synthetic, and the backend refuses to serve it. |
| F11 | Phase A (the manuscript method) and Phase B (the Model evaluation page and consent flow, PR #4) are built. Phase C starts after the pilot. |
| F12 | The three 4CS blocks hold 53 students (18 + 15 + 20). The manuscript expects at least 30 respondents. |
| F13 | The test partition gets 20% of learners. At 30 consenting learners that is 6, exactly the adequacy minimum, so a single withdrawal drops it below. |
| F14 | Adequacy needs at least 15 test rows of **each** outcome. One row is one learner's first submission on one challenge. |
| F15 | The local demo course has 6 published programming challenges. The pilot track's content isn't frozen yet (gate G3). |
| F16 | Consent is collected through the Dashboard card. Admin Course health shows how many students agreed in each course. Since 22 November it also shows how many haven't answered the current form. |
| F17 | The consent form version and text are still `dev-placeholder` until the ethics-approved form arrives. |

### ML methodology

| # | Fact |
|---|---|
| F18 | The primary result comes from one seeded 60/20/20 split by learner. With about 30 learners, a different seed could move the test metrics a lot. |
| F19 | 95% intervals (1,000 learner resamples) and the adequacy verdict are already reported. |
| F20 | There is a known train/serve skew. Offline, `days_since_last_attempt` is the gap up to the first submission. Live, it is the gap up to the snapshot, which is usually close to 0. |
| F21 | The Brier score is reported, but calibration is not shown. The 0.60 and 0.40 advisory bands that instructors see assume the probabilities mean what they say. |
| F22 | `ml_pipeline/train_compare.py` is one 1,145-line file that holds loading, screening, features, splitting, fitting, evaluation, reporting and the command line. |
| F23 | The errata list for the adviser is written (ML plan §7) but hasn't been sent. |

### What the numbers mean for data volume

Each test learner contributes one row per challenge they attempt. With 6 test learners attempting *k* challenges each, and a first-submission pass rate of *p*, adequacy needs **6 × k × min(p, 1 − p) ≥ 15**.

| First-submission pass rate | Challenges each learner must attempt |
|---|---|
| 50% | 5 |
| 70% | 9 |
| 80% | 13 |

With only 6 challenges, adequacy holds only when the pass rate is between about 42% and 58%. **The pilot needs 12 to 15 programming challenges per learner, and at least 35 consenting learners**, to leave room for withdrawals and an uneven pass rate.

## 2. Decisions you need to make

These block the work below. Each has a recommendation.

| # | Decision | Recommendation |
|---|---|---|
| R1 | Where does the pilot run: the hosted KVM 2 VPS (gates G1 to G6) or this PC? | **Hosted.** This PC is one machine with no failover, and Docker stopped twice in one day. Harden the PC anyway (Workstream A1), because it is the rehearsal machine and the fallback. |
| R2 | What is the defense date, and when are the pilot weeks? | The timeline in §6 counts back from it. Phase C needs about 3 to 4 weeks after the last pilot class. |
| R3 | Do you add an external error tracker such as Sentry? | **Not for this pilot.** It sends request data to a third party, so it needs scrubbing and an ethics note. An uptime monitor plus the watchdog log is enough for 53 students. |
| R4 | What recovery targets do you set: how much data you can lose (RPO) and how long you can be down (RTO)? | RPO of 24 hours on ordinary days and 1 hour on exam days. RTO of 2 hours. Exams are the one place where lost work hurts students. |
| R5 | Will the adviser accept the supplementary analyses in Workstream C as "supplementary, decides nothing"? | Ask with the errata in one message (C6). |
| R6 | Who asks students for consent? | **Someone without grading power over them**, such as you as the researcher, with the instructor out of the room. This keeps the "no pressure" promise the consent card makes. |
| R7 | What is the content target for the pilot track? | 12 to 15 reviewed programming challenges, plus quizzes, published before the first pilot class. |

## 3. Workstream A: operations and reliability

### A1. Harden this PC (do now, small)

1. **Turn on Docker auto-start.** In Docker Desktop, open Settings → General and tick "Start Docker Desktop when you sign in to your computer". This fixes F1. It is your app setting, so change it yourself.
2. **Keep the PC awake during class.** While plugged in, set Windows sleep to "Never" for the pilot weeks.
3. **Find out why Docker stops (F3).** Use the `/diagnosing-bugs` flow. Its first job is a feedback loop: a watcher that records the moment Docker stops (see A2), plus Docker's `com.docker.backend.exe.log` and WSL events from the same minute. Don't guess a fix until a stop has been captured.
4. **Check grading at the end of launch (done 22 November).** `infra/start-bytequest.ps1` checks each service as it starts it. It now also finishes with `scripts.check_stack_health --judge0`: the admin health checks plus one real grading run. A failure prints a red warning instead of stopping the launch.

### A2. Watch the stack while class is on (built 22 November as `infra/watch-bytequest.ps1` and registered on this PC to run every minute)

The deep check already exists (F5); nothing runs it. Add one small watchdog:

- **What it checks:**
  - `/readyz`, so the API and database respond;
  - the grading worker heartbeat, which must be younger than 2 minutes;
  - a Judge0 test run every 5 minutes, because each run uses the sandbox.
- **What it does:**
  - writes one line per check to `logs/ops/watchdog.log`;
  - raises a Windows notification on failure;
  - if Docker itself is down, starts Docker Desktop and logs the attempt. It never restarts the database container by hand.
- **Where it runs:** on this PC, a scheduled task every minute during class hours, which you approve. On the VPS, a systemd timer running the same script, plus a free external uptime monitor on `/health` and `/readyz`.
- **Keep `/readyz` as it is.** A readiness check that fails whenever Judge0 is slow would take the whole API offline, even though students could still read materials. The watchdog reports Judge0 separately.

### A3. Backups and a restore rehearsal (gate G5)

1. Record R4's recovery targets in the runbook.
2. **This PC:**
   - each night, run a `pg_dump` of the application schema and copy the PDF storage files to an external drive, with a SHA-256 manifest;
   - on exam days, run the dump every hour.
3. **Hosted:** use Supabase's own backup or point-in-time recovery, plus the encrypted logical export the runbook describes.
4. **Rehearse once** into a separate, isolated project with synthetic data. Check that you can sign in, that course access holds, that a PDF downloads and that a test submission grades. Record how long it took. Until a restore has worked, there is no backup.

### A4. Class capacity (gate G4)

- Rehearse 20 simultaneous submissions (one 4CS-C class), then 53 (every block at once), on the actual VPS.
- Record:
  - the queue wait and the total time to a grade;
  - any failures;
  - CPU and memory use on both the API and the Judge0 host.
- Use synthetic accounts and the offline test battery (`infra/test-offline-battery.ps1`) as the starting point.
- **Pass mark:** 95% of submissions are graded within 30 seconds, and none are lost.

### A5. Incident playbook (one page)

For each likely failure, the playbook lists the signal, the first fix, and what to tell the class:

- Docker is down;
- grading stalls (heartbeat is old);
- Judge0 fails its test run;
- the database is unreachable;
- the tutor is unavailable.

Add an exam rule: when grading is down, the exam's autosave keeps students' answers. The instructor extends the time and does not restart the exam. Name the operator and a backup contact (gate G6).

### A6. Hosted release gates G1 to G6

Work through the [KVM 2 checklist](KVM2_LIVE_PILOT_CHECKLIST.md) in order. A1 to A5 produce the evidence for G4, G5 and G6. G2 needs one real phone.

## 4. Workstream B: ML evidence and readiness

### B1. Consent uptake (before the pilot)

1. Get the ethics-approved form. Set `RESEARCH_CONSENT_VERSION` and `RESEARCH_CONSENT_TEXT` on the host. The withdrawal wording must match the protocol.
2. **Watch uptake in Admin → Course health (F16).** It shows agreed and not-answered totals per course, never names, to the admin only. By the second class it tells you whether you'll reach 35. A per-block split isn't built: blocks are workshops, and this count is per course.
3. Run a 5-minute in-class explanation in each block, led by the person R6 names.
4. Don't offer rewards or reminders that single anyone out. The card already asks once, with equal buttons and no reward.

### B2. Content and data volume (before the pilot)

- Publish the R7 content target. The §1 table explains why 6 challenges is too few.
- Each week, check the de-identified volume: consenting learners, first-submission rows, and the pass rate so far. If the pass rate drifts above 75%, you'll need more challenges per learner to reach adequacy, so add harder ones early rather than late.

### B3. Rehearse Phase C end to end now, with synthetic data

Run every Phase C step except activation on the synthetic data set, so the real run after the pilot holds no surprises:

1. Run both export queries (attempts and hints) against the local database, which holds synthetic demo accounts only. Check that they run, return the expected columns, and pass the trainer's identifier screening.
2. Train with the synthetic data set: `python ml_pipeline/train_compare.py` with no data file. Don't pass `--research-approved` on demo data. That flag vouches that the data is approved, and the run would look like a real one.
3. Read `adequacy` and `confidence_intervals` from `metrics_summary.json`.
4. Open the report on the Model evaluation page.
5. Confirm that the backend refuses the synthetic run.

Write the exact commands into a **Phase C runbook**. Don't fake an approved model to rehearse activation: the activation step is reviewed, not rehearsed.

### B4. Phase C after the pilot (from the ML plan)

1. Export, train and check adequacy.
2. Make the reviewed activation decision and record the build, data and model versions.
3. Run the shadow window: forecasts appear in Student Progress for consented learners, for at least 1 to 2 weeks of classes.
4. Record the SOP 5 instructor walkthrough.
5. Report SOP 4 from the frozen test partition, with intervals, the adequacy verdict, and the supplementary reports labelled.

### B5. Evidence pack for the panel

A single `docs/evidence/` index that points to:

- the protocol section of `metrics_summary.json`;
- the intervals and the adequacy verdict;
- the activation decision record;
- the SOP 5 recording;
- the supplementary analyses from Workstream C;
- the errata the adviser accepted;
- the consent uptake totals;
- gate evidence G1 to G6.

### B6. If adequacy fails

Pre-write, with the adviser, the paragraph you'll use when `adequacy.met` is false. The results are then "indicative only", the intervals show how wide they are, and the thesis contribution rests on the system and the protocol rather than on one score. Deciding this before you see the numbers keeps the report honest.

## 5. Workstream C: ML methodology (all supplementary)

| # | Change | Why | Size |
|---|---|---|---|
| C1 | **Split-seed sensitivity.** Rerun the whole frozen protocol on 20 or more seeds. Report the spread of each test metric and how often logistic regression or random forest wins. | It answers the panel's most likely question, "would another split change the answer?" (F18), without changing the method. | Small |
| C2 | **Measure the skew.** Score the frozen test rows again with `days_since_last_attempt` set to what a live snapshot would see (0 days), and report how much each metric moves. During the shadow window, compare live and offline feature distributions. | It turns the known skew (F20) into a measured limitation instead of a footnote. | Small |
| C3 | **Calibration.** Add a 5-bin reliability curve for both models on the test partition beside the Brier score, and show it on the Model evaluation page as supplementary. | Instructors read the 0.60 and 0.40 bands as probabilities, so the panel will ask whether they are calibrated (F21). | Small |
| C4 | **Split `train_compare.py` into modules** without changing what it does. First pin the seed-42 synthetic run's `metrics_summary.json` and model hashes as a reference test. Then split it into data and screening, features, split, fit and select, evaluate and report, and the command line. | Each later change becomes safer and easier to review (F22). The reference test proves the method didn't move. | Medium |
| C5 | **Repeated grouped cross-validation (optional).** For example, 5 × 5 folds by learner on all rows, reported as supplementary. | It gives a second estimate with less variance than one split. Do it only if the adviser agrees (R5), because it is close to a method change. | Small |
| C6 | **Send the errata** (ML plan §7) and the R5 question in one message to the adviser. | It is the last piece of D11. | Tiny |

Order: C6 → C4 (with its reference test) → C1, C2, C3 on the new modules → C5 only if approved.

## 6. Order and timeline

The weeks are relative. Place them once R2 is settled.

| When | Operations | ML evidence | ML methodology |
|---|---|---|---|
| This week | A1 (auto-start, awake, launch check) and A2 (watchdog) | B1.2 (uptake count) | C6 (errata), C4 (reference test, then split) |
| Before pilot, weeks −3 to −1 | A3 (backups and rehearsal), A4 (capacity), A5 (playbook), A6 (G1 to G6) | B1 (approved form, in-class explanation), B2 (content), B3 (Phase C rehearsal) | C1, C2 and C3 built and run on synthetic data |
| Pilot weeks | Watchdog on, nightly and exam-day backups, incident log | Weekly volume check (B2) | None |
| After the last class, weeks +1 to +2 | Final backup and restore check | B4 steps 1 and 2 (export, train, activation decision) | C1 to C3 on the real run |
| Weeks +2 to +4 | None | B4 steps 3 to 5 (shadow window, SOP 5, SOP 4 report), B5 (evidence pack) | None |

## 7. Which skill flow to use for each piece

1. **`/setup-matt-pocock-skills` first.** No issue tracker is set up for this repository, and `/to-spec`, `/to-tickets` and `/wayfinder` need one. A local tracker (files under `.scratch/`) is fine.
2. **`/grill-with-docs` on §2.** It settles R1 to R7 and records them in the glossary and as decision records, so later sessions don't ask again. `/wayfinder` isn't needed: the work is mapped here, and only the decisions are open.
3. **`/to-spec`, then `/to-tickets`, for each workstream.** Three specs fit: operations (A1 to A6), ML evidence (B1 to B3) and methodology (C1 to C5). The tickets carry their blocking edges. For example, C1 to C3 wait on C4.
4. **`/implement` per ticket**, clearing context between tickets. Each ticket is built with `/tdd` and closes with `/code-review`.
5. **`/diagnosing-bugs` for A1.3**, the Docker stops, once the watchdog has captured one.
6. **`/improve-codebase-architecture`** isn't needed for C4: the seams are already named here. Go straight to `/tdd`, writing the reference test first.
7. **`/to-questionnaire` for R5**, if the adviser prefers to answer in writing.
8. **`/wizard` for the hosted setup steps** that only you can do (gates G1 and G6), such as DNS, provider dashboards and secrets.

## 8. Done means

- Docker starts at sign-in. The watchdog logs every minute during class, and a stop has been captured and explained.
- One restore has been rehearsed and timed, and backups run nightly and hourly on exam days.
- A 53-submission burst grades 95% of submissions within 30 seconds with none lost, on the pilot host.
- Gates G1 to G6 have recorded evidence.
- The approved consent form is live, the uptake count shows at least 35 consenting learners, and the pilot track has 12 or more challenges.
- The Phase C runbook has been rehearsed on synthetic data.
- `train_compare.py` is split into modules, and the seed-42 reference test passes unchanged.
- The split-seed, skew and calibration reports are produced and labelled supplementary.
- The adviser has answered the errata and R5.

# ByteQuest machine-learning improvement plan

**Date:** 21 November 2026
**Status:** agreed with the project owner in a grilling interview. Phase A was implemented on 11/21/26 in the working tree (uncommitted); Phases B and C are open.
**Manuscript of record:** `ByteQuest-Thesis-Manuscript-Compilation.pdf` (14 November 2026, 19:39), Chapter 3 pp. 43–56: data preparation, Algorithms 3 and 4, glossary "Subsequent Programming Task". The 13 November Word files and `docs/manuscript/Chapter-3.pdf` (a 30 October draft) are older and superseded.
**Supersedes:** [ml-feature-alignment.md](ml-feature-alignment.md) and checklist item M05 in [BYTEQUEST_MANUSCRIPT_ALIGNMENT_CHECKLIST.md](BYTEQUEST_MANUSCRIPT_ALIGNMENT_CHECKLIST.md) ("replace the 10-feature claim with 13").

## 1. Goal

1. **Thesis defensibility first.** The code implements Chapter 3 exactly, so the pilot data produces the comparison the manuscript promises for SOP 4. Chapter 3 is frozen: the code changes to match it. Mismatches that only affect a description go on an errata list (section 7).
2. **Instructor use second.** Shadow forecasts support instructors' sequencing decisions (SOP 5). Students never see forecasts.
3. **Out of scope:**
   - live ML sequencing: rules keep driving students;
   - new ML capabilities such as clustering or error classification;
   - new Insights screens.

## 2. Where things stand

- Logistic regression and random forest predict pass or not-pass, and both probabilities are stored on each prediction. Rule-based sequencing is authoritative. Forecasts are shadow-only and visible to instructors only.
- Forecasting is off unless all of these hold:
  - `ML_SHADOW_ENABLED` is set;
  - `ML_SHADOW_RESEARCH_APPROVED` is set;
  - research consent is active and the learner's latest consent accepts the current version;
  - an `active_model.json` manifest selects an approved, non-synthetic run.
- The only trained run is synthetic (`ml_pipeline/artifacts/development/`). The backend refuses to serve it.
- This branch (`fix/ml-pr-auc-student-disjoint-split`, commit `54c4707`) already implements and commits:
  - the seeded, student-disjoint 60/20/20 split;
  - training-only preprocessing and tuning;
  - validation Average Precision selection with the 0.005 tie rule;
  - majority-class and prevalence baselines;
  - Brier score, ROC and PR curves;
  - the shared `DECISION_THRESHOLD = 0.50`.

  All of this matches the manuscript.
- The Insights work in the working tree moved forecasts into Student Progress. It deleted the ML Learner insights tab (`insights.tsx`), `ml_analytics.py` and `instructor-shadow-analytics.tsx`, because they duplicated Model evaluation. This plan does not restore them.

**Gaps against the manuscript:**

| Area | Manuscript | Code today |
|---|---|---|
| Training row | One per student per assigned programming task, at cutoff t0 before any submission on it | One per attempt, including retries |
| Targets | Programming challenges | Every attempt, quizzes included |
| Features | Ten named features | Thirteen different features |
| History | All earlier completed quizzes and attempts before t0 | Same course, same language and the target's topic only |
| Missing history | Left blank, imputed with training medians | Filled with 0 |

## 3. Decisions

| # | Decision |
|---|---|
| D1 | Thesis defensibility first, instructor use second. No live ML sequencing, no new ML capabilities. |
| D2 | Chapter 3 is frozen. The code matches the 14 November compilation. |
| D3 | The pilot collects consented data first. Training, review and activation happen after the pilot. Shadow forecasts reach instructors only in a later window. Everything in Phase A must land before data collection starts. |
| D4 | ML owns the models, the pipeline, prediction records, the forecast API (`/faculty/ml`) and the Model evaluation page. Insights owns how forecasts are shown in Student Progress. ML adds no Insights screens. |
| D5 | Adopt the manuscript's ten features exactly (section 4.3). Drop the execution-time, time-spent, difficulty and three released-exam features from the model. |
| D6 | One row per student per programming challenge at t0. A supplementary test report covers rows eligible for a live forecast. |
| D7 | Report seeded, learner-resampled bootstrap 95% confidence intervals on test metrics. Apply a predeclared minimum-data rule: the test partition must hold at least 6 learners and at least 15 rows of each outcome, otherwise results are "indicative only". The manuscript expects at least 30 respondents, which puts about 6 learners in the test partition. |
| D8 | SOP 5 evidence is a scripted, recorded walkthrough of instructors using shadow forecasts in Student Progress during the shadow window. No new tracking of instructor actions. |
| D9 | Hide the Model evaluation navigation entry while forecasting is off and no approved report exists. The route stays reachable. See conflict X1. |
| D10 | ML inputs are limited to attempt outcomes, error categories, timings, scores and hint-reveal counts. Never source code, hint text, tutor chat text, Gemini output or tutor-usage measures. |
| D11 | Descriptive mismatches go on an errata list for the adviser (section 7), not into code. |
| D12 | Targets are programming challenges only. Quizzes feed features but are never targets. The live forecast target is the learner's next unpassed published challenge. |
| D13 | t0 is the time of the learner's first graded submission on the challenge. The label is whether that submission meets the activity's pass mark. Infrastructure faults never create an attempt (`is_successful` is non-nullable), so the first stored attempt is the first graded one. |
| D14 | History is everything before t0 in the same course and the learner's language, across all topics. |
| D15 | Feature definitions as in section 4.3. A value with no history is left blank and filled with the training median. |
| D16 | Observed online accuracy counts one prediction per learner per challenge: the last snapshot saved before the first graded submission. |
| D17 | Live minimum-history rule: at least `prediction_min_history` (default 3) distinct prior tasks in the course. The topic restriction is removed. The supplementary report in D6 uses the same rule. |
| D18 | `prior_hint_usage_rate` counts hints on earlier tasks only, never on the target. A snapshot taken when the challenge is assigned cannot see later hints on it. |
| D19 | The Model evaluation page adds the confidence intervals, the "indicative only" verdict and the supplementary report. Nothing else on the page changes. |
| D20 | Implement on a new branch, for example `feat/ml-task-assignment-rows`, cut after the working tree's Insights, rail and critique changes are committed. Planning commits nothing. |

## 4. Target design

### 4.1 Prediction unit and label

- **Row:** one per (research code, programming challenge) the learner submitted at least once.
- **t0:** `created_at` of the learner's first stored non-exam attempt on that challenge.
- **Label:** that attempt's `is_successful`, which already applies the activity's pass mark. Later attempts on the same challenge never enter that row.
- **Excluded from rows:** quiz targets, exam-item attempts (`exam_attempt_id IS NOT NULL`) and challenges outside the course.
- **Cold start:** rows with no prior history stay in, as the manuscript says. Undefined features are left blank and imputed by the training-partition median.

### 4.2 History

Everything strictly before t0 counts, from the same course and the learner's language, across all topics:

- graded non-exam attempts on challenges and concept quizzes;
- hint reveals on tasks other than the target (D18).

Exam results are not features. `exam_history.py` stays because Student Progress still shows released exam history.

### 4.3 The ten features, in this order

| # | Name | Definition (history before t0) | No history |
|---|---|---|---|
| 1 | `prior_attempt_count` | Graded attempts, coding and quiz | 0 |
| 2 | `prior_pass_rate` | Passed ÷ graded attempts | blank |
| 3 | `prior_mean_score_ratio` | Mean `score_percentage` ÷ 100 | blank |
| 4 | `recent_3_pass_rate` | Pass rate of the last 3 attempts, or of all of them if fewer than 3 | blank |
| 5 | `prior_compile_error_rate` | Coding attempts with `error_category = syntax_error` or Judge0 status 6, ÷ coding attempts | blank |
| 6 | `prior_runtime_error_rate` | Coding attempts with `runtime_error` or `timeout`, or Judge0 status 5 or ≥ 7, ÷ coding attempts. Logic errors and wrong answers (status 4) are not counted. | blank |
| 7 | `mean_attempts_per_task` | Graded attempts ÷ distinct tasks attempted | blank |
| 8 | `prior_quiz_score_mean` | Mean `score_percentage` of concept-quiz attempts | blank |
| 9 | `prior_hint_usage_rate` | Hint reveals on earlier tasks ÷ distinct tasks attempted | blank |
| 10 | `days_since_last_attempt` | (t0 − last graded attempt) in days, as a float | blank |

Before coding item 6, check the Judge0 status mapping against `services/judge0` and keep one definition for training and live scoring. A blank becomes `NaN` in the model input, and the pipeline's median imputer fills it. Bump metadata `schema_version` to 3. The predictor rejects any other version.

### 4.4 Live shadow scoring

- **Target:** the next unpassed published challenge in the course and the learner's language (`targets.next_course_activity`, restricted to challenges).
- **Triggers** stay where they are: quiz submit, code submit, and exam release (see X3). Features are computed at the snapshot time with the same rules as section 4.2, so t0 is the snapshot time.
- **Minimum history (D17):** a learner with fewer than `prediction_min_history` distinct prior tasks in the course keeps the existing `insufficient_history` status, not a low probability.
- **Outcome:** `audit.record_prediction_outcome` already labels every earlier open snapshot from the first attempt on the target. That matches D13.
- **First submissions only** (added in implementation): shadow scoring saves nothing for a challenge the learner has already submitted, so a retry is never scored by a model trained on first submissions. Student Progress shows the status `first_submission_made` ("Forecasts cover first submissions only") for that learner.
- **Known skew:** live t0 is the snapshot time, so `days_since_last_attempt` is usually near 0 live, while offline it is the gap up to the first submission. A forecast cannot know when the learner will submit.

### 4.5 Reporting

`metrics_summary.json` adds three things:

- **`confidence_intervals`:** for each model and baseline on the test partition, percentile 95% intervals for accuracy, precision, recall, F1, ROC-AUC, Average Precision and Brier. They come from 1,000 learner-level bootstrap resamples seeded from `--seed`. A resample that lacks a class is skipped and counted.
- **`adequacy`:** `{min_test_learners: 6, min_rows_per_class: 15, met: bool}`. When `met` is false, the console output and the page say "indicative only".
- **`supplementary.live_eligible`:** the same frozen pipelines, scored once on the test rows that meet the D17 rule. It never informs selection.

Online evaluation (`GET /faculty/ml/evaluation`) counts one prediction per (student, target): the latest labelled snapshot created at or before the first attempt on the target. The response's `unit` becomes "learner-challenge predictions". Versions are still never pooled.

## 5. Work

### Phase A: before pilot data collection (has a deadline)

1. **Features** (`backend/app/services/ml_predictor/feature_engineering.py`): replace `FEATURE_NAMES` and the extraction with section 4.3. Accept hint-reveal rows. Return `NaN` where section 4.3 says blank. Keep `ml_pipeline/feature_engineering.py` as the re-export.
2. **Trainer** (`ml_pipeline/train_compare.py`):
   - Rewrite `prepare_ml_dataset` to section 4.1: first attempt per challenge, challenge targets only, and course-and-language history.
   - Add a hints CSV input (section 6).
   - Remove the exam-features input from training.
   - Rewrite the synthetic generator to produce challenges, quizzes and hints per student.
   - Add the confidence intervals, `adequacy` and `supplementary.live_eligible`, and set `schema_version` to 3.
3. **Predictor** (`predictor.py`):
   - Build the live history with section 4.2's rules: drop the topic filter, include quizzes, add hint reveals except on the target, and drop exam history.
   - Accept `schema_version` 3.
   - Add the new report keys to the allowlist (`_PARTITION_KEYS` and `_sanitized_report`).
4. **Shadow scoring** (`shadow.py` and `targets.py`): use challenge-only targets and the course-wide count for `prior_graded_task_count`.
5. **Faculty API** (`backend/app/api/faculty_ml.py`):
   - `_snapshot` uses the same challenge target and course-wide history count as shadow scoring. This keeps the "saved prediction is found" invariant noted in the code.
   - `evaluation()` uses the D16 counting unit.
6. **Export documentation** (`ml_pipeline/README.md`): describe the row and label, add the hints export, and drop the exam export from training.
7. **Tests:**
   - Update `backend/tests/test_ml_exam_features.py`. It becomes a check that exam results are excluded from features but still shown in history.
   - Update `test_ml_export_consent.py` and the ML cases in `test_faculty_admin.py`.
   - Add tests for: one row per challenge; retries excluded; quiz targets excluded; target hints excluded; `NaN` for cold-start rows; reproducible confidence intervals at seed 42; and `adequacy.met` false on a small dataset.
8. **Regenerate** the synthetic development run. Confirm the backend still refuses it, and that two runs at seed 42 produce identical metrics.

### Phase B: Model evaluation page (no deadline)

**Done on 22 November 2026** (branch `feat/ml-evaluation-page`). Each test metric shows its 95% interval under the value (one cell, so the table still fits a phone), with a footnote counting skipped resamples. The adequacy verdict states the real learner and row counts, and a supplementary table covers learners eligible for a live forecast, test partition only. `/faculty/courses` now returns `model_evaluation_available`, and the instructor menu hides Model evaluation while it is false (D9). The page stays reachable from Student Progress and by its address. The page also opens with a short purpose, advisory-use and status summary (UI/UX slice 4), so it reads correctly before an approved report exists. No synthetic run is shown in the app.

1. **Report sections** (`frontend/src/app/(workspace)/instructor/ml/evaluation.tsx` and `types.ts`):
   - an interval column beside each test metric;
   - an "Indicative only" notice when `adequacy.met` is false;
   - a "Learners eligible for a live forecast" comparison table.

   Update `evaluation.test.tsx`.
2. **Hide the navigation entry** (D9) in `components/instructor/course-navigation-links.tsx` and the phone rail, while `forecasts_available` is false and no offline report exists. Take the flag from a payload the course shell already loads. If none carries it, add one boolean there rather than making another request.

### Phase C: after the pilot

1. Export the consented data: attempts, plus hints for the same consent version. Train with `--research-approved`, then check `adequacy`.
2. Hold a reviewed activation decision (`active_model.json`). Record the build, data and model versions.
3. Run the shadow window: forecasts appear in Student Progress for consented learners.
4. Record the scripted instructor walkthrough as SOP 5 evidence (D8).
5. Report SOP 4 from the frozen test partition, with intervals and the adequacy verdict. The supplementary report is labelled as such.

## 6. Data and privacy

- The hints export has one row per reveal:
  - `md5(code || ':' || hint_use.id)` as `id`;
  - the research code as `student_id`;
  - `activity_id`;
  - `created_at`.

  It uses the same `latest_consent` join and `:current_consent_version` as the attempt export. Never export `body`, `hint_id` text, `request_key` or `source`.
- The trainer's identifier screening applies to the hints CSV too.
- Nothing from tutor chat, Gemini output or source code enters any export (D10).

## 7. Errata for the adviser (manuscript stays frozen)

| Manuscript claim | Build | Proposed erratum |
|---|---|---|
| Rule-based sequencer "at all eight student exit points" (Algorithm 4, p. ~45) | 3 sequencer call sites (quiz submit, code submit, the `sequencer.py` helper). Shadow snapshots on quiz submit, code submit and exam release. | State the verified trigger list instead of "eight". |
| Artifacts in `ml_pipeline/artifacts/v1.0.0-<UTC timestamp>/` | Approved runs in `artifacts/runs/<model-version>/`, synthetic runs in `artifacts/development/<model-version>/` | Correct the path. |
| `model_metadata.json` holds "the 10 feature names" | True after Phase A, with `schema_version` 3 | None after Phase A. |
| Repository copy `docs/manuscript/Chapter-3.pdf` | 30 October draft | Replace with the frozen compilation, or mark it superseded. |

## 8. Conflicts to report (not decided here)

- **X1. Navigation entry hidden (D9).** Hiding the Model evaluation entry while forecasting is off hides a visible feature. It is conditional and reversible, and the route stays. The owner approved it, but it touches the shared navigation the Insights work also changes, so it needs coordination.
- **X2. Forecast target changes (D12).** Student Progress shows the next challenge, not the next activity of any kind. The forecast API changes. How Student Progress shows it belongs to Insights. That team should check its "Next activity" wording.
- **X3. Exam-release trigger becomes redundant.** With exam features gone, a snapshot on exam release repeats the previous features. Leave it unless a later review removes it. It is harmless.
- **X4. Exam features removed from the model (D5).** Three model inputs go. Released exam results stay visible to instructors.

## 9. Done means

- Phase A merged before pilot data collection starts.
- The feature list in code, metadata and manuscript are identical.
- Backend tests pass against local Supabase, using synthetic accounts and mocked Gemini.
- The seed-42 synthetic run is reproducible and refused by the backend.
- The faculty evaluation API counts one prediction per learner per challenge.
- After the pilot: an approved run with intervals and an adequacy verdict, a recorded activation decision, and the SOP 5 walkthrough record.

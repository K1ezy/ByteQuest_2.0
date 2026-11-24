# ML feature engineering and training

The backend feature extractor is the canonical train/serve contract. Offline
training and live inference both import
`backend/app/services/ml_predictor/feature_engineering.py` through the
compatibility export in this directory. Training artifacts are versioned and
remain inactive unless a later, separately reviewed Phase 6 activation points
the backend at them. The student quest flow continues to use deterministic
rules.

## Safe pipeline setup

To exercise the comparison pipeline without research data, run it with its
synthetic bootstrap dataset:

```powershell
python ml_pipeline/train_compare.py
```

This creates a development-only run under
`ml_pipeline/artifacts/development/<model-version>/`. Its metrics are not
empirical findings and the backend refuses to serve the synthetic models.

Do not use real student attempts until the required institutional approval and
consent are in place. The CLI requires an explicit `--research-approved`
confirmation before it will read a CSV. That flag is an operator attestation;
it does not grant, verify, or replace institutional approval. Use only a
de-identified export with research-code `student_id` values, and never include
names, account UUIDs, contact details, IP addresses, or source code.

## Export an attempt dataset

When approved, export one joined attempt/activity row per attempt, and one row
per hint reveal. Use the random research code
(`bytequest_private.research_codes`, issued when a student accepts consent) as
the group identifier, not `pseudonym_id`, which encodes the account id. Row
identifiers are hashed with the code, so once the codes are destroyed at the
end of the study (`backend/scripts/destroy_research_link.py`) the export cannot
be joined back to accounts through ids. The training script rejects common
identifying columns, email/UUID/numeric student identifiers, malformed rows,
and non-chronological attempt sequences; these checks reduce accidental
exposure but cannot prove that arbitrary identifiers are anonymous. The hint
export carries who, where and when only: never the hint text, its source or
the request key.

The export script holds both queries and runs them for you. It reads
`RESEARCH_CONSENT_VERSION` from the backend settings, refuses to run while
`RESEARCH_CONSENT_ACTIVE` is off, and needs `--research-approved` as the same
operator attestation as the trainer. The latest consent event for each learner
must accept that version: a past acceptance does not override a later decline
or withdrawal. Run it from `backend/` with the database owner's `DATABASE_URL`:

```powershell
.venv\Scripts\python -m scripts.export_ml_dataset --research-approved
```

It writes three files, all ignored by git:

| File | Contents |
| --- | --- |
| `ml_pipeline/data/attempts.csv` | One row per graded, non-exam attempt. Training input. |
| `ml_pipeline/data/hints.csv` | One row per hint reveal. Training input. |
| `ml_pipeline/ten_model_inputs/ten_model_inputs.csv` | One row per learner and programming challenge: `student_id` (research code), `course_id`, `language`, `activity_id`, `first_submission_passed` (the outcome), the ten inputs in `FEATURE_NAMES` order, and `live_eligible`. |

`ten_model_inputs.csv` is the readable copy of exactly what the two models see.
`train_compare.ten_model_input_table` builds it with the live predictor's
feature code, and `prepare_ml_dataset` trains from the same table, so the file
can't drift from training or serving. A blank input means the learner had no
history for it yet; training fills it with the training-partition median.
The SQL is `ATTEMPTS_SQL` and `HINTS_SQL` in
[`backend/scripts/export_ml_dataset.py`](../backend/scripts/export_ml_dataset.py).

Students give or refuse research consent with an optional checkbox in the
sign-up Terms step, described in section VI of the Privacy Policy. Their answer
is recorded the first time they are signed in, as their first answer to the
current form. Students with accounts from before sign-up asked are asked once
on the Dashboard. Either way they can change it in Research participation.

### Rehearse with the synthetic four-section scenario

To see the export fill every input before real students exist, seed the local
database with 120 synthetic students, all consenting: 30 each in 1CSA and 1CSC
(course `SYNML-Y1-PY`, Python) and 2CSB and 2CSC (course `SYNML-Y2-JAVA`,
Java). Each course has a diagnostic quiz, 10 challenges and 3 more quizzes. A
seeded simulation gives every student graded attempts with compile, runtime,
time-limit and wrong-answer failures, retries until a pass, hint reveals and
quiz scores. Research consent must be on. From `backend/`:

```powershell
.venv\Scripts\python -m scripts.seed_local_ml_scenario
.venv\Scripts\python -m scripts.export_ml_dataset --research-approved
```

The export then writes 1,200 ten-input rows. Each student's first challenge
leaves the two error-rate inputs blank, because there is no earlier coding
attempt to count. The seeder refuses any database that isn't on this machine,
reseeding replaces the scenario, and
`.venv\Scripts\python -m scripts.seed_local_ml_scenario --remove` deletes it.
Don't train this data with `--research-approved`: that labels the run as
approved research. Train it as a synthetic run instead, which goes to
`artifacts/development/` and is never served:

```powershell
cd ..
backend\.venv\Scripts\python -c "import pandas as pd; from ml_pipeline.train_compare import run_training_and_comparison as run, DATASET_SOURCE_SYNTHETIC as S; run(pd.read_csv('ml_pipeline/data/attempts.csv'), hints_df=pd.read_csv('ml_pipeline/data/hints.csv'), dataset_source=S)"
```

Released exam results are not model features. Student Progress still shows
them to instructors.

Train from the repository root only after approval. A hint CSV with headers and no rows is valid when no
learner revealed a hint:

```powershell
python -m pip install -r backend/requirements.txt
python ml_pipeline/train_compare.py --data-csv .\ml_pipeline\data\attempts.csv --hints-csv .\ml_pipeline\data\hints.csv --research-approved
```

The script includes cold-start rows and writes both pipelines, model metadata,
ROC and precision-recall curve points, confusion matrices, and per-partition
metrics to an immutable `ml_pipeline/artifacts/runs/<model-version>/`
directory. Files are staged and published as one completed run; metadata
includes SHA-256 integrity hashes. Each run records its data source, feature
schema, library version, sample and student counts, the full comparison
protocol, and the evaluation results. It does not write an activation manifest
or replace earlier runs.

## Comparison protocol

Every run follows the protocol the thesis reports, and records it under
`protocol` in `metrics_summary.json` so a reader never has to infer it:

- **Prediction unit.** One row per learner and programming challenge at t0,
  the learner's first graded submission on that challenge. The label is
  whether that submission met the activity's pass mark. Retries never become
  rows, and quizzes are history, never targets.
- **Features.** The manuscript's ten features, in `FEATURE_NAMES` order, from
  graded attempts and hint reveals in the same course and language strictly
  before t0. Hints on the target challenge never count. A value that has no
  history is left blank and filled by the training-partition median.
- **Split.** Rows are partitioned 60/20/20 into train, validation and test by
  `student_id`, so no student's records span partitions. Students are dealt out
  from one seeded permutation stream (`--seed`, default 42), and candidate
  permutations are redrawn until all three partitions carry both outcome
  classes. The split is reproducible from the seed alone.
- **Preprocessing and tuning.** Median imputation, scaling and the
  `GridSearchCV` hyperparameter search run inside the training partition only,
  over student-grouped `GroupKFold` folds. Validation and test rows never
  influence a fitted transformer or a chosen hyperparameter.
- **Selection.** The winner is the model with the higher validation Average
  Precision (PR-AUC), which stays informative when passes and failures are
  imbalanced. A predeclared tie rule resolves gaps of at most 0.005 to logistic
  regression as the simpler, directly interpretable model.
- **Test evaluation.** Both pipelines are frozen and the winner is fixed before
  the test partition is scored, once, informing no decision. Reported metrics
  are accuracy, precision, recall, F1, ROC-AUC, Average Precision, Brier score
  and the confusion matrix, beside a majority-class and a prevalence baseline
  fitted on the same training partition.
- **Threshold.** Every threshold-dependent metric uses `DECISION_THRESHOLD`
  from `backend/app/services/ml_predictor/thresholds.py`, the same constant the
  live predictor classifies with, so a reported metric and a served prediction
  can never disagree about where a predicted pass begins. The wider 0.60/0.40
  advisory bands in that module drive next-task guidance only and never enter
  the reported metrics.
- **Saved artifacts.** The published pipelines are the ones fitted on the
  training partition, so the reported test metrics describe exactly the models
  on disk rather than a later refit on all rows. Metadata `schema_version` is 3;
  the backend refuses any other.
- **Uncertainty.** `confidence_intervals` holds 95% percentile intervals for
  every test metric from 1,000 seeded resamples of test learners. Resamples
  with a single outcome class are skipped and counted.
- **Adequacy.** `adequacy.met` is false unless the test partition holds at
  least 6 learners and 15 rows of each outcome. Below that, results are
  indicative only, and the CLI says so.
- **Supplementary.** `supplementary.live_eligible` scores the same frozen
  estimators on the test rows with at least `--min-history` (default 3)
  distinct prior tasks, the rows a live forecast would cover. It informs no
  decision.

The backend loader checks for a separate explicit `active_model.json`, requires
the selected version to be inside `artifacts/runs/`, validates approval and
feature/library metadata, verifies artifact hashes, and rejects synthetic
models. Do not create that activation manifest as part of Phase 5. A reviewed
Phase 6 decision is required first. No model training or model activation is
performed by the regular local startup script.

The current local student submission flow does not require model artifacts and
keeps rule-based sequencing active. Apply the ML analytics and later username,
snapshot, and exam release migrations before using prediction logging and the
faculty Machine Learning dashboard.

## Prepare an Ubuntu VPS

From the repository root, copy the script to the VPS and run:

```bash
sudo bash infra/vps_bootstrap.sh
```

The default run installs Docker and configures 4 GB of swap. Firewall
activation and the legacy cgroup setting are opt-in. If enabling UFW, confirm
the active SSH port first and pass `--enable-firewall`; only add
`--enable-cgroup-v1` when required by the Judge0 host configuration, then
reboot to apply the GRUB change.

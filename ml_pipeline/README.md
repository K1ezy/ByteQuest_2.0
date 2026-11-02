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
de-identified export with pseudonymous `student_id` values, and never include
names, account UUIDs, contact details, IP addresses, or source code.

## Export an attempt dataset

When approved, export one joined attempt/activity row per attempt. Use
`pseudonym_id` as the group identifier. The training script rejects common
identifying columns, email/UUID/numeric student identifiers, malformed rows,
and non-chronological attempt sequences; these checks reduce accidental
exposure but cannot prove that arbitrary identifiers are anonymous.

```sql
SELECT
    aa.id::text AS id,
    p.pseudonym_id AS student_id,
    aa.activity_id::text AS activity_id,
    aa.attempt_number,
    aa.created_at,
    la.language::text AS language,
    la.topic_concept,
    la.activity_type::text AS activity_type,
    la.difficulty_level,
    aa.is_successful,
    aa.score_percentage,
    aa.error_category,
    aa.compiler_status_id,
    aa.execution_time_ms,
    aa.time_spent_seconds
FROM public.activity_attempts AS aa
JOIN public.profiles AS p ON p.id = aa.student_id
JOIN public.learning_activities AS la ON la.id = aa.activity_id
ORDER BY p.pseudonym_id, aa.created_at, aa.attempt_number, aa.id;
```

Save the approved, de-identified result as a CSV and train from the repository
root only after approval:

```powershell
python -m pip install -r backend/requirements.txt
python ml_pipeline/train_compare.py --data-csv .\ml_pipeline\data\attempts.csv --research-approved
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
  on disk rather than a later refit on all rows.

The backend loader checks for a separate explicit `active_model.json`, requires
the selected version to be inside `artifacts/runs/`, validates approval and
feature/library metadata, verifies artifact hashes, and rejects synthetic
models. Do not create that activation manifest as part of Phase 5. A reviewed
Phase 6 decision is required first. No model training or model activation is
performed by the regular local startup script.

The current local student submission flow does not require model artifacts and
keeps rule-based sequencing active. The Supabase migration
`supabase/migrations/20261023_ml_analytics.sql` must be applied before using
prediction logging and analytics.

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

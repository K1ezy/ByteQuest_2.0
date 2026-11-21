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

Both export queries below require the named SQL parameter
`:current_consent_version`. Bind it to the currently active backend
`RESEARCH_CONSENT_VERSION` using a parameter-aware SQL client, after confirming
`RESEARCH_CONSENT_ACTIVE` and institutional approval. In a SQL editor without
named parameters, replace the parameter with a correctly quoted literal of
that exact version before running either query. An unbound parameter fails;
an unmatched version returns no rows. The latest consent event for each learner
must accept that version. A past acceptance does not override a later decline
or withdrawal. Use the same version for both exports.

```sql
WITH latest_consent AS (
    SELECT DISTINCT ON (student_id) student_id, choice, document_version
    FROM public.research_consents
    ORDER BY student_id, event_order DESC
)
SELECT
    md5(rc.code || ':' || aa.id::text) AS id,
    rc.code AS student_id,
    aa.activity_id::text AS activity_id,
    la.course_id::text AS course_id,
    aa.exam_attempt_id::text AS exam_attempt_id,
    aa.attempt_number,
    aa.created_at,
    la.language::text AS language,
    la.activity_type::text AS activity_type,
    aa.is_successful,
    aa.score_percentage,
    aa.error_category,
    aa.compiler_status_id
FROM public.activity_attempts AS aa
JOIN latest_consent AS consent ON consent.student_id = aa.student_id
    AND consent.choice = 'accepted'
    AND consent.document_version = :current_consent_version
JOIN bytequest_private.research_codes AS rc ON rc.student_id = aa.student_id
JOIN public.learning_activities AS la ON la.id = aa.activity_id
WHERE aa.exam_attempt_id IS NULL AND la.course_id IS NOT NULL
ORDER BY rc.code, aa.created_at, aa.attempt_number, aa.id;
```

Export hint reveals with the same research codes and consent version:

```sql
WITH latest_consent AS (
    SELECT DISTINCT ON (student_id) student_id, choice, document_version
    FROM public.research_consents
    ORDER BY student_id, event_order DESC
)
SELECT
    md5(rc.code || ':' || hu.id::text) AS id,
    rc.code AS student_id,
    hu.activity_id::text AS activity_id,
    la.course_id::text AS course_id,
    la.language::text AS language,
    hu.created_at
FROM public.hint_uses AS hu
JOIN latest_consent AS consent ON consent.student_id = hu.student_id
    AND consent.choice = 'accepted'
    AND consent.document_version = :current_consent_version
JOIN bytequest_private.research_codes AS rc ON rc.student_id = hu.student_id
JOIN public.learning_activities AS la ON la.id = hu.activity_id
WHERE la.course_id IS NOT NULL
ORDER BY rc.code, hu.created_at, hu.id;
```

Released exam results are not model features. Student Progress still shows
them to instructors.

Save the approved, de-identified results as CSVs and train from the repository
root only after approval. A hint CSV with headers and no rows is valid when no
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

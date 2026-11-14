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
    aa.id::text AS id,
    p.pseudonym_id AS student_id,
    aa.activity_id::text AS activity_id,
    la.course_id::text AS course_id,
    aa.exam_attempt_id::text AS exam_attempt_id,
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
JOIN latest_consent AS consent ON consent.student_id = p.id
    AND consent.choice = 'accepted'
    AND consent.document_version = :current_consent_version
JOIN public.learning_activities AS la ON la.id = aa.activity_id
WHERE aa.exam_attempt_id IS NULL AND la.course_id IS NOT NULL
ORDER BY p.pseudonym_id, aa.created_at, aa.attempt_number, aa.id;
```

Export released overall exam results separately. An exam is associated with a
course only when **all** its items belong to that course; mixed-course exams are
excluded. Use the same pseudonymous `student_id` values as the attempt export.
Apply `20261111154648_usernames_ml_dashboard.sql` and
`20261112000100_exam_attempt_release_time.sql` before exporting. The latter
records a release time for each attempt; older retakes are backfilled with the
latest known exam release time so historical features cannot become available
too early.

```sql
WITH latest_consent AS (
    SELECT DISTINCT ON (student_id) student_id, choice, document_version
    FROM public.research_consents
    ORDER BY student_id, event_order DESC
), course_exams AS (
    SELECT ei.exam_id, max(la.course_id::text)::uuid AS course_id
    FROM public.exam_items AS ei
    JOIN public.learning_activities AS la ON la.id = ei.activity_id
    GROUP BY ei.exam_id
    HAVING count(*) = count(la.course_id)
       AND count(DISTINCT la.course_id) = 1
)
SELECT p.pseudonym_id AS student_id,
       ce.course_id::text AS course_id,
       ea.id::text AS exam_attempt_id,
       ea.result_released_at AS released_at,
       round((ea.score / ea.max_score * 100)::numeric, 2) AS score_percentage
FROM public.exam_attempts AS ea
JOIN public.exams AS e ON e.id = ea.exam_id
JOIN course_exams AS ce ON ce.exam_id = e.id
JOIN public.profiles AS p ON p.id = ea.student_id
JOIN latest_consent AS consent ON consent.student_id = p.id
    AND consent.choice = 'accepted'
    AND consent.document_version = :current_consent_version
WHERE ea.status = 'submitted'
  AND ea.result_released_at IS NOT NULL
  AND ea.submitted_at <= ea.result_released_at
  AND ea.max_score > 0
ORDER BY p.pseudonym_id, ea.result_released_at, ea.id;
```

Save the approved, de-identified result as a CSV and train from the repository
root only after approval:

```powershell
python -m pip install -r backend/requirements.txt
python ml_pipeline/train_compare.py --data-csv .\ml_pipeline\data\attempts.csv --exams-csv .\ml_pipeline\data\exams.csv --research-approved
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

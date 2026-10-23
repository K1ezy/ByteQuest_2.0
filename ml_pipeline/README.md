# ML training and deployment

## Export an attempt dataset

Export one joined attempt/activity row per attempt. Use the pseudonym as the
group identifier; do not export a student's name, email, or auth identifier.

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

Save the result as a CSV and train from the repository root:

```powershell
python -m pip install -r backend/requirements.txt
python ml_pipeline/train_compare.py --data-csv .\ml_pipeline\data\attempts.csv
```

The script includes cold-start rows, performs nested student-grouped
`GroupKFold` evaluation and tuning, and writes both pipelines, model metadata,
ROC curve points, confusion matrices, and fold metrics to `ml_pipeline/artifacts/`.
If no CSV is supplied, it generates a synthetic bootstrap dataset for
development; its results are labeled and cannot be activated in production.

Train and serve with the same scikit-learn version. The loader checks that
version and the feature order before activating models. The Compose service
mounts `ml_pipeline/artifacts/` read-only at `/app/ml_artifacts`; place both
`.joblib` files and `model_metadata.json` there before restarting the backend.
The Supabase migration `supabase/migrations/20261023_ml_analytics.sql` must be
applied before using prediction logging and analytics.

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

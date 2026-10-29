# ML pipeline synthetic verification — 2026-10-25

## Scope

Executed the Phase 5 comparative training pipeline with its built-in synthetic
bootstrap dataset. No student or classroom records were read. This verifies
that the local training pipeline can complete and emit a versioned artifact
bundle; it does not measure real student outcomes or establish model quality.

## Execution

From the repository root, using the backend virtual environment:

```powershell
& .\backend\.venv\Scripts\python.exe .\ml_pipeline\train_compare.py
```

The command completed successfully on 2026-10-25. The pipeline processed 1,000
synthetic attempts from 50 synthetic students, using five outer
`GroupKFold` folds grouped by student for both classifiers.

## Observed grouped metrics

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---:|---:|---:|---:|---:|
| Logistic Regression | 0.670 | 0.753 | 0.689 | 0.714 | 0.715 |
| Random Forest | 0.646 | 0.748 | 0.642 | 0.688 | 0.710 |

These values describe only the generated synthetic dataset. They must not be
reported as empirical classroom or thesis findings and must not be used to
claim that one model performs better on real students.

## Artifact and activation checks

The immutable run was written to:

```text
ml_pipeline/artifacts/development/v1.0.0-20261025T141900494209Z/
```

The output contains both model pipelines, `metrics_summary.json`, and
`model_metadata.json`. SHA-256 values for both model files and the metrics file
matched the values recorded in the metadata. The run is marked
`synthetic_bootstrap`, `is_synthetic_data: true`, and
`research_approved: false`. No `active_model.json` exists, so this run is not
loadable by the backend. Rule-based sequencing remains active.

`python -m py_compile` succeeded for the feature extractor, predictor, and
training script, and `git diff --check` completed successfully. The automated
test suite was not run.

## Remaining Phase 5 work

Empirical evaluation requires an approved, de-identified dataset and a separate
training run. The `--research-approved` CLI option is an operator attestation;
it does not grant or replace institutional approval or consent. Phase 6 model
shadow evaluation and any activation decision remain separate work.

"""Grouped, leakage-resistant comparison of student-success models.

Input CSV files contain one joined activity attempt per row with the columns
required by ``REQUIRED_COLUMNS``. Without a CSV, a clearly labeled synthetic
dataset is used for pipeline setup; those results are not empirical findings.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import GridSearchCV, GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.ml_predictor.feature_engineering import (  # noqa: E402
    FEATURE_NAMES,
    extract_features_from_dataframe,
)

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
RANDOM_SEED = 42
MODEL_VERSION = "v1.0.0"
DATASET_SOURCE_SYNTHETIC = "synthetic_bootstrap"
DATASET_SOURCE_APPROVED = "approved_deidentified_csv"
REQUIRED_COLUMNS = {
    "id",
    "student_id",
    "activity_id",
    "attempt_number",
    "created_at",
    "language",
    "topic_concept",
    "activity_type",
    "difficulty_level",
    "is_successful",
    "score_percentage",
    "error_category",
    "compiler_status_id",
    "execution_time_ms",
    "time_spent_seconds",
}
NON_NULL_CONTEXT_COLUMNS = {
    "id",
    "student_id",
    "activity_id",
    "attempt_number",
    "created_at",
    "language",
    "topic_concept",
    "activity_type",
    "difficulty_level",
    "is_successful",
}
SENSITIVE_COLUMN_MARKERS = (
    "name",
    "email",
    "phone",
    "mobile",
    "password",
    "auth",
    "profile",
    "account",
    "user_id",
    "user_uuid",
    "student_number",
    "student_no",
    "birth",
    "address",
    "ip",
    "source_code",
    "submitted_code",
    "submission_code",
    "token",
)


def _as_binary_label(value: Any) -> int:
    if isinstance(value, (bool, np.bool_)):
        return int(value)
    if isinstance(value, (int, np.integer)) and value in (0, 1):
        return int(value)
    if isinstance(value, (float, np.floating)) and np.isfinite(value) and value in (0.0, 1.0):
        return int(value)
    normalized = str(value).strip().casefold()
    if normalized in {"1", "true", "t", "yes", "success", "successful", "passed"}:
        return 1
    if normalized in {"0", "false", "f", "no", "failure", "failed", "unsuccessful"}:
        return 0
    raise ValueError(f"Invalid binary success label: {value!r}")


def _sort_attempts(group: pd.DataFrame) -> pd.DataFrame:
    # prepare_ml_dataset validates every timestamp and tie-breaker before this
    # function is called. Never fall back to CSV row order: that would make the
    # generated historical features depend on how the export was sorted.
    return group.sort_values(
        ["created_at", "attempt_number", "id"], kind="stable"
    )


def _validate_training_frame(df: pd.DataFrame) -> pd.DataFrame:
    if not df.columns.is_unique:
        raise ValueError("Attempt dataset contains duplicate column names.")
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Attempt dataset is missing required columns: {', '.join(sorted(missing))}")
    if df.empty:
        raise ValueError("Attempt dataset contains no rows.")

    sensitive_columns = sorted(
        str(column)
        for column in df.columns
        if any(marker in str(column).strip().casefold() for marker in SENSITIVE_COLUMN_MARKERS)
    )
    if sensitive_columns:
        raise ValueError(
            "Attempt dataset contains identifying or raw-submission columns: "
            + ", ".join(sensitive_columns)
            + ". Export pseudonymous student_id values only; remove names, account identifiers, "
            "contact details, IP addresses, and submitted source code."
        )

    valid_rows = df.copy()
    missing_context = [
        column for column in NON_NULL_CONTEXT_COLUMNS if valid_rows[column].isna().any()
    ]
    if missing_context:
        raise ValueError(
            "Attempt dataset has missing values in required context columns: "
            + ", ".join(sorted(missing_context))
        )
    text_columns = (
        "id",
        "student_id",
        "activity_id",
        "language",
        "topic_concept",
        "activity_type",
    )
    for column in text_columns:
        valid_rows[column] = valid_rows[column].astype(str).str.strip()
        blank = valid_rows[column].eq("")
        if blank.any():
            raise ValueError(f"Attempt dataset contains blank values in {column}.")

    valid_rows["attempt_number"] = pd.to_numeric(
        valid_rows["attempt_number"], errors="coerce"
    )
    attempts = valid_rows["attempt_number"]
    if (
        attempts.isna().any()
        or not np.isfinite(attempts.to_numpy(dtype=float)).all()
        or (attempts < 1).any()
        or not np.equal(attempts, np.floor(attempts)).all()
    ):
        raise ValueError("attempt_number must contain positive whole numbers.")
    valid_rows["attempt_number"] = attempts.astype("int64")

    if valid_rows["id"].duplicated().any():
        raise ValueError("Attempt dataset contains duplicate attempt ids.")
    if valid_rows.duplicated(["student_id", "activity_id", "attempt_number"]).any():
        raise ValueError(
            "Attempt dataset contains duplicate student/activity/attempt-number rows."
        )
    student_ids = valid_rows["student_id"]
    if student_ids.str.contains(r"\S+@\S+\.\S+", regex=True).any():
        raise ValueError("student_id must be a pseudonym, not an email address.")
    if student_ids.str.fullmatch(r"\d+").any():
        raise ValueError("student_id cannot be a numeric student or account number.")
    if student_ids.str.fullmatch(
        r"(?i)(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})"
    ).any():
        raise ValueError("student_id cannot be a raw UUID; export pseudonym_id values instead.")

    valid_rows["created_at"] = pd.to_datetime(
        valid_rows["created_at"], errors="coerce", utc=True
    )
    if valid_rows["created_at"].isna().any():
        raise ValueError(
            "Every created_at value must be a valid timestamp for chronological training."
        )
    valid_rows["difficulty_level"] = pd.to_numeric(
        valid_rows["difficulty_level"], errors="coerce"
    )
    if (
        valid_rows["difficulty_level"].isna().any()
        or not np.isfinite(valid_rows["difficulty_level"].to_numpy(dtype=float)).all()
        or not valid_rows["difficulty_level"].between(1, 5).all()
    ):
        raise ValueError("difficulty_level must contain numeric values from 1 through 5.")

    languages = valid_rows["language"].str.casefold()
    if not languages.isin({"cpp", "python", "java"}).all():
        raise ValueError("language must contain only cpp, python, or java values.")
    valid_rows["language"] = languages
    activity_types = valid_rows["activity_type"].str.casefold()
    if not activity_types.isin({"quiz", "challenge"}).all():
        raise ValueError("activity_type must contain only quiz or challenge values.")
    valid_rows["activity_type"] = activity_types

    valid_rows["is_successful"] = [
        _as_binary_label(value) for value in valid_rows["is_successful"]
    ]
    for column in ("score_percentage", "execution_time_ms", "time_spent_seconds"):
        raw_values = valid_rows[column]
        numeric_values = pd.to_numeric(raw_values, errors="coerce")
        invalid_conversion = raw_values.notna() & numeric_values.isna()
        non_finite = numeric_values.notna() & ~np.isfinite(numeric_values.astype(float))
        if invalid_conversion.any() or non_finite.any():
            raise ValueError(f"{column} must contain finite numeric values or blanks.")
        if (numeric_values.dropna() < 0).any():
            raise ValueError(f"{column} cannot contain negative values.")
        if column == "score_percentage" and (numeric_values.dropna() > 100).any():
            raise ValueError("score_percentage must be between 0 and 100.")
        valid_rows[column] = numeric_values

    raw_status_ids = valid_rows["compiler_status_id"]
    status_ids = pd.to_numeric(raw_status_ids, errors="coerce")
    if (raw_status_ids.notna() & status_ids.isna()).any():
        raise ValueError("compiler_status_id must contain numeric values or blanks.")
    present_status_ids = status_ids.dropna()
    if not present_status_ids.empty and (
        not np.isfinite(present_status_ids.to_numpy(dtype=float)).all()
        or (present_status_ids < 1).any()
        or not np.equal(present_status_ids, np.floor(present_status_ids)).all()
    ):
        raise ValueError("compiler_status_id must contain positive whole numbers or blanks.")
    valid_rows["compiler_status_id"] = status_ids

    for _, activity_rows in valid_rows.groupby(
        ["student_id", "activity_id"], sort=False, dropna=False
    ):
        ordered = activity_rows.sort_values("attempt_number", kind="stable")
        if not ordered["created_at"].is_monotonic_increasing:
            raise ValueError(
                "Attempt timestamps must not move backwards as attempt_number increases."
            )
    return valid_rows


def prepare_ml_dataset(df: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Build one feature/label row per outcome, including each cold-start row.

    CSV input must be a joined activity_attempts/learning_activities export so
    it contains the same context and telemetry available to live inference.
    """
    valid_rows = _validate_training_frame(df)

    feature_rows: list[dict[str, float]] = []
    labels: list[int] = []
    groups: list[Any] = []

    for student_id, student_rows in valid_rows.groupby("student_id", sort=False, dropna=True):
        ordered = _sort_attempts(student_rows)
        for position in range(len(ordered)):
            prior_history = ordered.iloc[:position]
            outcome = ordered.iloc[position]
            feature_rows.append(
                extract_features_from_dataframe(
                    prior_attempts=prior_history,
                    target_difficulty=outcome.get("difficulty_level"),
                    target_language=outcome.get("language"),
                    target_topic=outcome.get("topic_concept"),
                )
            )
            labels.append(_as_binary_label(outcome["is_successful"]))
            groups.append(student_id)

    if not feature_rows:
        raise ValueError("Could not create any labeled feature rows from this dataset.")
    X = pd.DataFrame(feature_rows, columns=FEATURE_NAMES, dtype=float)
    y = np.asarray(labels, dtype=np.int8)
    group_ids = np.asarray(groups)
    if not np.isfinite(X.to_numpy()).all():
        raise ValueError("Feature extraction produced non-finite values.")
    if set(np.unique(y)) != {0, 1}:
        raise ValueError("Training requires at least one successful and one unsuccessful outcome.")
    return X, y, group_ids


def generate_synthetic_thesis_dataset(
    num_students: int = 50,
    records_per_student: int = 20,
    seed: int = RANDOM_SEED,
) -> pd.DataFrame:
    """Generate reproducible bootstrap records for pipeline setup only."""
    if num_students < 5 or records_per_student < 1:
        raise ValueError("Synthetic data requires at least five students and one record per student.")
    rng = np.random.default_rng(seed)
    languages = np.array(["cpp", "python", "java"])
    topics = np.array(["variables", "loops", "functions", "arrays"])
    records: list[dict[str, Any]] = []

    for student_index in range(num_students):
        student_id = f"synthetic-student-{student_index:04d}"
        ability = rng.uniform(0.25, 0.9)
        for record_index in range(records_per_student):
            difficulty = int(rng.integers(1, 6))
            language = str(languages[record_index % len(languages)])
            topic = str(topics[(record_index // len(languages)) % len(topics)])
            logit = (ability - (difficulty - 1) / 5.0) * 3.0
            probability = 1.0 / (1.0 + np.exp(-logit))
            is_successful = bool(rng.random() < probability)
            error_category = "none" if is_successful else str(
                rng.choice(["syntax_error", "logic_error", "runtime_error", "timeout"], p=[0.3, 0.4, 0.2, 0.1])
            )
            records.append(
                {
                    "id": f"synthetic-attempt-{student_index:04d}-{record_index:04d}",
                    "student_id": student_id,
                    "activity_id": f"{language}-{topic}-{record_index}",
                    "attempt_number": 1,
                    "created_at": pd.Timestamp("2025-01-01", tz="UTC") + pd.Timedelta(days=record_index),
                    "language": language,
                    "topic_concept": topic,
                    "activity_type": "quiz" if record_index % 5 == 0 else "challenge",
                    "difficulty_level": difficulty,
                    "is_successful": is_successful,
                    "score_percentage": float(rng.integers(0, 101)) if record_index % 5 == 0 else None,
                    "error_category": error_category,
                    "compiler_status_id": 6 if error_category == "syntax_error" else None,
                    "execution_time_ms": float(rng.uniform(50, 1500)),
                    "time_spent_seconds": int(rng.integers(30, 600)),
                }
            )
    return pd.DataFrame.from_records(records)


def _build_pipeline(model_name: str) -> tuple[Pipeline, dict[str, list[Any]]]:
    if model_name == "logreg":
        pipeline = Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RANDOM_SEED),
                ),
            ]
        )
        parameter_grid = {"classifier__C": [0.1, 1.0, 10.0]}
    elif model_name == "random_forest":
        pipeline = Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    RandomForestClassifier(
                        class_weight="balanced", random_state=RANDOM_SEED, n_jobs=1
                    ),
                ),
            ]
        )
        parameter_grid = {
            "classifier__n_estimators": [100, 200],
            "classifier__max_depth": [None, 8],
            "classifier__min_samples_split": [2, 5],
        }
    else:
        raise ValueError(f"Unknown model: {model_name}")
    return pipeline, parameter_grid


def _probability_for_success(model: Pipeline, X: pd.DataFrame) -> np.ndarray:
    classes = np.asarray(model.classes_)
    positive_columns = np.flatnonzero(classes == 1)
    if positive_columns.size != 1:
        raise ValueError("Fitted classifier does not expose a unique positive class (1).")
    return model.predict_proba(X)[:, int(positive_columns[0])]


def _evaluate_fold(
    model: Pipeline,
    X: pd.DataFrame,
    y: np.ndarray,
    *,
    model_name: str,
    fold_number: int,
    n_train_students: int,
    n_validation_students: int,
) -> dict[str, Any]:
    predicted = model.predict(X)
    probabilities = _probability_for_success(model, X)
    result: dict[str, Any] = {
        "model": model_name,
        "fold": fold_number,
        "train_students": n_train_students,
        "validation_students": n_validation_students,
        "accuracy": float(accuracy_score(y, predicted)),
        "precision": float(precision_score(y, predicted, zero_division=0)),
        "recall": float(recall_score(y, predicted, zero_division=0)),
        "f1_score": float(f1_score(y, predicted, zero_division=0)),
        "roc_auc": float(roc_auc_score(y, probabilities)) if len(np.unique(y)) == 2 else None,
        "confusion_matrix": confusion_matrix(y, predicted, labels=[0, 1]).tolist(),
    }
    if len(np.unique(y)) == 2:
        false_positive_rate, true_positive_rate, thresholds = roc_curve(y, probabilities)
        result["roc_curve"] = {
            "false_positive_rate": false_positive_rate.tolist(),
            "true_positive_rate": true_positive_rate.tolist(),
            "thresholds": [float(value) if np.isfinite(value) else None for value in thresholds],
        }
    else:
        result["roc_curve"] = None
    return result


def _validate_group_splits(
    splits: list[tuple[np.ndarray, np.ndarray]], y: np.ndarray, groups: np.ndarray
) -> None:
    for split_number, (train_indices, validation_indices) in enumerate(splits, start=1):
        train_groups = set(groups[train_indices].tolist())
        validation_groups = set(groups[validation_indices].tolist())
        if train_groups.intersection(validation_groups):
            raise RuntimeError(f"Student leakage detected in GroupKFold split {split_number}.")
        if len(np.unique(y[train_indices])) != 2:
            raise ValueError(
                "GroupKFold produced a training partition with one outcome class "
                f"(split {split_number}); collect more balanced student groups before training."
            )


def _fit_tuned_model(
    model_name: str,
    X: pd.DataFrame,
    y: np.ndarray,
    groups: np.ndarray,
    *,
    n_jobs: int,
) -> GridSearchCV:
    unique_groups = np.unique(groups)
    inner_splits = min(3, len(unique_groups))
    if inner_splits < 2:
        raise ValueError("At least two student groups are required for inner grouped tuning.")
    cv = GroupKFold(n_splits=inner_splits)
    splits = list(cv.split(X, y, groups=groups))
    _validate_group_splits(splits, y, groups)
    pipeline, parameter_grid = _build_pipeline(model_name)
    search = GridSearchCV(
        estimator=pipeline,
        param_grid=parameter_grid,
        scoring="f1",
        cv=splits,
        n_jobs=n_jobs,
        refit=True,
        error_score="raise",
        return_train_score=False,
    )
    search.fit(X, y)
    return search


def _mean_metric(folds: list[dict[str, Any]], metric: str) -> float | None:
    values = [fold[metric] for fold in folds if fold[metric] is not None]
    return float(np.mean(values)) if values else None


def _atomic_write(path: Path, writer: Any) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    try:
        writer(temporary_path)
        os.replace(temporary_path, path)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise


def _atomic_json_write(path: Path, value: dict[str, Any]) -> None:
    def write_json(temporary_path: Path) -> None:
        with temporary_path.open("w", encoding="utf-8") as output:
            json.dump(value, output, indent=2, allow_nan=False)
            output.write("\n")

    _atomic_write(path, write_json)


def _atomic_joblib_dump(model: Pipeline, path: Path) -> None:
    _atomic_write(path, lambda temporary_path: joblib.dump(model, temporary_path, compress=3))


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as input_file:
        for chunk in iter(lambda: input_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run_training_and_comparison(
    df: pd.DataFrame,
    *,
    artifacts_dir: Path | str | None = None,
    dataset_source: str,
    n_jobs: int = 1,
) -> dict[str, Any]:
    """Tune and compare both classifiers using student-isolated outer folds."""
    if n_jobs == 0:
        raise ValueError("n_jobs cannot be zero.")
    if dataset_source not in {DATASET_SOURCE_SYNTHETIC, DATASET_SOURCE_APPROVED}:
        raise ValueError(
            f"dataset_source must be {DATASET_SOURCE_SYNTHETIC!r} or "
            f"{DATASET_SOURCE_APPROVED!r}."
        )
    X, y, groups = prepare_ml_dataset(df)
    unique_students = np.unique(groups)
    if len(unique_students) < 5:
        raise ValueError(
            f"GroupKFold(n_splits=5) requires at least five students; found {len(unique_students)}."
        )

    outer_cv = GroupKFold(n_splits=5)
    outer_splits = list(outer_cv.split(X, y, groups=groups))
    _validate_group_splits(outer_splits, y, groups)
    fold_results: dict[str, list[dict[str, Any]]] = {"logreg": [], "random_forest": []}

    for fold_number, (train_indices, validation_indices) in enumerate(outer_splits, start=1):
        train_X = X.iloc[train_indices]
        validation_X = X.iloc[validation_indices]
        train_y = y[train_indices]
        validation_y = y[validation_indices]
        train_groups = groups[train_indices]

        for model_name in ("logreg", "random_forest"):
            tuned = _fit_tuned_model(
                model_name,
                train_X,
                train_y,
                train_groups,
                n_jobs=n_jobs,
            )
            fold_results[model_name].append(
                _evaluate_fold(
                    tuned.best_estimator_,
                    validation_X,
                    validation_y,
                    model_name=model_name,
                    fold_number=fold_number,
                    n_train_students=len(np.unique(train_groups)),
                    n_validation_students=len(np.unique(groups[validation_indices])),
                )
            )

    artifacts_root = Path(artifacts_dir or ARTIFACTS_DIR).expanduser().resolve()
    run_parent = artifacts_root / (
        "development" if dataset_source == DATASET_SOURCE_SYNTHETIC else "runs"
    )
    run_parent.mkdir(parents=True, exist_ok=True)
    trained_models: dict[str, Pipeline] = {}
    final_parameters: dict[str, dict[str, Any]] = {}
    for model_name in ("logreg", "random_forest"):
        final_search = _fit_tuned_model(model_name, X, y, groups, n_jobs=n_jobs)
        trained_models[model_name] = final_search.best_estimator_
        final_parameters[model_name] = final_search.best_params_

    generated_at = datetime.now(timezone.utc)
    model_version = f"{MODEL_VERSION}-{generated_at.strftime('%Y%m%dT%H%M%S%fZ')}"
    run_directory = run_parent / model_version
    relative_run_directory = run_directory.relative_to(artifacts_root).as_posix()
    metrics_summary = {
        "model_version": model_version,
        "dataset_source": dataset_source,
        "is_synthetic_data": dataset_source == "synthetic_bootstrap",
        "research_approved": dataset_source == DATASET_SOURCE_APPROVED,
        "n_samples": int(len(y)),
        "n_students": int(len(unique_students)),
        "outcome_counts": {
            "unsuccessful": int((y == 0).sum()),
            "successful": int((y == 1).sum()),
        },
        "features": list(FEATURE_NAMES),
        "outer_cv": "GroupKFold(n_splits=5), grouped by student_id",
        "hyperparameter_tuning": "inner GroupKFold, student_id grouped",
        "models": {
            model_name: {
                "mean_accuracy": _mean_metric(folds, "accuracy"),
                "mean_precision": _mean_metric(folds, "precision"),
                "mean_recall": _mean_metric(folds, "recall"),
                "mean_f1_score": _mean_metric(folds, "f1_score"),
                "mean_roc_auc": _mean_metric(folds, "roc_auc"),
                "folds": folds,
                "final_best_parameters": final_parameters[model_name],
            }
            for model_name, folds in fold_results.items()
        },
        "generated_at": generated_at.isoformat(),
        "scikit_learn_version": sklearn.__version__,
        "artifact_directory": relative_run_directory,
        "warning": (
            "Synthetic bootstrap results are for pipeline setup only and must not be reported "
            "as empirical classroom or thesis findings."
            if dataset_source == DATASET_SOURCE_SYNTHETIC
            else None
        ),
    }

    if run_directory.exists():
        raise FileExistsError(f"Refusing to overwrite existing model run: {run_directory}")
    with tempfile.TemporaryDirectory(
        prefix=f".{model_version}.", dir=run_parent
    ) as staging_name:
        staging_dir = Path(staging_name)
        logreg_path = staging_dir / "logreg_pipeline.joblib"
        rf_path = staging_dir / "rf_pipeline.joblib"
        metrics_path = staging_dir / "metrics_summary.json"
        _atomic_joblib_dump(trained_models["logreg"], logreg_path)
        _atomic_joblib_dump(trained_models["random_forest"], rf_path)
        _atomic_json_write(metrics_path, metrics_summary)
        metadata = {
            "schema_version": 1,
            "model_version": model_version,
            "features": list(FEATURE_NAMES),
            "dataset_source": dataset_source,
            "is_synthetic_data": dataset_source == DATASET_SOURCE_SYNTHETIC,
            "research_approved": dataset_source == DATASET_SOURCE_APPROVED,
            "scikit_learn_version": sklearn.__version__,
            "trained_at": metrics_summary["generated_at"],
            "sha256": {
                "logreg_pipeline.joblib": _sha256_file(logreg_path),
                "rf_pipeline.joblib": _sha256_file(rf_path),
                "metrics_summary.json": _sha256_file(metrics_path),
            },
        }
        _atomic_json_write(staging_dir / "model_metadata.json", metadata)
        Path(staging_name).rename(run_directory)
    return metrics_summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-csv", type=Path, help="CSV with one row per attempt and a student_id.")
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        default=ARTIFACTS_DIR,
        help="Artifact root; immutable versioned runs are written below it.",
    )
    parser.add_argument(
        "--research-approved",
        action="store_true",
        help=(
            "Confirm that the supplied pseudonymized CSV is approved for this research use. "
            "Required with --data-csv; do not use before institutional approval."
        ),
    )
    parser.add_argument("--n-jobs", type=int, default=1, help="Parallel tuning jobs; defaults to 1.")
    parser.add_argument("--seed", type=int, default=RANDOM_SEED)
    args = parser.parse_args()

    if args.data_csv:
        if not args.research_approved:
            parser.error(
                "--data-csv requires --research-approved. Use only after the required "
                "institutional approval and consent are in place."
            )
        if not args.data_csv.is_file():
            parser.error(f"CSV file not found: {args.data_csv}")
        attempts = pd.read_csv(args.data_csv)
        dataset_source = DATASET_SOURCE_APPROVED
    else:
        if args.research_approved:
            parser.error("--research-approved requires --data-csv.")
        print(
            "WARNING: no --data-csv supplied; training on synthetic bootstrap data. "
            "Do not report these metrics as empirical results."
        )
        attempts = generate_synthetic_thesis_dataset(seed=args.seed)
        dataset_source = DATASET_SOURCE_SYNTHETIC

    results = run_training_and_comparison(
        attempts,
        artifacts_dir=args.artifacts_dir,
        dataset_source=dataset_source,
        n_jobs=args.n_jobs,
    )
    print(
        "Saved immutable training run to "
        f"{(args.artifacts_dir.resolve() / results['artifact_directory'])}"
    )
    print("The run is not active; reviewed model activation is a separate Phase 6 decision.")
    for model_name, metrics in results["models"].items():
        print(
            f"{model_name}: accuracy={metrics['mean_accuracy']:.3f}, "
            f"precision={metrics['mean_precision']:.3f}, recall={metrics['mean_recall']:.3f}, "
            f"f1={metrics['mean_f1_score']:.3f}, roc_auc={metrics['mean_roc_auc']}"
        )


if __name__ == "__main__":
    main()

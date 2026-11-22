"""Grouped, leakage-resistant comparison of student-success models.

Input CSV files contain one joined activity attempt per row with the columns
required by ``REQUIRED_COLUMNS``, plus one hint reveal per row with
``HINT_COLUMNS``. Without a CSV, a clearly labeled synthetic dataset is used for
pipeline setup; those results are not empirical findings.

Each prediction row is one learner and programming challenge at t0, the
learner's first graded submission on it (Chapter 3, Algorithm 3).
Protocol: rows are partitioned 60/20/20 by student, so no student's records
span partitions. Imputation, scaling and hyperparameter tuning see the training
partition only; the winning model is chosen on the validation partition by
Average Precision; both frozen pipelines are then scored exactly once on the
untouched test partition, beside a majority-class and a prevalence baseline.
Every threshold-dependent metric uses the shared ``DECISION_THRESHOLD``.
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
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
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
from app.services.ml_predictor.thresholds import DECISION_THRESHOLD  # noqa: E402

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
RANDOM_SEED = 42
MODEL_VERSION = "v3.0.0"
DATASET_SOURCE_SYNTHETIC = "synthetic_bootstrap"
DATASET_SOURCE_APPROVED = "approved_deidentified_csv"
# Student-disjoint partition sizes; the test share is whatever remains.
TRAIN_FRACTION = 0.60
VALIDATION_FRACTION = 0.20
PARTITION_NAMES = ("train", "validation", "test")
# Three partitions, each needing both outcome classes, and a training partition
# that still has two groups left for inner grouped tuning.
MIN_STUDENTS = 5
MAX_SPLIT_ATTEMPTS = 64
# Average Precision summarises the precision-recall curve, which stays
# informative when passes and failures are imbalanced; it selects the model.
PRIMARY_SELECTION_METRIC = "average_precision"
# Predeclared tie rule: a validation gap this small is not evidence of a real
# difference, so the simpler, directly interpretable model wins.
SELECTION_TIE_TOLERANCE = 0.005
# Naive references the reported models must beat to mean anything.
BASELINE_STRATEGIES = {"majority_class": "most_frequent", "prevalence": "prior"}
def _encodes_account_id(student_ids: pd.Series) -> bool:
    """True when any id embeds a dash-less UUID, as profiles.pseudonym_id does."""
    return bool(student_ids.astype(str).str.contains(r"(?i)[0-9a-f]{32}", regex=True).any())


REQUIRED_COLUMNS = {
    "id",
    "student_id",
    "activity_id",
    "course_id",
    "attempt_number",
    "created_at",
    "language",
    "activity_type",
    "is_successful",
    "score_percentage",
    "error_category",
    "compiler_status_id",
}
NON_NULL_CONTEXT_COLUMNS = {
    "id",
    "student_id",
    "activity_id",
    "course_id",
    "attempt_number",
    "created_at",
    "language",
    "activity_type",
    "is_successful",
}
HINT_COLUMNS = {"id", "student_id", "activity_id", "course_id", "language", "created_at"}
# A live forecast needs this many distinct prior tasks in the course; the
# supplementary report scores the test rows that would have passed the gate.
DEFAULT_MIN_HISTORY = 3
# Predeclared adequacy rule: below this the comparison is indicative only.
MIN_TEST_LEARNERS = 6
MIN_TEST_ROWS_PER_CLASS = 15
BOOTSTRAP_RESAMPLES = 1000
CONFIDENCE_LEVEL = 0.95
INTERVAL_METRICS = (
    "accuracy", "precision", "recall", "f1_score", "roc_auc", "average_precision", "brier_score",
)
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


def _check_columns(df: pd.DataFrame, required: set[str], label: str) -> None:
    """Reject missing, duplicate and identifying columns before reading any row."""
    if not df.columns.is_unique:
        raise ValueError(f"{label} contains duplicate column names.")
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{label} is missing required columns: {', '.join(sorted(missing))}")
    sensitive_columns = sorted(
        str(column)
        for column in df.columns
        if any(marker in str(column).strip().casefold() for marker in SENSITIVE_COLUMN_MARKERS)
    )
    if sensitive_columns:
        raise ValueError(
            f"{label} contains identifying or raw-submission columns: "
            + ", ".join(sensitive_columns)
            + ". Export pseudonymous student_id values only; remove names, account identifiers, "
            "contact details, IP addresses, and submitted source code."
        )


def _require_pseudonymous(student_ids: pd.Series) -> None:
    if student_ids.str.contains(r"\S+@\S+\.\S+", regex=True).any():
        raise ValueError("student_id must be a pseudonym, not an email address.")
    if student_ids.str.fullmatch(r"\d+").any():
        raise ValueError("student_id cannot be a numeric student or account number.")
    if student_ids.str.fullmatch(
        r"(?i)(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})"
    ).any():
        raise ValueError("student_id cannot be a raw UUID; export research codes instead.")
    if _encodes_account_id(student_ids):
        raise ValueError(
            "student_id encodes an account id (pseudonym_id is 'stu_' plus the account UUID); "
            "export research codes instead."
        )


def _strip_text(frame: pd.DataFrame, columns: tuple[str, ...], label: str) -> None:
    for column in columns:
        frame[column] = frame[column].astype(str).str.strip()
        if frame[column].eq("").any():
            raise ValueError(f"{label} contains blank values in {column}.")


def _validate_training_frame(df: pd.DataFrame) -> pd.DataFrame:
    _check_columns(df, REQUIRED_COLUMNS, "Attempt dataset")
    if df.empty:
        raise ValueError("Attempt dataset contains no rows.")

    valid_rows = df.copy()
    missing_context = [
        column for column in NON_NULL_CONTEXT_COLUMNS if valid_rows[column].isna().any()
    ]
    if missing_context:
        raise ValueError(
            "Attempt dataset has missing values in required context columns: "
            + ", ".join(sorted(missing_context))
        )
    _strip_text(
        valid_rows,
        ("id", "student_id", "activity_id", "course_id", "language", "activity_type"),
        "Attempt dataset",
    )

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
    _require_pseudonymous(valid_rows["student_id"])

    valid_rows["created_at"] = pd.to_datetime(
        valid_rows["created_at"], errors="coerce", utc=True
    )
    if valid_rows["created_at"].isna().any():
        raise ValueError(
            "Every created_at value must be a valid timestamp for chronological training."
        )

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
    raw_scores = valid_rows["score_percentage"]
    scores = pd.to_numeric(raw_scores, errors="coerce")
    if (raw_scores.notna() & scores.isna()).any() or (
        scores.notna() & ~np.isfinite(scores.astype(float))
    ).any():
        raise ValueError("score_percentage must contain finite numeric values or blanks.")
    if not scores.dropna().between(0, 100).all():
        raise ValueError("score_percentage must be between 0 and 100.")
    valid_rows["score_percentage"] = scores

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


def _validate_hint_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Hint reveals carry only who, where and when: never the hint text."""
    _check_columns(df, HINT_COLUMNS, "Hint dataset")
    hints = df.loc[:, sorted(HINT_COLUMNS)].copy()
    if hints.isna().any().any():
        raise ValueError("Hint dataset has missing values.")
    _strip_text(hints, ("id", "student_id", "activity_id", "course_id", "language"), "Hint dataset")
    if hints["id"].duplicated().any():
        raise ValueError("Hint dataset contains duplicate ids.")
    _require_pseudonymous(hints["student_id"])
    hints["language"] = hints["language"].str.casefold()
    hints["created_at"] = pd.to_datetime(hints["created_at"], errors="coerce", utc=True)
    if hints["created_at"].isna().any():
        raise ValueError("Every hint created_at value must be a valid timestamp.")
    return hints


def prepare_ml_dataset(
    df: pd.DataFrame,
    hints_df: pd.DataFrame | None = None,
    *,
    min_history: int = DEFAULT_MIN_HISTORY,
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray, np.ndarray]:
    """Build one row per learner and programming challenge, at that challenge's t0.

    t0 is the learner's first graded submission on the challenge, and the label
    is whether that submission passed. Features use only the learner's attempts
    and hint reveals in the same course and language strictly before t0, so
    retries never become rows and never inform their own task. Quizzes are
    history, never targets. Cold-start rows (no prior history) stay in.

    Returns features, labels, student groups, and whether each row had at least
    ``min_history`` distinct prior tasks, which is the live forecast gate.
    """
    valid_rows = _validate_training_frame(df)
    if "exam_attempt_id" in valid_rows.columns and valid_rows["exam_attempt_id"].notna().any():
        raise ValueError("Training rows must exclude exam item attempts.")
    hints = _validate_hint_frame(hints_df) if hints_df is not None else pd.DataFrame(columns=sorted(HINT_COLUMNS))

    feature_rows: list[dict[str, float]] = []
    labels: list[int] = []
    groups: list[Any] = []
    eligible: list[bool] = []
    for student_id, student_rows in valid_rows.groupby("student_id", sort=False):
        ordered = _sort_attempts(student_rows)
        student_hints = hints[hints["student_id"] == student_id]
        first_attempts = ordered[ordered["activity_type"] == "challenge"].drop_duplicates(
            ["course_id", "activity_id"], keep="first"
        )
        for _, target in first_attempts.iterrows():
            scope = (ordered["course_id"] == target["course_id"]) & (ordered["language"] == target["language"])
            prior = ordered[scope & (ordered["created_at"] < target["created_at"])]
            features = extract_features_from_dataframe(
                prior,
                cutoff=target["created_at"],
                hint_reveals=student_hints[
                    (student_hints["course_id"] == target["course_id"])
                    & (student_hints["language"] == target["language"])
                ],
                target_activity_id=target["activity_id"],
            )
            feature_rows.append(features)
            labels.append(int(target["is_successful"]))
            groups.append(student_id)
            eligible.append(prior["activity_id"].nunique() >= min_history)

    if not feature_rows:
        raise ValueError("The dataset holds no programming-challenge submissions to predict.")
    X = pd.DataFrame(feature_rows, columns=FEATURE_NAMES, dtype=float)
    y = np.asarray(labels, dtype=np.int8)
    if np.isinf(X.to_numpy()).any():
        raise ValueError("Feature extraction produced infinite values.")
    if set(np.unique(y)) != {0, 1}:
        raise ValueError("Training requires at least one successful and one unsuccessful outcome.")
    return X, y, np.asarray(groups), np.asarray(eligible, dtype=bool)


def generate_synthetic_thesis_dataset(
    num_students: int = 50,
    tasks_per_student: int = 20,
    seed: int = RANDOM_SEED,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Generate reproducible bootstrap attempts and hint reveals for pipeline setup only."""
    if num_students < 5 or tasks_per_student < 1:
        raise ValueError("Synthetic data requires at least five students and one task per student.")
    rng = np.random.default_rng(seed)
    languages = ("cpp", "python", "java")
    attempts: list[dict[str, Any]] = []
    hints: list[dict[str, Any]] = []
    for student_index in range(num_students):
        student_id = f"synthetic-student-{student_index:04d}"
        language = languages[student_index % len(languages)]
        course_id = f"synthetic-course-{language}"
        ability = rng.uniform(0.25, 0.9)
        clock = pd.Timestamp("2025-01-06", tz="UTC") + pd.Timedelta(hours=float(rng.uniform(0, 48)))
        for task_index in range(tasks_per_student):
            is_quiz = task_index % 4 == 0
            difficulty = (task_index % 5) + 1
            activity_id = f"{course_id}-task-{task_index:03d}"
            clock += pd.Timedelta(hours=float(rng.uniform(2, 96)))
            if not is_quiz and rng.random() > ability:
                hints.append({
                    "id": f"synthetic-hint-{student_index:04d}-{task_index:03d}",
                    "student_id": student_id, "activity_id": activity_id, "course_id": course_id,
                    "language": language, "created_at": clock,
                })
                clock += pd.Timedelta(minutes=float(rng.uniform(5, 60)))
            for attempt_number in range(1, 4):
                logit = (ability - (difficulty - 1) / 5.0) * 3.0 + 0.6 * (attempt_number - 1)
                passed = bool(rng.random() < 1.0 / (1.0 + np.exp(-logit)))
                error = "none" if passed else str(
                    rng.choice(["syntax_error", "logic_error", "runtime_error", "timeout"], p=[0.3, 0.4, 0.2, 0.1])
                )
                attempts.append({
                    "id": f"synthetic-attempt-{student_index:04d}-{task_index:03d}-{attempt_number}",
                    "student_id": student_id, "activity_id": activity_id, "course_id": course_id,
                    "attempt_number": attempt_number, "created_at": clock, "language": language,
                    "activity_type": "quiz" if is_quiz else "challenge",
                    "is_successful": passed,
                    "score_percentage": 100.0 if passed else float(rng.integers(0, 70)),
                    "error_category": "none" if is_quiz else error,
                    "compiler_status_id": None if is_quiz else {
                        "none": 3, "logic_error": 4, "timeout": 5, "syntax_error": 6, "runtime_error": 11,
                    }[error],
                })
                clock += pd.Timedelta(minutes=float(rng.uniform(5, 90)))
                if passed or is_quiz:
                    break
    return pd.DataFrame.from_records(attempts), pd.DataFrame.from_records(hints)


def split_students_disjoint(
    y: np.ndarray, groups: np.ndarray, *, seed: int = RANDOM_SEED
) -> dict[str, np.ndarray]:
    """Partition rows 60/20/20 so every student sits in exactly one partition.

    Students, not rows, are dealt out; that is what stops one student's records
    from spanning partitions and leaking their own history across the split.
    Permutations come from a single seeded stream, so the chosen split is
    reproducible from ``seed`` alone. A partition missing an outcome class
    would leave ROC-AUC and Average Precision undefined there, so candidate
    permutations are redrawn until all three carry both classes.
    """
    unique_students = np.unique(groups)
    total = len(unique_students)
    if total < MIN_STUDENTS:
        raise ValueError(
            f"A student-disjoint 60/20/20 split needs at least {MIN_STUDENTS} "
            f"students; found {total}."
        )
    # Clamp so the training partition keeps two groups for inner grouped
    # tuning and the validation and test partitions are never empty.
    n_train = max(2, min(int(round(total * TRAIN_FRACTION)), total - 2))
    n_validation = max(
        1, min(int(round(total * VALIDATION_FRACTION)), total - n_train - 1)
    )

    rng = np.random.default_rng(seed)
    for _ in range(MAX_SPLIT_ATTEMPTS):
        shuffled = rng.permutation(unique_students)
        assigned = {
            "train": shuffled[:n_train],
            "validation": shuffled[n_train : n_train + n_validation],
            "test": shuffled[n_train + n_validation :],
        }
        partitions = {
            name: np.flatnonzero(np.isin(groups, students))
            for name, students in assigned.items()
        }
        covered = np.concatenate([partitions[name] for name in PARTITION_NAMES])
        if len(covered) != len(groups) or len(np.unique(covered)) != len(groups):
            raise RuntimeError(
                "Student partitioning did not place every row in exactly one partition."
            )
        if all(len(np.unique(y[rows])) == 2 for rows in partitions.values()):
            return partitions
    raise ValueError(
        "Could not place both outcome classes in all three partitions after "
        f"{MAX_SPLIT_ATTEMPTS} seeded attempts. Collect more students, or more "
        "balanced outcomes per student, before comparing models."
    )


def _build_pipeline(
    model_name: str, *, seed: int = RANDOM_SEED
) -> tuple[Pipeline, dict[str, list[Any]]]:
    if model_name == "logreg":
        pipeline = Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    LogisticRegression(max_iter=2000, class_weight="balanced", random_state=seed),
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
                        class_weight="balanced", random_state=seed, n_jobs=1
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


def _finite_or_none(values: np.ndarray) -> list[float | None]:
    """JSON cannot hold the infinite first threshold a ROC curve reports."""
    return [float(value) if np.isfinite(value) else None for value in values]


def _point_metrics(y: np.ndarray, probabilities: np.ndarray) -> dict[str, float | None]:
    """The reported metrics at ``DECISION_THRESHOLD``; ranking metrics need both classes."""
    predicted = (probabilities >= DECISION_THRESHOLD).astype(np.int8)
    both_classes = len(np.unique(y)) == 2
    return {
        "accuracy": float(accuracy_score(y, predicted)),
        "precision": float(precision_score(y, predicted, zero_division=0)),
        "recall": float(recall_score(y, predicted, zero_division=0)),
        "f1_score": float(f1_score(y, predicted, zero_division=0)),
        "roc_auc": float(roc_auc_score(y, probabilities)) if both_classes else None,
        "average_precision": (
            float(average_precision_score(y, probabilities)) if both_classes else None
        ),
        "brier_score": float(brier_score_loss(y, probabilities)),
    }


def _bootstrap_intervals(
    y: np.ndarray,
    probabilities: np.ndarray,
    groups: np.ndarray,
    *,
    n_resamples: int = BOOTSTRAP_RESAMPLES,
    seed: int = RANDOM_SEED,
) -> dict[str, Any]:
    """Percentile intervals from resampling learners, not rows, with replacement.

    Rows of one learner are correlated, so learners are the resampling unit. A
    resample holding a single outcome class leaves ranking metrics undefined;
    it is skipped and counted rather than silently scored. The same seed gives
    every estimator the same resamples, so their intervals are paired.
    """
    rng = np.random.default_rng(seed)
    students = np.unique(groups)
    rows_by_student = [np.flatnonzero(groups == student) for student in students]
    samples: dict[str, list[float]] = {name: [] for name in INTERVAL_METRICS}
    skipped = 0
    for _ in range(n_resamples):
        picked = rng.integers(0, len(students), len(students))
        rows = np.concatenate([rows_by_student[index] for index in picked])
        if len(np.unique(y[rows])) < 2:
            skipped += 1
            continue
        for name, value in _point_metrics(y[rows], probabilities[rows]).items():
            samples[name].append(value)
    tail = (1 - CONFIDENCE_LEVEL) / 2 * 100
    return {
        "level": CONFIDENCE_LEVEL,
        "n_resamples": n_resamples,
        "skipped_single_class": skipped,
        "metrics": {
            name: (
                {"low": float(np.percentile(values, tail)), "high": float(np.percentile(values, 100 - tail))}
                if values else None
            )
            for name, values in samples.items()
        },
    }


def _adequacy(y: np.ndarray, groups: np.ndarray) -> dict[str, Any]:
    """Apply the predeclared minimum-data rule to the test partition."""
    rows_per_class = {"unsuccessful": int((y == 0).sum()), "successful": int((y == 1).sum())}
    learners = int(len(np.unique(groups)))
    return {
        "min_test_learners": MIN_TEST_LEARNERS,
        "min_rows_per_class": MIN_TEST_ROWS_PER_CLASS,
        "test_learners": learners,
        "test_rows_per_class": rows_per_class,
        "met": learners >= MIN_TEST_LEARNERS and min(rows_per_class.values()) >= MIN_TEST_ROWS_PER_CLASS,
    }


def _evaluate_partition(
    model: Pipeline,
    X: pd.DataFrame,
    y: np.ndarray,
    groups: np.ndarray,
    *,
    partition: str,
) -> dict[str, Any]:
    """Score one frozen estimator on one partition at ``DECISION_THRESHOLD``.

    The label is taken from the probability and the shared threshold rather
    than from ``predict``, so the reported metrics and the served predictions
    are guaranteed to use one boundary. Ranking metrics need both outcome
    classes present and are reported as null when the partition lacks one.
    """
    probabilities = _probability_for_success(model, X)
    predicted = (probabilities >= DECISION_THRESHOLD).astype(np.int8)
    both_classes = len(np.unique(y)) == 2
    result: dict[str, Any] = {
        "partition": partition,
        "n_samples": int(len(y)),
        "n_students": int(len(np.unique(groups))),
        "positive_rate": float(np.mean(y)),
        "decision_threshold": DECISION_THRESHOLD,
        **_point_metrics(y, probabilities),
        "confusion_matrix": confusion_matrix(y, predicted, labels=[0, 1]).tolist(),
    }
    if both_classes:
        false_positive_rate, true_positive_rate, roc_thresholds = roc_curve(y, probabilities)
        result["roc_curve"] = {
            "false_positive_rate": false_positive_rate.tolist(),
            "true_positive_rate": true_positive_rate.tolist(),
            "thresholds": _finite_or_none(roc_thresholds),
        }
        precisions, recalls, pr_thresholds = precision_recall_curve(y, probabilities)
        result["pr_curve"] = {
            "precision": precisions.tolist(),
            "recall": recalls.tolist(),
            "thresholds": _finite_or_none(pr_thresholds),
        }
    else:
        result["roc_curve"] = None
        result["pr_curve"] = None
    return result


def _select_winner(scores: dict[str, dict[str, dict[str, Any]]]) -> tuple[str, bool]:
    """Choose the model with the higher validation Average Precision.

    Returns the winner and whether the predeclared tie rule decided it. The
    test partition is deliberately not consulted: selection happens before it
    is ever scored.
    """
    validation_scores = {
        model_name: partition_scores["validation"]["average_precision"]
        for model_name, partition_scores in scores.items()
    }
    missing = sorted(name for name, value in validation_scores.items() if value is None)
    if missing:
        raise ValueError(
            "Validation Average Precision is undefined for "
            + ", ".join(missing)
            + "; the validation partition must contain both outcome classes."
        )
    logreg_score = validation_scores["logreg"]
    forest_score = validation_scores["random_forest"]
    if abs(logreg_score - forest_score) <= SELECTION_TIE_TOLERANCE:
        return "logreg", True
    return ("logreg" if logreg_score > forest_score else "random_forest"), False


def _fit_baselines(
    train_X: pd.DataFrame, train_y: np.ndarray, *, seed: int
) -> dict[str, DummyClassifier]:
    """Fit the naive references, on the training partition like any model."""
    baselines: dict[str, DummyClassifier] = {}
    for name, strategy in BASELINE_STRATEGIES.items():
        baseline = DummyClassifier(strategy=strategy, random_state=seed)
        baseline.fit(train_X, train_y)
        baselines[name] = baseline
    return baselines


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
    seed: int = RANDOM_SEED,
) -> GridSearchCV:
    """Tune one pipeline on grouped folds drawn from the given rows only.

    Callers pass the training partition, so the imputer, the scaler and the
    hyperparameter search never observe validation or test rows. Candidates are
    ranked by Average Precision, the same metric that later selects the winner.
    """
    unique_groups = np.unique(groups)
    inner_splits = min(3, len(unique_groups))
    if inner_splits < 2:
        raise ValueError("At least two student groups are required for inner grouped tuning.")
    cv = GroupKFold(n_splits=inner_splits)
    splits = list(cv.split(X, y, groups=groups))
    _validate_group_splits(splits, y, groups)
    pipeline, parameter_grid = _build_pipeline(model_name, seed=seed)
    search = GridSearchCV(
        estimator=pipeline,
        param_grid=parameter_grid,
        scoring=PRIMARY_SELECTION_METRIC,
        cv=splits,
        n_jobs=n_jobs,
        refit=True,
        error_score="raise",
        return_train_score=False,
    )
    search.fit(X, y)
    return search


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
    hints_df: pd.DataFrame | None = None,
    artifacts_dir: Path | str | None = None,
    dataset_source: str,
    n_jobs: int = 1,
    seed: int = RANDOM_SEED,
    min_history: int = DEFAULT_MIN_HISTORY,
    n_bootstrap: int = BOOTSTRAP_RESAMPLES,
) -> dict[str, Any]:
    """Tune, select and compare both classifiers on a student-disjoint split.

    Tuning and preprocessing see the training partition only, the winner is
    chosen on the validation partition by Average Precision, and each frozen
    pipeline is scored once on the untouched test partition beside a
    majority-class and a prevalence baseline, with learner-bootstrap intervals,
    the adequacy verdict and a supplementary score on live-eligible test rows.
    """
    if n_jobs == 0:
        raise ValueError("n_jobs cannot be zero.")
    if dataset_source not in {DATASET_SOURCE_SYNTHETIC, DATASET_SOURCE_APPROVED}:
        raise ValueError(
            f"dataset_source must be {DATASET_SOURCE_SYNTHETIC!r} or "
            f"{DATASET_SOURCE_APPROVED!r}."
        )
    X, y, groups, live_eligible = prepare_ml_dataset(df, hints_df, min_history=min_history)
    partitions = split_students_disjoint(y, groups, seed=seed)
    train_rows = partitions["train"]
    train_X = X.iloc[train_rows]
    train_y = y[train_rows]
    train_groups = groups[train_rows]

    trained_models: dict[str, Pipeline] = {}
    best_parameters: dict[str, dict[str, Any]] = {}
    scores: dict[str, dict[str, dict[str, Any]]] = {}
    for model_name in ("logreg", "random_forest"):
        search = _fit_tuned_model(
            model_name, train_X, train_y, train_groups, n_jobs=n_jobs, seed=seed
        )
        # GridSearchCV refits the winning configuration on the whole training
        # partition; that refit is the pipeline frozen and saved below.
        trained_models[model_name] = search.best_estimator_
        best_parameters[model_name] = search.best_params_
        scores[model_name] = {
            name: _evaluate_partition(
                search.best_estimator_,
                X.iloc[partitions[name]],
                y[partitions[name]],
                groups[partitions[name]],
                partition=name,
            )
            for name in ("train", "validation")
        }

    winner, tie_rule_applied = _select_winner(scores)

    # Both pipelines are frozen and the winner is fixed, so the test partition
    # is scored exactly once here and informs no tuning or selection decision.
    test_rows = partitions["test"]
    test_X = X.iloc[test_rows]
    test_y = y[test_rows]
    test_groups = groups[test_rows]
    baselines = _fit_baselines(train_X, train_y, seed=seed)
    estimators = {**trained_models, **baselines}
    for model_name, model in trained_models.items():
        scores[model_name]["test"] = _evaluate_partition(
            model, test_X, test_y, test_groups, partition="test"
        )
    baseline_scores = {
        name: {
            "strategy": BASELINE_STRATEGIES[name],
            "test": _evaluate_partition(
                baseline, test_X, test_y, test_groups, partition="test"
            ),
        }
        for name, baseline in baselines.items()
    }
    confidence_intervals = {
        name: _bootstrap_intervals(
            test_y, _probability_for_success(model, test_X), test_groups,
            n_resamples=n_bootstrap, seed=seed,
        )
        for name, model in estimators.items()
    }
    # Supplementary only: the same frozen estimators on the test rows a live
    # forecast would have covered. It never informs tuning or selection.
    eligible = live_eligible[test_rows]
    live_scores = {
        name: (
            _evaluate_partition(
                model, test_X[eligible], test_y[eligible], test_groups[eligible],
                partition="test_live_eligible",
            )
            if eligible.any()
            else {"partition": "test_live_eligible", "n_samples": 0, "n_students": 0}
        )
        for name, model in estimators.items()
    }

    artifacts_root = Path(artifacts_dir or ARTIFACTS_DIR).expanduser().resolve()
    run_parent = artifacts_root / (
        "development" if dataset_source == DATASET_SOURCE_SYNTHETIC else "runs"
    )
    run_parent.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now(timezone.utc)
    model_version = f"{MODEL_VERSION}-{generated_at.strftime('%Y%m%dT%H%M%S%fZ')}"
    run_directory = run_parent / model_version
    relative_run_directory = run_directory.relative_to(artifacts_root).as_posix()
    metrics_summary = {
        "model_version": model_version,
        "dataset_source": dataset_source,
        "is_synthetic_data": dataset_source == DATASET_SOURCE_SYNTHETIC,
        "research_approved": dataset_source == DATASET_SOURCE_APPROVED,
        "n_samples": int(len(y)),
        "n_students": int(len(np.unique(groups))),
        "outcome_counts": {
            "unsuccessful": int((y == 0).sum()),
            "successful": int((y == 1).sum()),
        },
        "features": list(FEATURE_NAMES),
        "protocol": {
            "prediction_unit": (
                "one row per learner and programming challenge at t0, the learner's first "
                "graded submission on it; the label is whether that submission passed"
            ),
            "history": (
                "graded attempts and hint reveals in the same course and language strictly "
                "before t0; hints on the target challenge never count"
            ),
            "split": (
                "student-disjoint 60/20/20 train/validation/test, partitioned by student_id"
            ),
            "random_seed": seed,
            "preprocessing": (
                "median imputation and scaling fitted on the training partition only"
            ),
            "hyperparameter_tuning": (
                "GridSearchCV over GroupKFold folds inside the training partition only"
            ),
            "primary_selection_metric": PRIMARY_SELECTION_METRIC,
            "selection_tie_rule": (
                f"a validation Average Precision gap of at most {SELECTION_TIE_TOLERANCE} "
                "resolves to logistic regression as the simpler model"
            ),
            "decision_threshold": DECISION_THRESHOLD,
            "test_partition_scored": (
                "once, after both pipelines were frozen and the winner was fixed"
            ),
            "artifacts_fitted_on": (
                "training partition only, so the reported test metrics describe the "
                "saved pipelines"
            ),
            "confidence_intervals": (
                f"{CONFIDENCE_LEVEL:.0%} percentile intervals from {n_bootstrap} seeded "
                "resamples of test learners"
            ),
            "live_forecast_min_history": min_history,
        },
        "partitions": {
            name: {
                "n_samples": int(len(rows)),
                "n_students": int(len(np.unique(groups[rows]))),
                "positive_rate": float(np.mean(y[rows])),
            }
            for name, rows in partitions.items()
        },
        "selection": {
            "winner": winner,
            "tie_rule_applied": tie_rule_applied,
            "validation_average_precision": {
                model_name: partition_scores["validation"]["average_precision"]
                for model_name, partition_scores in scores.items()
            },
        },
        "models": {
            model_name: {
                "best_parameters": best_parameters[model_name],
                **scores[model_name],
            }
            for model_name in trained_models
        },
        "baselines": baseline_scores,
        "confidence_intervals": confidence_intervals,
        "adequacy": _adequacy(test_y, test_groups),
        "supplementary": {
            "live_eligible": {
                "min_prior_tasks": min_history,
                "models": {name: live_scores[name] for name in trained_models},
                "baselines": {name: live_scores[name] for name in baselines},
            }
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
            "schema_version": 3,
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


def _format_metric(value: float | None) -> str:
    """Ranking metrics are null when a partition holds a single class."""
    return "n/a" if value is None else f"{value:.3f}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-csv", type=Path, help="CSV with one row per attempt and a student_id.")
    parser.add_argument("--hints-csv", type=Path, help="Approved hint-reveal export for the same pseudonymous students.")
    parser.add_argument(
        "--min-history",
        type=int,
        default=DEFAULT_MIN_HISTORY,
        help="Distinct prior tasks a live forecast needs; sets the supplementary eligible-row report.",
    )
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
    parser.add_argument(
        "--seed",
        type=int,
        default=RANDOM_SEED,
        help=(
            "Seed for the student-disjoint split, the estimators and the synthetic "
            "bootstrap, so a whole run is reproducible from one number."
        ),
    )
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
        if not args.hints_csv or not args.hints_csv.is_file():
            parser.error("Approved training requires an existing --hints-csv file (headers only if no hints).")
        hints = pd.read_csv(args.hints_csv)
        dataset_source = DATASET_SOURCE_APPROVED
    else:
        if args.hints_csv:
            parser.error("--hints-csv requires --data-csv.")
        if args.research_approved:
            parser.error("--research-approved requires --data-csv.")
        print(
            "WARNING: no --data-csv supplied; training on synthetic bootstrap data. "
            "Do not report these metrics as empirical results."
        )
        attempts, hints = generate_synthetic_thesis_dataset(seed=args.seed)
        dataset_source = DATASET_SOURCE_SYNTHETIC

    results = run_training_and_comparison(
        attempts,
        hints_df=hints,
        artifacts_dir=args.artifacts_dir,
        dataset_source=dataset_source,
        n_jobs=args.n_jobs,
        seed=args.seed,
        min_history=args.min_history,
    )
    print(
        "Saved immutable training run to "
        f"{(args.artifacts_dir.resolve() / results['artifact_directory'])}"
    )
    print("The run is not active; reviewed model activation is a separate Phase 6 decision.")
    partitions = results["partitions"]
    print(
        "Student-disjoint partitions: "
        + ", ".join(
            f"{name}={summary['n_students']} students/{summary['n_samples']} rows"
            for name, summary in partitions.items()
        )
    )
    selection = results["selection"]
    print(
        f"Selected on validation {results['protocol']['primary_selection_metric']}: "
        f"{selection['winner']}"
        + (" (predeclared tie rule applied)" if selection["tie_rule_applied"] else "")
    )
    for model_name, metrics in results["models"].items():
        test = metrics["test"]
        print(
            f"{model_name} [test] accuracy={test['accuracy']:.3f}, "
            f"precision={test['precision']:.3f}, recall={test['recall']:.3f}, "
            f"f1={test['f1_score']:.3f}, roc_auc={_format_metric(test['roc_auc'])}, "
            f"pr_auc={_format_metric(test['average_precision'])}, "
            f"brier={test['brier_score']:.3f}"
        )
    for name, baseline in results["baselines"].items():
        test = baseline["test"]
        print(
            f"baseline:{name} [test] accuracy={test['accuracy']:.3f}, "
            f"pr_auc={_format_metric(test['average_precision'])}, "
            f"brier={test['brier_score']:.3f}"
        )
    adequacy = results["adequacy"]
    if not adequacy["met"]:
        print(
            f"INDICATIVE ONLY: the test partition has {adequacy['test_learners']} learners and "
            f"{adequacy['test_rows_per_class']} rows per class; the predeclared minimum is "
            f"{adequacy['min_test_learners']} learners and {adequacy['min_rows_per_class']} rows per class."
        )


if __name__ == "__main__":
    main()

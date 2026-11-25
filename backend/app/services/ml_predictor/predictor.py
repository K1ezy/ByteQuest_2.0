"""Load validated model artifacts and predict outcomes from prior attempts."""

from __future__ import annotations

import hashlib
import json
import logging
import math
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
import sklearn
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import ActivityAttempt, HintUse, LearningActivity, Profile
from app.services.ml_predictor.feature_engineering import (
    FEATURE_NAMES,
    extract_features_from_dataframe,
)
from app.services.ml_predictor.thresholds import classify_success, recommended_action

logger = logging.getLogger(__name__)


class ModelArtifactsUnavailable(RuntimeError):
    """Raised when a complete compatible pair of trained models is unavailable."""


class ModelArtifactError(RuntimeError):
    """Raised when saved model artifacts are invalid or incompatible."""


@dataclass(frozen=True)
class ModelBundle:
    logistic_regression: Any
    random_forest: Any
    model_version: str
    selected_model: str
    report: dict[str, Any]


# Reported partitions and per-partition keys the faculty evaluation view may
# show. Anything outside these lists — artifact paths, feature schemas, fitted
# hyperparameters, training rows — never leaves the backend.
_REPORT_PARTITIONS = ("validation", "test")
_PARTITION_KEYS = (
    "partition", "n_samples", "n_students", "positive_rate", "decision_threshold",
    "accuracy", "precision", "recall", "f1_score", "roc_auc", "average_precision",
    "brier_score", "confusion_matrix", "roc_curve", "pr_curve",
)


def _partition_report(scores: dict[str, Any]) -> dict[str, Any]:
    return {
        partition: {key: scores[partition][key] for key in _PARTITION_KEYS if key in scores[partition]}
        for partition in _REPORT_PARTITIONS
        if isinstance(scores.get(partition), dict)
    }


def _scores_only(by_name: Any) -> dict[str, Any]:
    """Keep only the allowlisted partition keys of each estimator's score."""
    if not isinstance(by_name, dict):
        return {}
    return {
        name: {key: score[key] for key in _PARTITION_KEYS if key in score}
        for name, score in by_name.items()
        if isinstance(score, dict)
    }


def _sanitized_report(metrics: dict[str, Any]) -> dict[str, Any]:
    """Allowlist the validated metrics summary for the faculty evaluation view."""
    live = (metrics.get("supplementary") or {}).get("live_eligible")
    live = live if isinstance(live, dict) else {}
    return {
        "model_version": metrics.get("model_version"),
        "dataset_source": metrics.get("dataset_source"),
        "research_approved": metrics.get("research_approved"),
        "generated_at": metrics.get("generated_at"),
        "n_samples": metrics.get("n_samples"),
        "n_students": metrics.get("n_students"),
        "outcome_counts": metrics.get("outcome_counts") or {},
        "protocol": metrics.get("protocol") or {},
        "partitions": metrics.get("partitions") or {},
        "selection": metrics.get("selection") or {},
        "models": {
            name: _partition_report(scores)
            for name, scores in (metrics.get("models") or {}).items()
            if isinstance(scores, dict)
        },
        "baselines": {
            name: _partition_report(scores)
            for name, scores in (metrics.get("baselines") or {}).items()
            if isinstance(scores, dict)
        },
        "confidence_intervals": {
            name: {key: intervals.get(key) for key in ("level", "n_resamples", "skipped_single_class", "metrics")}
            for name, intervals in (metrics.get("confidence_intervals") or {}).items()
            if isinstance(intervals, dict)
        },
        "adequacy": metrics.get("adequacy") or {},
        "supplementary": {
            "live_eligible": {
                "min_prior_tasks": live.get("min_prior_tasks"),
                "models": _scores_only(live.get("models")),
                "baselines": _scores_only(live.get("baselines")),
            }
        } if live else {},
    }


@dataclass(frozen=True)
class PredictionResult:
    features: dict[str, float]
    logreg_probability: float
    logreg_prediction: bool
    rf_probability: float
    rf_prediction: bool
    recommended_action: str
    model_version: str
    selected_model: str


_model_bundle: ModelBundle | None = None
_model_load_error: str | None = None
_model_lock = threading.Lock()


def _validate_model(model: Any, model_name: str) -> None:
    has_predict_proba = callable(getattr(model, "predict_proba", None))
    has_predict = callable(getattr(model, "predict", None))
    if not has_predict_proba or not has_predict:
        raise ModelArtifactError(f"The {model_name} artifact must implement predict and predict_proba.")
    feature_names = getattr(model, "feature_names_in_", None)
    if feature_names is not None and tuple(str(name) for name in feature_names) != FEATURE_NAMES:
        raise ModelArtifactError(
            f"The {model_name} artifact feature order does not match the current schema."
        )
    feature_count = getattr(model, "n_features_in_", None)
    if feature_count is not None and int(feature_count) != len(FEATURE_NAMES):
        raise ModelArtifactError(f"The {model_name} artifact has an incompatible number of input features.")
    classes = set(getattr(model, "classes_", ()))
    if classes != {0, 1}:
        raise ModelArtifactError(
            f"The {model_name} artifact must be trained with both binary outcome classes."
        )


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as model_file:
        for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_ml_models() -> ModelBundle:
    """Load and cache the model pair; missing files remain retryable."""
    global _model_bundle, _model_load_error
    if _model_bundle is not None:
        return _model_bundle
    if _model_load_error is not None:
        raise ModelArtifactError(_model_load_error)

    with _model_lock:
        if _model_bundle is not None:
            return _model_bundle
        if _model_load_error is not None:
            raise ModelArtifactError(_model_load_error)

        artifacts_dir = Path(settings.ML_ARTIFACTS_DIR).expanduser().resolve()
        activation_path = artifacts_dir / "active_model.json"
        if not activation_path.is_file():
            raise ModelArtifactsUnavailable(
                "No reviewed model is active. Expected an explicit "
                f"activation manifest at {activation_path}."
            )

        try:
            with activation_path.open(encoding="utf-8") as manifest_file:
                manifest = json.load(manifest_file)
            if not isinstance(manifest, dict):
                raise ModelArtifactError("Active model manifest must be a JSON object.")
            relative_directory = manifest.get("artifact_directory")
            if not isinstance(relative_directory, str) or not relative_directory.strip():
                raise ModelArtifactError("Active model manifest has no artifact_directory.")
            version_root = (artifacts_dir / "runs").resolve()
            model_directory = (artifacts_dir / relative_directory).resolve()
            if model_directory.parent != version_root:
                raise ModelArtifactError(
                    "Active model artifact_directory must select one direct child of the reviewed runs directory."
                )
            manifest_version = manifest.get("model_version")
            if not isinstance(manifest_version, str) or not manifest_version.strip():
                raise ModelArtifactError("Active model manifest has no valid model_version.")

            metadata_path = model_directory / "model_metadata.json"
            if not metadata_path.is_file():
                raise ModelArtifactError("Selected model run is missing model_metadata.json.")
            with metadata_path.open(encoding="utf-8") as metadata_file:
                metadata = json.load(metadata_file)
            if not isinstance(metadata, dict):
                raise ModelArtifactError("Model metadata must be a JSON object.")
            model_version = str(metadata.get("model_version") or "")
            if model_version != manifest_version:
                raise ModelArtifactError(
                    "Active model manifest version does not match the selected artifact metadata."
                )
            if model_directory.name != model_version:
                raise ModelArtifactError(
                    "Active model directory name does not match its recorded model version."
                )
            if metadata.get("schema_version") != 3:
                raise ModelArtifactError("Model artifact metadata schema is unsupported.")
            if metadata.get("features") != list(FEATURE_NAMES):
                raise ModelArtifactError("Model metadata feature schema does not match this backend version.")
            if metadata.get("scikit_learn_version") != sklearn.__version__:
                raise ModelArtifactError(
                    "Model artifacts were trained with a different scikit-learn version; retrain "
                    "them in the backend's current environment."
                )
            metrics_path = model_directory / "metrics_summary.json"
            if not metrics_path.is_file():
                raise ModelArtifactError("Selected model run is missing metrics_summary.json.")
            with metrics_path.open(encoding="utf-8") as metrics_file:
                metrics = json.load(metrics_file)
            if not isinstance(metrics, dict):
                raise ModelArtifactError("Metrics summary must be a JSON object.")
            selected_model = (metrics.get("selection") or {}).get("winner")
            if selected_model not in {"logreg", "random_forest"}:
                raise ModelArtifactError("Model run has no valid selected winner.")
            if (
                metrics.get("model_version") != model_version
                or metrics.get("dataset_source") != metadata.get("dataset_source")
                or metrics.get("features") != list(FEATURE_NAMES)
                or metrics.get("research_approved") is not metadata.get("research_approved")
            ):
                raise ModelArtifactError(
                    "Metrics summary does not match the selected model metadata."
                )
            if metadata.get("is_synthetic_data") is not False:
                raise ModelArtifactError(
                    "Synthetic bootstrap models are for development evaluation and cannot be served."
                )
            if (
                metadata.get("dataset_source") != "approved_deidentified_csv"
                or metadata.get("research_approved") is not True
            ):
                raise ModelArtifactError(
                    "Only institution-approved, deidentified training artifacts may be served."
                )
            artifact_hashes = metadata.get("sha256")
            if not isinstance(artifact_hashes, dict):
                raise ModelArtifactError("Model metadata is missing artifact integrity hashes.")
            artifact_paths = {
                "logreg_pipeline.joblib": model_directory / "logreg_pipeline.joblib",
                "rf_pipeline.joblib": model_directory / "rf_pipeline.joblib",
                "metrics_summary.json": model_directory / "metrics_summary.json",
            }
            for name, path in artifact_paths.items():
                if not path.is_file():
                    raise ModelArtifactError(f"Required versioned artifact is missing: {name}.")
                expected_hash = artifact_hashes.get(name)
                if not isinstance(expected_hash, str) or _sha256_file(path) != expected_hash:
                    raise ModelArtifactError(f"Artifact integrity check failed for {name}.")

            logreg_path = artifact_paths["logreg_pipeline.joblib"]
            rf_path = artifact_paths["rf_pipeline.joblib"]
            logreg_model = joblib.load(logreg_path)
            rf_model = joblib.load(rf_path)
            _validate_model(logreg_model, "logistic regression")
            _validate_model(rf_model, "random forest")
            bundle = ModelBundle(
                logistic_regression=logreg_model,
                random_forest=rf_model,
                model_version=model_version,
                selected_model=selected_model,
                report=_sanitized_report(metrics),
            )
        except ModelArtifactsUnavailable:
            raise
        except ModelArtifactError as exc:
            _model_load_error = str(exc)
            raise
        except Exception as exc:
            logger.exception("Unable to load ML model artifacts from %s", artifacts_dir)
            _model_load_error = "ML model artifacts could not be loaded."
            raise ModelArtifactError(_model_load_error) from exc

        _model_bundle = bundle
        logger.info("Loaded compatible ML model artifacts (version=%s)", bundle.model_version)
        return bundle


def _positive_probability(model: Any, model_input: pd.DataFrame) -> tuple[float, bool]:
    classes = list(model.classes_)
    try:
        positive_index = classes.index(1)
    except ValueError as exc:
        raise ModelArtifactError("Model is missing the positive success class.") from exc
    probabilities = model.predict_proba(model_input)
    probability = float(probabilities[0][positive_index])
    if not math.isfinite(probability) or not 0.0 <= probability <= 1.0:
        raise ModelArtifactError("Model returned an invalid probability.")
    # Classify from the shared threshold rather than the estimator's own
    # argmax, so a served prediction uses the same boundary the reported
    # offline metrics were computed at.
    return probability, classify_success(probability)


def predict_student_success(
    db: Session,
    student: Profile,
    target_activity: LearningActivity,
    source_attempt: ActivityAttempt | None = None,
    *,
    as_of: datetime | None = None,
) -> PredictionResult:
    """Predict the first-submission outcome on a challenge from the learner's course history.

    History is every graded, non-exam attempt and hint reveal in the target's
    course and language, up to the source attempt (or ``as_of``). The snapshot
    time is the live t0, matching how the trainer cuts history at t0.
    """
    models = load_ml_models()
    in_scope = (
        LearningActivity.course_id == target_activity.course_id,
        LearningActivity.language == target_activity.language,
    )
    history_query = (
        db.query(ActivityAttempt, LearningActivity.activity_type)
        .join(LearningActivity, ActivityAttempt.activity_id == LearningActivity.id)
        .filter(
            ActivityAttempt.student_id == student.id,
            ActivityAttempt.exam_attempt_id.is_(None),
            *in_scope,
        )
    )
    if source_attempt is not None:
        history_query = history_query.filter(
            or_(
                ActivityAttempt.created_at < source_attempt.created_at,
                and_(
                    ActivityAttempt.created_at == source_attempt.created_at,
                    ActivityAttempt.attempt_number < source_attempt.attempt_number,
                ),
                and_(
                    ActivityAttempt.created_at == source_attempt.created_at,
                    ActivityAttempt.attempt_number == source_attempt.attempt_number,
                    ActivityAttempt.id <= source_attempt.id,
                ),
            )
        )
    elif as_of is not None:
        history_query = history_query.filter(ActivityAttempt.created_at < as_of)

    history = [
        {
            "id": str(attempt.id),
            "activity_id": str(attempt.activity_id),
            "attempt_number": attempt.attempt_number,
            "created_at": attempt.created_at,
            "is_successful": attempt.is_successful,
            "error_category": attempt.error_category,
            "compiler_status_id": attempt.compiler_status_id,
            "score_percentage": attempt.score_percentage,
            "activity_type": activity_type,
        }
        for attempt, activity_type in history_query.all()
    ]
    hints = [
        {"activity_id": str(activity_id), "created_at": created_at}
        for activity_id, created_at in db.query(HintUse.activity_id, HintUse.created_at)
        .join(LearningActivity, HintUse.activity_id == LearningActivity.id)
        .filter(HintUse.student_id == student.id, *in_scope)
        .all()
    ]
    # The snapshot moment is t0. Rows were already limited to the source
    # attempt above; the cutoff sits just after it so that attempt counts.
    cutoff = as_of or datetime.now(timezone.utc)
    if history and source_attempt is not None:
        cutoff = max(cutoff, max(row["created_at"] for row in history) + timedelta(microseconds=1))
    features = extract_features_from_dataframe(
        history,
        cutoff=cutoff,
        hint_reveals=hints,
        target_activity_id=target_activity.id,
    )
    model_input = pd.DataFrame([features], columns=FEATURE_NAMES, dtype=float)

    logreg_probability, logreg_prediction = _positive_probability(
        models.logistic_regression, model_input
    )
    rf_probability, rf_prediction = _positive_probability(models.random_forest, model_input)

    return PredictionResult(
        features=features,
        logreg_probability=logreg_probability,
        logreg_prediction=logreg_prediction,
        rf_probability=rf_probability,
        rf_prediction=rf_prediction,
        recommended_action=recommended_action(
            logreg_probability if models.selected_model == "logreg" else rf_probability
        ),
        model_version=models.model_version,
        selected_model=models.selected_model,
    )

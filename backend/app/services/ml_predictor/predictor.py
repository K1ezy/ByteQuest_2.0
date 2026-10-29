"""Load validated model artifacts and predict outcomes from prior attempts."""

from __future__ import annotations

import hashlib
import json
import logging
import math
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
import sklearn
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import ActivityAttempt, LearningActivity, Profile
from app.services.ml_predictor.feature_engineering import (
    FEATURE_NAMES,
    extract_features_from_dataframe,
)

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


@dataclass(frozen=True)
class PredictionResult:
    features: dict[str, float]
    logreg_probability: float
    logreg_prediction: bool
    rf_probability: float
    rf_prediction: bool
    recommended_action: str
    model_version: str


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
            if metadata.get("schema_version") != 1:
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
    predicted = bool(model.predict(model_input)[0] == 1)
    return probability, predicted


def predict_student_success(
    db: Session,
    student: Profile,
    target_activity: LearningActivity,
    source_attempt: ActivityAttempt | None = None,
) -> PredictionResult:
    """Predict success using only the student's prior attempts in the target track."""
    models = load_ml_models()
    history_query = (
        db.query(
            ActivityAttempt,
            LearningActivity.activity_type,
            LearningActivity.language,
            LearningActivity.topic_concept,
        )
        .join(LearningActivity, ActivityAttempt.activity_id == LearningActivity.id)
        .filter(
            ActivityAttempt.student_id == student.id,
            LearningActivity.language == target_activity.language,
            func.lower(func.trim(LearningActivity.topic_concept))
            == str(target_activity.topic_concept).strip().casefold(),
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

    history_rows = (
        history_query.order_by(
            ActivityAttempt.created_at.asc(),
            ActivityAttempt.attempt_number.asc(),
            ActivityAttempt.id.asc(),
        )
        .all()
    )
    history = [
        {
            "id": str(attempt.id),
            "activity_id": str(attempt.activity_id),
            "attempt_number": attempt.attempt_number,
            "created_at": attempt.created_at,
            "is_successful": attempt.is_successful,
            "error_category": attempt.error_category,
            "compiler_status_id": attempt.compiler_status_id,
            "execution_time_ms": attempt.execution_time_ms,
            "time_spent_seconds": attempt.time_spent_seconds,
            "score_percentage": attempt.score_percentage,
            "activity_type": activity_type,
            "language": language,
            "topic_concept": topic_concept,
        }
        for attempt, activity_type, language, topic_concept in history_rows
    ]
    features = extract_features_from_dataframe(
        pd.DataFrame.from_records(history),
        target_difficulty=target_activity.difficulty_level,
        target_language=target_activity.language,
        target_topic=target_activity.topic_concept,
    )
    model_input = pd.DataFrame([features], columns=FEATURE_NAMES, dtype=float)

    logreg_probability, logreg_prediction = _positive_probability(
        models.logistic_regression, model_input
    )
    rf_probability, rf_prediction = _positive_probability(models.random_forest, model_input)
    if rf_probability >= 0.60:
        recommended_action = "advance_next_level"
    elif rf_probability >= 0.40:
        recommended_action = "standard_next"
    else:
        recommended_action = "remedial_practice"

    return PredictionResult(
        features=features,
        logreg_probability=logreg_probability,
        logreg_prediction=logreg_prediction,
        rf_probability=rf_probability,
        rf_prediction=rf_prediction,
        recommended_action=recommended_action,
        model_version=models.model_version,
    )

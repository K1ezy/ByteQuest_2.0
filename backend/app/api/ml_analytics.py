"""Live model predictions and instructor model-performance summaries."""

from __future__ import annotations

import logging
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_instructor
from app.models.entities import (
    ActivityAttempt,
    LearningActivity,
    MLPrediction,
    Profile,
    ReviewState,
    UserRole,
)
from app.services.ml_predictor.predictor import (
    ModelArtifactError,
    ModelArtifactsUnavailable,
    predict_student_success,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/predict", tags=["ML Predictions & Analytics"])


class PredictNextTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_activity_id: uuid.UUID
    source_attempt_id: Optional[uuid.UUID] = None


class ModelEstimate(BaseModel):
    probability_success: float = Field(ge=0.0, le=1.0)
    prediction: bool


class PredictionProbabilities(BaseModel):
    logistic_regression: ModelEstimate
    random_forest: ModelEstimate


class PredictNextTaskResponse(BaseModel):
    prediction_id: uuid.UUID
    target_activity_id: uuid.UUID
    model_version: str
    probabilities: PredictionProbabilities
    recommended_action: Literal[
        "advance_next_level", "standard_next", "remedial_practice"
    ]
    rationale: str


class ModelVersionCount(BaseModel):
    model_version: Optional[str]
    prediction_count: int = Field(ge=0)


class InstructorAnalyticsResponse(BaseModel):
    total_predictions_logged: int = Field(ge=0)
    labeled_predictions: int = Field(ge=0)
    model_versions: list[ModelVersionCount]
    average_predicted_success_probability_percent: dict[str, Optional[float]]
    accuracy_percent: dict[str, Optional[float]]
    status: Literal["active", "no_predictions_yet"]


@router.post("/next-task", response_model=PredictNextTaskResponse)
def predict_and_sequence_next_task(
    payload: PredictNextTaskRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PredictNextTaskResponse:
    """Predict a student's success probability and save an auditable snapshot."""
    if current_user.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student prediction access is required.",
        )

    target_activity = (
        db.query(LearningActivity)
        .filter(
            LearningActivity.id == payload.target_activity_id,
            LearningActivity.language == current_user.enrolled_language,
            LearningActivity.review_status == ReviewState.published,
        )
        .first()
    )
    if target_activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Published target activity not found in the enrolled language.",
        )

    source_attempt = None
    if payload.source_attempt_id is not None:
        source_attempt = (
            db.query(ActivityAttempt)
            .join(LearningActivity, ActivityAttempt.activity_id == LearningActivity.id)
            .filter(
                ActivityAttempt.id == payload.source_attempt_id,
                ActivityAttempt.student_id == current_user.id,
                LearningActivity.language == current_user.enrolled_language,
            )
            .first()
        )
        if source_attempt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Source attempt not found.",
            )

    try:
        prediction = predict_student_success(
            db, current_user, target_activity, source_attempt
        )
    except ModelArtifactsUnavailable as exc:
        logger.warning("ML prediction unavailable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Trained prediction models are not available. "
                "Rule-based sequencing remains active."
            ),
        ) from exc
    except ModelArtifactError as exc:
        logger.exception("ML model artifacts are incompatible or failed during inference.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prediction models are temporarily unavailable.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected failure while generating ML prediction.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prediction service is temporarily unavailable.",
        ) from exc

    prediction_record = MLPrediction(
        student_id=current_user.id,
        source_attempt_id=source_attempt.id if source_attempt is not None else None,
        target_activity_id=target_activity.id,
        features_snapshot_json=prediction.features,
        logreg_prob=prediction.logreg_probability,
        logreg_pred=prediction.logreg_prediction,
        rf_prob=prediction.rf_probability,
        rf_pred=prediction.rf_prediction,
        active_sequencer_mode="random_forest",
        recommended_action=prediction.recommended_action,
        model_version=prediction.model_version,
    )
    try:
        db.add(prediction_record)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to persist ML prediction for student %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prediction could not be recorded. Please try again.",
        )

    return PredictNextTaskResponse(
        prediction_id=prediction_record.id,
        target_activity_id=target_activity.id,
        model_version=prediction.model_version,
        probabilities=PredictionProbabilities(
            logistic_regression=ModelEstimate(
                probability_success=prediction.logreg_probability,
                prediction=prediction.logreg_prediction,
            ),
            random_forest=ModelEstimate(
                probability_success=prediction.rf_probability,
                prediction=prediction.rf_prediction,
            ),
        ),
        recommended_action=prediction.recommended_action,
        rationale=(
            "Random Forest predicted success probability "
            f"{prediction.rf_probability * 100:.1f}%; recommended action: "
            f"{prediction.recommended_action}."
        ),
    )


@router.get("/instructor/analytics", response_model=InstructorAnalyticsResponse)
def get_ml_analytics_summary(
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
) -> InstructorAnalyticsResponse:
    """Return aggregated prediction quality without loading individual records."""
    summary = (
        db.query(
            func.count(MLPrediction.id),
            func.avg(MLPrediction.logreg_prob),
            func.avg(MLPrediction.rf_prob),
            func.count(MLPrediction.actual_outcome),
            func.sum(
                case(
                    (
                        MLPrediction.actual_outcome.is_not(None)
                        & (MLPrediction.logreg_pred == MLPrediction.actual_outcome),
                        1,
                    ),
                    else_=0,
                )
            ),
            func.sum(
                case(
                    (
                        MLPrediction.actual_outcome.is_not(None)
                        & (MLPrediction.rf_pred == MLPrediction.actual_outcome),
                        1,
                    ),
                    else_=0,
                )
            ),
        )
        .one()
    )
    (
        total_predictions,
        avg_logreg_probability,
        avg_rf_probability,
        labeled_count,
        logreg_correct,
        rf_correct,
    ) = summary
    total_predictions = int(total_predictions or 0)
    labeled_count = int(labeled_count or 0)
    model_versions = (
        db.query(MLPrediction.model_version, func.count(MLPrediction.id))
        .group_by(MLPrediction.model_version)
        .order_by(MLPrediction.model_version.asc())
        .all()
    )

    return InstructorAnalyticsResponse(
        total_predictions_logged=total_predictions,
        labeled_predictions=labeled_count,
        model_versions=[
            ModelVersionCount(model_version=version, prediction_count=int(count))
            for version, count in model_versions
        ],
        average_predicted_success_probability_percent={
            "logistic_regression": (
                round(float(avg_logreg_probability) * 100, 2)
                if avg_logreg_probability is not None
                else None
            ),
            "random_forest": (
                round(float(avg_rf_probability) * 100, 2)
                if avg_rf_probability is not None
                else None
            ),
        },
        accuracy_percent={
            "logistic_regression": round((int(logreg_correct or 0) / labeled_count) * 100, 2)
            if labeled_count
            else None,
            "random_forest": round((int(rf_correct or 0) / labeled_count) * 100, 2)
            if labeled_count
            else None,
        },
        status="active" if total_predictions else "no_predictions_yet",
    )

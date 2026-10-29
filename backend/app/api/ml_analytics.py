"""Instructor-only aggregate analytics for non-interfering ML shadow scoring."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_instructor
from app.models.entities import MLPrediction, Profile

router = APIRouter(prefix="/api/v1/predict", tags=["ML Shadow Evaluation & Analytics"])


class ModelVersionCount(BaseModel):
    model_version: Optional[str]
    prediction_count: int = Field(ge=0)


class InstructorAnalyticsResponse(BaseModel):
    total_predictions_logged: int = Field(ge=0)
    labeled_predictions: int = Field(ge=0)
    model_versions: list[ModelVersionCount]
    average_predicted_success_probability_percent: dict[str, Optional[float]]
    accuracy_percent: dict[str, Optional[float]]
    active_sequencer_mode: Literal["rule_based"]
    shadow_status: Literal[
        "disabled",
        "approval_required",
        "ready",
        "artifacts_unavailable",
        "artifacts_invalid",
        "unavailable",
    ]
    status: Literal["shadow_active", "no_predictions_yet"]


@router.get("/instructor/analytics", response_model=InstructorAnalyticsResponse)
def get_ml_analytics_summary(
    request: Request,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
) -> InstructorAnalyticsResponse:
    """Return aggregate model quality for labeled shadow predictions only."""
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
        active_sequencer_mode="rule_based",
        shadow_status=getattr(request.app.state, "ml_shadow_status", "disabled"),
        status="shadow_active" if total_predictions else "no_predictions_yet",
    )

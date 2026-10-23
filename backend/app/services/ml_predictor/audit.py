"""Helpers for linking recorded predictions to their eventual outcomes."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.entities import MLPrediction


def record_prediction_outcome(
    db: Session,
    *,
    student_id: uuid.UUID,
    activity_id: uuid.UUID,
    attempt_created_at: datetime,
    is_successful: bool,
) -> int:
    """Attach the first observed target outcome to matching earlier predictions."""
    return (
        db.query(MLPrediction)
        .filter(
            MLPrediction.student_id == student_id,
            MLPrediction.target_activity_id == activity_id,
            MLPrediction.created_at <= attempt_created_at,
            MLPrediction.actual_outcome.is_(None),
        )
        .update(
            {MLPrediction.actual_outcome: bool(is_successful)},
            synchronize_session=False,
        )
    )

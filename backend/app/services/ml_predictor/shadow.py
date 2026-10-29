"""Non-interfering, opt-in shadow scoring for rule-sequenced activity flows."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import (
    ActivityAttempt,
    LearningActivity,
    MLPrediction,
    Profile,
    ResearchConsent,
    ReviewState,
    UserRole,
)
from app.services.ml_predictor.predictor import (
    ModelArtifactError,
    ModelArtifactsUnavailable,
    predict_student_success,
)
from app.services.settings_service import get_setting_int

logger = logging.getLogger(__name__)


def _rollback_quietly(db: Session) -> None:
    """Clear a failed optional transaction without masking the student response."""
    try:
        db.rollback()
    except Exception:
        logger.warning("Unable to roll back the optional ML shadow transaction.")


def prior_graded_task_count(db: Session, student: Profile, target: LearningActivity, source: ActivityAttempt) -> int:
    """Count distinct eligible activities before the next-task prediction."""
    return (
        db.query(ActivityAttempt.activity_id)
        .join(LearningActivity, ActivityAttempt.activity_id == LearningActivity.id)
        .filter(
            ActivityAttempt.student_id == student.id,
            LearningActivity.language == target.language,
            func.lower(func.trim(LearningActivity.topic_concept)) == str(target.topic_concept).strip().casefold(),
            ActivityAttempt.created_at <= source.created_at,
        )
        .distinct()
        .count()
    )


def has_required_prediction_history(db: Session, student: Profile, target: LearningActivity, source: ActivityAttempt) -> bool:
    return prior_graded_task_count(db, student, target, source) >= get_setting_int(db, "prediction_min_history", 3)


def record_shadow_prediction(
    db: Session,
    *,
    student: Profile,
    target_activity_id: uuid.UUID | None,
    source_attempt: ActivityAttempt,
    shadow_ready: bool,
) -> bool:
    """Persist a model snapshot without affecting the committed student flow.

    This function is called only after the authoritative attempt and rule-based
    recommendation have committed. Shadow scoring is disabled by default and
    additionally requires an explicit research-approval attestation plus the
    predictor's reviewed-artifact checks. All failures are isolated from the
    already-committed student submission.
    """
    if not settings.ML_SHADOW_ENABLED:
        return False
    if not settings.ML_SHADOW_RESEARCH_APPROVED:
        logger.warning("Skipping ML shadow prediction: research approval is not attested.")
        return False
    if not (settings.RESEARCH_CONSENT_ACTIVE and settings.RESEARCH_CONSENT_VERSION and settings.RESEARCH_CONSENT_TEXT):
        return False
    latest_consent = (
        db.query(ResearchConsent)
        .filter(ResearchConsent.student_id == student.id)
        .order_by(ResearchConsent.event_order.desc())
        .first()
    )
    if (
        latest_consent is None
        or latest_consent.choice != "accepted"
        or latest_consent.document_version != settings.RESEARCH_CONSENT_VERSION
    ):
        return False
    if not shadow_ready:
        # Avoid retrying model loads per request after startup has classified the
        # model as missing, invalid, or otherwise unavailable.
        return False
    if target_activity_id is None:
        return False

    try:
        if source_attempt.student_id != student.id:
            logger.warning("Skipping ML shadow prediction with a mismatched source attempt.")
            return False

        target_activity = db.get(LearningActivity, target_activity_id)
        if (
            student.role != UserRole.student
            or target_activity is None
            or target_activity.language != student.enrolled_language
            or target_activity.review_status != ReviewState.published
        ):
            return False

        # The source attempt has already committed and is prior to the target.
        # Count distinct graded activities, rather than retries of one activity.
        if not has_required_prediction_history(db, student, target_activity, source_attempt):
            return False

        prediction = predict_student_success(
            db,
            student,
            target_activity,
            source_attempt,
        )
    except ModelArtifactsUnavailable as exc:
        _rollback_quietly(db)
        logger.info("Skipping ML shadow prediction because no reviewed model is active: %s", exc)
        return False
    except ModelArtifactError:
        _rollback_quietly(db)
        logger.exception("Skipping ML shadow prediction because model validation failed.")
        return False
    except SQLAlchemyError:
        _rollback_quietly(db)
        logger.exception("Database failure while preparing optional ML shadow prediction.")
        return False
    except Exception:
        _rollback_quietly(db)
        logger.exception("Unexpected ML shadow prediction failure; student flow is unchanged.")
        return False

    try:
        prediction_record = MLPrediction(
            student_id=student.id,
            source_attempt_id=source_attempt.id,
            target_activity_id=target_activity.id,
            features_snapshot_json=prediction.features,
            logreg_prob=prediction.logreg_probability,
            logreg_pred=prediction.logreg_prediction,
            rf_prob=prediction.rf_probability,
            rf_pred=prediction.rf_prediction,
            # This records the policy that actually served the student.
            active_sequencer_mode="rule_based",
            # This is an offline/shadow candidate and is never returned to the client.
            recommended_action=prediction.recommended_action,
            model_version=prediction.model_version,
        )
        db.add(prediction_record)
        db.commit()
    except SQLAlchemyError:
        _rollback_quietly(db)
        logger.exception("Unable to persist optional ML shadow prediction.")
        return False
    except Exception:
        _rollback_quietly(db)
        logger.exception("Unexpected failure while persisting ML shadow prediction.")
        return False

    logger.info(
        "Recorded ML shadow prediction (model_version=%s)",
        prediction.model_version,
    )
    return True

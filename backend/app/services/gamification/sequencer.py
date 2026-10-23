"""Deterministic cold-start recommendations for student quest progression."""

from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import (
    ActivityAttempt,
    ActivityKind,
    LearningActivity,
    Profile,
    ReviewState,
)

MAX_MASTERY_ATTEMPTS = 2
QUIZ_MASTERY_SCORE = 75.0
CHALLENGE_MASTERY_SCORE = 80.0
HIGH_ERROR_CATEGORIES = {"syntax_error", "logic_error"}


def determine_next_task_rule_based(
    db: Session,
    student: Profile,
    completed_activity: LearningActivity,
    latest_attempt: ActivityAttempt,
) -> dict[str, Any]:
    """Recommend advancement or focused practice using stable pedagogical rules.

    Advancement requires a successful score at the activity's mastery threshold,
    no more than two attempts, and no dominant syntax or logic error on the latest
    attempt. Candidates are restricted to published activities in the same language.
    """
    attempt_count = (
        db.query(func.count(ActivityAttempt.id))
        .filter(
            ActivityAttempt.student_id == student.id,
            ActivityAttempt.activity_id == completed_activity.id,
        )
        .scalar()
        or 0
    )
    attempt_count = max(attempt_count, int(latest_attempt.attempt_number or 0))

    mastery_score = (
        CHALLENGE_MASTERY_SCORE
        if completed_activity.activity_type == ActivityKind.challenge
        else QUIZ_MASTERY_SCORE
    )
    error_category = (latest_attempt.error_category or "").strip().lower()
    is_mastered = (
        bool(latest_attempt.is_successful)
        and float(latest_attempt.score_percentage or 0.0) >= mastery_score
        and attempt_count <= MAX_MASTERY_ATTEMPTS
        and error_category not in HIGH_ERROR_CATEGORIES
    )
    successful_activity = (
        db.query(ActivityAttempt.id)
        .filter(
            ActivityAttempt.student_id == student.id,
            ActivityAttempt.activity_id == LearningActivity.id,
            ActivityAttempt.is_successful.is_(True),
        )
        .exists()
    )

    if is_mastered:
        next_activity = (
            db.query(LearningActivity)
            .filter(
                LearningActivity.language == completed_activity.language,
                LearningActivity.review_status == ReviewState.published,
                LearningActivity.sequence_order > completed_activity.sequence_order,
                ~successful_activity,
            )
            .order_by(
                LearningActivity.sequence_order.asc(),
                LearningActivity.difficulty_level.asc(),
                LearningActivity.id.asc(),
            )
            .first()
        )
        if next_activity is None:
            return {
                "sequencer_mode": "rule_based",
                "recommended_action": "completed_track",
                "target_activity_id": None,
                "rationale": "You completed all published activities in this language track.",
            }

        return {
            "sequencer_mode": "rule_based",
            "recommended_action": "advance_next_level",
            "target_activity_id": next_activity.id,
            "rationale": "Mastery criteria met. Continue to the next published activity.",
        }

    remedial_activity = (
        db.query(LearningActivity)
        .filter(
            LearningActivity.language == completed_activity.language,
            LearningActivity.topic_concept == completed_activity.topic_concept,
            LearningActivity.review_status == ReviewState.published,
            LearningActivity.difficulty_level <= completed_activity.difficulty_level,
            LearningActivity.id != completed_activity.id,
            ~successful_activity,
        )
        .order_by(
            LearningActivity.difficulty_level.desc(),
            LearningActivity.sequence_order.asc(),
            LearningActivity.id.asc(),
        )
        .first()
    )

    return {
        "sequencer_mode": "rule_based",
        "recommended_action": "remedial_practice",
        "target_activity_id": (
            remedial_activity.id if remedial_activity else completed_activity.id
        ),
        "rationale": "More practice is recommended to reinforce mastery of this concept.",
    }

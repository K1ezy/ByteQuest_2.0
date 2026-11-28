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
from app.services.attempt_visibility import (
    activity_accepts_submissions_clause, activity_is_closed,
    learner_visible_attempt_clause, student_visible_activity_clause,
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
            learner_visible_attempt_clause(),
        )
        .scalar()
        or 0
    )
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
            learner_visible_attempt_clause(),
        )
        .exists()
    )

    if is_mastered:
        # Mastered: move on to whatever is due soonest across every Workshop (ADR 0001).
        return determine_recommendation(db, student, consider_latest=False)

    remedial_activity = (
        db.query(LearningActivity)
        .filter(
            LearningActivity.language == completed_activity.language,
            LearningActivity.topic_concept == completed_activity.topic_concept,
            LearningActivity.review_status == ReviewState.published,
            student_visible_activity_clause(student.id),
            activity_accepts_submissions_clause(),
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

    if remedial_activity is None and activity_is_closed(completed_activity):
        return determine_recommendation(db, student, consider_latest=False)

    return {
        "sequencer_mode": "rule_based",
        "recommended_action": "remedial_practice",
        "target_activity_id": (
            remedial_activity.id if remedial_activity else completed_activity.id
        ),
        "rationale": "More practice is recommended to reinforce mastery of this concept.",
    }


def next_up_order():
    """One "Next up" across all Workshops: soonest deadline first, then the lowest number."""
    return (
        LearningActivity.closes_at.asc().nulls_last(),
        LearningActivity.sequence_order.asc(),
        LearningActivity.difficulty_level.asc(),
        LearningActivity.id.asc(),
    )


def determine_recommendation(
    db: Session,
    student: Profile,
    *,
    consider_latest: bool = True,
) -> dict[str, Any]:
    """Recommend the student's next action across every activity their Workshops share (ADR 0001)."""
    if not student.workshop_languages:
        return {
            "sequencer_mode": "rule_based",
            "recommended_action": "join_workshop",
            "target_activity_id": None,
            "rationale": "Join a workshop to see its activities.",
        }
    successful_activity = (
        db.query(ActivityAttempt.id)
        .filter(
            ActivityAttempt.student_id == student.id,
            ActivityAttempt.activity_id == LearningActivity.id,
            ActivityAttempt.is_successful.is_(True),
            learner_visible_attempt_clause(),
        )
        .exists()
    )
    activities = db.query(LearningActivity).filter(
        LearningActivity.review_status == ReviewState.published,
        student_visible_activity_clause(student.id),
    )
    first_uncompleted = (
        activities.filter(~successful_activity, activity_accepts_submissions_clause())
        .order_by(*next_up_order())
        .first()
    )

    latest_attempt_row = (
        db.query(ActivityAttempt, LearningActivity)
        .join(LearningActivity, LearningActivity.id == ActivityAttempt.activity_id)
        .filter(
            ActivityAttempt.student_id == student.id,
            LearningActivity.review_status == ReviewState.published,
            student_visible_activity_clause(student.id),
            learner_visible_attempt_clause(),
        )
        .order_by(ActivityAttempt.created_at.desc(), ActivityAttempt.id.desc())
        .first()
    ) if consider_latest else None

    if latest_attempt_row is None:
        if first_uncompleted is not None:
            return {
                "sequencer_mode": "rule_based",
                "recommended_action": "start_track" if consider_latest else "advance_next_level",
                "target_activity_id": first_uncompleted.id,
                "rationale": "Start with the activity that is due soonest.",
            }
        if activities.first() is None:
            return {
                "sequencer_mode": "rule_based",
                "recommended_action": "no_published_activities",
                "target_activity_id": None,
                "rationale": "Your workshops have not shared an activity yet.",
            }
        if activities.filter(~successful_activity).first() is not None:
            return {
                "sequencer_mode": "rule_based",
                "recommended_action": "no_open_activities",
                "target_activity_id": None,
                "rationale": "Your remaining activities are closed. You can still review them on the quest map.",
            }
        return {
            "sequencer_mode": "rule_based",
            "recommended_action": "completed_track",
            "target_activity_id": None,
            "rationale": "You completed every activity your workshops have shared.",
        }

    latest_attempt, latest_activity = latest_attempt_row
    return determine_next_task_rule_based(db, student, latest_activity, latest_attempt)

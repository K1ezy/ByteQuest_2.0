"""Shared XP and level progression rules."""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import ActivityAttempt, LearningActivity, Profile
from app.services.attempt_visibility import learner_visible_attempt_clause, published_track_clause

XP_PER_LEVEL = 250


def quest_completion(db: Session, student: Profile) -> tuple[int, int]:
    """Count completed and available quests on the student's current track."""
    published_track = published_track_clause(student)
    completed = (
        db.query(func.count(func.distinct(ActivityAttempt.activity_id)))
        .join(LearningActivity, LearningActivity.id == ActivityAttempt.activity_id)
        .filter(
            published_track,
            ActivityAttempt.student_id == student.id,
            ActivityAttempt.is_successful.is_(True),
            learner_visible_attempt_clause(),
        )
        .scalar()
    )
    total = db.query(func.count(LearningActivity.id)).filter(published_track).scalar()
    return completed or 0, total or 0


def grant_xp(student: Profile, amount: int) -> int:
    """Apply non-negative XP and keep the student's level in sync."""
    awarded = max(0, int(amount or 0))
    student.xp_points = max(0, int(student.xp_points or 0)) + awarded
    student.current_level = (student.xp_points // XP_PER_LEVEL) + 1
    return awarded

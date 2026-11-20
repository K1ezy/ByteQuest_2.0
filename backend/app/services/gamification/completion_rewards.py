"""First-completion rewards for practice and released exam items."""

from collections.abc import Collection
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.entities import ActivityAttempt, ExamAttempt, ExamItem, LearningActivity
from app.services.attempt_visibility import learner_visible_attempt_clause


def completed_activity_ids(db: Session, student_id: UUID, activity_ids: Collection[UUID]) -> set[UUID]:
    if not activity_ids:
        return set()
    return {
        activity_id
        for (activity_id,) in db.query(ActivityAttempt.activity_id).filter(
            ActivityAttempt.student_id == student_id,
            ActivityAttempt.activity_id.in_(activity_ids),
            ActivityAttempt.is_successful.is_(True),
            learner_visible_attempt_clause(),
        ).distinct()
    }


def exam_completion_awards(db: Session, attempt: ExamAttempt) -> dict[str, int]:
    """Compute awards before release while holding this learner's profile lock."""
    successes = db.query(ActivityAttempt.activity_id, ExamItem.snapshot_json, LearningActivity.xp_reward).join(
        LearningActivity, LearningActivity.id == ActivityAttempt.activity_id,
    ).outerjoin(ExamItem, ExamItem.id == ActivityAttempt.exam_item_id).filter(
        ActivityAttempt.exam_attempt_id == attempt.id,
        ActivityAttempt.student_id == attempt.student_id,
        ActivityAttempt.is_successful.is_(True),
    ).order_by(ActivityAttempt.id).all()
    completed = completed_activity_ids(db, attempt.student_id, {row.activity_id for row in successes})
    awards = {}
    for activity_id, snapshot, current_reward in successes:
        if activity_id in completed:
            continue
        reward = (snapshot or {}).get("xp_reward", current_reward)
        awards[str(activity_id)] = max(0, int(reward or 0))
        completed.add(activity_id)
    return awards

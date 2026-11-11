"""Select a learner's next published activity inside one course."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.entities import ActivityAttempt, LearningActivity, Profile, ReviewState
from app.services.attempt_visibility import learner_visible_attempt_clause


def next_course_activity(db: Session, student: Profile, course_id: uuid.UUID) -> LearningActivity | None:
    successful = db.query(ActivityAttempt.id).filter(
        ActivityAttempt.student_id == student.id,
        ActivityAttempt.activity_id == LearningActivity.id,
        ActivityAttempt.is_successful.is_(True),
        learner_visible_attempt_clause(),
    ).exists()
    return db.query(LearningActivity).filter(
        LearningActivity.course_id == course_id,
        LearningActivity.language == student.enrolled_language,
        LearningActivity.review_status == ReviewState.published,
        LearningActivity.closed_at.is_(None),
        LearningActivity.archived_at.is_(None),
        ~successful,
    ).order_by(LearningActivity.sequence_order, LearningActivity.id).first()

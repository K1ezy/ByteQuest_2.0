"""Select a learner's next published programming challenge inside one course."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.entities import ActivityAttempt, ActivityKind, LearningActivity, Profile, ReviewState
from app.services.attempt_visibility import (
    activity_accepts_submissions_clause, learner_visible_attempt_clause, student_visible_activity_clause,
)


def next_course_activity(db: Session, student: Profile, course_id: uuid.UUID) -> LearningActivity | None:
    successful = db.query(ActivityAttempt.id).filter(
        ActivityAttempt.student_id == student.id,
        ActivityAttempt.activity_id == LearningActivity.id,
        ActivityAttempt.is_successful.is_(True),
        learner_visible_attempt_clause(),
    ).exists()
    return db.query(LearningActivity).filter(
        LearningActivity.course_id == course_id,
        # Models predict challenge outcomes; quizzes are history, never targets.
        LearningActivity.activity_type == ActivityKind.challenge,
        LearningActivity.language == student.enrolled_language,
        LearningActivity.review_status == ReviewState.published,
        student_visible_activity_clause(student.id),
        activity_accepts_submissions_clause(),
        ~successful,
    ).order_by(LearningActivity.sequence_order, LearningActivity.id).first()

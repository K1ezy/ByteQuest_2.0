"""Shared learner-facing visibility rule for practice and exam attempts."""

from sqlalchemy import and_, exists, or_

from app.models.entities import ActivityAttempt, Exam, ExamAttempt


def learner_visible_attempt_clause():
    """Hide exam-backed activity rows until that exact attempt is released."""
    released_exam_attempt = exists().where(
        and_(
            ExamAttempt.id == ActivityAttempt.exam_attempt_id,
            Exam.id == ExamAttempt.exam_id,
            Exam.results_released_at.is_not(None),
            ExamAttempt.submitted_at.is_not(None),
            ExamAttempt.submitted_at <= Exam.results_released_at,
        )
    )
    return or_(ActivityAttempt.exam_attempt_id.is_(None), released_exam_attempt)

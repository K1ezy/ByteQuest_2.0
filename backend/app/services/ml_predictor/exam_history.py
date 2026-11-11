"""Course-scoped, released exam outcomes for model features and faculty history."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.entities import Exam, ExamAttempt, ExamItem, LearningActivity


def _utc(value: datetime) -> datetime:
    return value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)


def course_exam_ids(db: Session, course_id: uuid.UUID) -> set[uuid.UUID]:
    candidate_ids = {
        exam_id for (exam_id,) in db.query(ExamItem.exam_id)
        .join(LearningActivity, LearningActivity.id == ExamItem.activity_id)
        .filter(LearningActivity.course_id == course_id).distinct().all()
    }
    if not candidate_ids:
        return set()
    item_courses: dict[uuid.UUID, set[uuid.UUID | None]] = {}
    for exam_id, item_course_id in (
        db.query(ExamItem.exam_id, LearningActivity.course_id)
        .join(LearningActivity, LearningActivity.id == ExamItem.activity_id)
        .filter(ExamItem.exam_id.in_(candidate_ids)).all()
    ):
        item_courses.setdefault(exam_id, set()).add(item_course_id)
    return {exam_id for exam_id, courses in item_courses.items() if courses == {course_id}}


def released_exam_history(
    db: Session,
    student_id: uuid.UUID,
    course_id: uuid.UUID,
    *,
    as_of: datetime | None = None,
    include_at_cutoff: bool = False,
    exam_ids: set[uuid.UUID] | None = None,
) -> list[dict]:
    exam_ids = course_exam_ids(db, course_id) if exam_ids is None else exam_ids
    if not exam_ids:
        return []
    rows = (
        db.query(ExamAttempt, Exam)
        .join(Exam, Exam.id == ExamAttempt.exam_id)
        .filter(ExamAttempt.student_id == student_id,
                ExamAttempt.exam_id.in_(exam_ids),
                ExamAttempt.status == "submitted",
                ExamAttempt.submitted_at.is_not(None),
                ExamAttempt.result_released_at.is_not(None),
                ExamAttempt.submitted_at <= ExamAttempt.result_released_at)
        .order_by(ExamAttempt.result_released_at.asc(), ExamAttempt.id.asc())
        .all()
    )
    cutoff = _utc(as_of) if as_of is not None else None
    return [
        {"exam_attempt_id": str(attempt.id), "title": exam.title,
         "created_at": attempt.result_released_at,
         "score_percentage": round(float(attempt.score) / float(attempt.max_score) * 100, 2)}
        for attempt, exam in rows
        if attempt.score is not None and attempt.max_score and float(attempt.max_score) > 0
        and (cutoff is None or _utc(attempt.result_released_at) < cutoff
             or (include_at_cutoff and _utc(attempt.result_released_at) == cutoff))
    ]

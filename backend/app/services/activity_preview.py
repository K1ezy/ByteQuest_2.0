"""Summaries of a student's own comparable, visible results."""

import uuid
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    ActivityAttempt, Exam, ExamAssignment, ExamAttempt, ExamItem, LearningActivity,
    Profile, Workshop, WorkshopActivity, WorkshopMember,
)
from app.services.attempt_visibility import (
    practice_attempt_clause, published_track_clause, workshop_shareable_activity_clause,
)
from app.services.course_access import has_course_role
from app.services.ml_predictor.exam_history import course_exam_ids
from app.services.pass_mark import exam_passed


class ActivityPreview(BaseModel):
    scope: Literal["workshop", "course"]
    total: int
    pass_marked: int
    passed: int
    average_percent: float | None = None
    pass_mark_percent: int | None = None


def _active_workshops(db: Session, student: Profile):
    return db.query(Workshop.id).join(WorkshopMember, WorkshopMember.workshop_id == Workshop.id).filter(
        WorkshopMember.profile_id == student.id, Workshop.archived_at.is_(None),
    )


def _top_results(db: Session, query):
    ranked = query.subquery()
    return db.execute(select(ranked).where(ranked.c.result_rank == 1)).all()


def practice_preview(db: Session, student: Profile, activity: LearningActivity) -> ActivityPreview:
    workshops = _active_workshops(db, student).join(
        WorkshopActivity, WorkshopActivity.workshop_id == Workshop.id,
    ).filter(WorkshopActivity.activity_id == activity.id, workshop_shareable_activity_clause(Workshop.created_by))
    shared_activities = db.query(WorkshopActivity.activity_id).join(
        Workshop, Workshop.id == WorkshopActivity.workshop_id,
    ).join(
        LearningActivity, LearningActivity.id == WorkshopActivity.activity_id,
    ).filter(WorkshopActivity.workshop_id.in_(workshops), workshop_shareable_activity_clause(Workshop.created_by))
    results = db.query(ActivityAttempt.is_successful, func.row_number().over(
        partition_by=ActivityAttempt.activity_id, order_by=ActivityAttempt.attempt_number,
    ).label("result_rank")).join(
        LearningActivity, LearningActivity.id == ActivityAttempt.activity_id,
    ).filter(
        ActivityAttempt.student_id == student.id, practice_attempt_clause(),
        LearningActivity.id != activity.id, LearningActivity.activity_type == activity.activity_type,
        LearningActivity.exam_only.is_(False),
        published_track_clause(student),
    )
    rows = _top_results(db, results.filter(LearningActivity.id.in_(shared_activities)))
    scope: Literal["workshop", "course"] = "workshop"
    if len(rows) < 3 and activity.course_id and has_course_role(db, student, activity.course_id, "student"):
        course_rows = _top_results(db, results.filter(LearningActivity.course_id == activity.course_id))
        if len(course_rows) > len(rows):
            rows, scope = course_rows, "course"
    return ActivityPreview(scope=scope, total=len(rows), pass_marked=len(rows), passed=sum(row.is_successful for row in rows))


def exam_preview(db: Session, student: Profile, exam: Exam, visible_exam_ids) -> ActivityPreview:
    workshops = _active_workshops(db, student).join(
        ExamAssignment, ExamAssignment.workshop_id == Workshop.id,
    ).filter(ExamAssignment.exam_id == exam.id)
    shared_exams = db.query(ExamAssignment.exam_id).filter(ExamAssignment.workshop_id.in_(workshops))
    results = db.query(ExamAttempt.score, ExamAttempt.max_score, Exam.pass_mark_percent, func.row_number().over(
        partition_by=ExamAttempt.exam_id, order_by=ExamAttempt.attempt_number.desc(),
    ).label("result_rank")).join(
        Exam, Exam.id == ExamAttempt.exam_id,
    ).filter(
        Exam.id != exam.id, Exam.id.in_(visible_exam_ids), ExamAttempt.student_id == student.id,
        ExamAttempt.status == "submitted", ExamAttempt.score.is_not(None), ExamAttempt.max_score > 0,
        ExamAttempt.submitted_at <= ExamAttempt.result_released_at,
    )
    rows = _top_results(db, results.filter(Exam.id.in_(shared_exams)))
    scope: Literal["workshop", "course"] = "workshop"
    if len(rows) < 3:
        course_id = _exam_course(db, exam)
        if course_id and has_course_role(db, student, course_id, "student"):
            course_rows = _top_results(db, results.filter(Exam.id.in_(course_exam_ids(db, course_id))))
            if len(course_rows) > len(rows):
                rows, scope = course_rows, "course"
    return ActivityPreview(
        scope=scope, total=len(rows), pass_marked=sum(row.pass_mark_percent is not None for row in rows),
        passed=sum(exam_passed(row.score, row.max_score, row.pass_mark_percent) is True for row in rows),
        average_percent=round(sum(row.score / row.max_score * 100 for row in rows) / len(rows), 1)
        if rows else None,
        pass_mark_percent=exam.pass_mark_percent,
    )


def _exam_course(db: Session, exam: Exam) -> uuid.UUID | None:
    if exam.restricted_course_id is not None:
        return exam.restricted_course_id
    courses = db.query(LearningActivity.course_id).join(ExamItem, ExamItem.activity_id == LearningActivity.id).filter(
        ExamItem.exam_id == exam.id,
    ).distinct().all()
    return courses[0][0] if len(courses) == 1 else None

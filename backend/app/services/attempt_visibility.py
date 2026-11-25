"""Shared learner-facing visibility rules for attempts and published activities."""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import and_, exists, or_

from app.models.entities import (
    ActivityAttempt,
    ActivityKind,
    Course,
    CourseMember,
    ExamAttempt,
    LearningActivity,
    WorkshopActivity,
    WorkshopMember,
    Workshop,
    Profile,
    ReviewState,
    UserRole,
)


def practice_attempt_clause():
    return ActivityAttempt.exam_attempt_id.is_(None)


def learner_visible_attempt_clause():
    """Hide exam-backed activity rows until that exact attempt is released."""
    released_exam_attempt = exists().where(
        and_(
            ExamAttempt.id == ActivityAttempt.exam_attempt_id,
            ExamAttempt.result_released_at.is_not(None),
            ExamAttempt.submitted_at.is_not(None),
            ExamAttempt.submitted_at <= ExamAttempt.result_released_at,
        )
    )
    return or_(practice_attempt_clause(), released_exam_attempt)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def activity_is_closed(activity: LearningActivity, now: datetime | None = None) -> bool:
    """Closed either because faculty closed it, or because its scheduled close passed.

    Faculty can set a closing time in the workspace, so the schedule has to carry
    the same weight as the explicit close; otherwise a deadline is decoration.
    """
    if activity.closed_at is not None:
        return True
    closes_at = _as_utc(activity.closes_at)
    return closes_at is not None and closes_at <= (now or datetime.now(timezone.utc))


def activity_accepts_submissions_clause(now: datetime | None = None):
    moment = now or datetime.now(timezone.utc)
    return and_(
        LearningActivity.closed_at.is_(None),
        or_(LearningActivity.closes_at.is_(None), LearningActivity.closes_at > moment),
    )


def course_open_clause():
    """Activities without a course are global; an archived course's activities are closed everywhere."""
    return or_(
        LearningActivity.course_id.is_(None),
        exists().where(Course.id == LearningActivity.course_id, Course.status == "active").correlate_except(Course),
    )


def workshop_shareable_activity_clause(owner_id):
    """A workshop may share global activities or content its owner can teach, while its course is open."""
    teaches_course = exists().where(
        CourseMember.profile_id == owner_id,
        CourseMember.course_id == LearningActivity.course_id,
        CourseMember.member_role == "instructor",
        CourseMember.status == "active",
    ).correlate_except(CourseMember)
    authorized_owner = exists().where(
        Profile.id == owner_id,
        Profile.account_status == "active",
        or_(Profile.role == UserRole.admin, and_(Profile.role == UserRole.instructor, teaches_course)),
    ).correlate_except(Profile)
    return and_(course_open_clause(), or_(LearningActivity.course_id.is_(None), authorized_owner))


def guard_solution_reopen(
    activity: LearningActivity, *, closed_at: datetime | None, closes_at: datetime | None,
) -> None:
    """Refuse a schedule change that would reopen a closed, published challenge.

    A challenge's reference solution unlocks for students once it closes, so reopening
    it would let a student submit the copied solution for first-solve XP, stars and a
    false pass in the research data. Running it again needs a new version.
    """
    now = datetime.now(timezone.utc)
    if (
        activity.activity_type != ActivityKind.challenge
        or activity.review_status != ReviewState.published
        or not activity_is_closed(activity, now)
    ):
        return
    after = SimpleNamespace(closed_at=closed_at, closes_at=closes_at)
    if not activity_is_closed(after, now):  # type: ignore[arg-type]
        raise HTTPException(
            status_code=409,
            detail={
                "code": "solution_exposed",
                "message": "Students can already see this challenge's solution, so it can't reopen. "
                "Create a new version to run it again.",
            },
        )


def activity_has_opened(activity: LearningActivity, now: datetime | None = None) -> bool:
    opens_at = _as_utc(activity.opens_at)
    return opens_at is None or opens_at <= (now or datetime.now(timezone.utc))


def student_activity_clause(student_id: uuid.UUID):
    """A student reaches an activity through its course, or a workshop holding it.

    Joining a workshop by code adds a workshop membership and no course row,
    so scoping on the course alone would hide the activities a student joined for.

    An activity with no course belongs to no one and cannot be scoped, so it stays
    visible to its language track: seeded content must not vanish silently.
    An archived course closes its activities on both paths; past attempts stay on record.
    """
    in_course = exists().where(
        and_(
            CourseMember.course_id == LearningActivity.course_id,
            CourseMember.profile_id == student_id,
            CourseMember.status == "active",
        )
    )
    in_workshop = exists().where(
        and_(
            WorkshopActivity.activity_id == LearningActivity.id,
            WorkshopMember.workshop_id == WorkshopActivity.workshop_id,
            WorkshopMember.profile_id == student_id,
            Workshop.id == WorkshopActivity.workshop_id,
            or_(LearningActivity.destination_workshop_id.is_(None), and_(
                LearningActivity.destination_workshop_id == Workshop.id, Workshop.archived_at.is_(None))),
            workshop_shareable_activity_clause(Workshop.created_by),
        )
    ).correlate(LearningActivity)
    return and_(course_open_clause(), or_(in_workshop, and_(LearningActivity.destination_workshop_id.is_(None),
                                                           or_(LearningActivity.course_id.is_(None), in_course))))


def student_visible_activity_clause(student_id: uuid.UUID, now: datetime | None = None):
    """Published, not replaced by a newer version, already open, and theirs to see.

    A challenge past its closing time stays listed: students still need to read it,
    review their own code and open the reference solution once it is unlocked.
    """
    moment = now or datetime.now(timezone.utc)
    return and_(
        LearningActivity.archived_at.is_(None),
        or_(LearningActivity.opens_at.is_(None), LearningActivity.opens_at <= moment),
        student_activity_clause(student_id),
    )


def published_track_clause(student: Profile, now: datetime | None = None):
    return and_(
        LearningActivity.language == student.enrolled_language,
        LearningActivity.review_status == ReviewState.published,
        student_visible_activity_clause(student.id, now),
    )

"""Shared learner-facing visibility rules for attempts and published activities."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, exists, or_

from app.models.entities import (
    ActivityAttempt,
    CourseMember,
    ExamAttempt,
    LearningActivity,
    QuestGroupActivity,
    QuestGroupMember,
)


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
    return or_(ActivityAttempt.exam_attempt_id.is_(None), released_exam_attempt)


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


def activity_has_opened(activity: LearningActivity, now: datetime | None = None) -> bool:
    opens_at = _as_utc(activity.opens_at)
    return opens_at is None or opens_at <= (now or datetime.now(timezone.utc))


def student_activity_clause(student_id: uuid.UUID):
    """A student reaches an activity through its course, or a workshop holding it.

    Joining a workshop by code adds a quest-group membership and no course row,
    so scoping on the course alone would hide the activities a student joined for.

    An activity with no course belongs to no one and cannot be scoped, so it stays
    visible to its language track: seeded content must not vanish silently.
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
            QuestGroupActivity.activity_id == LearningActivity.id,
            QuestGroupMember.group_id == QuestGroupActivity.group_id,
            QuestGroupMember.profile_id == student_id,
        )
    )
    return or_(LearningActivity.course_id.is_(None), in_course, in_workshop)


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

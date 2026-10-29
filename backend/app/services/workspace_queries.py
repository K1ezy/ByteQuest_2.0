"""Course-scoped query builders shared by workspace dashboards and lists.

Each dashboard count is produced by the same filter function that produces the
destination list rows. If the two ever disagree, this module is the bug.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Iterable, Sequence

from sqlalchemy import bindparam, func, or_, text
from sqlalchemy.orm import Session, selectinload

from app.models.entities import (
    ActivityAttempt,
    Course,
    CourseMember,
    InstructionalDocument,
    LearningActivity,
    Profile,
    ReviewState,
)
from app.services.workspace_common import (
    MATERIAL_ATTENTION_STATES,
    activity_state,
    as_aware,
    draft_state,
    material_state,
)

LIST_LIMIT = 1000

DRAFT_STATUS_FILTERS = {"open", "pending", "ready", "rejected", "published", "all"}
MATERIAL_STATUS_FILTERS = {"attention", "ready", "processing", "needs_review", "failed", "archived", "all"}
ACTIVITY_STATUS_FILTERS = {"draft", "scheduled", "open", "closed", "archived", "all"}
ACCOUNT_STATUS_FILTERS = {"active", "deactivated", "attention", "all"}


def scoped_activities(db: Session, course_ids: Sequence[uuid.UUID]) -> list[LearningActivity]:
    if not course_ids:
        return []
    return (
        db.query(LearningActivity)
        .options(selectinload(LearningActivity.test_cases))
        .filter(LearningActivity.course_id.in_(list(course_ids)))
        .order_by(LearningActivity.created_at.desc())
        .limit(LIST_LIMIT)
        .all()
    )


def scoped_materials(db: Session, course_ids: Sequence[uuid.UUID]) -> list[InstructionalDocument]:
    if not course_ids:
        return []
    return (
        db.query(InstructionalDocument)
        .filter(InstructionalDocument.course_id.in_(list(course_ids)))
        .order_by(InstructionalDocument.created_at.desc())
        .limit(LIST_LIMIT)
        .all()
    )


def filter_drafts(
    activities: Iterable[LearningActivity],
    *,
    status: str = "open",
    material_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
) -> list[LearningActivity]:
    status = status if status in DRAFT_STATUS_FILTERS else "open"
    normalized = (search or "").strip().casefold()
    from_bound = as_aware(date_from)
    to_bound = as_aware(date_to)
    rows: list[LearningActivity] = []
    for activity in activities:
        state = draft_state(activity)
        if status == "open":
            if state == "published":
                continue
        elif status != "all" and state != status:
            continue
        if material_id is not None and activity.source_document_id != material_id:
            continue
        created = as_aware(activity.created_at)
        if from_bound is not None and (created is None or created < from_bound):
            continue
        if to_bound is not None and (created is None or created > to_bound):
            continue
        if normalized:
            haystack = f"{activity.title or ''} {activity.topic_concept or ''} {state}".casefold()
            if normalized not in haystack:
                continue
        rows.append(activity)
    rows.sort(key=lambda item: as_aware(item.created_at) or datetime.min.replace(tzinfo=timezone.utc))
    return rows


def filter_materials(
    documents: Iterable[InstructionalDocument],
    *,
    status: str = "all",
    search: str | None = None,
    current_only: bool = True,
) -> list[InstructionalDocument]:
    status = status if status in MATERIAL_STATUS_FILTERS else "all"
    normalized = (search or "").strip().casefold()
    rows: list[InstructionalDocument] = []
    for document in documents:
        if current_only and not document.is_current:
            continue
        state = material_state(document)
        if status == "attention":
            if state not in MATERIAL_ATTENTION_STATES:
                continue
        elif status != "all" and state != status:
            continue
        if normalized:
            haystack = (
                f"{document.title or ''} {document.uploaded_original_name or ''} "
                f"{document.topic_concept or ''} {state}"
            ).casefold()
            if normalized not in haystack:
                continue
        rows.append(document)
    return rows


def filter_activities(
    activities: Iterable[LearningActivity],
    *,
    status: str = "all",
    activity_type: str | None = None,
    search: str | None = None,
    now: datetime | None = None,
) -> list[LearningActivity]:
    status = status if status in ACTIVITY_STATUS_FILTERS else "all"
    normalized = (search or "").strip().casefold()
    rows: list[LearningActivity] = []
    for activity in activities:
        state = activity_state(activity, now)
        if status != "all" and state != status:
            continue
        if activity_type in {"quiz", "challenge"}:
            activity_type_value = getattr(activity.activity_type, "value", activity.activity_type)
            if activity_type_value != activity_type:
                continue
        if normalized:
            haystack = f"{activity.title or ''} {activity.topic_concept or ''} {state}".casefold()
            if normalized not in haystack:
                continue
        rows.append(activity)
    rows.sort(key=lambda item: as_aware(item.created_at) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return rows


def draft_status_counts(activities: Iterable[LearningActivity]) -> dict[str, int]:
    counts = {"open": 0, "pending": 0, "ready": 0, "rejected": 0, "published": 0}
    for activity in activities:
        state = draft_state(activity)
        counts[state] = counts.get(state, 0) + 1
        if state != "published":
            counts["open"] += 1
    return counts


def material_status_counts(documents: Iterable[InstructionalDocument]) -> dict[str, int]:
    counts = {"attention": 0, "ready": 0, "processing": 0, "needs_review": 0, "failed": 0, "archived": 0}
    for document in documents:
        state = material_state(document)
        counts[state] = counts.get(state, 0) + 1
        if state in MATERIAL_ATTENTION_STATES:
            counts["attention"] += 1
    return counts


def activity_status_counts(activities: Iterable[LearningActivity], now: datetime | None = None) -> dict[str, int]:
    counts = {"draft": 0, "scheduled": 0, "open": 0, "closed": 0, "archived": 0}
    for activity in activities:
        state = activity_state(activity, now)
        counts[state] = counts.get(state, 0) + 1
    return counts


def draft_counts_by_material(db: Session, material_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, int]:
    ids = list(material_ids)
    if not ids:
        return {}
    rows = (
        db.query(LearningActivity.source_document_id, func.count())
        .filter(LearningActivity.source_document_id.in_(ids))
        .group_by(LearningActivity.source_document_id)
        .all()
    )
    return {row[0]: int(row[1]) for row in rows}


def activity_attempt_counts(db: Session, activity_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, int]:
    ids = list(activity_ids)
    if not ids:
        return {}
    rows = (
        db.query(LearningActivity.id, func.count(ActivityAttempt.id))
        .outerjoin(ActivityAttempt, ActivityAttempt.activity_id == LearningActivity.id)
        .filter(LearningActivity.id.in_(ids))
        .group_by(LearningActivity.id)
        .all()
    )
    return {row[0]: int(row[1]) for row in rows}


def published_activity_ids(db: Session, course_ids: Sequence[uuid.UUID]) -> list[uuid.UUID]:
    if not course_ids:
        return []
    rows = (
        db.query(LearningActivity.id)
        .filter(
            LearningActivity.course_id.in_(list(course_ids)),
            LearningActivity.review_status == ReviewState.published,
            LearningActivity.archived_at.is_(None),
        )
        .all()
    )
    return [row[0] for row in rows]


def enrolled_students(db: Session, course_id: uuid.UUID) -> list[Profile]:
    return (
        db.query(Profile)
        .join(CourseMember, CourseMember.profile_id == Profile.id)
        .filter(
            CourseMember.course_id == course_id,
            CourseMember.member_role == "student",
            CourseMember.status == "active",
            Profile.account_status == "active",
        )
        .order_by(Profile.pseudonym_id.asc())
        .all()
    )


def enrollment_counts(db: Session, course_ids: Sequence[uuid.UUID]) -> dict[str, dict[uuid.UUID, int]]:
    ids = list(course_ids)
    result = {"instructor": {}, "student": {}}
    if not ids:
        return result
    rows = (
        db.query(CourseMember.course_id, CourseMember.member_role, func.count())
        .filter(
            CourseMember.course_id.in_(ids),
            CourseMember.status == "active",
        )
        .group_by(CourseMember.course_id, CourseMember.member_role)
        .all()
    )
    for course_id, role, count in rows:
        if role in result:
            result[role][course_id] = int(count)
    return result


def class_snapshot(db: Session, course_id: uuid.UUID) -> dict:
    students = enrolled_students(db, course_id)
    activity_ids = published_activity_ids(db, [course_id])
    if not activity_ids or not students:
        return {
            "active_learners": len(students),
            "published_activities": len(activity_ids),
            "average_completion_percent": 0,
            "average_score": None,
            "need_follow_up": len(students),
        }
    rows = (
        db.query(
            ActivityAttempt.student_id,
            func.count(func.distinct(ActivityAttempt.activity_id)).label("completed"),
        )
        .filter(ActivityAttempt.activity_id.in_(activity_ids))
        .group_by(ActivityAttempt.student_id)
        .all()
    )
    completed_by_student = {row[0]: int(row[1]) for row in rows}
    completions = [min(completed_by_student.get(student.id, 0), len(activity_ids)) for student in students]
    average_completion = round(
        (sum(completions) / max(len(completions), 1)) / len(activity_ids) * 100
    )

    latest_activity = (
        db.query(LearningActivity)
        .filter(LearningActivity.id.in_(activity_ids))
        .order_by(LearningActivity.published_at.desc().nullslast(), LearningActivity.created_at.desc())
        .first()
    )
    average_score = None
    if latest_activity is not None:
        average_score = (
            db.query(func.avg(ActivityAttempt.score_percentage))
            .filter(
                ActivityAttempt.activity_id == latest_activity.id,
                ActivityAttempt.is_successful.is_(True),
            )
            .scalar()
        )
    need_follow_up = sum(1 for student in students if completed_by_student.get(student.id, 0) == 0)
    return {
        "active_learners": len(students),
        "published_activities": len(activity_ids),
        "average_completion_percent": average_completion,
        "average_score": round(float(average_score), 1) if average_score is not None else None,
        "need_follow_up": need_follow_up,
    }


def account_emails(db: Session, profile_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, str]:
    ids = list(profile_ids)
    if not ids:
        return {}
    statement = text("SELECT id, email FROM auth.users WHERE id IN :ids").bindparams(
        bindparam("ids", expanding=True)
    )
    rows = db.execute(statement, {"ids": [str(value) for value in ids]}).fetchall()
    return {row[0]: row[1] for row in rows}


def account_course_access(db: Session, profile_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, list[dict]]:
    ids = list(profile_ids)
    if not ids:
        return {}
    rows = (
        db.query(CourseMember.profile_id, CourseMember.member_role, CourseMember.status, Course.id, Course.code, Course.title)
        .join(Course, Course.id == CourseMember.course_id)
        .filter(CourseMember.profile_id.in_(ids), CourseMember.status != "removed")
        .all()
    )
    result: dict[uuid.UUID, list[dict]] = {}
    for profile_id, member_role, state, course_id, code, title in rows:
        result.setdefault(profile_id, []).append(
            {
                "course_id": str(course_id),
                "code": code,
                "title": title,
                "member_role": member_role,
                "status": state,
            }
        )
    return result


def passing_attempts_by_student(
    db: Session,
    activity_ids: Sequence[uuid.UUID],
    student_ids: Sequence[uuid.UUID],
) -> dict[uuid.UUID, dict]:
    if not activity_ids or not student_ids:
        return {}
    rows = (
        db.query(ActivityAttempt)
        .filter(
            ActivityAttempt.activity_id.in_(list(activity_ids)),
            ActivityAttempt.student_id.in_(list(student_ids)),
        )
        .order_by(ActivityAttempt.created_at.desc())
        .all()
    )
    result: dict[uuid.UUID, dict] = {}
    for attempt in rows:
        entry = result.setdefault(
            attempt.student_id,
            {"completed": 0, "attempts": 0, "latest_score": None, "latest_at": None, "successful": set()},
        )
        entry["attempts"] += 1
        if attempt.is_successful:
            entry["successful"].add(attempt.activity_id)
        if entry["latest_at"] is None:
            entry["latest_at"] = attempt.created_at
            entry["latest_score"] = attempt.score_percentage
    for entry in result.values():
        entry["completed"] = len(entry.pop("successful"))
    return result


def latest_predictions(db: Session, student_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, dict]:
    if not student_ids:
        return {}
    from app.models.entities import MLPrediction

    rows = (
        db.query(MLPrediction)
        .filter(MLPrediction.student_id.in_(list(student_ids)))
        .order_by(MLPrediction.created_at.desc())
        .limit(500)
        .all()
    )
    result: dict[uuid.UUID, dict] = {}
    for prediction in rows:
        if prediction.student_id in result:
            continue
        result[prediction.student_id] = prediction
    return result


def search_matches(value: str | None, needle: str | None) -> bool:
    if not needle:
        return True
    return needle.strip().casefold() in (value or "").casefold()


def course_ids_filter(column, ids: Sequence[uuid.UUID]):
    return column.in_(list(ids)) if ids else or_(False)


__all__ = [
    "scoped_activities",
    "scoped_materials",
    "filter_drafts",
    "filter_materials",
    "filter_activities",
    "draft_status_counts",
    "material_status_counts",
    "activity_status_counts",
    "draft_counts_by_material",
    "activity_attempt_counts",
    "published_activity_ids",
    "enrolled_students",
    "enrollment_counts",
    "class_snapshot",
    "account_emails",
    "account_course_access",
    "passing_attempts_by_student",
    "latest_predictions",
    "search_matches",
]

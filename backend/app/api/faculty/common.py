"""Shared helpers for the faculty workspace routes."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.orm.attributes import set_committed_value

from app.core.security import get_current_user
from app.models.entities import Course, InstructionalDocument, LearningActivity, Profile
from app.services.activity_publishing import publication_issues
from app.services.challenge_verification import verification_status
from app.services.course_access import require_course_instructor, resolve_workspace_course
from app.services.materials import material_draft_count, serialize_material
from app.services.workspace_common import activity_detail, activity_state, as_aware, citation_list, course_reference, draft_state, iso


def faculty_user(user: Profile = Depends(get_current_user)) -> Profile:
    return require_course_instructor(user)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)


def version_conflict() -> HTTPException:
    return HTTPException(409, detail={
        "code": "version_conflict",
        "message": "This was changed somewhere else. Reload the saved version or copy your unsaved changes.",
    })


def _save_activity_revision(db: Session, activity: LearningActivity, expected: int, changes: dict) -> None:
    revision = db.scalar(
        update(LearningActivity)
        .where(
            LearningActivity.id == activity.id,
            LearningActivity.content_version == expected,
            LearningActivity.review_status == activity.review_status,
        )
        .values(**changes, content_version=LearningActivity.content_version + 1)
        .returning(LearningActivity.content_version)
        .execution_options(synchronize_session=False)
    )
    if revision is None:
        raise version_conflict()
    for field, value in changes.items():
        set_committed_value(activity, field, value)
    set_committed_value(activity, "content_version", revision)


def _schedule_label(value: datetime | None) -> str:
    aware = as_aware(value)
    if aware is None:
        return "no set time"
    return aware.strftime("%Y-%m-%d %H:%M UTC")


def _course_brief(course: Course) -> dict:
    return course_reference(course) or {}


def _material_brief(document: InstructionalDocument | None) -> dict | None:
    if document is None:
        return None
    return {
        "document_id": str(document.id),
        "title": document.title,
        "version_number": document.version_number,
        "state": document.processing_status,
        "archived_at": iso(document.archived_at),
    }


def _draft_item(activity: LearningActivity, course: Course, document: InstructionalDocument | None, attempt_count: int) -> dict:
    questions = (activity.quiz_questions_json or {}).get("questions") or []
    return {
        "activity_id": str(activity.id),
        "title": activity.title,
        "activity_type": getattr(activity.activity_type, "value", activity.activity_type),
        "topic_concept": activity.topic_concept,
        "draft_state": draft_state(activity),
        "review_status": getattr(activity.review_status, "value", activity.review_status),
        "rejection_reason": activity.rejection_reason,
        "content_version": activity.content_version or 1,
        "version_number": activity.version_number or 1,
        "judge0_verified": verification_status(activity),
        "attempt_count": attempt_count,
        "citation_count": len(citation_list(activity)),
        "question_count": len(questions),
        "test_case_count": len(activity.test_cases),
        "created_at": iso(activity.created_at),
        "updated_at": iso(activity.created_at),
        "course": _course_brief(course),
        "material": _material_brief(document),
    }


def _activity_response(activity: LearningActivity, course: Course, *, attempt_count: int | None = None) -> dict:
    detail = activity_detail(activity, include_grading=True, attempt_count=attempt_count)
    detail["course"] = _course_brief(course)
    detail["publication_issues"] = _publication_codes(activity)
    return detail


def _draft_response(db: Session, activity: LearningActivity, course: Course, attempts: int) -> dict:
    detail = _activity_response(activity, course, attempt_count=attempts)
    material = (
        db.query(InstructionalDocument).filter(InstructionalDocument.id == activity.source_document_id).first()
        if activity.source_document_id
        else None
    )
    detail["material"] = (
        serialize_material(material, draft_count=material_draft_count(db, material.id)) if material else None
    )
    detail["draft_state"] = draft_state(activity)
    detail["updated_at"] = iso(activity.created_at)
    return detail


def _publication_codes(activity: LearningActivity) -> list[str]:
    return [issue["code"] for issue in publication_issues(activity)] if activity_state(activity) == "draft" else []


def _activity_brief(activity: LearningActivity, course: Course, attempt_count: int) -> dict:
    questions = (activity.quiz_questions_json or {}).get("questions") or []
    return {
        "activity_id": str(activity.id),
        "title": activity.title,
        "activity_type": getattr(activity.activity_type, "value", activity.activity_type),
        "language": getattr(activity.language, "value", activity.language),
        "topic_concept": activity.topic_concept,
        "state": activity_state(activity),
        "review_status": getattr(activity.review_status, "value", activity.review_status),
        "draft_state": draft_state(activity),
        "publication_issues": _publication_codes(activity),
        "exam_only": activity.exam_only,
        "generated": bool(activity.source_document_id or activity.generation_json),
        "version_number": activity.version_number or 1,
        "version_of": str(activity.version_of) if activity.version_of else None,
        "judge0_verified": verification_status(activity),
        "attempt_count": attempt_count,
        "grading_locked": attempt_count > 0,
        "question_count": len(questions),
        "test_case_count": len(activity.test_cases),
        "opens_at": iso(activity.opens_at),
        "closes_at": iso(activity.closes_at),
        "created_at": iso(activity.created_at),
        "course": _course_brief(course),
    }


def _load_activity(db: Session, activity_id: uuid.UUID, *, include_test_cases: bool = True) -> LearningActivity:
    query = db.query(LearningActivity).filter(LearningActivity.id == activity_id)
    if include_test_cases:
        query = query.options(selectinload(LearningActivity.test_cases))
    activity = query.first()
    if activity is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That activity was not found in your courses."})
    return activity


def _course_for_activity(db: Session, user: Profile, activity: LearningActivity) -> Course:
    if activity.course_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "course_forbidden", "message": "That activity is not assigned to a course you teach."},
        )
    return resolve_workspace_course(db, user, activity.course_id, allow_admin=False)


def _material_for_user(db: Session, user: Profile, document_id: uuid.UUID) -> tuple[InstructionalDocument, Course]:
    document = db.query(InstructionalDocument).filter(InstructionalDocument.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That material was not found in your courses."})
    if document.course_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "course_forbidden", "message": "That material is not assigned to a course you teach."},
        )
    course = resolve_workspace_course(db, user, document.course_id, allow_admin=False)
    return document, course

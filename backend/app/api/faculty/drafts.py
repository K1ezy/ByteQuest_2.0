"""Review queue and draft workspace."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import ActivityAttempt, InstructionalDocument, LearningActivity, Profile, ReviewState, TestCase
from app.services.audit import record_audit
from app.services.activity_publishing import apply_publish_rules
from app.services.course_access import resolve_workspace_course
from app.services.materials import material_draft_count, serialize_material
from app.services.workspace_common import activity_detail, activity_state, citation_list, draft_state, iso
from app.services.workspace_queries import activity_attempt_counts, draft_status_counts, filter_drafts, scoped_activities, scoped_materials
from app.api.faculty.common import faculty_user, _course_brief, _draft_item, _draft_response, _load_activity, _course_for_activity, _save_activity_revision, version_conflict

router = APIRouter()

# ---------------------------------------------------------------------------
# Review queue and draft workspace
# ---------------------------------------------------------------------------
@router.get("/drafts")
def list_drafts(
    course_id: Optional[uuid.UUID] = None,
    status_filter: str = Query("open", alias="status"),
    material_id: Optional[uuid.UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    activities = scoped_activities(db, [course.id])
    materials = scoped_materials(db, [course.id])
    rows = filter_drafts(
        activities,
        status=status_filter,
        material_id=material_id,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )
    attempts = activity_attempt_counts(db, [item.id for item in rows])
    material_by_id = {document.id: document for document in materials}
    return {
        "course": _course_brief(course),
        "items": [
            _draft_item(item, course, material_by_id.get(item.source_document_id), attempts.get(item.id, 0))
            for item in rows
        ],
        "total": len(rows),
        "counts": draft_status_counts(activities),
        "filters": {
            "materials": [
                {
                    "document_id": str(document.id),
                    "title": document.title,
                    "version_number": document.version_number,
                }
                for document in materials
                if document.is_current
            ],
            "statuses": ["open", "pending", "ready", "rejected", "published", "all"],
        },
    }


@router.get("/drafts/{activity_id}")
def get_draft(activity_id: uuid.UUID, user: Profile = Depends(faculty_user), db: Session = Depends(get_db)):
    activity = _load_activity(db, activity_id)
    course = _course_for_activity(db, user, activity)
    material = (
        db.query(InstructionalDocument)
        .filter(InstructionalDocument.id == activity.source_document_id)
        .first()
        if activity.source_document_id
        else None
    )
    attempts = (
        db.query(func.count(ActivityAttempt.id)).filter(ActivityAttempt.activity_id == activity.id).scalar() or 0
    )
    detail = activity_detail(activity, include_grading=True)
    detail.update(
        {
            "course": _course_brief(course),
            "material": serialize_material(material, draft_count=material_draft_count(db, material.id)) if material else None,
            "attempt_count": int(attempts),
            "draft_state": draft_state(activity),
            "updated_at": iso(activity.created_at),
        }
    )
    return detail


class TestCasePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_index: int = Field(ge=0)
    stdin: str = Field(default="", max_length=20_000)
    expected_stdout: str = Field(max_length=20_000)
    time_limit_ms: int = Field(default=2000, ge=250, le=15_000)
    memory_limit_kb: int = Field(default=256_000, ge=32_000, le=1_048_576)
    is_hidden: bool = False
    weight: float = Field(default=1.0, ge=0.01, le=100)


class DraftUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content_version: int = Field(ge=1)
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    topic_concept: Optional[str] = Field(None, min_length=2, max_length=100)
    problem_statement: Optional[str] = Field(None, min_length=20, max_length=20_000)
    difficulty_level: Optional[int] = Field(None, ge=1, le=5)
    xp_reward: Optional[int] = Field(None, ge=10, le=10_000)
    starter_code: Optional[str] = Field(None, max_length=50_000)
    reference_solution_code: Optional[str] = Field(None, min_length=1, max_length=50_000)
    test_cases: Optional[list[TestCasePayload]] = Field(None, max_length=20)
    quiz_questions: Optional[dict[str, Any]] = None


class RejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=5, max_length=2_000)

    @field_validator("reason")
    @classmethod
    def reject_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Explain what needs correction.")
        return value.strip()


class ApproveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: bool = False
    student_preview_confirmed: bool = False


def _validate_quiz_payload(payload: dict[str, Any]) -> None:
    from app.services.gamification.quiz_content import parse_quiz_questions

    try:
        parse_quiz_questions(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_quiz", "field": "quiz_questions", "message": f"Quiz questions are invalid: {exc}"},
        ) from exc


def _apply_test_cases(db: Session, activity: LearningActivity, cases: list[TestCasePayload]) -> None:
    indexes = [case.order_index for case in cases]
    if len(indexes) != len(set(indexes)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_test_cases", "field": "test_cases", "message": "Test case order values must be unique."},
        )
    db.query(TestCase).filter(TestCase.activity_id == activity.id).delete()
    for case in cases:
        db.add(
            TestCase(
                activity_id=activity.id,
                order_index=case.order_index,
                stdin=case.stdin,
                expected_stdout=case.expected_stdout,
                time_limit_ms=case.time_limit_ms,
                memory_limit_kb=case.memory_limit_kb,
                is_hidden=case.is_hidden,
                weight=case.weight,
            )
        )


@router.patch("/drafts/{activity_id}")
def save_draft(
    activity_id: uuid.UUID,
    payload: DraftUpdate,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    """Save a revision. Saving never publishes and never changes student visibility."""
    activity = _load_activity(db, activity_id)
    course = _course_for_activity(db, user, activity)
    attempts = (
        db.query(func.count(ActivityAttempt.id)).filter(ActivityAttempt.activity_id == activity.id).scalar() or 0
    )
    if activity.review_status != ReviewState.draft:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "not_editable",
                "message": "Published content is read-only. Create a new version to change it.",
            },
        )
    if (activity.content_version or 1) != payload.content_version:
        raise version_conflict()

    fields = {"title", "topic_concept", "problem_statement", "difficulty_level", "xp_reward", "starter_code", "reference_solution_code"}
    changes = {
        field: value for field, value in payload.model_dump(include=fields, exclude_none=True).items()
        if value != getattr(activity, field)
    }
    if payload.quiz_questions is not None:
        _validate_quiz_payload(payload.quiz_questions)
        changes["quiz_questions_json"] = payload.quiz_questions

    cases = payload.test_cases
    if cases is not None:
        saved_cases = sorted(activity.test_cases, key=lambda case: case.order_index)
        case_fields = TestCasePayload.model_fields
        if len(cases) == len(saved_cases) and all(
            proposed.model_dump() == {field: getattr(saved, field) for field in case_fields}
            for proposed, saved in zip(sorted(cases, key=lambda case: case.order_index), saved_cases)
        ):
            cases = None

    if not changes and cases is None:
        return {"draft": _draft_response(db, activity, course, int(attempts)), "saved": False, "message": "No changes to save."}

    changes.update(reviewed_by=None, rejection_reason=None)
    if "reference_solution_code" in changes or cases is not None:
        changes.update(judge0_verified=False, judge0_verification_log=None)
    _save_activity_revision(db, activity, payload.content_version, changes)
    if cases is not None:
        _apply_test_cases(db, activity, cases)
    record_audit(
        db,
        actor=user,
        action="draft.revision_saved",
        entity_type="activity",
        entity_id=activity.id,
        course_id=course.id,
        summary=f"Saved a revision of “{activity.title or activity.topic_concept}” (stays unpublished)",
        metadata={"content_version": activity.content_version},
    )
    db.commit()
    activity = _load_activity(db, activity_id)
    return {
        "draft": _draft_response(db, activity, course, int(attempts)),
        "saved": True,
        "message": "Revision saved. The draft remains in review and is still hidden from students.",
    }


@router.post("/drafts/{activity_id}/reject")
def reject_draft(
    activity_id: uuid.UUID,
    payload: RejectRequest,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    activity = _load_activity(db, activity_id)
    course = _course_for_activity(db, user, activity)
    if activity.review_status != ReviewState.draft:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "not_editable", "message": "Only an unpublished draft can be rejected."},
        )
    activity.rejection_reason = payload.reason
    activity.reviewed_by = None
    activity.content_version = (activity.content_version or 1) + 1
    record_audit(
        db,
        actor=user,
        action="draft.rejected",
        entity_type="activity",
        entity_id=activity.id,
        course_id=course.id,
        summary=f"Rejected “{activity.title or activity.topic_concept}”: {payload.reason[:120]}",
        metadata={"reason": payload.reason},
    )
    db.commit()
    db.refresh(activity)
    return {
        "activity_id": str(activity.id),
        "draft_state": draft_state(activity),
        "rejection_reason": activity.rejection_reason,
        "message": "Draft rejected with a review note. Students still cannot see it.",
    }


@router.post("/drafts/{activity_id}/approve")
def approve_draft(
    activity_id: uuid.UUID,
    payload: ApproveRequest,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    activity = _load_activity(db, activity_id)
    course = _course_for_activity(db, user, activity)
    if not payload.confirm or not payload.student_preview_confirmed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "confirmation_required",
                "message": "Review the student-visible preview and confirm the publication summary.",
            },
        )
    if activity.review_status != ReviewState.draft:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "already_published", "message": "This draft is already published."},
        )
    apply_publish_rules(db, activity, user)
    record_audit(
        db,
        actor=user,
        action="draft.published",
        entity_type="activity",
        entity_id=activity.id,
        course_id=course.id,
        summary=f"Published “{activity.title or activity.topic_concept}” to {course.title}",
        metadata={
            "activity_type": getattr(activity.activity_type, "value", activity.activity_type),
            "citations": len(citation_list(activity)),
            "version_number": activity.version_number or 1,
        },
    )
    db.commit()
    db.refresh(activity)
    return {
        "activity_id": str(activity.id),
        "review_status": getattr(activity.review_status, "value", activity.review_status),
        "published_at": iso(activity.published_at),
        "state": activity_state(activity),
        "message": "Published. Students can open it when its schedule allows.",
    }

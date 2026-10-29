"""Faculty (instructor) workspace API.

Every route enforces the instructor role, an active account, and an active
course assignment. Administrators use the separate /api/v1/admin routes and
never receive academic approval or answer-key editing here.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, text
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import (
    ActivityAttempt,
    ActivityKind,
    AuditEvent,
    Course,
    CourseMember,
    InstructionalDocument,
    LearningActivity,
    Profile,
    ProgrammingLang,
    ReviewState,
    TestCase,
)
from app.services.audit import record_audit
from app.services.course_access import (
    courses_for_user,
    require_course_instructor,
    resolve_workspace_course,
)
from app.services.materials import (
    material_draft_count,
    material_version_rows,
    retry_material,
    serialize_material,
    upload_material,
)
from app.services.storage.supabase_storage import StorageError, pdf_storage
from app.services.judge0.client import TestCaseInput, judge0_client
from app.services.workspace_common import (
    activity_detail,
    activity_state,
    as_aware,
    citation_list,
    course_reference,
    draft_state,
    generation_metadata,
    iso,
    student_preview,
)
from app.services.workspace_queries import (
    activity_attempt_counts,
    activity_status_counts,
    class_snapshot,
    draft_counts_by_material,
    draft_status_counts,
    enrolled_students,
    enrollment_counts,
    filter_activities,
    filter_drafts,
    filter_materials,
    latest_predictions,
    material_status_counts,
    passing_attempts_by_student,
    published_activity_ids,
    scoped_activities,
    scoped_materials,
)

router = APIRouter(prefix="/api/v1/faculty", tags=["Faculty workspace"])
logger = logging.getLogger(__name__)

MAX_LESSON_SUMMARY = 400


def faculty_user(user: Profile = Depends(get_current_user)) -> Profile:
    return require_course_instructor(user)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


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
        "judge0_verified": bool(activity.judge0_verified),
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


def _activity_brief(activity: LearningActivity, course: Course, attempt_count: int) -> dict:
    questions = (activity.quiz_questions_json or {}).get("questions") or []
    return {
        "activity_id": str(activity.id),
        "title": activity.title,
        "activity_type": getattr(activity.activity_type, "value", activity.activity_type),
        "topic_concept": activity.topic_concept,
        "state": activity_state(activity),
        "review_status": getattr(activity.review_status, "value", activity.review_status),
        "version_number": activity.version_number or 1,
        "version_of": str(activity.version_of) if activity.version_of else None,
        "judge0_verified": bool(activity.judge0_verified),
        "attempt_count": attempt_count,
        "grading_locked": attempt_count > 0,
        "question_count": len(questions),
        "test_case_count": len(activity.test_cases),
        "opens_at": iso(activity.opens_at),
        "closes_at": iso(activity.closes_at),
        "created_at": iso(activity.created_at),
        "course": _course_brief(course),
    }


def _load_activity(db: Session, activity_id: uuid.UUID) -> LearningActivity:
    activity = (
        db.query(LearningActivity)
        .options(selectinload(LearningActivity.test_cases))
        .filter(LearningActivity.id == activity_id)
        .first()
    )
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


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------
@router.get("/courses")
def list_courses(user: Profile = Depends(faculty_user), db: Session = Depends(get_db)):
    courses = courses_for_user(db, user)
    counts = enrollment_counts(db, [course.id for course in courses])
    activities = scoped_activities(db, [course.id for course in courses])
    materials = scoped_materials(db, [course.id for course in courses])
    payload = []
    for course in courses:
        course_activities = [item for item in activities if item.course_id == course.id]
        course_materials = [item for item in materials if item.course_id == course.id]
        drafts = filter_drafts(course_activities, status="open")
        attention = filter_materials(course_materials, status="attention")
        payload.append(
            {
                **_course_brief(course),
                "description": course.description,
                "student_count": counts["student"].get(course.id, 0),
                "instructor_count": counts["instructor"].get(course.id, 0),
                "draft_count": len(drafts),
                "attention_count": len(attention),
            }
        )
    return {
        "courses": payload,
        "default_course_id": str(courses[0].id) if courses else None,
        "timezone": "Asia/Manila",
    }


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@router.get("/dashboard")
def faculty_dashboard(
    course_id: Optional[uuid.UUID] = None,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    now = datetime.now(timezone.utc)
    activities = scoped_activities(db, [course.id])
    materials = scoped_materials(db, [course.id])
    attempts = activity_attempt_counts(db, [item.id for item in activities])
    material_by_id = {document.id: document for document in materials}

    open_drafts = filter_drafts(activities, status="open")
    attention_materials = filter_materials(materials, status="attention")
    scheduled = [
        item
        for item in filter_activities(activities, status="scheduled")
        if as_aware(item.opens_at) is not None and as_aware(item.opens_at) <= now + timedelta(days=14)
    ]
    upcoming = sorted(scheduled, key=lambda item: as_aware(item.opens_at) or now)[:5]
    snapshot = class_snapshot(db, course.id)

    queue: list[dict] = []
    for document in attention_materials:
        queue.append(
            {
                "kind": "material",
                "id": str(document.id),
                "title": document.title,
                "detail": document.processing_error or "The PDF needs attention before it can be cited.",
                "status": "Needs review" if document.processing_status == "needs_review" else "Failed",
                "severity": "bad",
                "course": _course_brief(course),
                "updated_at": iso(document.created_at),
                "href": f"/faculty/materials?course={course.id}&material={document.id}",
            }
        )
    for activity in sorted(open_drafts, key=lambda item: as_aware(item.created_at) or now):
        queue.append(
            {
                "kind": "draft",
                "id": str(activity.id),
                "title": activity.title or activity.topic_concept,
                "detail": "Generated draft waiting for your review before students can see it.",
                "status": "Awaiting review" if draft_state(activity) == "pending" else draft_state(activity).title(),
                "severity": "wait",
                "course": _course_brief(course),
                "updated_at": iso(activity.created_at),
                "href": f"/faculty/review/{activity.id}?course={course.id}",
            }
        )
    for activity in upcoming:
        opens_at = as_aware(activity.opens_at)
        queue.append(
            {
                "kind": "activity",
                "id": str(activity.id),
                "title": activity.title or activity.topic_concept,
                "detail": f"Opens {opens_at.isoformat() if opens_at else 'soon'} · {len(activity.test_cases) if activity.activity_type == ActivityKind.challenge else len((activity.quiz_questions_json or {}).get('questions') or [])} items",
                "status": "Scheduled",
                "severity": "info",
                "course": _course_brief(course),
                "updated_at": iso(activity.created_at),
                "href": f"/faculty/activities/{activity.id}?course={course.id}",
            }
        )

    recent = (
        db.query(AuditEvent)
        .filter(AuditEvent.course_id == course.id)
        .order_by(AuditEvent.created_at.desc())
        .limit(6)
        .all()
    )
    actors = {
        event.actor_id: profile
        for event in recent
        if event.actor_id
        for profile in [db.query(Profile).filter(Profile.id == event.actor_id).first()]
        if profile is not None
    }

    return {
        "course": {**_course_brief(course), "description": course.description},
        "counts": {
            "drafts_awaiting_review": len(open_drafts),
            "materials_needing_attention": len(attention_materials),
            "upcoming_activities": len(scheduled),
            "class_progress_percent": snapshot["average_completion_percent"],
            "active_learners": snapshot["active_learners"],
        },
        "action_queue": queue[:8],
        "queue_hrefs": {
            "drafts": f"/faculty/review?course={course.id}&status=open",
            "materials": f"/faculty/materials?course={course.id}&status=attention",
            "activities": f"/faculty/activities?course={course.id}&status=scheduled",
            "performance": f"/faculty/performance?course={course.id}",
        },
        "upcoming": [
            {
                "id": str(item.id),
                "title": item.title or item.topic_concept,
                "activity_type": getattr(item.activity_type, "value", item.activity_type),
                "opens_at": iso(item.opens_at),
                "closes_at": iso(item.closes_at),
                "state": activity_state(item),
                "href": f"/faculty/activities/{item.id}?course={course.id}",
            }
            for item in upcoming
        ],
        "class_snapshot": snapshot,
        "recent_changes": [
            {
                "id": str(event.id),
                "action": event.action,
                "summary": event.summary,
                "actor": (actors.get(event.actor_id).display_name or actors.get(event.actor_id).pseudonym_id)
                if event.actor_id in actors
                else "System",
                "created_at": iso(event.created_at),
            }
            for event in recent
        ],
    }


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


def _apply_quiz_payload(activity: LearningActivity, payload: dict[str, Any]) -> None:
    from app.services.gamification.quiz_content import parse_quiz_questions

    try:
        parse_quiz_questions(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_quiz", "field": "quiz_questions", "message": f"Quiz questions are invalid: {exc}"},
        ) from exc
    activity.quiz_questions_json = payload


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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "version_conflict",
                "message": "This draft changed since you opened it. Reload to see the latest saved revision.",
            },
        )

    changed = False
    for field in ("title", "topic_concept", "problem_statement", "difficulty_level", "xp_reward"):
        value = getattr(payload, field)
        if value is not None and value != getattr(activity, field):
            setattr(activity, field, value)
            changed = True
    if payload.starter_code is not None and payload.starter_code != activity.starter_code:
        activity.starter_code = payload.starter_code
        changed = True
    if payload.reference_solution_code is not None and payload.reference_solution_code != activity.reference_solution_code:
        activity.reference_solution_code = payload.reference_solution_code
        changed = True
    if payload.quiz_questions is not None:
        _apply_quiz_payload(activity, payload.quiz_questions)
        changed = True
    if payload.test_cases is not None:
        _apply_test_cases(db, activity, payload.test_cases)
        changed = True

    if not changed:
        return {"draft": _draft_response(db, activity, course, int(attempts)), "saved": False, "message": "No changes to save."}

    activity.content_version = (activity.content_version or 1) + 1
    activity.reviewed_by = None
    activity.rejection_reason = None
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


def _publish_activity(db: Session, activity: LearningActivity, actor: Profile) -> None:
    if activity.activity_type == ActivityKind.challenge:
        if not activity.test_cases:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "missing_tests", "field": "test_cases", "message": "Add at least one grading case before publishing."},
            )
        if not activity.judge0_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "not_verified",
                    "message": "The saved reference solution has not passed Judge0 validation yet.",
                },
            )
    if activity.activity_type == ActivityKind.quiz:
        from app.services.gamification.quiz_content import parse_quiz_questions

        try:
            questions = parse_quiz_questions(activity.quiz_questions_json)
            if not 3 <= len(questions) <= 10:
                raise ValueError("A published quiz must contain between 3 and 10 questions.")
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "invalid_quiz", "message": f"Cannot publish this quiz: {exc}"},
            ) from exc
    opens_at = as_aware(activity.opens_at)
    closes_at = as_aware(activity.closes_at)
    if opens_at and closes_at and closes_at <= opens_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_schedule", "field": "closes_at", "message": "The closing time must be after the opening time."},
        )
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key)::bigint)"),
        {"lock_key": f"bytequest:activity-sequence:{getattr(activity.language, 'value', activity.language)}"},
    )
    highest = (
        db.query(func.max(LearningActivity.sequence_order))
        .filter(
            LearningActivity.language == activity.language,
            LearningActivity.review_status == ReviewState.published,
        )
        .scalar()
        or 0
    )
    activity.sequence_order = highest + 1
    activity.review_status = ReviewState.published
    activity.reviewed_by = actor.id
    activity.published_at = datetime.now(timezone.utc)
    activity.rejection_reason = None
    if activity.version_of is not None:
        previous = db.query(LearningActivity).filter(LearningActivity.id == activity.version_of).first()
        if previous is not None and previous.archived_at is None and previous.id != activity.id:
            previous.archived_at = datetime.now(timezone.utc)


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
    _publish_activity(db, activity, user)
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


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
def _material_rows(db: Session, course: Course) -> tuple[list[dict], list[InstructionalDocument]]:
    documents = scoped_materials(db, [course.id])
    current = [document for document in documents if document.is_current]
    draft_counts = draft_counts_by_material(db, [document.id for document in current])
    families: dict[uuid.UUID, list[InstructionalDocument]] = {}
    for document in documents:
        families.setdefault(document.document_family_id, []).append(document)
    items: list[dict] = []
    for document in current:
        versions = sorted(families.get(document.document_family_id, []), key=lambda item: item.version_number, reverse=True)
        serialized = serialize_material(document, draft_count=draft_counts.get(document.id, 0))
        serialized["versions"] = [
            {
                "document_id": str(version.id),
                "version_number": version.version_number,
                "state": version.processing_status,
                "created_at": iso(version.created_at),
                "is_current": bool(version.is_current),
            }
            for version in versions
        ]
        items.append(serialized)
    return items, current


@router.get("/materials")
def list_materials(
    course_id: Optional[uuid.UUID] = None,
    status_filter: str = Query("all", alias="status"),
    search: Optional[str] = None,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    items, current = _material_rows(db, course)
    filtered_ids = {
        str(document.id) for document in filter_materials(current, status=status_filter, search=search, current_only=True)
    }
    visible = [item for item in items if item["document_id"] in filtered_ids]
    return {
        "course": _course_brief(course),
        "items": visible,
        "total": len(visible),
        "counts": material_status_counts(current),
        "filters": {"statuses": ["all", "attention", "ready", "processing", "needs_review", "failed", "archived"]},
    }


@router.post("/materials", status_code=status.HTTP_201_CREATED)
async def create_material(
    course_id: uuid.UUID = Form(...),
    title: str = Form(..., min_length=2, max_length=255),
    language_tag: ProgrammingLang = Form(...),
    description: Optional[str] = Form(None, max_length=4_000),
    topic_concept: Optional[str] = Form(None, max_length=100),
    replaces_document_id: Optional[uuid.UUID] = Form(None),
    file: UploadFile = File(...),
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    document, job = await upload_material(
        db,
        actor=user,
        course_id=course.id,
        file=file,
        title=title,
        description=description,
        language_tag=language_tag,
        topic_concept=topic_concept,
        replaces_document_id=replaces_document_id,
    )
    serialized = serialize_material(document, draft_count=material_draft_count(db, document.id))
    return {
        "material": serialized,
        "job": {
            "id": str(job.id),
            "status": job.status,
            "cause": job.cause,
            "retryable": bool(job.retryable),
            "trace_id": job.trace_id,
        },
        "message": (
            f"“{document.title}” is indexed and ready."
            if document.processing_status == "completed"
            else f"“{document.title}” was saved but needs attention: {document.processing_error}"
        ),
    }


@router.post("/materials/{document_id}/versions", status_code=status.HTTP_201_CREATED)
async def replace_material_version(
    document_id: uuid.UUID,
    title: str = Form(..., min_length=2, max_length=255),
    language_tag: ProgrammingLang = Form(...),
    description: Optional[str] = Form(None, max_length=4_000),
    topic_concept: Optional[str] = Form(None, max_length=100),
    file: UploadFile = File(...),
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, course = _material_for_user(db, user, document_id)
    new_document, job = await upload_material(
        db,
        actor=user,
        course_id=course.id,
        file=file,
        title=title,
        description=description,
        language_tag=language_tag,
        topic_concept=topic_concept,
        replaces_document_id=document.id,
    )
    return {
        "material": serialize_material(new_document, draft_count=material_draft_count(db, new_document.id)),
        "job": {"id": str(job.id), "status": job.status, "cause": job.cause, "trace_id": job.trace_id},
        "message": f"Saved version {new_document.version_number} of “{new_document.title}”. Historical citations are preserved.",
    }


@router.get("/materials/{document_id}/download")
async def download_material(
    document_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, _course = _material_for_user(db, user, document_id)
    try:
        url = await pdf_storage.create_download_url(document.storage_path, expires_in=60)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail={"code": "storage_unavailable", "message": str(exc)}) from exc
    return {"download_url": url, "expires_in": 60}


class MaterialMetadataUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=4_000)
    language_tag: ProgrammingLang
    topic_concept: Optional[str] = Field(None, max_length=100)


@router.patch("/materials/{document_id}")
def update_material(
    document_id: uuid.UUID,
    payload: MaterialMetadataUpdate,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, course = _material_for_user(db, user, document_id)
    document.title = payload.title.strip()
    document.description = payload.description.strip() if payload.description and payload.description.strip() else None
    document.language_tag = payload.language_tag
    document.topic_concept = payload.topic_concept.strip() if payload.topic_concept and payload.topic_concept.strip() else None
    record_audit(
        db,
        actor=user,
        action="material.metadata_updated",
        entity_type="material",
        entity_id=document.id,
        course_id=course.id,
        summary=f"Updated details for “{document.title}” v{document.version_number}",
    )
    db.commit()
    db.refresh(document)
    return {
        "material": serialize_material(document, draft_count=material_draft_count(db, document.id)),
        "message": "Material details saved. The stored PDF and its version history are unchanged.",
    }


@router.post("/materials/{document_id}/archive")
def archive_material(
    document_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, course = _material_for_user(db, user, document_id)
    if document.archived_at is not None:
        raise HTTPException(status_code=409, detail={"code": "already_archived", "message": "This material is already archived."})
    document.archived_at = datetime.now(timezone.utc)
    document.status = "archived"
    cited = material_draft_count(db, document.id)
    record_audit(
        db,
        actor=user,
        action="material.archived",
        entity_type="material",
        entity_id=document.id,
        course_id=course.id,
        summary=f"Archived “{document.title}” v{document.version_number}; {cited} linked draft(s) keep their citations",
    )
    db.commit()
    return {
        "material": serialize_material(document, draft_count=cited),
        "message": f"Archived “{document.title}”. New drafts cannot cite it, and {cited} existing draft(s) keep their citations.",
    }


@router.post("/materials/{document_id}/restore")
def restore_material(
    document_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, course = _material_for_user(db, user, document_id)
    document.archived_at = None
    if document.processing_status == "completed":
        document.status = "ready"
    record_audit(
        db,
        actor=user,
        action="material.restored",
        entity_type="material",
        entity_id=document.id,
        course_id=course.id,
        summary=f"Restored “{document.title}” v{document.version_number} for new drafts",
    )
    db.commit()
    return {"material": serialize_material(document), "message": "Material restored for new generation."}


@router.post("/materials/{document_id}/retry")
async def retry_material_processing(
    document_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, _course = _material_for_user(db, user, document_id)
    updated, job = await retry_material(db, actor=user, document=document)
    return {
        "material": serialize_material(updated),
        "job": {"id": str(job.id), "status": job.status, "cause": job.cause, "retryable": bool(job.retryable), "trace_id": job.trace_id},
        "message": (
            f"Processing retried. “{updated.title}” is ready."
            if updated.processing_status == "completed"
            else f"Retry finished with a failure: {updated.processing_error}"
        ),
    }


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------
@router.get("/activities")
def list_activity_workspace(
    course_id: Optional[uuid.UUID] = None,
    status_filter: str = Query("all", alias="status"),
    type_filter: Optional[str] = Query(None, alias="type"),
    search: Optional[str] = None,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    activities = scoped_activities(db, [course.id])
    rows = filter_activities(activities, status=status_filter, activity_type=type_filter, search=search)
    attempts = activity_attempt_counts(db, [item.id for item in rows])
    return {
        "course": _course_brief(course),
        "items": [_activity_brief(item, course, attempts.get(item.id, 0)) for item in rows],
        "total": len(rows),
        "counts": activity_status_counts(activities),
        "filters": {"statuses": ["all", "draft", "scheduled", "open", "closed", "archived"]},
    }


class ActivityCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    course_id: uuid.UUID
    activity_type: str = Field(pattern="^(quiz|challenge)$")
    title: str = Field(min_length=3, max_length=255)
    topic_concept: str = Field(min_length=2, max_length=100)
    problem_statement: str = Field(min_length=20, max_length=20_000)
    difficulty_level: int = Field(default=1, ge=1, le=5)
    xp_reward: int = Field(default=50, ge=10, le=10_000)
    starter_code: Optional[str] = Field(None, max_length=50_000)
    reference_solution_code: Optional[str] = Field(None, max_length=50_000)
    test_cases: list[TestCasePayload] = Field(default_factory=list, max_length=20)
    quiz_questions: Optional[dict[str, Any]] = None
    opens_at: Optional[datetime] = None
    closes_at: Optional[datetime] = None


class ActivityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content_version: int = Field(ge=1)
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    topic_concept: Optional[str] = Field(None, min_length=2, max_length=100)
    problem_statement: Optional[str] = Field(None, min_length=20, max_length=20_000)
    difficulty_level: Optional[int] = Field(None, ge=1, le=5)
    xp_reward: Optional[int] = Field(None, ge=10, le=10_000)
    starter_code: Optional[str] = Field(None, max_length=50_000)
    reference_solution_code: Optional[str] = Field(None, max_length=50_000)
    test_cases: Optional[list[TestCasePayload]] = Field(None, max_length=20)
    quiz_questions: Optional[dict[str, Any]] = None
    opens_at: Optional[datetime] = None
    closes_at: Optional[datetime] = None


def _validate_schedule(opens_at: datetime | None, closes_at: datetime | None) -> None:
    start = as_aware(opens_at)
    end = as_aware(closes_at)
    if start and end and end <= start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_schedule", "field": "closes_at", "message": "The closing time must be after the opening time."},
        )


@router.post("/activities", status_code=status.HTTP_201_CREATED)
def create_activity(
    payload: ActivityCreate,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, payload.course_id, allow_admin=False)
    _validate_schedule(payload.opens_at, payload.closes_at)
    if payload.activity_type == "challenge" and not payload.reference_solution_code:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "validation_error", "field": "reference_solution_code", "message": "Add a reference solution so grading can be validated."},
        )
    activity = LearningActivity(
        course_id=course.id,
        created_by=user.id,
        activity_type=ActivityKind(payload.activity_type),
        language=user.enrolled_language,
        topic_concept=payload.topic_concept.strip(),
        title=payload.title.strip(),
        problem_statement=payload.problem_statement.strip(),
        starter_code=payload.starter_code,
        reference_solution_code=payload.reference_solution_code,
        difficulty_level=payload.difficulty_level,
        xp_reward=payload.xp_reward,
        review_status=ReviewState.draft,
        content_version=1,
        version_number=1,
        opens_at=_aware(payload.opens_at),
        closes_at=_aware(payload.closes_at),
    )
    if payload.quiz_questions is not None:
        _apply_quiz_payload(activity, payload.quiz_questions)
    db.add(activity)
    db.flush()
    if payload.activity_type == "challenge":
        for case in payload.test_cases:
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
    record_audit(
        db,
        actor=user,
        action="activity.created",
        entity_type="activity",
        entity_id=activity.id,
        course_id=course.id,
        summary=f"Created {payload.activity_type} draft “{activity.title}”",
    )
    db.commit()
    activity = _load_activity(db, activity.id)
    return {
        "activity": _activity_response(activity, course, attempt_count=0),
        "message": "Activity draft saved. Complete content and scheduling, then preview before publishing.",
    }


def _grading_fields(activity: LearningActivity) -> dict:
    return {
        "problem_statement": activity.problem_statement,
        "starter_code": activity.starter_code,
        "reference_solution_code": activity.reference_solution_code,
        "difficulty_level": activity.difficulty_level,
        "xp_reward": activity.xp_reward,
        "quiz_questions_json": activity.quiz_questions_json,
        "test_cases": [
            {
                "order_index": case.order_index,
                "stdin": case.stdin,
                "expected_stdout": case.expected_stdout,
                "time_limit_ms": case.time_limit_ms,
                "memory_limit_kb": case.memory_limit_kb,
                "is_hidden": case.is_hidden,
                "weight": case.weight,
            }
            for case in sorted(activity.test_cases, key=lambda item: item.order_index)
        ],
    }


@router.get("/activities/{activity_id}")
def get_activity(activity_id: uuid.UUID, user: Profile = Depends(faculty_user), db: Session = Depends(get_db)):
    activity = _load_activity(db, activity_id)
    course = _course_for_activity(db, user, activity)
    attempts = db.query(func.count(ActivityAttempt.id)).filter(ActivityAttempt.activity_id == activity.id).scalar() or 0
    detail = activity_detail(activity, include_grading=True)
    detail.update(
        {
            "course": _course_brief(course),
            "attempt_count": int(attempts),
            "grading_locked": attempts > 0,
            "version_of": str(activity.version_of) if activity.version_of else None,
            "versions": [
                {
                    "activity_id": str(row.id),
                    "version_number": row.version_number,
                    "state": activity_state(row),
                    "created_at": iso(row.created_at),
                }
                for row in db.query(LearningActivity)
                .filter(
                    (LearningActivity.id == activity.id)
                    | (LearningActivity.version_of == activity.id)
                    | (LearningActivity.id == activity.version_of)
                )
                .order_by(LearningActivity.version_number.desc())
                .all()
            ],
        }
    )
    return detail


@router.patch("/activities/{activity_id}")
def update_activity(
    activity_id: uuid.UUID,
    payload: ActivityUpdate,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    activity = _load_activity(db, activity_id)
    course = _course_for_activity(db, user, activity)
    _validate_schedule(
        payload.opens_at if payload.opens_at is not None else activity.opens_at,
        payload.closes_at if payload.closes_at is not None else activity.closes_at,
    )
    if (activity.content_version or 1) != payload.content_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "version_conflict",
                "message": "This activity changed since you opened it. Reload to see the latest saved version.",
            },
        )
    attempts = db.query(func.count(ActivityAttempt.id)).filter(ActivityAttempt.activity_id == activity.id).scalar() or 0
    published = activity.review_status != ReviewState.draft
    grading_changed = any(
        [
            payload.problem_statement is not None and payload.problem_statement != activity.problem_statement,
            payload.difficulty_level is not None and payload.difficulty_level != activity.difficulty_level,
            payload.xp_reward is not None and payload.xp_reward != activity.xp_reward,
            payload.starter_code is not None and payload.starter_code != activity.starter_code,
            payload.reference_solution_code is not None
            and payload.reference_solution_code != activity.reference_solution_code,
            payload.quiz_questions is not None,
            payload.test_cases is not None,
        ]
    )
    if (attempts > 0 or published) and grading_changed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "grading_locked",
                "message": (
                    "Students have attempted this activity, so its grading content is locked. "
                    "Create a new version to change it."
                    if attempts > 0
                    else "Published content is locked. Create a new version to change grading content."
                ),
                "attempt_count": int(attempts),
                "create_version_endpoint": f"/api/v1/faculty/activities/{activity.id}/versions",
            },
        )
    for field in ("title", "topic_concept"):
        value = getattr(payload, field)
        if value is not None:
            setattr(activity, field, value)
    if not published:
        for field in ("problem_statement", "starter_code", "reference_solution_code", "difficulty_level", "xp_reward"):
            value = getattr(payload, field)
            if value is not None:
                setattr(activity, field, value)
        if payload.quiz_questions is not None:
            _apply_quiz_payload(activity, payload.quiz_questions)
        if payload.test_cases is not None:
            _apply_test_cases(db, activity, payload.test_cases)
            activity.judge0_verified = False
        if payload.reference_solution_code is not None:
            activity.judge0_verified = False
        activity.reviewed_by = None
    if payload.opens_at is not None:
        activity.opens_at = _aware(payload.opens_at)
    if payload.closes_at is not None:
        activity.closes_at = _aware(payload.closes_at)
    activity.content_version = (activity.content_version or 1) + 1
    record_audit(
        db,
        actor=user,
        action="activity.updated",
        entity_type="activity",
        entity_id=activity.id,
        course_id=course.id,
        summary=f"Updated “{activity.title or activity.topic_concept}”",
        metadata={"attempt_count": int(attempts)},
    )
    db.commit()
    activity = _load_activity(db, activity_id)
    return {
        "activity": _activity_response(activity, course, attempt_count=int(attempts)),
        "message": "Activity saved. Preview the student view before publishing.",
    }


class ScheduleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    opens_at: Optional[datetime] = None
    closes_at: Optional[datetime] = None


@router.post("/activities/{activity_id}/verify")
async def verify_activity(activity_id: uuid.UUID, user: Profile = Depends(faculty_user), db: Session = Depends(get_db)):
    """Run the reference solution against the saved grading cases in Judge0."""
    activity = _load_activity(db, activity_id)
    course = _course_for_activity(db, user, activity)
    if activity.activity_type != ActivityKind.challenge:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "not_a_challenge", "message": "Only coding challenges use Judge0 verification."},
        )
    if not activity.reference_solution_code or not activity.test_cases:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "missing_grading_content",
                "message": "Add the reference solution and at least one grading case before verifying.",
            },
        )
    test_inputs = [
        TestCaseInput(
            test_case_id=str(case.id),
            order_index=case.order_index,
            stdin=case.stdin,
            expected_stdout=case.expected_stdout,
            time_limit_ms=case.time_limit_ms,
            memory_limit_kb=case.memory_limit_kb,
            is_hidden=case.is_hidden,
            weight=case.weight,
        )
        for case in sorted(activity.test_cases, key=lambda item: item.order_index)
    ]
    verified, log = await _verify_snapshot(
        activity_id=activity.id,
        language=activity.language,
        reference_solution_code=activity.reference_solution_code,
        test_cases=test_inputs,
    )
    activity.judge0_verified = verified
    activity.judge0_verification_log = log
    record_audit(
        db,
        actor=user,
        action="activity.verified",
        entity_type="activity",
        entity_id=activity.id,
        course_id=course.id,
        summary=f"Judge0 verification {'passed' if verified else 'failed'} for “{activity.title or activity.topic_concept}”",
        metadata={"verified": verified},
    )
    db.commit()
    activity = _load_activity(db, activity_id)
    return {
        "activity": _activity_response(activity, course),
        "message": (
            "Judge0 verification passed. The activity can be published."
            if verified
            else f"Verification did not pass: {log.get('error') or log.get('reason') or 'check the reference solution and grading cases'}"
        ),
    }


async def _verify_snapshot(*, activity_id: uuid.UUID, language, reference_solution_code: str, test_cases) -> tuple[bool, dict]:
    try:
        return await judge0_client.verify_reference_solution(
            language=language,
            reference_solution_code=reference_solution_code,
            test_cases=test_cases,
        )
    except Exception:
        logger.warning("Judge0 verification could not be completed for activity %s.", activity_id)
        return False, {"verified": False, "error": "Judge0 verification could not be completed."}


@router.post("/activities/{activity_id}/schedule")
def schedule_activity(
    activity_id: uuid.UUID,
    payload: ScheduleUpdate,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    activity = _load_activity(db, activity_id)
    course = _course_for_activity(db, user, activity)
    _validate_schedule(payload.opens_at, payload.closes_at)
    activity.opens_at = _aware(payload.opens_at)
    activity.closes_at = _aware(payload.closes_at)
    activity.content_version = (activity.content_version or 1) + 1
    record_audit(
        db,
        actor=user,
        action="activity.scheduled",
        entity_type="activity",
        entity_id=activity.id,
        course_id=course.id,
        summary=(
            f"Scheduled “{activity.title or activity.topic_concept}” to open "
            f"{_schedule_label(activity.opens_at)} and close {_schedule_label(activity.closes_at)}"
        ),
    )
    db.commit()
    return {
        "activity": _activity_response(activity, course),
        "message": "Schedule saved. Times are shown in your local timezone.",
    }


class PublishRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: bool = False
    preview_confirmed: bool = False


@router.post("/activities/{activity_id}/publish")
def publish_activity(
    activity_id: uuid.UUID,
    payload: PublishRequest,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    activity = _load_activity(db, activity_id)
    course = _course_for_activity(db, user, activity)
    if not payload.confirm or not payload.preview_confirmed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "confirmation_required", "message": "Confirm the student preview and schedule before publishing."},
        )
    if activity.review_status != ReviewState.draft:
        raise HTTPException(status_code=409, detail={"code": "already_published", "message": "This activity is already published."})
    _publish_activity(db, activity, user)
    record_audit(
        db,
        actor=user,
        action="activity.published",
        entity_type="activity",
        entity_id=activity.id,
        course_id=course.id,
        summary=f"Published “{activity.title or activity.topic_concept}” to {course.title}",
    )
    db.commit()
    db.refresh(activity)
    return {
        "activity": _activity_response(activity, course),
        "message": f"Published. Students see it {('from ' + iso(activity.opens_at)) if activity.opens_at else 'immediately'}.",
    }


@router.get("/activities/{activity_id}/preview")
def preview_activity(activity_id: uuid.UUID, user: Profile = Depends(faculty_user), db: Session = Depends(get_db)):
    activity = _load_activity(db, activity_id)
    course = _course_for_activity(db, user, activity)
    questions = (activity.quiz_questions_json or {}).get("questions") or []
    return {
        "activity_id": str(activity.id),
        "course": _course_brief(course),
        "preview": student_preview(activity),
        "schedule": {
            "opens_at": iso(activity.opens_at),
            "closes_at": iso(activity.closes_at),
            "state": activity_state(activity),
            "timezone": "Asia/Manila",
        },
        "grading": {
            "hidden_test_cases": len([case for case in activity.test_cases if case.is_hidden]),
            "answer_key_questions": len(questions),
            "attempt_count": int(
                db.query(func.count(ActivityAttempt.id)).filter(ActivityAttempt.activity_id == activity.id).scalar() or 0
            ),
        },
        "note": "Answer keys and hidden tests are never part of the student view.",
    }


@router.post("/activities/{activity_id}/versions", status_code=status.HTTP_201_CREATED)
def create_activity_version(
    activity_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    activity = _load_activity(db, activity_id)
    course = _course_for_activity(db, user, activity)
    root_id = activity.version_of or activity.id
    latest = (
        db.query(LearningActivity)
        .filter((LearningActivity.id == root_id) | (LearningActivity.version_of == root_id))
        .order_by(LearningActivity.version_number.desc())
        .first()
    )
    next_version = (latest.version_number if latest else activity.version_number or 1) + 1
    clone = LearningActivity(
        course_id=course.id,
        created_by=user.id,
        activity_type=activity.activity_type,
        language=activity.language,
        topic_concept=activity.topic_concept,
        title=activity.title,
        problem_statement=activity.problem_statement,
        starter_code=activity.starter_code,
        reference_solution_code=activity.reference_solution_code,
        difficulty_level=activity.difficulty_level,
        xp_reward=activity.xp_reward,
        quiz_questions_json=activity.quiz_questions_json,
        review_status=ReviewState.draft,
        content_version=1,
        version_number=next_version,
        version_of=root_id,
        opens_at=activity.opens_at,
        closes_at=activity.closes_at,
        source_document_id=activity.source_document_id,
        generation_json=activity.generation_json,
        judge0_verified=False,
    )
    db.add(clone)
    db.flush()
    for case in activity.test_cases:
        db.add(
            TestCase(
                activity_id=clone.id,
                order_index=case.order_index,
                stdin=case.stdin,
                expected_stdout=case.expected_stdout,
                time_limit_ms=case.time_limit_ms,
                memory_limit_kb=case.memory_limit_kb,
                is_hidden=case.is_hidden,
                weight=case.weight,
            )
        )
    record_audit(
        db,
        actor=user,
        action="activity.version_created",
        entity_type="activity",
        entity_id=clone.id,
        course_id=course.id,
        summary=f"Created version {next_version} of “{activity.title or activity.topic_concept}”",
        metadata={"version_of": str(root_id)},
    )
    db.commit()
    clone = _load_activity(db, clone.id)
    return {
        "activity": _activity_response(clone, course, attempt_count=0),
        "message": f"Version {next_version} drafted. Grading content is editable here; the published version stays live until you publish.",
    }


# ---------------------------------------------------------------------------
# Performance
# ---------------------------------------------------------------------------
def _prediction_view(prediction, target_title: str | None) -> dict:
    if prediction is None:
        return {
            "status": "unavailable",
            "as_of": None,
            "reason": "No saved next-task prediction exists for this student yet.",
        }
    probability = float(prediction.logreg_prob)
    return {
        "status": "saved",
        "as_of": iso(prediction.created_at),
        "target_activity": target_title,
        "probability": round(probability, 3),
        "random_forest_probability": round(float(prediction.rf_prob), 3),
        "label": "Likely to pass the next task" if probability >= 0.5 else "May need support on the next task",
        "model_version": prediction.model_version,
        "advisory": "Advisory only. Predictions never change grades, rewards or access.",
    }


@router.get("/performance")
def performance(
    course_id: Optional[uuid.UUID] = None,
    activity_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    course_activities = scoped_activities(db, [course.id])
    if activity_id is not None:
        selected = next((item for item in course_activities if item.id == activity_id), None)
        if selected is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That activity is not part of this course."})
        activity_ids = [selected.id]
    else:
        activity_ids = published_activity_ids(db, [course.id])
    students = enrolled_students(db, course.id)
    stats = passing_attempts_by_student(db, activity_ids, [student.id for student in students])
    predictions = latest_predictions(db, [student.id for student in students])
    target_titles = {
        row.id: (row.title or row.topic_concept)
        for row in db.query(LearningActivity)
        .filter(LearningActivity.id.in_([p.target_activity_id for p in predictions.values()]))
        .all()
    } if predictions else {}

    needle = (search or "").strip().casefold()
    rows = []
    for student in students:
        if needle and needle not in (student.pseudonym_id or "").casefold() and needle not in (student.display_name or "").casefold():
            continue
        entry = stats.get(student.id, {"completed": 0, "attempts": 0, "latest_score": None, "latest_at": None})
        prediction = predictions.get(student.id)
        rows.append(
            {
                "student_id": str(student.id),
                "pseudonym": student.pseudonym_id,
                "display_name": student.display_name,
                "enrolled_language": getattr(student.enrolled_language, "value", student.enrolled_language),
                "completed_count": entry["completed"],
                "total_activities": len(activity_ids),
                "attempt_count": entry["attempts"],
                "latest_score": round(float(entry["latest_score"]), 1) if entry["latest_score"] is not None else None,
                "latest_at": iso(entry["latest_at"]),
                "prediction": _prediction_view(prediction, target_titles.get(prediction.target_activity_id) if prediction else None),
            }
        )
    rows.sort(key=lambda item: item["pseudonym"] or "")
    average_score = None
    scored = [item["latest_score"] for item in rows if item["latest_score"] is not None]
    if scored:
        average_score = round(sum(scored) / len(scored), 1)
    snapshot = class_snapshot(db, course.id) if activity_id is None else None
    return {
        "course": _course_brief(course),
        "activities": [
            {
                "activity_id": str(item.id),
                "title": item.title or item.topic_concept,
                "state": activity_state(item),
            }
            for item in course_activities
            if item.review_status == ReviewState.published
        ],
        "summary": {
            "active_learners": len(students),
            "published_activities": len(activity_ids),
            "average_score": average_score,
            "average_completion_percent": snapshot["average_completion_percent"] if snapshot else None,
            "need_follow_up": sum(1 for item in rows if item["attempt_count"] == 0),
            "selected_activity_id": str(activity_id) if activity_id else None,
        },
        "students": rows,
        "empty_reason": None if students else "No students are enrolled in this course yet.",
    }


@router.get("/performance/students/{student_id}")
def student_performance(
    student_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = None,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    enrollment = (
        db.query(CourseMember)
        .filter(
            CourseMember.course_id == course.id,
            CourseMember.profile_id == student_id,
            CourseMember.member_role == "student",
            CourseMember.status == "active",
        )
        .first()
    )
    if enrollment is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That student is not enrolled in this course."})
    student = db.query(Profile).filter(Profile.id == student_id).first()
    if student is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That student is not enrolled in this course."})
    course_activities = (
        db.query(LearningActivity)
        .filter(
            LearningActivity.course_id == course.id,
            LearningActivity.review_status == ReviewState.published,
        )
        .all()
    )
    activity_by_id = {item.id: item for item in course_activities}
    attempts = (
        db.query(ActivityAttempt)
        .filter(
            ActivityAttempt.student_id == student.id,
            ActivityAttempt.activity_id.in_(list(activity_by_id.keys())),
        )
        .order_by(ActivityAttempt.created_at.desc())
        .limit(50)
        .all()
        if activity_by_id
        else []
    )
    prediction = latest_predictions(db, [student.id]).get(student.id)
    target = activity_by_id.get(prediction.target_activity_id) if prediction else None
    return {
        "student": {
            "student_id": str(student.id),
            "pseudonym": student.pseudonym_id,
            "display_name": student.display_name,
            "enrolled_language": getattr(student.enrolled_language, "value", student.enrolled_language),
            "xp_points": student.xp_points,
            "current_level": student.current_level,
        },
        "course": _course_brief(course),
        "progress": {
            "completed": len({attempt.activity_id for attempt in attempts if attempt.is_successful}),
            "total": len(course_activities),
            "percent": round(
                len({attempt.activity_id for attempt in attempts if attempt.is_successful})
                / len(course_activities)
                * 100
            )
            if course_activities
            else 0,
        },
        "attempts": [
            {
                "attempt_id": str(attempt.id),
                "activity_id": str(attempt.activity_id),
                "title": activity_by_id.get(attempt.activity_id).title
                if activity_by_id.get(attempt.activity_id)
                else "Activity",
                "activity_type": getattr(activity_by_id.get(attempt.activity_id).activity_type, "value", "challenge")
                if activity_by_id.get(attempt.activity_id)
                else "challenge",
                "score_percentage": round(float(attempt.score_percentage), 1),
                "is_successful": bool(attempt.is_successful),
                "xp_awarded": attempt.xp_awarded,
                "created_at": iso(attempt.created_at),
            }
            for attempt in attempts
        ],
        "prediction": _prediction_view(prediction, (target.title or target.topic_concept) if target else None),
    }

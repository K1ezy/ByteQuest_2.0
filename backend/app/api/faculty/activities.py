"""Activities: create, edit, verify, schedule, publish, preview, version."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import ActivityAttempt, ActivityKind, LearningActivity, Profile, ProgrammingLang, ReviewState, TestCase
from app.services.audit import record_audit
from app.services.activity_publishing import apply_publish_rules
from app.services.challenge_verification import challenge_validation_fingerprint, record_challenge_verification
from app.services.attempt_visibility import guard_solution_reopen
from app.services.course_access import resolve_workspace_course
from app.services.judge0.client import TestCaseInput, judge0_client
from app.services.workspace_common import activity_detail, activity_state, as_aware, iso, student_preview
from app.services.workspace_queries import activity_attempt_counts, activity_status_counts, filter_activities, scoped_activities
from app.api.faculty.common import faculty_user, _aware, _schedule_label, _course_brief, _activity_response, _activity_brief, _load_activity, _course_for_activity, _save_activity_revision, version_conflict
from app.api.faculty.drafts import TestCasePayload, _validate_quiz_payload, _apply_test_cases

router = APIRouter()
logger = logging.getLogger(__name__)

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
    exam_only: bool = False
    activity_type: str = Field(pattern="^(quiz|challenge)$")
    # Omitted: the instructor's own track, as before.
    language: Optional[ProgrammingLang] = None
    title: str = Field(min_length=3, max_length=255)
    topic_concept: str = Field(min_length=2, max_length=100)
    problem_statement: str = Field(min_length=20, max_length=20_000)
    difficulty_level: int = Field(default=1, ge=1, le=5)
    xp_reward: int = Field(default=50, ge=10, le=10_000)
    pass_mark_percent: Optional[int] = Field(None, ge=1, le=100)
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
    # Sending null clears it back to the default rule; leaving it out keeps it unchanged.
    pass_mark_percent: Optional[int] = Field(None, ge=1, le=100)
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
        exam_only=payload.exam_only,
        language=payload.language or user.enrolled_language,
        topic_concept=payload.topic_concept.strip(),
        title=payload.title.strip(),
        problem_statement=payload.problem_statement.strip(),
        starter_code=payload.starter_code,
        reference_solution_code=payload.reference_solution_code,
        difficulty_level=payload.difficulty_level,
        xp_reward=payload.xp_reward,
        pass_mark_percent=payload.pass_mark_percent if payload.activity_type == "challenge" else None,
        review_status=ReviewState.draft,
        content_version=1,
        version_number=1,
        opens_at=_aware(payload.opens_at),
        closes_at=_aware(payload.closes_at),
    )
    if payload.quiz_questions is not None:
        _validate_quiz_payload(payload.quiz_questions)
        activity.quiz_questions_json = payload.quiz_questions
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
        "pass_mark_percent": activity.pass_mark_percent,
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
        raise version_conflict()
    attempts = db.query(func.count(ActivityAttempt.id)).filter(ActivityAttempt.activity_id == activity.id).scalar() or 0
    published = activity.review_status != ReviewState.draft
    grading_changed = any(
        [
            payload.problem_statement is not None and payload.problem_statement != activity.problem_statement,
            payload.difficulty_level is not None and payload.difficulty_level != activity.difficulty_level,
            payload.xp_reward is not None and payload.xp_reward != activity.xp_reward,
            "pass_mark_percent" in payload.model_fields_set
            and payload.pass_mark_percent != activity.pass_mark_percent,
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
    changes = payload.model_dump(include={"title", "topic_concept"}, exclude_none=True)
    if not published:
        changes.update(payload.model_dump(include={
            "problem_statement", "starter_code", "reference_solution_code", "difficulty_level", "xp_reward",
        }, exclude_none=True))
        if "pass_mark_percent" in payload.model_fields_set and activity.activity_type == ActivityKind.challenge:
            changes["pass_mark_percent"] = payload.pass_mark_percent
        if payload.quiz_questions is not None:
            _validate_quiz_payload(payload.quiz_questions)
            changes["quiz_questions_json"] = payload.quiz_questions
        if payload.test_cases is not None or payload.reference_solution_code is not None:
            changes.update(judge0_verified=False, judge0_verification_log=None)
        changes["reviewed_by"] = None
    if payload.closes_at is not None:
        guard_solution_reopen(activity, closed_at=activity.closed_at, closes_at=_aware(payload.closes_at))
    if payload.opens_at is not None:
        changes["opens_at"] = _aware(payload.opens_at)
    if payload.closes_at is not None:
        changes["closes_at"] = _aware(payload.closes_at)
    _save_activity_revision(db, activity, payload.content_version, changes)
    if not published and payload.test_cases is not None:
        _apply_test_cases(db, activity, payload.test_cases)
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
    content_version: int = Field(ge=1)
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
    if activity.review_status != ReviewState.draft:
        raise HTTPException(409, "Only unpublished drafts can be verified.")
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
    fingerprint = challenge_validation_fingerprint(activity)
    version = activity.content_version
    language = activity.language
    reference_solution = activity.reference_solution_code
    db.rollback()
    verified, log = await _verify_snapshot(
        activity_id=activity_id,
        language=language,
        reference_solution_code=reference_solution,
        test_cases=test_inputs,
    )
    db.refresh(activity, with_for_update=True)
    if (
        activity.review_status != ReviewState.draft
        or activity.content_version != version
        or challenge_validation_fingerprint(activity) != fingerprint
    ):
        raise version_conflict()
    _course_for_activity(db, user, activity)
    record_challenge_verification(activity, verified, log, fingerprint)
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
    guard_solution_reopen(activity, closed_at=activity.closed_at, closes_at=_aware(payload.closes_at))
    _save_activity_revision(db, activity, payload.content_version, {
        "opens_at": _aware(payload.opens_at), "closes_at": _aware(payload.closes_at),
    })
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
        "message": "Schedule saved. Times are shown in Asia/Manila.",
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
    apply_publish_rules(db, activity, user)
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
        exam_only=activity.exam_only,
        language=activity.language,
        topic_concept=activity.topic_concept,
        title=activity.title,
        problem_statement=activity.problem_statement,
        starter_code=activity.starter_code,
        reference_solution_code=activity.reference_solution_code,
        difficulty_level=activity.difficulty_level,
        xp_reward=activity.xp_reward,
        pass_mark_percent=activity.pass_mark_percent,
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

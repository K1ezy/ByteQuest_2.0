"""Student pilot dashboard, synced drafts, limited hints, and research choices."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.quotas import reserve
from app.core.security import get_current_user, require_instructor
from app.models.entities import (
    ActivityAttempt, ActivityDraft, ActivityKind, ChallengeHint, HintUse,
    LearningActivity, Profile, ResearchConsent, ReviewState, SubmissionJob, UserRole,
    NotificationOutbox,
    Course, CourseAnnouncement, _utcnow,
)
from app.services.ai_rag.error_explainer import explain_code_error
from app.services.ai_rag.retrieval import passages_block, tutoring_document_ids, tutoring_passages, validate_tutor_citations
from app.services.ai_rag.solution_guard import WITHHELD_HINT, reveals_solution
from app.services.ai_rag.gemini_client import GEMINI_DISABLED
from app.services.gamification.progression import quest_completion
from app.services.gamification.sequencer import determine_track_recommendation
from app.services.course_access import active_membership_course_ids, may_manage_instructional_content
from app.services.attempt_visibility import (
    activity_is_closed,
    learner_visible_attempt_clause,
    student_visible_activity_clause,
)

router = APIRouter(prefix="/api/v1/pilot", tags=["Classroom Pilot"])


def student_only(user: Profile) -> None:
    if user.role != UserRole.student:
        raise HTTPException(403, "Student access required.")


def challenge(db: Session, activity_id: uuid.UUID, user: Profile) -> LearningActivity:
    activity = db.query(LearningActivity).filter(
        LearningActivity.id == activity_id,
        LearningActivity.activity_type == ActivityKind.challenge,
        LearningActivity.review_status == ReviewState.published,
        student_visible_activity_clause(user.id),
    ).first()
    if activity is None:
        raise HTTPException(404, "Published challenge not found in your Workshops.")
    return activity


class DraftPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_code: str = Field(max_length=50_000)


@router.get("/announcements")
def student_announcements(user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    course_ids = active_membership_course_ids(db, user.id, "student")
    if not course_ids:
        return {"items": []}
    rows = (
        db.query(CourseAnnouncement, Course.title, Profile.display_name)
        .join(Course, Course.id == CourseAnnouncement.course_id)
        .outerjoin(Profile, Profile.id == CourseAnnouncement.author_id)
        .filter(
            CourseAnnouncement.course_id.in_(course_ids),
            or_(CourseAnnouncement.expires_at.is_(None), CourseAnnouncement.expires_at > _utcnow()),
        )
        .order_by(CourseAnnouncement.pinned.desc(), CourseAnnouncement.created_at.desc(), CourseAnnouncement.id.desc())
        .limit(10)
        .all()
    )
    return {"items": [
        {
            "id": item.id, "course_title": course_title,
            "title": item.title, "body": item.body, "pinned": item.pinned,
            "author_name": (author_name or "").strip() or "Your instructor",
            "created_at": item.created_at, "expires_at": item.expires_at,
        }
        for item, course_title, author_name in rows
    ]}


@router.get("/dashboard")
def dashboard(user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    recommendation = determine_track_recommendation(db, user)
    target = db.get(LearningActivity, recommendation["target_activity_id"]) if recommendation["target_activity_id"] else None
    completed, total = quest_completion(db, user)
    pending = db.query(SubmissionJob).filter(
        SubmissionJob.student_id == user.id, SubmissionJob.status.in_(["queued", "running"])
    ).order_by(SubmissionJob.created_at.desc()).first()
    notices = db.query(NotificationOutbox).filter(
        NotificationOutbox.recipient_id == user.id,
        NotificationOutbox.next_attempt_at <= datetime.now(timezone.utc),
    ).order_by(NotificationOutbox.next_attempt_at.desc()).limit(5).all()
    return {
        "recommendation": recommendation,
        "next_activity": {"id": str(target.id), "title": target.title or target.topic_concept,
                          "kind": target.activity_type.value} if target else None,
        "completed": completed, "total": total, "xp": user.xp_points, "level": user.current_level,
        "pending_job_id": str(pending.id) if pending else None,
        "due_exam": None,
        "notices": [{"id": str(n.id), "subject": n.subject, "body": n.body} for n in notices],
    }


@router.get("/drafts/{activity_id}")
def get_draft(activity_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    challenge(db, activity_id, user)
    draft = db.query(ActivityDraft).filter(
        ActivityDraft.student_id == user.id, ActivityDraft.activity_id == activity_id
    ).first()
    return {"source_code": draft.source_code, "updated_at": draft.updated_at} if draft else None


@router.put("/drafts/{activity_id}")
def save_draft(activity_id: uuid.UUID, body: DraftPayload, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    challenge(db, activity_id, user)
    db.query(Profile).filter(Profile.id == user.id).with_for_update().one()
    draft = db.query(ActivityDraft).filter(
        ActivityDraft.student_id == user.id, ActivityDraft.activity_id == activity_id
    ).first()
    if draft is None:
        draft = ActivityDraft(student_id=user.id, activity_id=activity_id, source_code=body.source_code)
        db.add(draft)
    else:
        draft.source_code = body.source_code
    draft.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"source_code": draft.source_code, "updated_at": draft.updated_at}


class InstructorHint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot: int = Field(ge=1, le=5)
    body: str = Field(min_length=1, max_length=2000)


@router.get("/instructor/activities/{activity_id}/hints")
def instructor_hints(activity_id: uuid.UUID, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    activity = db.get(LearningActivity, activity_id)
    if activity is None or activity.activity_type != ActivityKind.challenge:
        raise HTTPException(404, "Challenge not found.")
    if user.role != UserRole.instructor or not may_manage_instructional_content(db, user, activity.course_id, activity.created_by):
        raise HTTPException(404, "Challenge not found.")
    hints = db.query(ChallengeHint).filter(ChallengeHint.activity_id == activity_id).order_by(ChallengeHint.slot).all()
    return [{"id": h.id, "slot": h.slot, "body": h.body} for h in hints]


@router.put("/instructor/activities/{activity_id}/hints")
def put_hint(activity_id: uuid.UUID, body: InstructorHint, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    activity = db.get(LearningActivity, activity_id)
    if activity is None or activity.activity_type != ActivityKind.challenge:
        raise HTTPException(404, "Challenge not found.")
    if user.role != UserRole.instructor or not may_manage_instructional_content(db, user, activity.course_id, activity.created_by):
        raise HTTPException(404, "Challenge not found.")
    if activity.review_status == ReviewState.published:
        raise HTTPException(409, "Published hints cannot be changed.")
    hint = db.query(ChallengeHint).filter(ChallengeHint.activity_id == activity_id, ChallengeHint.slot == body.slot).first()
    if hint is None:
        hint = ChallengeHint(activity_id=activity_id, slot=body.slot, body=body.body)
        db.add(hint)
    else:
        hint.body = body.body
    db.commit()
    return {"id": hint.id, "slot": hint.slot, "body": hint.body}


HINT_LIMIT = 5
HINT_PENDING_BODY = "Generating…"
HINT_RESERVATION_TIME = timedelta(minutes=2)


def _hint_uses(db: Session, student_id: uuid.UUID, activity_id: uuid.UUID):
    return db.query(HintUse).filter(HintUse.student_id == student_id, HintUse.activity_id == activity_id)


def _expired_hint_reservation(now: datetime):
    return (HintUse.body == HINT_PENDING_BODY) & (HintUse.created_at <= now - HINT_RESERVATION_TIME)


@router.get("/activities/{activity_id}/hints")
def hint_status(activity_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    challenge(db, activity_id, user)
    reviewed = db.query(ChallengeHint).filter(ChallengeHint.activity_id == activity_id).order_by(ChallengeHint.slot).all()
    uses = _hint_uses(db, user.id, activity_id).filter(~_expired_hint_reservation(_utcnow())).order_by(HintUse.created_at).all()
    revealed = {u.hint_id for u in uses if u.hint_id}
    return {"remaining": max(0, HINT_LIMIT - len(uses)),
            "reviewed": [{"id": h.id, "slot": h.slot, "body": h.body if h.id in revealed else None} for h in reviewed],
            "ai_hints": [{"id": u.id, "body": u.body} for u in uses if u.source == "ai" and u.body != HINT_PENDING_BODY]}


class RevealHint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: Literal["reviewed", "ai"]
    request_key: str = Field(min_length=8, max_length=100)
    hint_id: uuid.UUID | None = None


def _visible_failure_diagnostics(evaluation: dict) -> dict[str, str]:
    cases = evaluation.get("test_results")
    if not isinstance(cases, list):
        return {}
    failure = next((case for case in cases if isinstance(case, dict)
                    and case.get("is_hidden") is False and case.get("passed") is False), None)
    if failure is None:
        return {}
    return {
        argument: failure[field][:500] for argument, field in {
            "failed_input": "stdin",
            "expected_output": "expected_stdout",
            "actual_output": "stdout",
            "compiler_output": "compile_output",
            "stderr": "stderr",
            "status_description": "status_description",
        }.items() if isinstance(failure.get(field), str)
    }


@router.post("/activities/{activity_id}/hints/reveal")
def reveal_hint(activity_id: uuid.UUID, body: RevealHint, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    activity = challenge(db, activity_id, user)
    student_id = user.id
    db.query(Profile).filter(Profile.id == student_id).with_for_update().one()
    query = _hint_uses(db, student_id, activity_id)
    query.filter(_expired_hint_reservation(_utcnow())).delete()
    uses = query.all()
    repeated = next((u for u in uses if u.request_key == body.request_key), None)
    if repeated:
        if repeated.body == HINT_PENDING_BODY:
            raise HTTPException(409, "Hint generation is still running.")
        return {"body": repeated.body, "remaining": max(0, HINT_LIMIT - len(uses))}
    hint = None
    if body.source == "reviewed":
        hint = db.query(ChallengeHint).filter(
            ChallengeHint.id == body.hint_id, ChallengeHint.activity_id == activity_id
        ).first()
        if hint is None:
            raise HTTPException(404, "Reviewed hint not found.")
        already = next((u for u in uses if u.hint_id == hint.id), None)
        if already:
            return {"body": already.body, "remaining": max(0, HINT_LIMIT - len(uses))}
    else:
        if not settings.GEMINI_ENABLED:
            raise HTTPException(503, GEMINI_DISABLED)
        failed_run = db.query(SubmissionJob).filter(
            SubmissionJob.student_id == user.id, SubmissionJob.activity_id == activity_id,
            SubmissionJob.status == "completed", SubmissionJob.dry_run_only.is_(True),
        ).order_by(SubmissionJob.created_at.desc()).first()
        evaluation = (failed_run.result_json or {}).get("evaluation") if failed_run else None
        if not isinstance(evaluation, dict) or evaluation.get("is_successful") is not False:
            raise HTTPException(409, "Run a sample and review its failure before requesting AI guidance.")
    if len(uses) >= HINT_LIMIT:
        raise HTTPException(429, "All five hints have been used for this challenge.")
    record = HintUse(id=uuid.uuid4(), student_id=student_id, activity_id=activity_id, request_key=body.request_key,
                     hint_id=hint.id if hint else None, source=body.source,
                     body=hint.body if hint else HINT_PENDING_BODY)
    record_id = record.id
    db.add(record)
    db.commit()
    if hint:
        return {"body": hint.body, "remaining": HINT_LIMIT - 1 - len(uses)}
    try:
        if settings.GEMINI_API_KEY:
            reserve("student_ai", student_id)
        error_category = evaluation.get("dominant_error_category", "")
        documents = tutoring_document_ids(db, student_id, "student", activity)
        question = f"{activity.title or ''} {activity.topic_concept} {error_category}".strip()
        language = activity.language.value
        title = activity.title or activity.topic_concept
        statement = activity.problem_statement or ""
        source = failed_run.source_code
        db.rollback()
        passages = tutoring_passages(db, documents, question)
        db.rollback()
        explanation = explain_code_error(
            language=language, problem_title=title, problem_statement=statement, student_code=source,
            error_category=error_category, course_passages=passages_block(passages),
            **_visible_failure_diagnostics(evaluation),
        )
        student = db.query(Profile).filter(Profile.id == student_id).with_for_update().populate_existing().one()
        student_only(student)
        if student.account_status != "active":
            raise HTTPException(403, "Student access required.")
        activity = challenge(db, activity_id, student)
        if passages and not set(documents).issubset(tutoring_document_ids(db, student_id, "student", activity)):
            raise HTTPException(409, "Available course material changed. Retry this hint.")
        current = db.get(HintUse, record_id)
        now = _utcnow()
        if current is None or current.body != HINT_PENDING_BODY or current.created_at <= now - HINT_RESERVATION_TIME:
            raise HTTPException(409, "Hint generation expired. Retry this hint.")
        hint_text, _ = validate_tutor_citations(explanation.hint, passages)
        if reveals_solution(hint_text, activity.reference_solution_code, activity.starter_code, failed_sample=source):
            hint_text = WITHHELD_HINT
        result = hint_text[:2000]
        if not result or result == HINT_PENDING_BODY:
            raise HTTPException(503, "AI hints are unavailable. Your hint was not spent.")
        current.body = result
        remaining = HINT_LIMIT - query.filter(~_expired_hint_reservation(now)).count()
        db.commit()
        return {"body": result, "remaining": max(0, remaining)}
    except Exception as exc:
        db.rollback()
        query.filter(HintUse.id == record_id, HintUse.body == HINT_PENDING_BODY).delete()
        db.commit()
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(503, "AI hints are unavailable. Your hint was not spent.") from None


@router.get("/activities/{activity_id}/solution")
def solution(activity_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    activity = challenge(db, activity_id, user)
    passed = db.query(ActivityAttempt.id).filter(
        ActivityAttempt.student_id == user.id, ActivityAttempt.activity_id == activity_id,
        ActivityAttempt.is_successful.is_(True), learner_visible_attempt_clause(),
    ).first()
    if not passed:
        if not activity_is_closed(activity):
            raise HTTPException(403, "The solution unlocks after you pass or the instructor closes the challenge.")
    return {"source_code": activity.reference_solution_code}


@router.post("/instructor/activities/{activity_id}/close")
def close_challenge(activity_id: uuid.UUID, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    activity = db.get(LearningActivity, activity_id)
    if activity is None or activity.activity_type != ActivityKind.challenge:
        raise HTTPException(404, "Challenge not found.")
    if activity.created_by != user.id and user.role != UserRole.admin:
        raise HTTPException(404, "Challenge not found.")
    if activity.closed_at is None:
        activity.closed_at = datetime.now(timezone.utc)
        db.commit()
    return {"closed_at": activity.closed_at}


class ConsentChoice(BaseModel):
    model_config = ConfigDict(extra="forbid")
    choice: Literal["accepted", "declined", "withdrawn"]
    document_version: str = Field(min_length=1, max_length=100)


@router.get("/research/consent")
def consent_status(user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    latest = db.query(ResearchConsent).filter(ResearchConsent.student_id == user.id).order_by(
        ResearchConsent.event_order.desc()).first()
    active = bool(settings.RESEARCH_CONSENT_ACTIVE and settings.RESEARCH_CONSENT_VERSION and settings.RESEARCH_CONSENT_TEXT)
    # An answer to an older form no longer counts (consent is matched on the current version), so it reads as
    # unanswered and the student is asked again instead of silently dropping out of the study.
    stale = bool(active and latest and latest.document_version != settings.RESEARCH_CONSENT_VERSION)
    return {"available": active, "version": settings.RESEARCH_CONSENT_VERSION if active else (latest.document_version if latest else None),
            "text": settings.RESEARCH_CONSENT_TEXT if active else None,
            "choice": None if stale or not latest else latest.choice,
            "previous_version": latest.document_version if stale else None}


@router.post("/research/consent")
def choose_consent(body: ConsentChoice, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    active = bool(settings.RESEARCH_CONSENT_ACTIVE and settings.RESEARCH_CONSENT_VERSION and settings.RESEARCH_CONSENT_TEXT)
    if body.choice == "withdrawn":
        latest = db.query(ResearchConsent).filter(ResearchConsent.student_id == user.id).order_by(
            ResearchConsent.event_order.desc()).first()
        if latest is None or latest.choice != "accepted" or latest.document_version != body.document_version:
            raise HTTPException(409, "No active consent exists to withdraw.")
    elif not active or body.document_version != settings.RESEARCH_CONSENT_VERSION:
        raise HTTPException(409, "Approved research consent is not available.")
    db.add(ResearchConsent(student_id=user.id, document_version=body.document_version, choice=body.choice))
    db.commit()
    return {"choice": body.choice, "version": body.document_version}


@router.post("/research-consent/withdraw")
def withdraw_research_consent(user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    latest = db.query(ResearchConsent).filter(ResearchConsent.student_id == user.id).order_by(
        ResearchConsent.event_order.desc()).first()
    doc_ver = latest.document_version if latest else "v0.0-pending-approval"
    consent = ResearchConsent(student_id=user.id, document_version=doc_ver, choice="withdrawn")
    db.add(consent)
    db.commit()
    return {"status": "withdrawn", "withdrawn_at": datetime.now(timezone.utc).isoformat()}


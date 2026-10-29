"""Student pilot dashboard, synced drafts, limited hints, and research choices."""

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.quotas import reserve
from app.core.security import get_current_user, require_instructor
from app.models.entities import (
    ActivityAttempt, ActivityDraft, ActivityKind, ChallengeHint, HintUse,
    LearningActivity, Profile, ResearchConsent, ReviewState, SubmissionJob, UserRole,
    Exam, ExamAssignment, ExamAttempt, QuestGroupMember,
    NotificationOutbox,
    QuestGroup, QuestGroupActivity,
)
from app.services.ai_rag.error_explainer import explain_code_error
from app.services.ai_rag.gemini_client import GeminiConfigurationError
from app.services.gamification.sequencer import determine_track_recommendation

router = APIRouter(prefix="/api/v1/pilot", tags=["Classroom Pilot"])


def student_only(user: Profile) -> None:
    if user.role != UserRole.student:
        raise HTTPException(403, "Student access required.")


def challenge(db: Session, activity_id: uuid.UUID, user: Profile) -> LearningActivity:
    activity = db.query(LearningActivity).filter(
        LearningActivity.id == activity_id,
        LearningActivity.activity_type == ActivityKind.challenge,
        LearningActivity.review_status == ReviewState.published,
        LearningActivity.language == user.enrolled_language,
    ).first()
    if activity is None:
        raise HTTPException(404, "Published challenge not found on your track.")
    return activity


class DraftPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_code: str = Field(max_length=50_000)


@router.get("/dashboard")
def dashboard(user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    recommendation = determine_track_recommendation(db, user)
    target = db.get(LearningActivity, recommendation["target_activity_id"]) if recommendation["target_activity_id"] else None
    completed = db.query(func.count(func.distinct(ActivityAttempt.activity_id))).join(
        LearningActivity, LearningActivity.id == ActivityAttempt.activity_id
    ).filter(
        ActivityAttempt.student_id == user.id, ActivityAttempt.is_successful.is_(True),
        LearningActivity.language == user.enrolled_language,
        LearningActivity.review_status == ReviewState.published,
    ).scalar() or 0
    total = db.query(func.count(LearningActivity.id)).filter(
        LearningActivity.language == user.enrolled_language,
        LearningActivity.review_status == ReviewState.published,
    ).scalar() or 0
    pending = db.query(SubmissionJob).filter(
        SubmissionJob.student_id == user.id, SubmissionJob.status.in_(["queued", "running"])
    ).order_by(SubmissionJob.created_at.desc()).first()
    due_exam = db.query(Exam).join(ExamAssignment, ExamAssignment.exam_id == Exam.id).join(
        QuestGroupMember, QuestGroupMember.group_id == ExamAssignment.group_id
    ).filter(QuestGroupMember.profile_id == user.id, Exam.published_at.is_not(None),
             Exam.closes_at > datetime.now(timezone.utc)).order_by(Exam.closes_at).first()
    if due_exam is not None:
        completed_exam = db.query(ExamAttempt.id).filter(
            ExamAttempt.exam_id == due_exam.id, ExamAttempt.student_id == user.id,
            ExamAttempt.status.in_(["grading", "submitted"])).first()
        if completed_exam:
            due_exam = None
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
        "due_exam": {"id": str(due_exam.id), "title": due_exam.title,
                     "closes_at": due_exam.closes_at} if due_exam else None,
        "notices": [{"id": str(n.id), "subject": n.subject, "body": n.body} for n in notices],
    }


@router.get("/instructor/groups/{group_id}/students")
def group_students(group_id: uuid.UUID, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    group = db.get(QuestGroup, group_id)
    if group is None:
        raise HTTPException(404, "Quest group not found.")
    if group.created_by != user.id and user.role != UserRole.admin:
        raise HTTPException(404, "Quest group not found.")
    activity_ids = [row[0] for row in db.query(QuestGroupActivity.activity_id).filter(
        QuestGroupActivity.group_id == group_id).all()]
    members = db.query(Profile).join(QuestGroupMember, QuestGroupMember.profile_id == Profile.id).filter(
        QuestGroupMember.group_id == group_id, Profile.role == UserRole.student).order_by(Profile.pseudonym_id).all()
    counts = dict(db.query(ActivityAttempt.student_id, func.count(func.distinct(ActivityAttempt.activity_id))).filter(
        ActivityAttempt.student_id.in_([m.id for m in members]),
        ActivityAttempt.activity_id.in_(activity_ids), ActivityAttempt.is_successful.is_(True)
    ).group_by(ActivityAttempt.student_id).all()) if members and activity_ids else {}
    return {"group_id": group_id, "total_activities": len(activity_ids),
            "students": [{"alias": m.pseudonym_id, "completed": counts.get(m.id, 0),
                          "level": m.current_level} for m in members]}


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
    if activity.created_by != user.id and user.role != UserRole.admin:
        raise HTTPException(404, "Challenge not found.")
    hints = db.query(ChallengeHint).filter(ChallengeHint.activity_id == activity_id).order_by(ChallengeHint.slot).all()
    return [{"id": h.id, "slot": h.slot, "body": h.body} for h in hints]


@router.put("/instructor/activities/{activity_id}/hints")
def put_hint(activity_id: uuid.UUID, body: InstructorHint, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    activity = db.get(LearningActivity, activity_id)
    if activity is None or activity.activity_type != ActivityKind.challenge:
        raise HTTPException(404, "Challenge not found.")
    if activity.created_by != user.id and user.role != UserRole.admin:
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


@router.get("/activities/{activity_id}/hints")
def hint_status(activity_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    challenge(db, activity_id, user)
    reviewed = db.query(ChallengeHint).filter(ChallengeHint.activity_id == activity_id).order_by(ChallengeHint.slot).all()
    uses = db.query(HintUse).filter(HintUse.student_id == user.id, HintUse.activity_id == activity_id).order_by(HintUse.created_at).all()
    revealed = {u.hint_id for u in uses if u.hint_id}
    return {"remaining": max(0, 5 - len(uses)),
            "reviewed": [{"id": h.id, "slot": h.slot, "body": h.body if h.id in revealed else None} for h in reviewed],
            "ai_hints": [{"id": u.id, "body": u.body} for u in uses if u.source == "ai" and u.body != "Generating…"]}


class RevealHint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: Literal["reviewed", "ai"]
    request_key: str = Field(min_length=8, max_length=100)
    hint_id: uuid.UUID | None = None


@router.post("/activities/{activity_id}/hints/reveal")
def reveal_hint(activity_id: uuid.UUID, body: RevealHint, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    activity = challenge(db, activity_id, user)
    db.query(Profile).filter(Profile.id == user.id).with_for_update().one()
    uses = db.query(HintUse).filter(HintUse.student_id == user.id, HintUse.activity_id == activity_id).all()
    repeated = next((u for u in uses if u.request_key == body.request_key), None)
    if repeated:
        if repeated.body == "Generating…":
            raise HTTPException(409, "Hint generation is still running.")
        return {"body": repeated.body, "remaining": max(0, 5-len(uses))}
    hint = None
    if body.source == "reviewed":
        hint = db.query(ChallengeHint).filter(
            ChallengeHint.id == body.hint_id, ChallengeHint.activity_id == activity_id
        ).first()
        if hint is None:
            raise HTTPException(404, "Reviewed hint not found.")
        already = next((u for u in uses if u.hint_id == hint.id), None)
        if already:
            return {"body": already.body, "remaining": max(0, 5-len(uses))}
    else:
        failed_run = db.query(SubmissionJob).filter(
            SubmissionJob.student_id == user.id, SubmissionJob.activity_id == activity_id,
            SubmissionJob.status == "completed", SubmissionJob.dry_run_only.is_(True),
        ).order_by(SubmissionJob.created_at.desc()).first()
        if failed_run is None or (failed_run.result_json or {}).get("evaluation", {}).get("is_successful"):
            raise HTTPException(409, "Run a sample and review its failure before requesting AI guidance.")
    if len(uses) >= 5:
        raise HTTPException(429, "All five hints have been used for this challenge.")
    record = HintUse(student_id=user.id, activity_id=activity_id, request_key=body.request_key,
                     hint_id=hint.id if hint else None, source=body.source,
                     body=hint.body if hint else "Generating…")
    db.add(record)
    db.commit()
    if hint:
        return {"body": hint.body, "remaining": 4-len(uses)}
    try:
        if settings.GEMINI_API_KEY:
            reserve("student_ai", user.id)
        explanation = explain_code_error(
            language=activity.language.value, problem_title=activity.title or activity.topic_concept,
            problem_statement=activity.problem_statement or "", student_code=failed_run.source_code,
            error_category=(failed_run.result_json or {}).get("evaluation", {}).get("dominant_error_category", ""),
        )
        record.body = explanation.hints[0][:2000]
        db.commit()
        return {"body": record.body, "remaining": 4-len(uses)}
    except HTTPException:
        db.delete(record)
        db.commit()
        raise
    except Exception:
        db.delete(record)
        db.commit()
        raise HTTPException(503, "AI hints are unavailable. Your hint was not spent.") from None


@router.get("/activities/{activity_id}/solution")
def solution(activity_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    student_only(user)
    activity = challenge(db, activity_id, user)
    passed = db.query(ActivityAttempt.id).filter(
        ActivityAttempt.student_id == user.id, ActivityAttempt.activity_id == activity_id,
        ActivityAttempt.is_successful.is_(True)
    ).first()
    if not passed:
        if activity.closed_at is None:
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
    return {"available": active, "version": settings.RESEARCH_CONSENT_VERSION if active else (latest.document_version if latest else None),
            "text": settings.RESEARCH_CONSENT_TEXT if active else None,
            "choice": latest.choice if latest else None}


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


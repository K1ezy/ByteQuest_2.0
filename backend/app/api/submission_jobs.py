"""Durable, idempotent classroom grading requests."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.quotas import reserve
from app.core.security import get_current_user
from app.services.attempt_visibility import activity_is_closed, practice_attempt_clause, student_visible_activity_clause
from app.services.gamification.rollout import mechanic_state
from app.models.entities import (
    ActivityAttempt, ActivityKind, LearningActivity, Profile, ProgrammingLang, ReviewState, SubmissionJob, UserRole,
)

router = APIRouter(prefix="/api/v1/submission-jobs", tags=["Submission Jobs"])


from app.services.submission_worker import sanitize_grading_result_for_student


class SubmitJob(BaseModel):
    model_config = ConfigDict(extra="forbid")
    activity_id: uuid.UUID
    source_code: str = Field(min_length=1, max_length=50_000)
    dry_run_only: bool = False
    # Carried to the recorded attempt: the worker is a separate process and has no
    # other way to learn how long the student actually worked.
    time_spent_seconds: int = Field(default=0, ge=0, le=86_400)


class ComparedAttempt(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attempt_number: int
    submitted_code: str | None
    passed_test_cases: int
    total_test_cases: int
    score_percentage: float
    is_successful: bool


class SubmissionComparison(BaseModel):
    language: ProgrammingLang
    current: ComparedAttempt
    previous: ComparedAttempt | None


def view(job: SubmissionJob, db: Session, student: Profile) -> dict:
    result = job.result_json
    if result is not None:
        result = sanitize_grading_result_for_student(result)
        if result.get("codex_recoveries") and not mechanic_state(db, student).codex.unlocked:
            result["codex_recoveries"] = []
    return {
        "id": job.id, "activity_id": job.activity_id, "status": job.status,
        "dry_run_only": job.dry_run_only, "result": result,
        "error": job.error_message, "created_at": job.created_at,
        "attempts": job.attempts, "next_attempt_at": job.next_attempt_at,
    }


def _retry_failed_job(job: SubmissionJob, db: Session, student_id: uuid.UUID) -> None:
    if job.status != "failed":
        return
    reserve("practice_code" if job.dry_run_only else "official_submit", student_id, session=db)
    now = datetime.now(timezone.utc)
    job.status = "queued"
    job.claim_token = None
    job.attempts = 0
    job.error_message = None
    job.next_attempt_at = now
    job.updated_at = now
    db.commit()
    db.refresh(job)


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def submit_job(
    body: SubmitJob,
    idempotency_key: str = Header(min_length=8, max_length=100),
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != UserRole.student:
        raise HTTPException(403, "Student access required.")
    
    # Serialize per-user submission limits and duplicate-key handling.
    db.query(Profile).filter(Profile.id == user.id).with_for_update().one()
    existing = db.query(SubmissionJob).filter(
        SubmissionJob.student_id == user.id, SubmissionJob.idempotency_key == idempotency_key
    ).first()
    if existing:
        if (existing.activity_id != body.activity_id or existing.source_code != body.source_code
                or existing.dry_run_only != body.dry_run_only):
            raise HTTPException(409, "Idempotency key was already used for different work.")
        _retry_failed_job(existing, db, user.id)
        return view(existing, db, user)

    # 15-second duplicate click window protection (Explicitly excludes failed jobs)
    recent_dup = db.query(SubmissionJob).filter(
        SubmissionJob.student_id == user.id,
        SubmissionJob.activity_id == body.activity_id,
        SubmissionJob.source_code == body.source_code,
        SubmissionJob.dry_run_only == body.dry_run_only,
        SubmissionJob.status.in_(["queued", "running", "completed"]),
        SubmissionJob.created_at >= datetime.now(timezone.utc) - timedelta(seconds=15),
    ).order_by(SubmissionJob.created_at.desc()).first()
    if recent_dup:
        return view(recent_dup, db, user)

    accepted_at = datetime.now(timezone.utc)
    activity = db.query(LearningActivity).filter(
        LearningActivity.id == body.activity_id,
        LearningActivity.activity_type == ActivityKind.challenge,
        LearningActivity.review_status == ReviewState.published,
        LearningActivity.language == user.enrolled_language,
        student_visible_activity_clause(user.id, accepted_at),
    ).first()
    if activity is None:
        raise HTTPException(404, "Published challenge not found on your track.")
    if not body.dry_run_only and activity_is_closed(activity, accepted_at):
        raise HTTPException(409, "This challenge is closed for submissions.")
    # Practice and official work hold separate budgets, so sample runs can never
    # use up the submissions a student needs near a deadline.
    reserve("practice_code" if body.dry_run_only else "official_submit", user.id, session=db)
    job = SubmissionJob(student_id=user.id, activity_id=body.activity_id,
                        idempotency_key=idempotency_key, source_code=body.source_code,
                        dry_run_only=body.dry_run_only, status="queued",
                        time_spent_seconds=body.time_spent_seconds,
                        created_at=accepted_at)
    db.add(job)
    db.commit()
    db.refresh(job)
    return view(job, db, user)


@router.get("/{job_id}")
def get_job(job_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.query(SubmissionJob).filter(
        SubmissionJob.id == job_id, SubmissionJob.student_id == user.id
    ).first()
    if job is None:
        raise HTTPException(404, "Submission not found.")
    return view(job, db, user)


@router.get("/{job_id}/comparison")
def compare_submission(
    job_id: uuid.UUID,
    response: Response,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmissionComparison:
    unavailable = HTTPException(404, "Comparison unavailable for this submission.")
    if user.role != UserRole.student:
        raise unavailable
    completed = db.query(SubmissionJob, LearningActivity.language).join(
        LearningActivity, LearningActivity.id == SubmissionJob.activity_id,
    ).filter(
        SubmissionJob.id == job_id,
        SubmissionJob.student_id == user.id,
        SubmissionJob.status == "completed",
        SubmissionJob.dry_run_only.is_(False),
        LearningActivity.activity_type == ActivityKind.challenge,
    ).one_or_none()
    if completed is None:
        raise unavailable
    job, language = completed

    attempts = db.query(ActivityAttempt).filter(
        ActivityAttempt.student_id == user.id,
        ActivityAttempt.activity_id == job.activity_id,
        practice_attempt_clause(),
        ActivityAttempt.exam_item_id.is_(None),
        # Exam item grades retain result JSON even if their foreign keys are cleared.
        ActivityAttempt.result_json.is_(None),
    )
    current = attempts.filter(ActivityAttempt.submission_job_id == job.id).one_or_none()
    if current is None:
        try:
            legacy_id = uuid.UUID(str((job.result_json or {}).get("attempt_id")))
        except ValueError:
            raise unavailable from None
        current = attempts.filter(
            ActivityAttempt.id == legacy_id,
            ActivityAttempt.submission_job_id.is_(None),
        ).one_or_none()
        if current is None or current.submitted_code not in (None, job.source_code):
            raise unavailable

    previous = attempts.filter(ActivityAttempt.attempt_number < current.attempt_number).order_by(
        ActivityAttempt.attempt_number.desc(),
    ).first()
    response.headers["Cache-Control"] = "private, no-store"
    return SubmissionComparison(
        language=language,
        current=ComparedAttempt.model_validate(current),
        previous=ComparedAttempt.model_validate(previous) if previous is not None else None,
    )


@router.post("/{job_id}/retry", status_code=status.HTTP_202_ACCEPTED)
def retry_job(job_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != UserRole.student:
        raise HTTPException(404, "Submission not found.")
    # Serialize retry and duplicate-key submit using the same lock order.
    db.query(Profile).filter(Profile.id == user.id).with_for_update().one()
    job = db.query(SubmissionJob).filter(
        SubmissionJob.id == job_id, SubmissionJob.student_id == user.id,
    ).first()
    if job is None:
        raise HTTPException(404, "Submission not found.")
    _retry_failed_job(job, db, user.id)
    return view(job, db, user)

import dataclasses
import logging
import uuid
from functools import partial
from typing import List, Optional

import anyio
from fastapi import HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import (
    ActivityAttempt,
    ActivityKind,
    LearningActivity,
    Profile,
    ReviewState,
    TestCase,
    UserRole,
    SubmissionJob,
)
from app.services.judge0.client import (
    Judge0CircuitOpenError,
    Judge0UnavailableError,
    TestCaseInput,
    judge0_client,
)
from app.services.attempt_visibility import activity_has_opened, activity_is_closed, student_activity_clause
from app.services.pass_mark import PRACTICE_PASS_MARK, submission_passes
from app.services.gamification.badges import award_badges
from app.services.gamification.completion_rewards import completed_activity_ids
from app.services.gamification.codex import recovery_news
from app.services.gamification.progression import grant_xp
from app.services.gamification.sequencer import determine_next_task_rule_based
from app.services.gamification.solve_quality import attempt_quality
from app.services.ml_predictor.audit import record_prediction_outcome
from app.services.ml_predictor.shadow import record_shadow_prediction
from app.services.submission_claims import SubmissionClaim, finish_submission, lock_submission_claim

logger = logging.getLogger(__name__)


def _shadow_scoring_ready(request: Request | None) -> bool:
    """Read the API lifespan flag without requiring a FastAPI app.

    The durable grading worker is a separate process and must not import
    app.main: doing so couples long-running workers to router changes and can
    fail a job when a deploy adds a new module/class after the worker started.
    """
    state = getattr(getattr(request, "app", None), "state", None)
    return getattr(state, "ml_shadow_status", "disabled") == "ready"


class CodeSubmissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    activity_id: uuid.UUID
    source_code: str = Field(..., min_length=1, max_length=50000)
    time_spent_seconds: int = Field(default=0, ge=0, le=86400)
    dry_run_only: bool = Field(
        default=False,
        description="If True, runs only visible sample test cases without logging an official attempt.",
    )


def run_code_submission(
    request: Request | None,
    payload: CodeSubmissionRequest,
    current_user: Profile,
    db: Session,
    submission_claim: SubmissionClaim | None = None,
):
    """
    Executes a student's C++, Python, or Java code against Judge0 test cases.
    Enforces Rule 5 (append-only logging on official submissions) and Rule 7 (5 runs/min rate limit).
    """
    if current_user.role != UserRole.student or current_user.account_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student code submission access is required.",
        )
    submission_job_id = submission_claim.job_id if submission_claim is not None else None
    if submission_job_id is not None:
        job = db.get(SubmissionJob, submission_job_id)
        if job is None or job.student_id != current_user.id or job.activity_id != payload.activity_id:
            raise HTTPException(403, "Submission job does not belong to this student and activity.")
        existing_attempt = db.query(ActivityAttempt).filter(
            ActivityAttempt.submission_job_id == submission_job_id
        ).first()
        if existing_attempt is not None and job.result_json is not None:
            return job.result_json

    activity = (
        db.query(LearningActivity)
        .filter(
            LearningActivity.id == payload.activity_id,
            LearningActivity.activity_type == ActivityKind.challenge,
            LearningActivity.review_status == ReviewState.published,
            student_activity_clause(current_user.id),
        )
        .first()
    )
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Published programming challenge not found.",
        )
    # Persisted jobs passed the schedule checks when accepted. Queue delays,
    # deadline edits and retries must not invalidate that decision.
    if submission_job_id is None:
        if not activity_has_opened(activity):
            raise HTTPException(409, "This challenge has not opened yet.")
        if not payload.dry_run_only and activity_is_closed(activity):
            raise HTTPException(409, "This challenge is closed for submissions.")

    # Fetch test cases (only visible ones for dry_run_only, all cases for official submit)
    tc_query = db.query(TestCase).filter(TestCase.activity_id == activity.id)
    if payload.dry_run_only:
        tc_query = tc_query.filter(TestCase.is_hidden.is_(False))
    db_test_cases: List[TestCase] = tc_query.order_by(TestCase.order_index.asc()).all()

    if not db_test_cases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No test cases configured for this challenge.",
        )

    tc_inputs = [
        TestCaseInput(
            test_case_id=str(tc.id),
            order_index=tc.order_index,
            stdin=tc.stdin,
            expected_stdout=tc.expected_stdout,
            time_limit_ms=tc.time_limit_ms,
            memory_limit_kb=tc.memory_limit_kb,
            is_hidden=tc.is_hidden,
            weight=float(tc.weight),
        )
        for tc in db_test_cases
    ]

    # Keep database connections out of the potentially long Judge0 queue wait.
    # Preserve primitive identifiers before ending this read-only transaction;
    # ORM instances are expired on rollback and are reloaded for official writes.
    activity_id = activity.id
    activity_language = activity.language
    student_id = current_user.id
    db.rollback()

    try:
        summary = anyio.from_thread.run(
            partial(
                judge0_client.evaluate_submission,
                language=activity_language,
                source_code=payload.source_code,
                test_cases=tc_inputs,
            )
        )
    except Judge0CircuitOpenError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Code execution is temporarily paused while the service recovers. Try again shortly.",
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc
    except Judge0UnavailableError as exc:
        logger.warning("Judge0 request failed (%s).", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Code execution service is temporarily unavailable. Try again shortly.",
        ) from exc

    # If dry_run_only, return results immediately without mutating database logs
    if payload.dry_run_only:
        if db.query(Profile.id).filter(Profile.id == student_id, Profile.account_status == "active",
                                      Profile.role == UserRole.student).first() is None:
            raise HTTPException(403, "Student code submission access is required.")
        if db.query(LearningActivity.id).filter(LearningActivity.id == activity_id, student_activity_clause(student_id)).first() is None:
            raise HTTPException(404, "Published programming challenge not found.")
        return {"mode": "dry_run", "evaluation": summary}

    # Lock the profile while computing attempt number, XP, and badge changes. This
    # serializes simultaneous official submissions for this student.
    student = (
        db.query(Profile)
        .filter(Profile.id == student_id)
        .with_for_update()
        .populate_existing()
        .one()
    )
    if student.role != UserRole.student or student.account_status != "active":
        raise HTTPException(403, "Student code submission access is required.")
    if submission_claim is not None:
        job = lock_submission_claim(db, submission_claim)
        if job is None:
            db.rollback()
            return None
        existing_attempt = db.query(ActivityAttempt).filter(
            ActivityAttempt.submission_job_id == submission_job_id
        ).first()
        if existing_attempt is not None and job.result_json is not None:
            db.rollback()
            return job.result_json
    # Reload the activity after the Judge0 wait. The initial transaction has been
    # released, and the recommendation service expects a live ORM activity.
    activity = db.query(LearningActivity).filter(
        LearningActivity.id == activity_id, student_activity_clause(student_id),
    ).one_or_none()
    if activity is None:
        raise HTTPException(404, "Published programming challenge not found.")
    level_before = student.current_level
    summary = dataclasses.replace(summary, is_successful=submission_passes(
        all_passed=summary.passed_test_cases == summary.total_test_cases,
        score_percentage=summary.score_percentage,
        pass_mark_percent=activity.pass_mark_percent,
        default_mark=PRACTICE_PASS_MARK,
    ))

    # Official submission: compute next sequential attempt_number (Rule 5: Append-Only)
    prior_attempts_count = (
        db.query(func.count(ActivityAttempt.id))
        .filter(
            ActivityAttempt.student_id == student.id,
            ActivityAttempt.activity_id == activity_id,
        )
        .scalar()
        or 0
    )
    # Award XP only on the first successful completion to prevent XP farming
    xp_earned = (
        max(0, int(activity.xp_reward or 0))
        if summary.is_successful and not completed_activity_ids(db, student.id, {activity_id})
        else 0
    )

    new_attempt = ActivityAttempt(
        student_id=student.id,
        activity_id=activity.id,
        attempt_number=prior_attempts_count + 1,
        submitted_code=payload.source_code,
        passed_test_cases=summary.passed_test_cases,
        total_test_cases=summary.total_test_cases,
        score_percentage=summary.score_percentage,
        is_successful=summary.is_successful,
        execution_time_ms=summary.avg_execution_time_ms,
        memory_used_kb=summary.max_memory_used_kb,
        compiler_status_id=summary.dominant_status_id,
        error_category=summary.dominant_error_category,
        time_spent_seconds=payload.time_spent_seconds,
        xp_awarded=xp_earned,
        submission_job_id=submission_job_id,
    )
    db.add(new_attempt)

    grant_xp(student, xp_earned)
    db.flush()
    record_prediction_outcome(
        db,
        student_id=student.id,
        activity_id=activity.id,
        attempt_created_at=new_attempt.created_at,
        is_successful=new_attempt.is_successful,
    )

    # Phase 4 awards apply to both quizzes and programming challenges.
    new_badges, badge_xp = award_badges(db, student)
    quality = attempt_quality(db, new_attempt)
    recommendation = determine_next_task_rule_based(
        db, student, activity, new_attempt
    )

    response_payload = jsonable_encoder({
        "mode": "official_submit",
        "attempt_id": new_attempt.id,
        "attempt_number": new_attempt.attempt_number,
        "xp_awarded": xp_earned,
        "new_total_xp": student.xp_points,
        "new_level": student.current_level,
        "level_up": student.current_level > level_before,
        "new_badges_unlocked": new_badges,
        "badge_xp_awarded": badge_xp,
        "quality": quality,
        "codex_recoveries": recovery_news(db, new_attempt),
        "next_step_recommendation": recommendation,
        "evaluation": summary,
    })
    if submission_claim is not None:
        finish_submission(job, response_payload)
    db.commit()
    if submission_claim is not None or _shadow_scoring_ready(request):
        try:
            record_shadow_prediction(
                db,
                student=student,
                target_activity_id=recommendation.get("target_activity_id"),
                source_attempt=new_attempt,
                shadow_ready=True,
            )
        except Exception:
            db.rollback()
            logger.exception("Optional shadow scoring failed after the submission was committed.")

    return response_payload

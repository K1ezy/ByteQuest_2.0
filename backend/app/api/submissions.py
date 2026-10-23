import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import (
    ActivityAttempt,
    ActivityKind,
    LearningActivity,
    Profile,
    ReviewState,
    TestCase,
)
from app.services.judge0.client import (
    Judge0CircuitOpenError,
    Judge0Client,
    Judge0UnavailableError,
    TestCaseInput,
)

router = APIRouter(prefix="/api/v1/submissions", tags=["Code Submissions"])
limiter = Limiter(key_func=get_remote_address)
judge0_client = Judge0Client()


class CodeSubmissionRequest(BaseModel):
    activity_id: uuid.UUID
    source_code: str = Field(..., min_length=1, max_length=50000)
    time_spent_seconds: int = Field(default=0, ge=0, le=86400)
    dry_run_only: bool = Field(
        default=False,
        description="If True, runs only visible sample test cases without logging an official attempt.",
    )


@router.post("/execute")
@limiter.limit("5/minute")
async def execute_code_submission(
    request: Request,
    payload: CodeSubmissionRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Executes a student's C++, Python, or Java code against Judge0 test cases.
    Enforces Rule 5 (append-only logging on official submissions) and Rule 7 (5 runs/min rate limit).
    """
    activity = (
        db.query(LearningActivity)
        .filter(
            LearningActivity.id == payload.activity_id,
            LearningActivity.activity_type == ActivityKind.challenge,
            LearningActivity.review_status == ReviewState.published,
        )
        .first()
    )
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Published programming challenge not found.",
        )

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

    try:
        summary = await judge0_client.evaluate_submission(
            language=activity.language,
            source_code=payload.source_code,
            test_cases=tc_inputs,
        )
    except Judge0CircuitOpenError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Judge0UnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Code execution sandbox error: {str(exc)}",
        )

    # If dry_run_only, return results immediately without mutating database logs
    if payload.dry_run_only:
        return {"mode": "dry_run", "evaluation": summary}

    # Official submission: compute next sequential attempt_number (Rule 5: Append-Only)
    prior_attempts_count = (
        db.query(func.count(ActivityAttempt.id))
        .filter(
            ActivityAttempt.student_id == current_user.id,
            ActivityAttempt.activity_id == activity.id,
        )
        .scalar()
        or 0
    )
    prior_success_exists = (
        db.query(ActivityAttempt.id)
        .filter(
            ActivityAttempt.student_id == current_user.id,
            ActivityAttempt.activity_id == activity.id,
            ActivityAttempt.is_successful.is_(True),
        )
        .first()
        is not None
    )

    # Award XP only on the first successful completion to prevent XP farming
    xp_earned = activity.xp_reward if (summary.is_successful and not prior_success_exists) else 0

    new_attempt = ActivityAttempt(
        student_id=current_user.id,
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
    )
    db.add(new_attempt)

    if xp_earned > 0:
        current_user.xp_points += xp_earned
        # Level progression formula: 1 level per 250 XP
        current_user.current_level = (current_user.xp_points // 250) + 1

    db.commit()
    db.refresh(new_attempt)

    return {
        "mode": "official_submit",
        "attempt_id": new_attempt.id,
        "attempt_number": new_attempt.attempt_number,
        "xp_awarded": xp_earned,
        "new_total_xp": current_user.xp_points,
        "new_level": current_user.current_level,
        "evaluation": summary,
    }

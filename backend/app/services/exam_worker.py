"""Server-side exam expiry and grading; called by the bounded worker."""

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from time import monotonic

import anyio
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.entities import (
    ActivityAttempt, ActivityKind, Exam, ExamAttempt, ExamItem,
    Profile, ProgrammingLang,
)
from app.services.gamification.quiz_content import parse_quiz_questions
from app.services.gamification.sequencer import QUIZ_MASTERY_SCORE
from app.services.pass_mark import EXAM_PASS_MARK, submission_passes
from app.services.judge0.client import TestCaseInput, judge0_client


def answer_grace() -> timedelta:
    """How long after due_at an answer may still reach the server and count.

    The browser locks editing at due_at and sends its last unsaved edits then;
    this window covers that request while it is in transit. It is the single
    exam cutoff: autosave rejects writes after it and grading starts after it.
    """
    return timedelta(seconds=settings.EXAM_AUTOSAVE_GRACE_SECONDS)


def answers_accepted_until(attempt: ExamAttempt) -> datetime:
    return attempt.due_at + answer_grace()


# Renew between items so a long exam can keep its claim without holding a DB connection.
GRADING_LEASE = timedelta(minutes=10)
MAX_GRADING_ATTEMPTS = 3
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExamGradingClaim:
    attempt_id: uuid.UUID
    token: uuid.UUID


def claim_exam(attempt_id: uuid.UUID | None = None) -> ExamGradingClaim | None:
    with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        lease_free = or_(ExamAttempt.grading_claimed_at.is_(None),
                         ExamAttempt.grading_claimed_at <= now - GRADING_LEASE)
        retry_due = or_(ExamAttempt.grading_retry_at.is_(None), ExamAttempt.grading_retry_at <= now)
        eligible = db.query(ExamAttempt).filter(or_(
            (ExamAttempt.status == "grading") & lease_free & retry_due,
            (ExamAttempt.status == "active") & (ExamAttempt.due_at <= now - answer_grace()),
        ))
        if attempt_id is not None:
            eligible = eligible.filter(ExamAttempt.id == attempt_id)
        attempt = eligible.order_by(ExamAttempt.due_at, ExamAttempt.id).with_for_update(skip_locked=True).first()
        if attempt is None:
            return None
        if attempt.status == "active":
            attempt.status = "grading"
            attempt.submitted_at = now
        if attempt.grading_attempts >= MAX_GRADING_ATTEMPTS:
            attempt.status = "failed"
            attempt.grading_claimed_at = None
            attempt.grading_token = None
            attempt.grading_retry_at = None
            db.commit()
            return None
        attempt.grading_claimed_at = now
        attempt.grading_token = uuid.uuid4()
        attempt.grading_attempts += 1
        attempt.grading_retry_at = None
        claim = ExamGradingClaim(attempt.id, attempt.grading_token)
        db.commit()
        return claim


def _lock_exam_claim(db: Session, claim: ExamGradingClaim) -> ExamAttempt | None:
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == claim.attempt_id).with_for_update().populate_existing().first()
    cutoff = datetime.now(timezone.utc) - GRADING_LEASE
    if (attempt is None or attempt.status != "grading" or attempt.grading_token != claim.token
            or attempt.grading_claimed_at is None or attempt.grading_claimed_at <= cutoff):
        return None
    return attempt


def _grade_item(snapshot: dict, answer: object) -> dict:
    if snapshot["kind"] == "quiz":
        questions = parse_quiz_questions(snapshot["quiz_questions_json"])
        answers = answer if isinstance(answer, dict) else {}
        correct = sum(1 for q in questions if str(answers.get(q.id, "")).casefold() == q.correct_answer.casefold())
        percentage = round(correct / len(questions) * 100, 2)
        return {"percentage": percentage, "passed": correct, "total": len(questions),
                "successful": percentage >= QUIZ_MASTERY_SCORE, "error_category": "none"}
    code = answer if isinstance(answer, str) else ""
    if not code.strip():
        return {"percentage": 0.0, "passed": 0, "total": len(snapshot["test_cases"]),
                "successful": False, "error_category": "none"}
    cases = [TestCaseInput(test_case_id=t["id"], order_index=t["order_index"], stdin=t["stdin"],
        expected_stdout=t["expected_stdout"], time_limit_ms=t["time_limit_ms"],
        memory_limit_kb=t["memory_limit_kb"], is_hidden=t["is_hidden"], weight=t["weight"])
        for t in snapshot["test_cases"]]
    summary = anyio.from_thread.run(judge0_client.evaluate_submission,
        ProgrammingLang(snapshot["language"]), code, cases)
    percentage = float(summary.score_percentage)
    return {"percentage": percentage, "passed": summary.passed_test_cases,
            "total": summary.total_test_cases,
            # Snapshots taken before pass marks existed have no key: the exam default applies.
            "successful": submission_passes(
                all_passed=summary.passed_test_cases == summary.total_test_cases,
                score_percentage=percentage,
                pass_mark_percent=snapshot.get("pass_mark_percent"),
                default_mark=EXAM_PASS_MARK,
            ),
            "error_category": summary.dominant_error_category}


def grade_exam(claim: ExamGradingClaim) -> None:
    try:
        _grade_claimed_exam(claim)
    except Exception as exc:
        logger.warning("Exam grading failed (%s, attempt_id=%s)", type(exc).__name__, claim.attempt_id)
        with SessionLocal() as db:
            attempt = _lock_exam_claim(db, claim)
            if attempt is None:
                return
            attempt.grading_claimed_at = None
            attempt.grading_token = None
            if attempt.grading_attempts >= MAX_GRADING_ATTEMPTS:
                attempt.status = "failed"
            else:
                attempt.grading_retry_at = datetime.now(timezone.utc) + timedelta(seconds=5 * 2 ** attempt.grading_attempts)
            db.commit()


def _grade_claimed_exam(claim: ExamGradingClaim) -> None:
    attempt_id = claim.attempt_id
    with SessionLocal() as db:
        attempt = db.get(ExamAttempt, attempt_id)
        if attempt is None or attempt.status != "grading" or attempt.grading_token != claim.token:
            return
        items = db.query(ExamItem).filter(ExamItem.exam_id == attempt.exam_id).order_by(ExamItem.position).all()
        work = [(i.id, i.activity_id, i.points, dict(i.snapshot_json),
                 (attempt.answers_json or {}).get(str(i.id))) for i in items]
        student_id = attempt.student_id
        db.rollback()

        grades = []
        renew_every = GRADING_LEASE.total_seconds() / 3
        renew_at = monotonic() + renew_every
        for item_id, activity_id, points, snapshot, answer in work:
            grades.append((item_id, activity_id, points, snapshot, answer, _grade_item(snapshot, answer)))
            if monotonic() >= renew_at:
                attempt = _lock_exam_claim(db, claim)
                if attempt is None:
                    return
                attempt.grading_claimed_at = datetime.now(timezone.utc)
                db.commit()
                renew_at = monotonic() + renew_every

        # Serialize activity attempt numbers with practice grading for this student.
        db.query(Profile.id).filter(Profile.id == student_id).with_for_update().one()
        attempt = _lock_exam_claim(db, claim)
        if attempt is None:
            return
        score = 0.0
        result_items = []
        for item_id, activity_id, points, snapshot, answer, result in grades:
            existing = db.query(ActivityAttempt).filter(
                ActivityAttempt.exam_attempt_id == attempt_id,
                ActivityAttempt.exam_item_id == item_id).first()
            if existing is None:
                prior_count = db.query(func.count(ActivityAttempt.id)).filter(
                    ActivityAttempt.student_id == student_id, ActivityAttempt.activity_id == activity_id).scalar() or 0
                row = ActivityAttempt(student_id=student_id, activity_id=activity_id,
                    attempt_number=prior_count+1, exam_attempt_id=attempt_id, exam_item_id=item_id,
                    submitted_code=answer if snapshot["kind"] == "challenge" and isinstance(answer, str) else None,
                    quiz_answers_json=answer if snapshot["kind"] == "quiz" and isinstance(answer, dict) else None,
                    passed_test_cases=result["passed"], total_test_cases=result["total"],
                    score_percentage=result["percentage"], is_successful=result["successful"],
                    error_category=result["error_category"], xp_awarded=0,
                    result_json={"percentage": result["percentage"]})
                db.add(row)
                db.flush()
            item_score = round(points * result["percentage"] / 100, 2)
            score += item_score
            result_items.append({"item_id": str(item_id), "points_earned": item_score,
                "points_possible": points})
        attempt.score = round(score, 2)
        attempt.max_score = sum(i[2] for i in work)
        attempt.result_json = jsonable_encoder({"score": attempt.score, "max_score": attempt.max_score,
                                               "items": result_items, "xp_released": False})
        attempt.status = "submitted"
        attempt.grading_claimed_at = None
        attempt.grading_token = None
        db.commit()

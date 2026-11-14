"""Server-side exam expiry and grading; called by the bounded worker."""

import uuid
from datetime import datetime, timedelta, timezone

import anyio
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, or_

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.entities import (
    ActivityAttempt, ActivityKind, Exam, ExamAttempt, ExamItem,
    Profile, ProgrammingLang,
)
from app.services.gamification.quiz_content import parse_quiz_questions
from app.services.gamification.sequencer import CHALLENGE_MASTERY_SCORE, QUIZ_MASTERY_SCORE
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


# Longer than grading a full exam takes. A claim older than this belongs to a
# worker that stopped or failed, so the attempt may be claimed again.
GRADING_LEASE = timedelta(minutes=10)


def claim_exam() -> uuid.UUID | None:
    with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        lease_free = or_(ExamAttempt.grading_claimed_at.is_(None),
                         ExamAttempt.grading_claimed_at <= now - GRADING_LEASE)
        attempt = db.query(ExamAttempt).filter(or_(
            (ExamAttempt.status == "grading") & lease_free,
            (ExamAttempt.status == "active") & (ExamAttempt.due_at <= now - answer_grace()),
        )).order_by(ExamAttempt.due_at, ExamAttempt.id).with_for_update(skip_locked=True).first()
        if attempt is None:
            return None
        if attempt.status == "active":
            attempt.status = "grading"
            attempt.submitted_at = now
        attempt.grading_claimed_at = now
        attempt_id = attempt.id
        db.commit()
        return attempt_id


def _grade_item(snapshot: dict, answer: object) -> dict:
    if snapshot["kind"] == "quiz":
        questions = parse_quiz_questions(snapshot["quiz_questions_json"])
        answers = answer if isinstance(answer, dict) else {}
        correct = sum(1 for q in questions if str(answers.get(q.id, "")).casefold() == q.correct_answer.casefold())
        percentage = round(correct / len(questions) * 100, 2)
        return {"percentage": percentage, "passed": correct, "total": len(questions),
                "successful": percentage >= QUIZ_MASTERY_SCORE, "error_category": "none",
                "solution": {q.id: q.correct_answer for q in questions}}
    code = answer if isinstance(answer, str) else ""
    if not code.strip():
        return {"percentage": 0.0, "passed": 0, "total": len(snapshot["test_cases"]),
                "successful": False, "error_category": "none", "solution": snapshot["reference_solution_code"]}
    cases = [TestCaseInput(test_case_id=t["id"], order_index=t["order_index"], stdin=t["stdin"],
        expected_stdout=t["expected_stdout"], time_limit_ms=t["time_limit_ms"],
        memory_limit_kb=t["memory_limit_kb"], is_hidden=t["is_hidden"], weight=t["weight"])
        for t in snapshot["test_cases"]]
    summary = anyio.from_thread.run(judge0_client.evaluate_submission,
        ProgrammingLang(snapshot["language"]), code, cases)
    percentage = float(summary.score_percentage)
    return {"percentage": percentage, "passed": summary.passed_test_cases,
            "total": summary.total_test_cases,
            "successful": percentage >= CHALLENGE_MASTERY_SCORE,
            "error_category": summary.dominant_error_category,
            "solution": snapshot["reference_solution_code"]}


def grade_exam(attempt_id: uuid.UUID) -> None:
    with SessionLocal() as db:
        attempt = db.get(ExamAttempt, attempt_id)
        if attempt is None or attempt.status != "grading":
            return
        items = db.query(ExamItem).filter(ExamItem.exam_id == attempt.exam_id).order_by(ExamItem.position).all()
        work = [(i.id, i.activity_id, i.points, dict(i.snapshot_json),
                 (attempt.answers_json or {}).get(str(i.id))) for i in items]
        student_id = attempt.student_id
        db.rollback()

        grades = [(item_id, activity_id, points, snapshot, answer, _grade_item(snapshot, answer))
                  for item_id, activity_id, points, snapshot, answer in work]

        # Serialize activity attempt numbers with practice grading for this student.
        db.query(Profile.id).filter(Profile.id == student_id).with_for_update().one()
        attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).with_for_update().one()
        if attempt.status == "submitted":
            db.rollback()
            return
        score = 0.0
        pending_xp = 0
        result_items = []
        for item_id, activity_id, points, snapshot, answer, result in grades:
            existing = db.query(ActivityAttempt).filter(
                ActivityAttempt.exam_attempt_id == attempt_id,
                ActivityAttempt.exam_item_id == item_id).first()
            if existing is None:
                prior_count = db.query(func.count(ActivityAttempt.id)).filter(
                    ActivityAttempt.student_id == student_id, ActivityAttempt.activity_id == activity_id).scalar() or 0
                prior_success = db.query(ActivityAttempt.id).filter(
                    ActivityAttempt.student_id == student_id, ActivityAttempt.activity_id == activity_id,
                    ActivityAttempt.is_successful.is_(True)).first() is not None
                xp = int(snapshot["xp_reward"] or 0) if result["successful"] and not prior_success else 0
                pending_xp += xp
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
                "points_possible": points, "solution": result["solution"]})
        attempt.score = round(score, 2)
        attempt.max_score = sum(i[2] for i in work)
        attempt.result_json = jsonable_encoder({"score": attempt.score, "max_score": attempt.max_score,
                                               "items": result_items, "pending_xp": pending_xp,
                                               "xp_released": False})
        attempt.status = "submitted"
        db.commit()

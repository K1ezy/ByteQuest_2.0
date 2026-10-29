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
    LearningActivity, Profile, ProgrammingLang,
)
from app.services.gamification.badges import evaluate_and_award_badges
from app.services.gamification.progression import grant_xp
from app.services.gamification.quiz_content import parse_quiz_questions
from app.services.gamification.sequencer import CHALLENGE_MASTERY_SCORE, QUIZ_MASTERY_SCORE
from app.services.judge0.client import TestCaseInput, judge0_client


def sweep_expired_exam_attempts(db_session=None) -> int:
    """
    Checklist #5: Finds active exam attempts past their deadline (+ grace window for in-flight autosaves),
    transitions status to 'grading', sets submitted_at, and commits so they are graded.
    """
    should_close = False
    if db_session is None:
        db_session = SessionLocal()
        should_close = True
    try:
        now = datetime.now(timezone.utc)
        grace_cutoff = now - timedelta(seconds=getattr(settings, "EXAM_AUTOSAVE_GRACE_SECONDS", 15))
        expired = db_session.query(ExamAttempt).filter(
            ExamAttempt.status == "active",
            ExamAttempt.due_at <= grace_cutoff,
        ).with_for_update(skip_locked=True).all()
        for attempt in expired:
            attempt.status = "grading"
            attempt.submitted_at = now
        count = len(expired)
        if count > 0:
            db_session.commit()
        return count
    finally:
        if should_close:
            db_session.close()


def claim_exam() -> uuid.UUID | None:
    with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        attempt = db.query(ExamAttempt).filter(or_(
            ExamAttempt.status == "grading",
            (ExamAttempt.status == "active") & (ExamAttempt.due_at <= now),
        )).order_by(ExamAttempt.due_at, ExamAttempt.id).with_for_update(skip_locked=True).first()
        if attempt is None:
            return None
        if attempt.status == "active":
            attempt.status = "grading"
            attempt.submitted_at = now
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

        student = db.query(Profile).filter(Profile.id == student_id).with_for_update().one()
        attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).with_for_update().one()
        if attempt.status == "submitted":
            db.rollback()
            return
        score = 0.0
        result_items = []
        for item_id, activity_id, points, snapshot, answer, result in grades:
            activity = db.get(LearningActivity, activity_id)
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
                row = ActivityAttempt(student_id=student_id, activity_id=activity_id,
                    attempt_number=prior_count+1, exam_attempt_id=attempt_id, exam_item_id=item_id,
                    submitted_code=answer if snapshot["kind"] == "challenge" and isinstance(answer, str) else None,
                    quiz_answers_json=answer if snapshot["kind"] == "quiz" and isinstance(answer, dict) else None,
                    passed_test_cases=result["passed"], total_test_cases=result["total"],
                    score_percentage=result["percentage"], is_successful=result["successful"],
                    error_category=result["error_category"], xp_awarded=xp,
                    result_json={"percentage": result["percentage"]})
                db.add(row)
                grant_xp(student, xp)
                db.flush()
            item_score = round(points * result["percentage"] / 100, 2)
            score += item_score
            result_items.append({"item_id": str(item_id), "points_earned": item_score,
                "points_possible": points, "solution": result["solution"]})
        evaluate_and_award_badges(db, student)
        attempt.score = round(score, 2)
        attempt.max_score = sum(i[2] for i in work)
        attempt.result_json = jsonable_encoder({"score": attempt.score, "max_score": attempt.max_score,
                                               "items": result_items})
        attempt.status = "submitted"
        db.commit()

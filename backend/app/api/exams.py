"""Instructor-assigned, server-timed exams built from published activities."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import anyio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_instructor
from app.core.quotas import reserve
from app.models.entities import (
    ActivityKind, Exam, ExamAssignment, ExamAttempt, ExamItem, ExamRetakeGrant,
    ExamSampleRun, LearningActivity, NotificationOutbox, Profile, QuestGroup,
    QuestGroupMember, ReviewState, TestCase, UserRole,
)
from app.services.gamification.quiz_content import parse_quiz_questions
from app.services.judge0.client import TestCaseInput, judge0_client

router = APIRouter(prefix="/api/v1/exams", tags=["Exams"])


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DraftItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    activity_id: uuid.UUID
    points: int = Field(ge=1, le=1000)


class DraftExam(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=3, max_length=255)
    opens_at: datetime
    closes_at: datetime
    duration_minutes: int = Field(ge=1, le=240)
    group_ids: list[uuid.UUID] = Field(min_length=1, max_length=10)
    items: list[DraftItem] = Field(min_length=1, max_length=30)

    @field_validator("opens_at", "closes_at")
    @classmethod
    def aware_time(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("Exam times must include a timezone.")
        return value.astimezone(timezone.utc)


def instructor_exam(db: Session, exam_id: uuid.UUID, user: Profile) -> Exam:
    exam = db.get(Exam, exam_id)
    if exam is None:
        raise HTTPException(404, "Exam not found.")
    if exam.created_by != user.id and user.role != UserRole.admin:
        raise HTTPException(404, "Exam not found.")
    return exam


def assigned(db: Session, exam_id: uuid.UUID, student_id: uuid.UUID) -> bool:
    return db.query(ExamAssignment.id).join(
        QuestGroupMember, QuestGroupMember.group_id == ExamAssignment.group_id
    ).filter(ExamAssignment.exam_id == exam_id, QuestGroupMember.profile_id == student_id).first() is not None


def public_item(item: ExamItem) -> dict:
    snap = item.snapshot_json
    result = {"id": str(item.id), "position": item.position, "points": item.points,
              "kind": snap["kind"], "title": snap["title"], "problem_statement": snap["problem_statement"]}
    if snap["kind"] == "quiz":
        result["questions"] = [
            {"id": q.id, "prompt": q.prompt, "options": [o.model_dump() for o in q.options]}
            for q in parse_quiz_questions(snap["quiz_questions_json"])
        ]
    else:
        result["starter_code"] = snap["starter_code"]
        result["samples"] = [{"stdin": t["stdin"], "expected_stdout": t["expected_stdout"]}
                             for t in snap["test_cases"] if not t["is_hidden"]]
    return result


@router.post("/instructor", status_code=201)
def create_exam(body: DraftExam, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    if body.closes_at <= body.opens_at or body.opens_at <= utcnow():
        raise HTTPException(422, "Choose a future exam window with the close after the open.")
    if len(set(body.group_ids)) != len(body.group_ids) or len({i.activity_id for i in body.items}) != len(body.items):
        raise HTTPException(422, "Groups and activities must be unique.")
    groups = db.query(QuestGroup).filter(QuestGroup.id.in_(body.group_ids)).all()
    if len(groups) != len(body.group_ids) or (user.role != UserRole.admin and any(g.created_by != user.id for g in groups)):
        raise HTTPException(404, "Quest group not found.")
    languages = {g.language for g in groups}
    if len(languages) != 1:
        raise HTTPException(422, "All assigned groups must use one language track.")
    activities = db.query(LearningActivity).filter(LearningActivity.id.in_([i.activity_id for i in body.items])).all()
    if len(activities) != len(body.items) or (user.role != UserRole.admin and any(
        a.created_by != user.id for a in activities
    )):
        raise HTTPException(404, "Activity not found.")
    if any(a.review_status != ReviewState.published or a.language not in languages for a in activities):
        raise HTTPException(422, "Use your own published activities in the assigned language.")
    exam = Exam(created_by=user.id, title=body.title.strip().replace("\r", " ").replace("\n", " "), opens_at=body.opens_at,
                closes_at=body.closes_at, duration_minutes=body.duration_minutes)
    db.add(exam)
    db.flush()
    db.add_all(ExamAssignment(exam_id=exam.id, group_id=g.id) for g in groups)
    db.add_all(ExamItem(exam_id=exam.id, activity_id=item.activity_id,
                        position=position, points=item.points, snapshot_json={})
               for position, item in enumerate(body.items, 1))
    db.commit()
    return {"id": exam.id, "status": "draft"}


@router.get("/instructor")
def instructor_exams(user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    query = db.query(Exam)
    if user.role != UserRole.admin:
        query = query.filter(Exam.created_by == user.id)
    exams = query.order_by(Exam.created_at.desc()).limit(100).all()
    return [{"id": e.id, "title": e.title, "opens_at": e.opens_at, "closes_at": e.closes_at,
             "published": e.published_at is not None, "results_released": e.results_released_at is not None}
            for e in exams]


@router.get("/instructor/catalog")
def exam_catalog(user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    groups_query = db.query(QuestGroup)
    activities_query = db.query(LearningActivity).filter(LearningActivity.review_status == ReviewState.published)
    if user.role != UserRole.admin:
        groups_query = groups_query.filter(QuestGroup.created_by == user.id)
        activities_query = activities_query.filter(LearningActivity.created_by == user.id)
    groups = groups_query.order_by(QuestGroup.created_at.desc()).all()
    activities = activities_query.order_by(LearningActivity.sequence_order).all()
    return {"groups": [{"id": g.id, "name": g.name, "language": g.language.value} for g in groups],
            "activities": [{"id": a.id, "title": a.title or a.topic_concept,
                            "kind": a.activity_type.value, "language": a.language.value}
                           for a in activities]}


@router.get("/instructor/{exam_id}")
def instructor_exam_detail(exam_id: uuid.UUID, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    exam = instructor_exam(db, exam_id, user)
    groups = db.query(QuestGroup).join(ExamAssignment, ExamAssignment.group_id == QuestGroup.id).filter(
        ExamAssignment.exam_id == exam_id).all()
    students = db.query(Profile).join(QuestGroupMember, QuestGroupMember.profile_id == Profile.id).join(
        ExamAssignment, ExamAssignment.group_id == QuestGroupMember.group_id
    ).filter(ExamAssignment.exam_id == exam_id, Profile.role == UserRole.student).distinct().order_by(
        Profile.pseudonym_id).all()
    attempt_counts = dict(db.query(ExamAttempt.student_id, func.count(ExamAttempt.id)).filter(
        ExamAttempt.exam_id == exam_id).group_by(ExamAttempt.student_id).all())
    return {"id": exam.id, "title": exam.title,
            "groups": [{"id": g.id, "name": g.name} for g in groups],
            "students": [{"id": s.id, "alias": s.pseudonym_id,
                          "attempts": attempt_counts.get(s.id, 0)} for s in students]}


@router.post("/instructor/{exam_id}/publish")
def publish_exam(exam_id: uuid.UUID, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    exam = instructor_exam(db, exam_id, user)
    db.query(Exam).filter(Exam.id == exam_id).with_for_update().one()
    if exam.published_at:
        return {"id": exam.id, "published_at": exam.published_at}
    if exam.opens_at <= utcnow():
        raise HTTPException(409, "Publish before the exam opens.")
    items = db.query(ExamItem).filter(ExamItem.exam_id == exam_id).order_by(ExamItem.position).all()
    for item in items:
        activity = db.get(LearningActivity, item.activity_id)
        if activity is None or activity.review_status != ReviewState.published:
            raise HTTPException(409, "Every exam activity must still be published.")
        snapshot = {"kind": activity.activity_type.value, "title": activity.title or activity.topic_concept,
                    "problem_statement": activity.problem_statement or "", "starter_code": activity.starter_code or "",
                    "reference_solution_code": activity.reference_solution_code or "", "xp_reward": activity.xp_reward,
                    "language": activity.language.value, "quiz_questions_json": activity.quiz_questions_json}
        if activity.activity_type == ActivityKind.quiz:
            try:
                parse_quiz_questions(activity.quiz_questions_json)
            except ValueError as exc:
                raise HTTPException(409, "A quiz has invalid questions.") from exc
        else:
            tests = db.query(TestCase).filter(TestCase.activity_id == activity.id).order_by(TestCase.order_index).all()
            if not activity.judge0_verified or not tests or not any(not t.is_hidden for t in tests):
                raise HTTPException(409, "Every code task needs verified tests and a visible sample.")
            snapshot["test_cases"] = [
                {"id": str(t.id), "order_index": t.order_index, "stdin": t.stdin,
                 "expected_stdout": t.expected_stdout, "time_limit_ms": t.time_limit_ms,
                 "memory_limit_kb": t.memory_limit_kb, "is_hidden": t.is_hidden, "weight": t.weight}
                for t in tests
            ]
        item.snapshot_json = snapshot
    exam.published_at = utcnow()
    member_ids = db.query(QuestGroupMember.profile_id).join(
        ExamAssignment, ExamAssignment.group_id == QuestGroupMember.group_id
    ).filter(ExamAssignment.exam_id == exam.id).distinct().all()
    remind_at = max(utcnow(), exam.opens_at - timedelta(days=1))
    for (student_id,) in member_ids:
        db.add(NotificationOutbox(recipient_id=student_id,
            dedupe_key=f"exam-reminder:{exam.id}:{student_id}",
            subject=f"Upcoming exam: {exam.title}",
            body=f"{exam.title} opens {exam.opens_at.astimezone(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %I:%M %p')} and closes {exam.closes_at.astimezone(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %I:%M %p')} Asia/Manila. Sign in to ByteQuest for details.",
            next_attempt_at=remind_at))
    db.commit()
    return {"id": exam.id, "published_at": exam.published_at}


@router.post("/instructor/{exam_id}/release")
def release_exam(exam_id: uuid.UUID, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    exam = instructor_exam(db, exam_id, user)
    db.query(Exam).filter(Exam.id == exam_id).with_for_update().populate_existing().one()
    retake_close = db.query(func.max(ExamRetakeGrant.closes_at)).filter(ExamRetakeGrant.exam_id == exam.id).scalar()
    if exam.published_at is None or utcnow() < max(exam.closes_at, retake_close or exam.closes_at):
        raise HTTPException(409, "Results can be released after the exam window closes.")
    unfinished = db.query(ExamAttempt.id).filter(ExamAttempt.exam_id == exam.id,
        ExamAttempt.status.in_(["active", "grading"])).first()
    if unfinished:
        raise HTTPException(409, "Wait for all attempts to finish grading.")
    unreleased = db.query(ExamAttempt.id).filter(ExamAttempt.exam_id == exam.id,
        ExamAttempt.status == "submitted",
        ExamAttempt.submitted_at > (exam.results_released_at or datetime.min.replace(tzinfo=timezone.utc))).first()
    if unreleased:
        exam.results_released_at = utcnow()
        students = db.query(ExamAttempt.student_id).filter(ExamAttempt.exam_id == exam.id).distinct().all()
        for (student_id,) in students:
            db.add(NotificationOutbox(recipient_id=student_id,
                dedupe_key=f"exam-release:{exam.id}:{exam.results_released_at.isoformat()}:{student_id}",
                subject=f"Exam results released: {exam.title}",
                body=f"Results for {exam.title} are available in ByteQuest. Sign in to view them."))
        db.commit()
    return {"released_at": exam.results_released_at}


class RetakeWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    opens_at: datetime
    closes_at: datetime
    duration_minutes: int = Field(ge=1, le=240)

    @field_validator("opens_at", "closes_at")
    @classmethod
    def aware_time(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("Retake times must include a timezone.")
        return value.astimezone(timezone.utc)


@router.post("/instructor/{exam_id}/retakes/{student_id}")
def grant_retake(exam_id: uuid.UUID, student_id: uuid.UUID, body: RetakeWindow,
                 user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    instructor_exam(db, exam_id, user)
    if body.opens_at <= utcnow() or body.closes_at <= body.opens_at:
        raise HTTPException(422, "Choose a future retake window.")
    if not assigned(db, exam_id, student_id):
        raise HTTPException(404, "Student is not assigned to this exam.")
    db.query(Profile).filter(Profile.id == student_id).with_for_update().one()
    grant = db.query(ExamRetakeGrant).filter(
        ExamRetakeGrant.exam_id == exam_id, ExamRetakeGrant.student_id == student_id).first()
    taken = db.query(func.count(ExamAttempt.id)).filter(
        ExamAttempt.exam_id == exam_id, ExamAttempt.student_id == student_id).scalar() or 0
    if grant is None:
        grant = ExamRetakeGrant(exam_id=exam_id, student_id=student_id, allowed_attempts=max(2, taken+1),
                                opens_at=body.opens_at, closes_at=body.closes_at,
                                duration_minutes=body.duration_minutes)
        db.add(grant)
    else:
        grant.allowed_attempts = min(5, max(grant.allowed_attempts + 1, taken + 1))
        grant.opens_at = body.opens_at
        grant.closes_at = body.closes_at
        grant.duration_minutes = body.duration_minutes
    db.commit()
    return {"allowed_attempts": grant.allowed_attempts}


@router.get("")
def student_exams(user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != UserRole.student:
        raise HTTPException(403, "Student access required.")
    exams = db.query(Exam).join(ExamAssignment, ExamAssignment.exam_id == Exam.id).join(
        QuestGroupMember, QuestGroupMember.group_id == ExamAssignment.group_id
    ).filter(QuestGroupMember.profile_id == user.id, Exam.published_at.is_not(None)).distinct().order_by(
        Exam.opens_at.desc()).limit(100).all()
    return [{"id": e.id, "title": e.title, "opens_at": e.opens_at, "closes_at": e.closes_at,
             "duration_minutes": e.duration_minutes, "results_released": e.results_released_at is not None}
            for e in exams]


@router.get("/{exam_id}")
def student_exam(exam_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != UserRole.student or not assigned(db, exam_id, user.id):
        raise HTTPException(404, "Assigned exam not found.")
    exam = db.get(Exam, exam_id)
    if exam.published_at is None:
        raise HTTPException(404, "Assigned exam not found.")
    latest = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id,
        ExamAttempt.student_id == user.id).order_by(ExamAttempt.attempt_number.desc()).first()
    grant = db.query(ExamRetakeGrant).filter(ExamRetakeGrant.exam_id == exam_id,
        ExamRetakeGrant.student_id == user.id).first()
    can_start = bool((not latest or latest.status == "submitted") and
                     (not latest or (grant is not None and latest.attempt_number < grant.allowed_attempts)))
    opens_at, closes_at = (grant.opens_at, grant.closes_at) if latest and grant else (exam.opens_at, exam.closes_at)
    return {"id": exam.id, "title": exam.title, "opens_at": opens_at, "closes_at": closes_at,
            "duration_minutes": grant.duration_minutes if latest and grant else exam.duration_minutes,
            "server_now": utcnow(),
            "can_start": can_start and opens_at <= utcnow() < closes_at,
            "latest_attempt_id": latest.id if latest else None,
            "latest_status": latest.status if latest else None,
            "results_released": bool(exam.results_released_at and latest and latest.submitted_at and latest.submitted_at <= exam.results_released_at)}


@router.post("/{exam_id}/start")
def start_exam(exam_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != UserRole.student or not assigned(db, exam_id, user.id):
        raise HTTPException(404, "Assigned exam not found.")
    db.query(Profile).filter(Profile.id == user.id).with_for_update().one()
    exam = db.get(Exam, exam_id)
    now = utcnow()
    attempts = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id,
        ExamAttempt.student_id == user.id).order_by(ExamAttempt.attempt_number.desc()).all()
    if attempts and attempts[0].status in ("active", "grading"):
        return {"attempt_id": attempts[0].id, "status": attempts[0].status}
    grant = db.query(ExamRetakeGrant).filter(ExamRetakeGrant.exam_id == exam_id,
        ExamRetakeGrant.student_id == user.id).first()
    opens_at, closes_at, duration_minutes = (exam.opens_at, exam.closes_at, exam.duration_minutes) if not attempts else (
        (grant.opens_at, grant.closes_at, grant.duration_minutes) if grant else (exam.opens_at, exam.closes_at, exam.duration_minutes)
    )
    if exam.published_at is None or not (opens_at <= now < closes_at):
        raise HTTPException(409, "Exam is not currently open.")
    if len(attempts) >= (grant.allowed_attempts if grant else 1):
        raise HTTPException(409, "No exam attempts remain.")
    due = min(closes_at, now + timedelta(minutes=duration_minutes))
    attempt = ExamAttempt(exam_id=exam_id, student_id=user.id, attempt_number=len(attempts)+1,
                          status="active", started_at=now, due_at=due, answers_json={})
    db.add(attempt)
    db.commit()
    return {"attempt_id": attempt.id, "status": attempt.status}


def own_attempt(db: Session, attempt_id: uuid.UUID, user: Profile) -> ExamAttempt:
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id,
        ExamAttempt.student_id == user.id).first()
    if attempt is None:
        raise HTTPException(404, "Exam attempt not found.")
    return attempt


@router.get("/attempts/{attempt_id}")
def get_attempt(attempt_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    attempt = own_attempt(db, attempt_id, user)
    exam = db.get(Exam, attempt.exam_id)
    items = db.query(ExamItem).filter(ExamItem.exam_id == exam.id).order_by(ExamItem.position).all()
    released = bool(exam.results_released_at and attempt.submitted_at and attempt.submitted_at <= exam.results_released_at)
    return {"id": attempt.id, "exam_id": exam.id, "title": exam.title,
            "user_id": attempt.student_id, "student_id": attempt.student_id,
            "status": attempt.status, "due_at": attempt.due_at,
            "server_now": utcnow(),
            "revision": attempt.revision, "last_saved_at": attempt.last_saved_at,
            "answers": attempt.answers_json, "items": [public_item(i) for i in items],
            "results_released": released,
            "result": attempt.result_json if released and attempt.status == "submitted" else None,
            "score": attempt.score if released and attempt.status == "submitted" else None}


class SaveAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0)
    answers: dict[str, Any] = Field(max_length=30)


@router.put("/attempts/{attempt_id}/answers")
def save_answers(attempt_id: uuid.UUID, body: SaveAnswers,
                 user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id,
        ExamAttempt.student_id == user.id).with_for_update().first()
    if attempt is None:
        raise HTTPException(404, "Exam attempt not found.")
    if attempt.status != "active" or utcnow() >= attempt.due_at:
        raise HTTPException(409, "Exam time has ended; the latest saved work will be submitted.")
    if attempt.revision != body.expected_revision:
        raise HTTPException(409, "A newer answer version is saved. Reload before editing.")
    items = db.query(ExamItem).filter(ExamItem.exam_id == attempt.exam_id).all()
    by_id = {str(i.id): i for i in items}
    if not set(body.answers).issubset(by_id):
        raise HTTPException(422, "An answer refers to an unknown exam item.")
    for item_id, value in body.answers.items():
        item = by_id[item_id]
        if item.snapshot_json["kind"] == "challenge":
            if not isinstance(value, str) or len(value) > 50_000:
                raise HTTPException(422, "Code answers must be at most 50,000 characters.")
        elif not isinstance(value, dict) or len(value) > 100 or any(
            not isinstance(k, str) or not isinstance(v, str) or len(k) > 100 or len(v) > 32
            for k, v in value.items()
        ):
            raise HTTPException(422, "Quiz answers are invalid.")
        else:
            questions = parse_quiz_questions(item.snapshot_json["quiz_questions_json"])
            allowed = {question.id: {option.key.casefold() for option in question.options}
                       for question in questions}
            if any(question_id not in allowed or answer.casefold() not in allowed[question_id]
                   for question_id, answer in value.items()):
                raise HTTPException(422, "Quiz answers must match this exam's questions and options.")
    attempt.answers_json = body.answers
    attempt.revision += 1
    attempt.last_saved_at = utcnow()
    db.commit()
    return {"attempt_id": attempt.id, "revision": attempt.revision, "last_saved_at": attempt.last_saved_at, "server_now": utcnow(), "status": attempt.status}


@router.post("/attempts/{attempt_id}/submit")
def submit_attempt(attempt_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id,
        ExamAttempt.student_id == user.id).with_for_update().first()
    if attempt is None:
        raise HTTPException(404, "Exam attempt not found.")
    if attempt.status == "active":
        attempt.status = "grading"
        attempt.submitted_at = utcnow()
        db.commit()
    return {"status": attempt.status}


class SampleRun(BaseModel):
    model_config = ConfigDict(extra="forbid")
    item_id: uuid.UUID
    source_code: str = Field(min_length=1, max_length=50_000)


@router.post("/attempts/{attempt_id}/run-sample")
def exam_sample_run(attempt_id: uuid.UUID, body: SampleRun,
                    user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    attempt = own_attempt(db, attempt_id, user)
    if attempt.status != "active" or utcnow() >= attempt.due_at:
        raise HTTPException(409, "The exam is no longer active.")
    item = db.query(ExamItem).filter(ExamItem.id == body.item_id,
        ExamItem.exam_id == attempt.exam_id).first()
    if item is None or item.snapshot_json["kind"] != "challenge":
        raise HTTPException(404, "Code task not found in this exam.")
    reserve("exam_sample", user.id)
    db.add(ExamSampleRun(student_id=user.id, exam_attempt_id=attempt.id))
    db.commit()
    cases = [TestCaseInput(test_case_id=t["id"], order_index=t["order_index"], stdin=t["stdin"],
        expected_stdout=t["expected_stdout"], time_limit_ms=t["time_limit_ms"],
        memory_limit_kb=t["memory_limit_kb"], is_hidden=False, weight=t["weight"])
        for t in item.snapshot_json["test_cases"] if not t["is_hidden"]]
    from app.models.entities import ProgrammingLang
    summary = anyio.from_thread.run(judge0_client.evaluate_submission,
        ProgrammingLang(item.snapshot_json["language"]), body.source_code, cases)
    return {"evaluation": summary}

"""Instructor-assigned, server-timed exams built from published activities."""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import anyio
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import exists, func, or_
from sqlalchemy.orm import Session, aliased

from app.core.database import get_db
from app.core.security import get_current_user, require_instructor
from app.core.quotas import reserve
from app.models.entities import (
    ActivityKind, CourseMember, Exam, ExamAssignment, ExamAttempt, ExamItem, ExamRetakeGrant,
    ExamSampleRun, LearningActivity, NotificationOutbox, Profile, Workshop,
    WorkshopMember, ReviewState, TestCase, UserRole,
)
from app.services.gamification.badges import evaluate_and_award_badges
from app.services.gamification.completion_rewards import exam_completion_awards
from app.services.gamification.progression import grant_xp
from app.services.gamification.quiz_content import parse_quiz_questions
from app.services.ml_predictor.exam_history import course_exam_ids
from app.services.ml_predictor.shadow import record_shadow_prediction
from app.services.ml_predictor.targets import next_course_activity
from app.services.judge0.client import TestCaseInput, judge0_client
from app.services.exam_worker import answer_grace, answers_accepted_until
from app.services.pass_mark import EXAM_PASS_MARK
from app.services.challenge_verification import challenge_is_verified
from app.services.course_access import active_membership_course_ids, has_course_role, may_manage_instructional_content

router = APIRouter(prefix="/api/v1/exams", tags=["Exams"])
logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require_practice_help_available(db: Session, student_id: uuid.UUID) -> None:
    """Pause practice help until every active attempt stops accepting answers."""
    active = db.query(ExamAttempt.id).filter(
        ExamAttempt.student_id == student_id,
        ExamAttempt.status == "active",
        ExamAttempt.due_at > utcnow() - answer_grace(),
    ).first()
    if active is not None:
        raise HTTPException(403, detail={
            "code": "exam_in_progress",
            "message": "Study help is paused during your exam. Try again after you submit or the answer window closes.",
        })


class DraftItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    activity_id: uuid.UUID
    points: int = Field(ge=1, le=1000)


class DraftExam(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=3, max_length=255)
    content_mode: Literal["practice", "restricted"] = "practice"
    opens_at: datetime
    closes_at: datetime
    duration_minutes: int = Field(ge=1, le=240)
    workshop_ids: list[uuid.UUID] = Field(min_length=1, max_length=10)
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
    if exam.restricted_course_id is not None and not has_course_role(db, user, exam.restricted_course_id, "instructor"):
        raise HTTPException(404, "Exam not found.")
    return exam


def _student_exam_course_clause(student_id: uuid.UUID):
    return or_(Exam.restricted_course_id.is_(None), exists().where(
        CourseMember.course_id == Exam.restricted_course_id,
        CourseMember.profile_id == student_id, CourseMember.member_role == "student", CourseMember.status == "active",
    ))


def assigned(db: Session, exam_id: uuid.UUID, student_id: uuid.UUID) -> bool:
    return db.query(ExamAssignment.id).join(Exam, Exam.id == ExamAssignment.exam_id).join(
        WorkshopMember, WorkshopMember.workshop_id == ExamAssignment.workshop_id
    ).filter(ExamAssignment.exam_id == exam_id, WorkshopMember.profile_id == student_id,
             _student_exam_course_clause(student_id)).first() is not None


def assigned_exam_numbers(db: Session, student_id: uuid.UUID):
    assignments = db.query(ExamAssignment.exam_id).join(
        WorkshopMember, WorkshopMember.workshop_id == ExamAssignment.workshop_id
    ).filter(WorkshopMember.profile_id == student_id)
    return db.query(
        Exam.id,
        func.row_number().over(order_by=(Exam.published_at, Exam.created_at, Exam.id)).label("exam_number"),
    ).filter(Exam.id.in_(assignments), Exam.published_at.is_not(None), _student_exam_course_clause(student_id)).subquery()


def _exam_access(exam: Exam, latest: ExamAttempt | None, grant: ExamRetakeGrant | None, now: datetime):
    """Return the effective window, duration, and whether a new attempt may start."""
    window = grant if latest is not None and grant is not None else exam
    attempts_remain = latest is None or (
        latest.status == "submitted" and grant is not None and latest.attempt_number < grant.allowed_attempts
    )
    can_start = bool(exam.published_at and attempts_remain and window.opens_at <= now < window.closes_at)
    return window, can_start


def _assigned_exams_with_state(db: Session, student_id: uuid.UUID):
    numbered = assigned_exam_numbers(db, student_id)
    latest = db.query(
        ExamAttempt, func.row_number().over(
            partition_by=ExamAttempt.exam_id, order_by=ExamAttempt.attempt_number.desc()
        ).label("latest_rank")
    ).filter(ExamAttempt.student_id == student_id).subquery()
    attempt = aliased(ExamAttempt, latest)
    return db.query(Exam, numbered.c.exam_number, attempt, ExamRetakeGrant).join(numbered, numbered.c.id == Exam.id).outerjoin(
        attempt, (attempt.exam_id == Exam.id) & (latest.c.latest_rank == 1)
    ).outerjoin(
        ExamRetakeGrant, (ExamRetakeGrant.exam_id == Exam.id) & (ExamRetakeGrant.student_id == student_id)
    ).order_by(Exam.opens_at.desc(), numbered.c.exam_number.desc()).all()


def next_due_exam(db: Session, student_id: uuid.UUID, now: datetime) -> dict | None:
    deadlines = []
    for exam, _, latest_attempt, grant in _assigned_exams_with_state(db, student_id):
        window, can_start = _exam_access(exam, latest_attempt, grant, now)
        if can_start:
            deadlines.append((window.closes_at, exam.id, exam.title))
        elif latest_attempt and latest_attempt.status == "active" and now < latest_attempt.due_at:
            deadlines.append((latest_attempt.due_at, exam.id, exam.title))
    if not deadlines:
        return None
    closes_at, exam_id, title = min(deadlines)
    return {"id": str(exam_id), "title": title, "closes_at": closes_at}


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
        result["pass_mark_percent"] = snap.get("pass_mark_percent") or EXAM_PASS_MARK
        result["starter_code"] = snap["starter_code"]
        result["samples"] = [{"stdin": t["stdin"], "expected_stdout": t["expected_stdout"]}
                             for t in snap["test_cases"] if not t["is_hidden"]]
    return result


@router.post("/instructor", status_code=201)
def create_exam(body: DraftExam, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    if body.closes_at <= body.opens_at or body.opens_at <= utcnow():
        raise HTTPException(422, "Choose a future exam window with the close after the open.")
    if len(set(body.workshop_ids)) != len(body.workshop_ids) or len({i.activity_id for i in body.items}) != len(body.items):
        raise HTTPException(422, "Groups and activities must be unique.")
    workshops = db.query(Workshop).filter(Workshop.id.in_(body.workshop_ids)).all()
    if len(workshops) != len(body.workshop_ids) or (user.role != UserRole.admin and any(g.created_by != user.id for g in workshops)):
        raise HTTPException(404, "Workshop not found.")
    languages = {g.language for g in workshops}
    if len(languages) != 1:
        raise HTTPException(422, "All assigned workshops must use one language track.")
    activities = db.query(LearningActivity).filter(LearningActivity.id.in_([i.activity_id for i in body.items])).all()
    if len(activities) != len(body.items) or any(
        not may_manage_instructional_content(db, user, a.course_id, a.created_by) for a in activities
    ):
        raise HTTPException(404, "Activity not found.")
    restricted = body.content_mode == "restricted"
    course_ids = {a.course_id for a in activities}
    if restricted and (None in course_ids or len(course_ids) != 1):
        raise HTTPException(422, "Use exam-only activities from one course in a restricted exam.")
    expected_status = ReviewState.draft if restricted else ReviewState.published
    if any(a.review_status != expected_status or a.exam_only != restricted or a.language not in languages
           or a.archived_at is not None for a in activities):
        raise HTTPException(422, "Choose activities of the selected exam type and assigned language.")
    exam = Exam(created_by=user.id, title=body.title.strip().replace("\r", " ").replace("\n", " "), opens_at=body.opens_at,
                closes_at=body.closes_at, duration_minutes=body.duration_minutes,
                restricted_course_id=next(iter(course_ids)) if restricted else None)
    db.add(exam)
    db.flush()
    db.add_all(ExamAssignment(exam_id=exam.id, workshop_id=g.id) for g in workshops)
    db.add_all(ExamItem(exam_id=exam.id, activity_id=item.activity_id,
                        position=position, points=item.points, snapshot_json={})
               for position, item in enumerate(body.items, 1))
    db.commit()
    return {"id": exam.id, "status": "draft"}


@router.get("/instructor")
def instructor_exams(user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    query = db.query(Exam)
    if user.role != UserRole.admin:
        course_ids = active_membership_course_ids(db, user.id, "instructor")
        query = query.filter(Exam.created_by == user.id,
                             or_(Exam.restricted_course_id.is_(None), Exam.restricted_course_id.in_(course_ids)))
    exams = query.order_by(Exam.created_at.desc()).limit(100).all()
    held_exam_ids = {exam_id for (exam_id,) in db.query(ExamAttempt.exam_id).filter(
        ExamAttempt.exam_id.in_([exam.id for exam in exams]),
        ExamAttempt.status == "submitted",
        ExamAttempt.result_released_at.is_(None),
    ).distinct().all()}
    return [{"id": e.id, "title": e.title, "opens_at": e.opens_at, "closes_at": e.closes_at,
             "published": e.published_at is not None, "results_released": e.results_released_at is not None,
             "has_unreleased_results": e.id in held_exam_ids,
             "content_mode": "restricted" if e.restricted_course_id is not None else "practice"}
            for e in exams]


@router.get("/instructor/catalog")
def exam_catalog(user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    workshops_query = db.query(Workshop)
    activities_query = db.query(LearningActivity).filter(
        LearningActivity.archived_at.is_(None), or_(LearningActivity.review_status == ReviewState.published,
                                                   LearningActivity.exam_only.is_(True)),
    )
    if user.role != UserRole.admin:
        workshops_query = workshops_query.filter(Workshop.created_by == user.id)
        course_ids = active_membership_course_ids(db, user.id, "instructor")
        activities_query = activities_query.filter(or_(
            LearningActivity.course_id.in_(course_ids),
            LearningActivity.course_id.is_(None) & (LearningActivity.created_by == user.id),
        ))
    workshops = workshops_query.order_by(Workshop.created_at.desc()).all()
    activities = activities_query.order_by(LearningActivity.sequence_order).all()
    return {"workshops": [{"id": g.id, "name": g.name, "language": g.language.value} for g in workshops],
            "activities": [{"id": a.id, "title": a.title or a.topic_concept,
                            "kind": a.activity_type.value, "language": a.language.value,
                            "exam_only": a.exam_only}
                           for a in activities]}


@router.get("/instructor/{exam_id}")
def instructor_exam_detail(exam_id: uuid.UUID, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    exam = instructor_exam(db, exam_id, user)
    workshops = db.query(Workshop).join(ExamAssignment, ExamAssignment.workshop_id == Workshop.id).filter(
        ExamAssignment.exam_id == exam_id).all()
    students = db.query(Profile).join(WorkshopMember, WorkshopMember.profile_id == Profile.id).join(
        ExamAssignment, ExamAssignment.workshop_id == WorkshopMember.workshop_id
    ).filter(ExamAssignment.exam_id == exam_id, Profile.role == UserRole.student).distinct().order_by(
        Profile.pseudonym_id).all()
    attempts_by_student: dict[uuid.UUID, list[dict]] = {}
    attempts = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id).order_by(
        ExamAttempt.attempt_number).all()
    for attempt in attempts:
        result = attempt.result_json or {}
        attempts_by_student.setdefault(attempt.student_id, []).append({
            "id": attempt.id,
            "attempt_number": attempt.attempt_number,
            "status": attempt.status,
            "grading_state": (
                "needs_retry" if attempt.status == "failed" else
                "retry_scheduled" if attempt.grading_retry_at is not None else
                "running" if attempt.grading_token is not None else "queued"
            ) if attempt.status in {"grading", "failed"} else None,
            "score": attempt.score,
            "max_score": attempt.max_score,
            "results_released": attempt.result_released_at is not None,
            "xp_awarded": result.get("pending_xp") if result.get("xp_released") else None,
        })
    return {"id": exam.id, "title": exam.title,
            "workshops": [{"id": g.id, "name": g.name} for g in workshops],
            "students": [{"id": s.id, "alias": s.username,
                          "attempts": len(attempts_by_student.get(s.id, ())),
                          "results": attempts_by_student.get(s.id, [])} for s in students]}


@router.post("/instructor/{exam_id}/publish")
def publish_exam(exam_id: uuid.UUID, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    exam = instructor_exam(db, exam_id, user)
    db.query(Exam).filter(Exam.id == exam_id).with_for_update().one()
    if exam.published_at:
        return {"id": exam.id, "published_at": exam.published_at}
    if exam.opens_at <= utcnow():
        raise HTTPException(409, "Publish before the exam opens.")
    items = db.query(ExamItem).filter(ExamItem.exam_id == exam_id).order_by(ExamItem.position).all()
    restricted = exam.restricted_course_id is not None
    activities = {activity.id: activity for activity in db.query(LearningActivity).filter(
        LearningActivity.id.in_([item.activity_id for item in items]),
    ).order_by(LearningActivity.id).with_for_update().populate_existing()}
    expected_status = ReviewState.draft if restricted else ReviewState.published
    for item in items:
        activity = activities.get(item.activity_id)
        if (activity is None or activity.review_status != expected_status or activity.exam_only != restricted
                or activity.archived_at is not None or (restricted and activity.course_id != exam.restricted_course_id)
                or not may_manage_instructional_content(db, user, activity.course_id, activity.created_by)):
            raise HTTPException(409, "Every exam activity must still be available for this exam type.")
        snapshot = {"kind": activity.activity_type.value, "title": activity.title or activity.topic_concept,
                    "problem_statement": activity.problem_statement or "", "starter_code": activity.starter_code or "",
                    "reference_solution_code": activity.reference_solution_code or "", "xp_reward": activity.xp_reward,
                    "pass_mark_percent": activity.pass_mark_percent,
                    "language": activity.language.value, "quiz_questions_json": activity.quiz_questions_json}
        if activity.activity_type == ActivityKind.quiz:
            try:
                questions = parse_quiz_questions(activity.quiz_questions_json)
            except ValueError as exc:
                raise HTTPException(409, "A quiz has invalid questions.") from exc
            if restricted and not 3 <= len(questions) <= 10:
                raise HTTPException(409, "Exam-only quizzes need 3 to 10 complete questions.")
        else:
            tests = db.query(TestCase).filter(TestCase.activity_id == activity.id).order_by(TestCase.order_index).all()
            verified = challenge_is_verified(activity) if restricted else activity.judge0_verified
            if not verified or not tests or not any(not t.is_hidden for t in tests):
                raise HTTPException(409, "Every code task needs verified tests and a visible sample.")
            snapshot["test_cases"] = [
                {"id": str(t.id), "order_index": t.order_index, "stdin": t.stdin,
                 "expected_stdout": t.expected_stdout, "time_limit_ms": t.time_limit_ms,
                 "memory_limit_kb": t.memory_limit_kb, "is_hidden": t.is_hidden, "weight": t.weight}
                for t in tests
            ]
        item.snapshot_json = snapshot
    exam.published_at = utcnow()
    members = db.query(WorkshopMember.profile_id).join(
        ExamAssignment, ExamAssignment.workshop_id == WorkshopMember.workshop_id
    ).filter(ExamAssignment.exam_id == exam.id)
    if restricted:
        members = members.filter(WorkshopMember.profile_id.in_(db.query(CourseMember.profile_id).filter(
            CourseMember.course_id == exam.restricted_course_id,
            CourseMember.member_role == "student", CourseMember.status == "active",
        )))
    member_ids = members.distinct().all()
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
def release_exam(exam_id: uuid.UUID, request: Request, user: Profile = Depends(require_instructor), db: Session = Depends(get_db)):
    exam = instructor_exam(db, exam_id, user)
    db.query(Exam).filter(Exam.id == exam_id).with_for_update().populate_existing().one()
    retake_close = db.query(func.max(ExamRetakeGrant.closes_at)).filter(ExamRetakeGrant.exam_id == exam.id).scalar()
    if exam.published_at is None or utcnow() < max(exam.closes_at, retake_close or exam.closes_at):
        raise HTTPException(409, "Results can be released after the exam window closes.")
    unfinished = {state for (state,) in db.query(ExamAttempt.status).filter(
        ExamAttempt.exam_id == exam.id, ExamAttempt.status.in_(["active", "grading", "failed"]),
    ).distinct()}
    if "failed" in unfinished:
        raise HTTPException(409, "Retry failed grading attempts before releasing results.")
    if unfinished:
        raise HTTPException(409, "Wait for all attempts to finish grading.")
    unreleased = db.query(ExamAttempt.id).filter(ExamAttempt.exam_id == exam.id,
        ExamAttempt.status == "submitted",
        ExamAttempt.result_released_at.is_(None)).first()
    if unreleased:
        release_time = utcnow()
        newly_released_attempts = db.query(ExamAttempt).filter(
            ExamAttempt.exam_id == exam.id,
            ExamAttempt.status == "submitted",
            ExamAttempt.submitted_at <= release_time,
            ExamAttempt.result_released_at.is_(None),
        ).order_by(ExamAttempt.submitted_at, ExamAttempt.id).all()
        student_ids = {attempt.student_id for attempt in newly_released_attempts}
        for student_id in sorted(student_ids):
            student = db.query(Profile).filter(Profile.id == student_id).with_for_update().one()
            for released_attempt in newly_released_attempts:
                if released_attempt.student_id != student_id:
                    continue
                result = dict(released_attempt.result_json or {})
                if not result.get("xp_released"):
                    awards = exam_completion_awards(db, released_attempt)
                    total = sum(awards.values())
                    grant_xp(student, total)
                    result.update(xp_released=True, pending_xp=total, activity_xp_awards=awards)
                    released_attempt.result_json = result
                released_attempt.result_released_at = release_time
                db.flush()
            evaluate_and_award_badges(db, student)

        exam.results_released_at = release_time
        students = [(student_id,) for student_id in student_ids]
        for (student_id,) in students:
            db.add(NotificationOutbox(recipient_id=student_id,
                dedupe_key=f"exam-release:{exam.id}:{exam.results_released_at.isoformat()}:{student_id}",
                subject=f"Exam results released: {exam.title}",
                body=f"Results for {exam.title} are available in ByteQuest. Sign in to view them."))
        db.commit()
        # The release is authoritative. Optional shadow scoring runs only after
        # commit and cannot undo or delay the released results.
        try:
            _score_released_exam(db, request, exam, newly_released_attempts)
        except Exception:
            db.rollback()
            logger.exception("Optional exam-release prediction failed after results were committed.")
    return {"released_at": exam.results_released_at}


@router.post("/instructor/{exam_id}/attempts/{attempt_id}/retry-grading", status_code=202)
def retry_exam_grading(exam_id: uuid.UUID, attempt_id: uuid.UUID, user: Profile = Depends(require_instructor),
                       db: Session = Depends(get_db)):
    instructor_exam(db, exam_id, user)
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.id == attempt_id, ExamAttempt.exam_id == exam_id,
    ).with_for_update().first()
    if attempt is None:
        raise HTTPException(404, "Exam attempt not found.")
    if attempt.status == "failed":
        attempt.status = "grading"
        attempt.grading_attempts = 0
        attempt.grading_claimed_at = None
        attempt.grading_token = None
        attempt.grading_retry_at = None
        db.commit()
    elif attempt.status != "grading":
        raise HTTPException(409, "Only failed grading attempts can be retried.")
    return {"status": attempt.status}


def _score_released_exam(db: Session, request: Request, exam: Exam, attempts: list[ExamAttempt]) -> None:
    if getattr(request.app.state, "ml_shadow_status", "") != "ready":
        return
    item_courses = {course_id for (course_id,) in db.query(LearningActivity.course_id).join(
        ExamItem, ExamItem.activity_id == LearningActivity.id
    ).filter(ExamItem.exam_id == exam.id).all()}
    if len(item_courses) != 1:
        return
    course_id = next(iter(item_courses))
    if course_id is None or exam.id not in course_exam_ids(db, course_id):
        return
    latest_by_student: dict[uuid.UUID, ExamAttempt] = {}
    for attempt in attempts:
        previous = latest_by_student.get(attempt.student_id)
        if previous is None or attempt.submitted_at > previous.submitted_at:
            latest_by_student[attempt.student_id] = attempt
    for student_id, released_attempt in latest_by_student.items():
        student = db.get(Profile, student_id)
        if student is None:
            continue
        target = next_course_activity(db, student, course_id)
        record_shadow_prediction(
            db, student=student, target_activity_id=target.id if target else None,
            source_exam_attempt=released_attempt, as_of=released_attempt.result_released_at,
            shadow_ready=True,
        )


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
    now = utcnow()
    cards = []
    for exam, number, latest, grant in _assigned_exams_with_state(db, user.id):
        window, can_start = _exam_access(exam, latest, grant, now)
        cards.append({
            "id": exam.id, "title": exam.title, "exam_number": number, "added_at": exam.published_at,
            "opens_at": window.opens_at, "closes_at": window.closes_at, "duration_minutes": window.duration_minutes,
            "can_start": can_start, "can_resume": bool(latest and latest.status == "active" and now < latest.due_at),
            "results_released": bool(latest and latest.result_released_at),
        })
    return cards


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
    now = utcnow()
    window, can_start = _exam_access(exam, latest, grant, now)
    numbered = assigned_exam_numbers(db, user.id)
    number = db.query(numbered.c.exam_number).filter(numbered.c.id == exam_id).scalar()
    return {"id": exam.id, "title": exam.title, "opens_at": window.opens_at, "closes_at": window.closes_at,
            "exam_number": number, "added_at": exam.published_at,
            "duration_minutes": window.duration_minutes,
            "server_now": now,
            "can_start": can_start,
            "latest_attempt_id": latest.id if latest else None,
            "latest_status": latest.status if latest else None,
            "results_released": bool(latest and latest.result_released_at)}


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


def own_attempt(db: Session, attempt_id: uuid.UUID, user: Profile, *, lock: bool = False) -> ExamAttempt:
    query = db.query(ExamAttempt).join(Exam, Exam.id == ExamAttempt.exam_id).filter(
        ExamAttempt.id == attempt_id, ExamAttempt.student_id == user.id,
        _student_exam_course_clause(user.id),
    )
    if lock:
        query = query.with_for_update(of=ExamAttempt)
    attempt = query.first() if user.role == UserRole.student else None
    if attempt is None:
        raise HTTPException(404, "Exam attempt not found.")
    return attempt


@router.get("/attempts/{attempt_id}")
def get_attempt(attempt_id: uuid.UUID, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    attempt = own_attempt(db, attempt_id, user)
    exam = db.get(Exam, attempt.exam_id)
    now = utcnow()
    answer_window = attempt.status == "active" and now < answers_accepted_until(attempt)
    show_items = exam.restricted_course_id is None or answer_window
    items = db.query(ExamItem).filter(ExamItem.exam_id == exam.id).order_by(ExamItem.position).all() if show_items else []
    released = bool(attempt.result_released_at)
    result = None
    if released and attempt.status == "submitted" and attempt.result_json is not None:
        # Older result rows may contain solutions. Retakes use the same frozen items.
        result = {
            "score": attempt.score,
            "max_score": attempt.max_score,
            "items": [
                {key: item[key] for key in ("item_id", "points_earned", "points_possible")}
                for item in attempt.result_json.get("items", [])
            ],
        }
    return {"id": attempt.id, "exam_id": exam.id, "title": exam.title,
            "user_id": attempt.student_id, "student_id": attempt.student_id,
            "status": "grading" if attempt.status == "active" and not answer_window else attempt.status,
            "due_at": attempt.due_at,
            "answers_accepted_until": answers_accepted_until(attempt),
            "server_now": now,
            "revision": attempt.revision, "last_saved_at": attempt.last_saved_at,
            "answers": attempt.answers_json if show_items else {}, "items": [public_item(i) for i in items],
            "results_released": released,
            "result": result,
            "score": attempt.score if released and attempt.status == "submitted" else None}


class SaveAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0)
    answers: dict[str, Any] = Field(max_length=30)


@router.put("/attempts/{attempt_id}/answers")
def save_answers(attempt_id: uuid.UUID, body: SaveAnswers,
                 user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    attempt = own_attempt(db, attempt_id, user, lock=True)
    if attempt.status != "active" or utcnow() >= answers_accepted_until(attempt):
        raise HTTPException(409, detail={"code": "attempt_expired",
            "message": "Exam time has ended; the latest saved work will be submitted."})
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
    attempt = own_attempt(db, attempt_id, user, lock=True)
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
    snapshot = item.snapshot_json
    cases = [TestCaseInput(test_case_id=t["id"], order_index=t["order_index"], stdin=t["stdin"],
        expected_stdout=t["expected_stdout"], time_limit_ms=t["time_limit_ms"],
        memory_limit_kb=t["memory_limit_kb"], is_hidden=False, weight=t["weight"])
        for t in snapshot["test_cases"] if not t["is_hidden"]]
    # Use the request's connection for quota and release it before waiting for Judge0.
    reserve("exam_sample", user.id, session=db)
    db.add(ExamSampleRun(student_id=user.id, exam_attempt_id=attempt.id))
    db.commit()
    from app.models.entities import ProgrammingLang
    summary = anyio.from_thread.run(judge0_client.evaluate_submission,
        ProgrammingLang(snapshot["language"]), body.source_code, cases)
    return {"evaluation": summary}

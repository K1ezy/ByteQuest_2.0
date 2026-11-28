"""Gamification insights and class performance."""

from __future__ import annotations

import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import ActivityAttempt, ActivityKind, CourseMember, HintUse, LearningActivity, Profile, ReviewState
from app.services.course_access import resolve_workspace_course
from app.services.workspace_common import activity_state, as_aware, iso
from app.services.attempt_visibility import practice_attempt_clause
from app.services.workspace_queries import SCORE_BANDS, STUCK_ATTEMPTS, activity_health, practice_cells, score_band_index, class_snapshot, enrolled_students, practice_attempts_by_student, published_activity_ids, scoped_activities, workshop_languages_by_profile
from app.services.gamification.insights import GamificationInsights, course_insights
from app.services.gamification.quiz_content import parse_quiz_questions
from app.services.gamification.sequencer import QUIZ_MASTERY_SCORE
from app.services.pass_mark import PRACTICE_PASS_MARK
from app.api.faculty.common import faculty_user, _course_brief, _course_for_activity, _load_activity

router = APIRouter()

# ---------------------------------------------------------------------------
# Gamification insights
# ---------------------------------------------------------------------------
@router.get("/gamification-insights", response_model=GamificationInsights)
def gamification_insights(
    course_id: Optional[uuid.UUID] = None,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
) -> GamificationInsights:
    """Class-level engagement, solve quality, help-seeking, recovery and recall retention.

    Same scope as Performance: an assigned instructor's course; aggregates only.
    """
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    return course_insights(db, course)


# ---------------------------------------------------------------------------
# Performance
# ---------------------------------------------------------------------------
@router.get("/performance")
def performance(
    course_id: Optional[uuid.UUID] = None,
    activity_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    stuck_only: bool = False,
    inactive: bool = False,
    not_started: bool = False,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    course_activities = [item for item in scoped_activities(db, [course.id])
                         if item.review_status == ReviewState.published and item.archived_at is None]
    if activity_id is not None:
        selected = next((item for item in course_activities if item.id == activity_id), None)
        if selected is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That activity is not part of this course."})
        activity_ids = [selected.id]
    else:
        activity_ids = [item.id for item in course_activities]
    students = enrolled_students(db, course.id)
    stats = practice_attempts_by_student(db, activity_ids, [student.id for student in students])
    languages = workshop_languages_by_profile(db, [student.id for student in students])

    as_of = datetime.now(timezone.utc)
    latest_course_stats = stats
    if (inactive or not_started) and activity_id:
        latest_course_stats = practice_attempts_by_student(db, [a.id for a in course_activities], [s.id for s in students])
    needle = (search or "").strip().casefold()
    rows = []
    for student in students:
        if not_started and student.id in latest_course_stats:
            continue
        if inactive:
            last = as_aware(latest_course_stats.get(student.id, {}).get("latest_at"))
            if last is None or last >= as_of - timedelta(days=7):
                continue
        if needle and needle not in (student.username or "").casefold() and needle not in (student.display_name or "").casefold():
            continue
        entry = stats.get(student.id, {"completed": 0, "attempts": 0, "latest_score": None, "latest_at": None})
        if stuck_only and activity_id is not None and (entry["completed"] or entry["attempts"] < STUCK_ATTEMPTS):
            continue
        rows.append(
            {
                "student_id": str(student.id),
                "pseudonym": student.pseudonym_id,
                "username": student.username,
                "display_name": student.display_name,
                "workshop_languages": [language.value for language in languages[student.id]],
                "completed_count": entry["completed"],
                "total_activities": len(activity_ids),
                "attempt_count": entry["attempts"],
                "latest_score": round(float(entry["latest_score"]), 1) if entry["latest_score"] is not None else None,
                "latest_at": iso(entry["latest_at"]),
            }
        )
    rows.sort(key=lambda item: item["pseudonym"] or "")
    average_score = None
    scored = [item["latest_score"] for item in rows if item["latest_score"] is not None]
    if scored:
        average_score = round(sum(scored) / len(scored), 1)
    snapshot = class_snapshot(db, course.id, as_of=as_of)
    return {
        "course": _course_brief(course),
        "activities": [
            {
                "activity_id": str(item.id),
                "title": item.title or item.topic_concept,
                "state": activity_state(item),
            }
            for item in course_activities
        ],
        "summary": {
            "active_learners": len(students),
            "published_activities": snapshot["published_activities"],
            "average_score": snapshot["average_score"] if activity_id is None else average_score,
            "latest_activity_title": snapshot["latest_activity_title"] if activity_id is None else selected.title or selected.topic_concept,
            "average_completion_percent": snapshot["average_completion_percent"],
            "need_follow_up": snapshot["need_follow_up"],
            "as_of": iso(as_of),
            "selected_activity_id": str(activity_id) if activity_id else None,
        },
        "students": rows,
        "empty_reason": None if students else "No students are enrolled in this course yet.",
    }


@router.get("/performance/students/{student_id}")
def student_performance(
    student_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = None,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    enrollment = (
        db.query(CourseMember)
        .filter(
            CourseMember.course_id == course.id,
            CourseMember.profile_id == student_id,
            CourseMember.member_role == "student",
            CourseMember.status == "active",
        )
        .first()
    )
    if enrollment is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That student is not enrolled in this course."})
    student = db.query(Profile).filter(Profile.id == student_id).first()
    if student is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That student is not enrolled in this course."})
    course_activities = (
        db.query(LearningActivity)
        .filter(
            LearningActivity.course_id == course.id,
            LearningActivity.review_status == ReviewState.published,
            LearningActivity.archived_at.is_(None),
        )
        .all()
    )
    activity_by_id = {item.id: item for item in course_activities}
    evidence = db.query(ActivityAttempt).filter(
        ActivityAttempt.student_id == student.id,
        ActivityAttempt.activity_id.in_(activity_by_id),
        practice_attempt_clause(),
    )
    completed = 0
    attempts = []
    if activity_by_id:
        completed = evidence.with_entities(func.count(func.distinct(ActivityAttempt.activity_id))).filter(
            ActivityAttempt.is_successful.is_(True),
        ).scalar() or 0
        attempts = evidence.order_by(ActivityAttempt.created_at.desc(), ActivityAttempt.id.desc()).limit(50).all()
    return {
        "student": {
            "student_id": str(student.id),
            "pseudonym": student.pseudonym_id,
            "username": student.username,
            "display_name": student.display_name,
            "workshop_languages": [language.value for language in student.workshop_languages],
            "xp_points": student.xp_points,
            "current_level": student.current_level,
        },
        "course": _course_brief(course),
        "progress": {
            "completed": completed,
            "total": len(course_activities),
            "percent": round(
                completed / len(course_activities) * 100
            )
            if course_activities
            else 0,
        },
        "attempts": [
            {
                "attempt_id": str(attempt.id),
                "activity_id": str(attempt.activity_id),
                "title": activity_by_id.get(attempt.activity_id).title
                if activity_by_id.get(attempt.activity_id)
                else "Activity",
                "activity_type": getattr(activity_by_id.get(attempt.activity_id).activity_type, "value", "challenge")
                if activity_by_id.get(attempt.activity_id)
                else "challenge",
                "score_percentage": round(float(attempt.score_percentage), 1),
                "is_successful": bool(attempt.is_successful),
                "xp_awarded": attempt.xp_awarded,
                "created_at": iso(attempt.created_at),
                "attempt_number": attempt.attempt_number,
                "error_category": attempt.error_category,
                # Challenge source only; quiz attempts store no code.
                "submitted_code": attempt.submitted_code,
            }
            for attempt in attempts
        ],
    }


@router.get("/gradebook")
def gradebook(
    course_id: Optional[uuid.UUID] = None,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    """Learner x activity grid for one course: attempts, best score and pass per cell."""
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    activities = (
        db.query(LearningActivity)
        .filter(
            LearningActivity.course_id == course.id,
            LearningActivity.review_status == ReviewState.published,
            LearningActivity.archived_at.is_(None),
        )
        .order_by(LearningActivity.sequence_order, LearningActivity.id)
        .all()
    )
    students = enrolled_students(db, course.id)
    activity_ids = [item.id for item in activities]
    cells = practice_cells(db, activity_ids, [student.id for student in students])
    health = activity_health(cells, activity_ids)
    return {
        "course": _course_brief(course),
        "stuck_after_attempts": STUCK_ATTEMPTS,
        "activities": [
            {
                "activity_id": str(item.id),
                "title": item.title or item.topic_concept,
                "activity_type": getattr(item.activity_type, "value", item.activity_type),
                **health[item.id],
            }
            for item in activities
        ],
        "students": [
            {
                "student_id": str(student.id),
                "pseudonym": student.pseudonym_id,
                "username": student.username,
                "display_name": student.display_name,
                "passed_count": sum(1 for cell in cells[student.id].values() if cell["passed"]),
                "stuck_count": sum(1 for cell in cells[student.id].values() if cell["stuck"]),
                "cells": cells[student.id],
            }
            for student in students
        ],
    }


ERROR_LABELS = {
    "syntax_error": "Compilation or syntax error",
    "logic_error": "Wrong output",
    "runtime_error": "Runtime error",
    "timeout": "Time limit exceeded",
    "none": "No error type recorded",
    "other": "Other grading error",
}


def _first_try_questions(db: Session, activity: LearningActivity, attempts) -> list[dict]:
    try:
        questions = parse_quiz_questions(activity.quiz_questions_json)
    except ValueError:
        return []
    # A missing record is unknown. An empty object is a recorded, unanswered attempt.
    responses = [
        answers for (answers,) in db.execute(
            select(attempts.c.quiz_answers_json).where(attempts.c.practice_number == 1)
        )
        if isinstance(answers, dict)
    ]
    return [
        {
            "question_id": question.id,
            "prompt": question.prompt,
            "correct": sum(
                str(answers.get(question.id, "")).casefold() == question.correct_answer.casefold()
                for answers in responses
            ),
            "recorded": len(responses),
        }
        for question in questions
    ]


@router.get("/activities/{activity_id}/analysis")
def activity_analysis(
    activity_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    activity = _load_activity(db, activity_id, include_test_cases=False)
    course = _course_for_activity(db, user, activity)
    if activity.id not in published_activity_ids(db, [course.id]):
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "This activity is not published."})

    student_ids = [student.id for student in enrolled_students(db, course.id)]
    is_quiz = activity.activity_type == ActivityKind.quiz
    # Number practice attempts after filtering. Exam rows share the stored
    # attempt-number sequence and would otherwise change the first-try metrics.
    attempts = select(
        ActivityAttempt.student_id,
        ActivityAttempt.score_percentage,
        ActivityAttempt.is_successful,
        ActivityAttempt.quiz_answers_json,
        func.row_number().over(
            partition_by=ActivityAttempt.student_id, order_by=ActivityAttempt.attempt_number,
        ).label("practice_number"),
    ).where(
        ActivityAttempt.activity_id == activity.id,
        ActivityAttempt.student_id.in_(student_ids),
        practice_attempt_clause(),
    ).subquery()
    by_student = db.execute(
        select(
            attempts.c.student_id,
            func.count(),
            func.max(attempts.c.score_percentage),
            func.min(attempts.c.practice_number).filter(attempts.c.is_successful),
        ).group_by(attempts.c.student_id)
    ).all() if student_ids else []

    passers = {student_id: first_pass for student_id, _, _, first_pass in by_student if first_pass is not None}
    bands = [0] * len(SCORE_BANDS)
    for _, _, best, _ in by_student:
        bands[score_band_index(best)] += 1

    errors: Counter[str] = Counter()
    hint_use = None
    if not is_quiz:
        if student_ids:
            for category, count in db.execute(
                select(ActivityAttempt.error_category, func.count()).where(
                    ActivityAttempt.activity_id == activity.id,
                    ActivityAttempt.student_id.in_(student_ids),
                    practice_attempt_clause(),
                    ActivityAttempt.is_successful.is_(False),
                ).group_by(ActivityAttempt.error_category)
            ):
                errors[category if category in ERROR_LABELS else "other"] += count
        hint_users = set(db.scalars(
            select(HintUse.student_id).where(
                HintUse.activity_id == activity.id, HintUse.student_id.in_(student_ids),
            ).distinct()
        )) if student_ids else set()
        hint_use = {"learners": len(hint_users), "passed": len(hint_users.intersection(passers))}

    attempted = len(by_student)
    result = {
        "generated_at": iso(datetime.now(timezone.utc)),
        "activity_id": str(activity.id),
        "title": activity.title or activity.topic_concept,
        "activity_type": activity.activity_type.value,
        "course": _course_brief(course),
        "class_size": len(student_ids),
        "attempted": attempted,
        "passed": len(passers),
        "pass_rate": len(passers) / attempted if attempted else None,
        "first_try_pass_rate": sum(n == 1 for n in passers.values()) / attempted if attempted else None,
        "median_attempts_to_pass": median(passers.values()) if passers else None,
        "stuck": sum(count >= STUCK_ATTEMPTS and first_pass is None for _, count, _, first_pass in by_student),
        "stuck_after_attempts": STUCK_ATTEMPTS,
        "not_started": len(student_ids) - attempted,
        "score_distribution": [{"label": label, "count": count} for label, count in zip(SCORE_BANDS, bands)],
        "error_categories": [
            {"category": category, "label": ERROR_LABELS[category], "count": count}
            for category, count in sorted(errors.items(), key=lambda item: (-item[1], item[0]))
        ],
        "hint_use": hint_use,
        "pass_mark_percent": QUIZ_MASTERY_SCORE if is_quiz else (activity.pass_mark_percent or PRACTICE_PASS_MARK),
        "excludes_exam_attempts": True,
    }
    if is_quiz:
        result["questions"] = _first_try_questions(db, activity, attempts) if attempted else []
    return result

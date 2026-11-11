"""Course-scoped faculty history and advisory ML snapshots."""

from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import (
    ActivityAttempt,
    LearningActivity,
    MLPrediction,
    Profile,
    ReviewState,
)
from app.services.attempt_visibility import learner_visible_attempt_clause
from app.services.course_access import (
    require_course_instructor,
    resolve_workspace_course,
)
from app.services.ml_predictor.consent import consented_student_ids
from app.services.ml_predictor.exam_history import (
    course_exam_ids,
    released_exam_history,
)
from app.services.ml_predictor.thresholds import classify_success, recommended_action
from app.services.settings_service import get_setting_int
from app.services.workspace_common import course_reference, iso
from app.services.workspace_queries import enrolled_students

router = APIRouter(prefix="/api/v1/faculty/ml", tags=["Faculty Machine Learning"])


def _faculty(user: Annotated[Profile, Depends(get_current_user)]) -> Profile:
    return require_course_instructor(user)


def _forecast(prediction: MLPrediction | None, target: LearningActivity | None) -> dict | None:
    if prediction is None or target is None or prediction.selected_model not in {"logreg", "random_forest"}:
        return None
    probability = float(prediction.logreg_prob if prediction.selected_model == "logreg" else prediction.rf_prob)
    action = recommended_action(probability)
    label = {"advance_next_level": "Likely to pass", "standard_next": "Continue practicing",
             "remedial_practice": "May need support"}[action]
    return {
        "id": str(prediction.id), "target_activity_id": str(target.id),
        "target_activity": target.title or target.topic_concept,
        "probability": round(probability, 3),
        "label": label,
        "predicted_pass": classify_success(probability),
        "model_version": prediction.model_version,
        "selected_model": prediction.selected_model,
        "as_of": iso(prediction.created_at),
        "actual_outcome": prediction.actual_outcome,
        "advisory": "Advisory only; grades, rewards and access are unchanged.",
    }


def _trend(events: list[dict]) -> list[dict]:
    daily: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for event in events:
        if event["at"]:
            daily[event["at"][:10]][event["kind"]].append(event["score_percentage"])
    return [{"date": day, **{kind: round(sum(kinds[kind]) / len(kinds[kind]), 1) if kinds[kind] else None
                              for kind in ("quiz", "challenge", "exam")}}
            for day, kinds in sorted(daily.items())]


def _course_data(db: Session, request: Request, user: Profile, course_id: uuid.UUID | None) -> dict:
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    students = enrolled_students(db, course.id)
    student_ids = [student.id for student in students]
    course_activities = db.query(LearningActivity).filter(
        LearningActivity.course_id == course.id,
    ).order_by(LearningActivity.sequence_order, LearningActivity.id).all()
    activity_by_id = {activity.id: activity for activity in course_activities}
    activities = [activity for activity in course_activities
                  if activity.review_status == ReviewState.published
                  and activity.closed_at is None and activity.archived_at is None]
    attempts = db.query(ActivityAttempt).filter(
        ActivityAttempt.student_id.in_(student_ids),
        ActivityAttempt.activity_id.in_(list(activity_by_id)),
        ActivityAttempt.exam_attempt_id.is_(None),
    ).order_by(ActivityAttempt.created_at, ActivityAttempt.id).all() if student_ids and course_activities else []
    by_student: dict[uuid.UUID, list[dict]] = defaultdict(list)
    successful: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
    topic_history: dict[tuple[uuid.UUID, str], set[uuid.UUID]] = defaultdict(set)
    for attempt in attempts:
        activity = activity_by_id[attempt.activity_id]
        kind = getattr(activity.activity_type, "value", activity.activity_type)
        by_student[attempt.student_id].append({
            "kind": kind, "title": activity.title or activity.topic_concept,
            "score_percentage": round(float(attempt.score_percentage), 1),
            "at": iso(attempt.created_at), "activity_id": str(activity.id),
        })
        topic_history[(attempt.student_id, str(activity.topic_concept).strip().casefold())].add(activity.id)
        if attempt.is_successful:
            successful[attempt.student_id].add(activity.id)
    if student_ids and activities:
        visible_successes = db.query(ActivityAttempt.student_id, ActivityAttempt.activity_id).filter(
            ActivityAttempt.student_id.in_(student_ids),
            ActivityAttempt.activity_id.in_(list(activity_by_id)),
            ActivityAttempt.is_successful.is_(True),
            learner_visible_attempt_clause(),
        ).distinct().all()
        for student_id, activity_id in visible_successes:
            successful[student_id].add(activity_id)

    predictions = db.query(MLPrediction).filter(
        MLPrediction.student_id.in_(student_ids),
        MLPrediction.target_activity_id.in_(list(activity_by_id)),
    ).order_by(MLPrediction.created_at.desc(), MLPrediction.id.desc()).all() if student_ids and course_activities else []
    predictions_by_student: dict[uuid.UUID, list[MLPrediction]] = defaultdict(list)
    for prediction in predictions:
        predictions_by_student[prediction.student_id].append(prediction)
    consented = consented_student_ids(db, student_ids)
    ready = getattr(request.app.state, "ml_shadow_status", "disabled") == "ready"
    required_history = get_setting_int(db, "prediction_min_history", 3)
    rows = []
    details = {}
    all_events = []
    labeled = 0
    correct = 0
    eligible_exam_ids = course_exam_ids(db, course.id) if students else set()
    for student in students:
        history = list(by_student[student.id])
        for exam in released_exam_history(db, student.id, course.id, exam_ids=eligible_exam_ids):
            history.append({"kind": "exam", "title": exam["title"],
                            "score_percentage": exam["score_percentage"], "at": iso(exam["created_at"]),
                            "exam_attempt_id": exam["exam_attempt_id"]})
        history.sort(key=lambda item: (item["at"] or "", item.get("activity_id", item.get("exam_attempt_id", ""))))
        all_events.extend(history)
        target = next((activity for activity in activities
                       if activity.id not in successful[student.id]
                       and activity.language == student.enrolled_language), None)
        current = next((prediction for prediction in predictions_by_student[student.id]
                        if target and prediction.target_activity_id == target.id
                        and prediction.actual_outcome is None
                        and prediction.selected_model in {"logreg", "random_forest"}), None)
        if not history:
            status = "no_graded_history"
        elif target is None:
            status = "no_next_activity"
        elif student.id not in consented:
            status = "missing_consent"
        elif len(topic_history[(student.id, str(target.topic_concept).strip().casefold())]) < required_history:
            status = "insufficient_history"
        elif not ready:
            status = "model_unavailable"
        elif current is None:
            status = "no_saved_prediction"
        else:
            status = "saved"
        forecast = _forecast(current, target) if status == "saved" else None
        scores = [event["score_percentage"] for event in history]
        row = {
            "student_id": str(student.id), "display_name": student.display_name,
            "username": student.username, "average_score": round(sum(scores) / len(scores), 1) if scores else None,
            "latest_score": history[-1]["score_percentage"] if history else None,
            "quiz_count": sum(event["kind"] == "quiz" for event in history),
            "challenge_count": sum(event["kind"] == "challenge" for event in history),
            "exam_count": sum(event["kind"] == "exam" for event in history),
            "forecast_status": status, "forecast": forecast,
            "target_activity": (target.title or target.topic_concept) if target else None,
        }
        rows.append(row)
        prediction_history = []
        if student.id in consented:
            for prediction in predictions_by_student[student.id]:
                item = _forecast(prediction, activity_by_id.get(prediction.target_activity_id))
                if item:
                    prediction_history.append(item)
                elif prediction.selected_model is None:
                    target_activity = activity_by_id.get(prediction.target_activity_id)
                    if target_activity:
                        prediction_history.append({
                            "id": str(prediction.id), "status": "legacy",
                            "target_activity": target_activity.title or target_activity.topic_concept,
                            "probability": None, "model_version": prediction.model_version,
                            "as_of": iso(prediction.created_at), "actual_outcome": prediction.actual_outcome,
                            "label": "Legacy prediction — selected model unknown",
                        })
        details[student.id] = {"student": row, "history": history,
                               "trend": _trend(history), "predictions": prediction_history}
        if student.id in consented:
            for prediction in predictions_by_student[student.id]:
                if prediction.actual_outcome is None or prediction.selected_model not in {"logreg", "random_forest"}:
                    continue
                labeled += 1
                selected_prediction = prediction.logreg_pred if prediction.selected_model == "logreg" else prediction.rf_pred
                correct += int(bool(selected_prediction) == bool(prediction.actual_outcome))

    trend = _trend(all_events)
    scores = [event["score_percentage"] for event in all_events]
    return {"course": course_reference(course), "students": rows, "details": details,
            "readiness": {"status": "ready" if ready else getattr(request.app.state, "ml_shadow_status", "disabled")},
            "summary": {"active_learners": len(students), "graded_events": len(all_events),
                        "average_score": round(sum(scores) / len(scores), 1) if scores else None,
                        "forecast_count": sum(row["forecast_status"] == "saved" for row in rows),
                        "need_support": sum(row["forecast"] is not None and row["forecast"]["label"] == "May need support" for row in rows)},
            "trend": trend, "model_quality": {"labeled_predictions": labeled,
                                               "accuracy_percent": round(correct / labeled * 100, 1) if labeled else None}}


@router.get("")
def dashboard(request: Request, user: Annotated[Profile, Depends(_faculty)],
              db: Annotated[Session, Depends(get_db)], course_id: uuid.UUID | None = None):
    result = _course_data(db, request, user, course_id)
    result.pop("details")
    return result


@router.get("/students/{student_id}")
def student_detail(student_id: uuid.UUID, request: Request,
                   user: Annotated[Profile, Depends(_faculty)],
                   db: Annotated[Session, Depends(get_db)], course_id: uuid.UUID | None = None):
    result = _course_data(db, request, user, course_id)
    detail = result["details"].get(student_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Student is not actively enrolled in this course.")
    return detail

"""Course-scoped faculty history, advisory forecasts and model evaluation.

Every endpoint here is read-only. They report shadow predictions that were
already saved after a committed student event; they never train a model, run
inference, or backfill a prediction once its outcome is known. Rule-based
sequencing stays authoritative for students.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
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
from app.services.ml_predictor.thresholds import (
    ADVANCE_PROBABILITY,
    DECISION_THRESHOLD,
    REMEDIAL_PROBABILITY,
    classify_success,
    recommended_action,
)
from app.services.settings_service import get_setting_int
from app.services.workspace_common import course_reference, iso
from app.services.workspace_queries import enrolled_students

router = APIRouter(prefix="/api/v1/faculty/ml", tags=["Faculty Machine Learning"])

SELECTABLE_MODELS = {"logreg", "random_forest"}
PERIOD_DAYS: dict[str, int | None] = {"7d": 7, "30d": 30, "90d": 90, "all": None}
BAND_LABELS = {
    "advance_next_level": "Likely to pass",
    "standard_next": "Continue practicing",
    "remedial_practice": "May need support",
}
SUPPORT_LABEL = BAND_LABELS["remedial_practice"]
# Daily trend buckets are cut from the UTC ISO timestamps below. The UI states
# this, so a reader never has to guess which midnight a point belongs to.
AGGREGATION_TIMEZONE = "UTC"


def _faculty(user: Annotated[Profile, Depends(get_current_user)]) -> Profile:
    return require_course_instructor(user)


def _topic_key(value: object) -> str:
    return str(value).strip().casefold()


def _period_cutoff(period: str) -> str | None:
    """Return the inclusive ISO lower bound for a validated historical period."""
    if period not in PERIOD_DAYS:
        raise HTTPException(422, "Unknown historical period.")
    days = PERIOD_DAYS[period]
    return None if days is None else iso(datetime.now(timezone.utc) - timedelta(days=days))


def _forecast(prediction: MLPrediction | None, target: LearningActivity | None) -> dict | None:
    if prediction is None or target is None or prediction.selected_model not in SELECTABLE_MODELS:
        return None
    probability = float(
        prediction.logreg_prob if prediction.selected_model == "logreg" else prediction.rf_prob
    )
    return {
        "id": str(prediction.id),
        "target_activity_id": str(target.id),
        "target_activity": target.title or target.topic_concept,
        "target_topic": target.topic_concept,
        "probability": round(probability, 3),
        "label": BAND_LABELS[recommended_action(probability)],
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
    return [
        {
            "date": day,
            **{
                kind: round(sum(kinds[kind]) / len(kinds[kind]), 1) if kinds[kind] else None
                for kind in ("quiz", "challenge", "exam")
            },
        }
        for day, kinds in sorted(daily.items())
    ]


def _course_activities(db: Session, course_id: uuid.UUID) -> list[LearningActivity]:
    return (
        db.query(LearningActivity)
        .filter(LearningActivity.course_id == course_id)
        .order_by(LearningActivity.sequence_order, LearningActivity.id)
        .all()
    )


def _snapshot(
    db: Session,
    request: Request,
    user: Profile,
    course_id: uuid.UUID | None,
    period: str,
    *,
    only_student: uuid.UUID | None = None,
) -> dict:
    """Build course rows, or one enrolled learner's full detail.

    ``only_student`` scopes every attempt, exam and prediction query to that
    learner, so opening a drawer never rebuilds the whole course.
    """
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    roster = enrolled_students(db, course.id)
    enrolled_count = len(roster)
    students = [s for s in roster if s.id == only_student] if only_student is not None else roster
    if only_student is not None and not students:
        raise HTTPException(404, "Student is not actively enrolled in this course.")

    cutoff = _period_cutoff(period)
    want_detail = only_student is not None
    student_ids = [student.id for student in students]

    course_activities = _course_activities(db, course.id)
    activity_by_id = {activity.id: activity for activity in course_activities}
    activities = [
        activity
        for activity in course_activities
        if activity.review_status == ReviewState.published
        and activity.closed_at is None
        and activity.archived_at is None
    ]

    attempts = (
        db.query(ActivityAttempt)
        .filter(
            ActivityAttempt.student_id.in_(student_ids),
            ActivityAttempt.activity_id.in_(list(activity_by_id)),
            ActivityAttempt.exam_attempt_id.is_(None),
        )
        .order_by(ActivityAttempt.created_at, ActivityAttempt.id)
        .all()
        if student_ids and course_activities
        else []
    )
    by_student: dict[uuid.UUID, list[dict]] = defaultdict(list)
    topic_history: dict[tuple, set[uuid.UUID]] = defaultdict(set)
    for attempt in attempts:
        activity = activity_by_id[attempt.activity_id]
        by_student[attempt.student_id].append(
            {
                "kind": getattr(activity.activity_type, "value", activity.activity_type),
                "title": activity.title or activity.topic_concept,
                "score_percentage": round(float(attempt.score_percentage), 1),
                "at": iso(attempt.created_at),
                "activity_id": str(activity.id),
            }
        )
        topic_history[
            (attempt.student_id, activity.language, _topic_key(activity.topic_concept))
        ].add(activity.id)

    # Only learner-visible successes retire an activity, matching
    # next_course_activity(). A row therefore names the same target the shadow
    # predictor scored, so a saved forecast is found instead of looking absent.
    successful: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
    if student_ids and activities:
        visible = (
            db.query(ActivityAttempt.student_id, ActivityAttempt.activity_id)
            .filter(
                ActivityAttempt.student_id.in_(student_ids),
                ActivityAttempt.activity_id.in_(list(activity_by_id)),
                ActivityAttempt.is_successful.is_(True),
                learner_visible_attempt_clause(),
            )
            .distinct()
            .all()
        )
        for student_id, activity_id in visible:
            successful[student_id].add(activity_id)

    predictions = (
        db.query(MLPrediction)
        .filter(
            MLPrediction.student_id.in_(student_ids),
            MLPrediction.target_activity_id.in_(list(activity_by_id)),
        )
        .order_by(MLPrediction.created_at.desc(), MLPrediction.id.desc())
        .all()
        if student_ids and course_activities
        else []
    )
    predictions_by_student: dict[uuid.UUID, list[MLPrediction]] = defaultdict(list)
    for prediction in predictions:
        predictions_by_student[prediction.student_id].append(prediction)

    consented = consented_student_ids(db, student_ids)
    shadow_status = getattr(request.app.state, "ml_shadow_status", "disabled")
    ready = shadow_status == "ready"
    active_version = getattr(request.app.state, "model_version", None)
    required_history = get_setting_int(db, "prediction_min_history", 3)
    eligible_exam_ids = course_exam_ids(db, course.id) if students else set()

    rows: list[dict] = []
    details: dict[uuid.UUID, dict] = {}
    all_events: list[dict] = []
    for student in students:
        full_history = list(by_student[student.id])
        for exam in released_exam_history(db, student.id, course.id, exam_ids=eligible_exam_ids):
            full_history.append(
                {
                    "kind": "exam",
                    "title": exam["title"],
                    "score_percentage": exam["score_percentage"],
                    "at": iso(exam["created_at"]),
                    "exam_attempt_id": exam["exam_attempt_id"],
                }
            )
        full_history.sort(
            key=lambda item: (
                item["at"] or "",
                item.get("activity_id", item.get("exam_attempt_id", "")),
            )
        )
        # The period narrows what is reported. Eligibility, target selection and
        # model inputs deliberately keep reading the unfiltered history.
        history = [
            event for event in full_history if cutoff is None or (event["at"] or "") >= cutoff
        ]
        all_events.extend(history)

        target = next(
            (
                activity
                for activity in activities
                if activity.id not in successful[student.id]
                and activity.language == student.enrolled_language
            ),
            None,
        )
        current = next(
            (
                prediction
                for prediction in predictions_by_student[student.id]
                if target
                and prediction.target_activity_id == target.id
                and prediction.actual_outcome is None
                and prediction.selected_model in SELECTABLE_MODELS
                and (active_version is None or prediction.model_version == active_version)
            ),
            None,
        )
        if not full_history:
            status = "no_graded_history"
        elif target is None:
            status = "no_next_activity"
        elif student.id not in consented:
            status = "missing_consent"
        elif (
            len(topic_history[(student.id, target.language, _topic_key(target.topic_concept))])
            < required_history
        ):
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
            "student_id": str(student.id),
            "display_name": student.display_name,
            "username": student.username,
            "average_score": round(sum(scores) / len(scores), 1) if scores else None,
            "latest_score": history[-1]["score_percentage"] if history else None,
            "quiz_count": sum(event["kind"] == "quiz" for event in history),
            "challenge_count": sum(event["kind"] == "challenge" for event in history),
            "exam_count": sum(event["kind"] == "exam" for event in history),
            "result_count": len(history),
            "forecast_status": status,
            "forecast": forecast,
            "target_activity": (target.title or target.topic_concept) if target else None,
            "target_activity_id": str(target.id) if target else None,
            "target_topic": target.topic_concept if target else None,
        }
        rows.append(row)
        if not want_detail:
            continue

        prediction_history: list[dict] = []
        if student.id in consented:
            for prediction in predictions_by_student[student.id]:
                item = _forecast(prediction, activity_by_id.get(prediction.target_activity_id))
                if item:
                    item["is_current"] = bool(current is not None and prediction.id == current.id)
                    item["from_active_model"] = bool(
                        active_version is not None and prediction.model_version == active_version
                    )
                    prediction_history.append(item)
                elif prediction.selected_model is None:
                    target_activity = activity_by_id.get(prediction.target_activity_id)
                    if target_activity:
                        prediction_history.append(
                            {
                                "id": str(prediction.id),
                                "status": "legacy",
                                "target_activity": target_activity.title
                                or target_activity.topic_concept,
                                "probability": None,
                                "model_version": prediction.model_version,
                                "as_of": iso(prediction.created_at),
                                "actual_outcome": prediction.actual_outcome,
                                "label": "Legacy prediction — selected model unknown",
                                "is_current": False,
                                "from_active_model": False,
                            }
                        )
        topic_attempted = (
            len(topic_history[(student.id, target.language, _topic_key(target.topic_concept))])
            if target
            else 0
        )
        details[student.id] = {
            "course": course_reference(course),
            "student": row,
            "history": history,
            "trend": _trend(history),
            "predictions": prediction_history,
            "evidence": {
                "topic": target.topic_concept if target else None,
                "topic_activities_attempted": topic_attempted,
                "topic_activities_required": required_history,
                "result_count": len(history),
                "period": period,
            },
        }

    forecast_count = sum(row["forecast_status"] == "saved" for row in rows)
    scores = [event["score_percentage"] for event in all_events]
    return {
        "course": course_reference(course),
        "period": period,
        "aggregation_timezone": AGGREGATION_TIMEZONE,
        "students": rows,
        "details": details,
        "readiness": {
            "status": shadow_status,
            "forecasts_available": ready,
            "active_model_version": active_version,
        },
        "summary": {
            "active_learners": enrolled_count,
            "graded_events": len(all_events),
            "average_score": round(sum(scores) / len(scores), 1) if scores else None,
            "forecast_count": forecast_count,
            "forecast_denominator": enrolled_count,
            "need_support": (
                sum(
                    row["forecast"] is not None and row["forecast"]["label"] == SUPPORT_LABEL
                    for row in rows
                )
                if ready
                else None
            ),
        },
        "trend": _trend(all_events),
        "thresholds": {
            "support_below": REMEDIAL_PROBABILITY,
            "likely_at_or_above": ADVANCE_PROBABILITY,
            "decision": DECISION_THRESHOLD,
        },
    }


@router.get("")
def dashboard(
    request: Request,
    user: Annotated[Profile, Depends(_faculty)],
    db: Annotated[Session, Depends(get_db)],
    course_id: uuid.UUID | None = None,
    period: str = "all",
):
    result = _snapshot(db, request, user, course_id, period)
    result.pop("details")
    return result


@router.get("/students/{student_id}")
def student_detail(
    student_id: uuid.UUID,
    request: Request,
    user: Annotated[Profile, Depends(_faculty)],
    db: Annotated[Session, Depends(get_db)],
    course_id: uuid.UUID | None = None,
    period: str = "all",
):
    result = _snapshot(db, request, user, course_id, period, only_student=student_id)
    return result["details"][student_id]


def _accuracy(rows: list[MLPrediction], field: str) -> dict:
    scored = [row for row in rows if getattr(row, field) is not None]
    if not scored:
        return {"labeled": 0, "correct": 0, "accuracy_percent": None}
    correct = sum(bool(getattr(row, field)) == bool(row.actual_outcome) for row in scored)
    return {
        "labeled": len(scored),
        "correct": correct,
        "accuracy_percent": round(correct / len(scored) * 100, 1),
    }


@router.get("/evaluation")
def evaluation(
    request: Request,
    user: Annotated[Profile, Depends(_faculty)],
    db: Annotated[Session, Depends(get_db)],
    course_id: uuid.UUID | None = None,
    model_version: str | None = None,
):
    """Observed outcomes in this course, beside the approved offline report."""
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    students = enrolled_students(db, course.id)
    student_ids = [student.id for student in students]
    consented = consented_student_ids(db, student_ids)
    activity_ids = [activity.id for activity in _course_activities(db, course.id)]

    saved = (
        db.query(MLPrediction)
        .filter(
            MLPrediction.student_id.in_(list(consented)),
            MLPrediction.target_activity_id.in_(activity_ids),
            MLPrediction.selected_model.in_(sorted(SELECTABLE_MODELS)),
        )
        .order_by(MLPrediction.created_at.desc(), MLPrediction.id.desc())
        .all()
        if consented and activity_ids
        else []
    )
    versions: list[str] = []
    for prediction in saved:
        if prediction.model_version and prediction.model_version not in versions:
            versions.append(prediction.model_version)

    active_version = getattr(request.app.state, "model_version", None)
    if model_version is not None:
        if model_version not in versions:
            raise HTTPException(404, "No saved predictions for that model version in this course.")
        selected_version = model_version
    elif active_version in versions:
        selected_version = active_version
    else:
        selected_version = versions[0] if versions else None

    # Versions are never pooled: a mixed count would compare models that were
    # fitted on different data.
    rows = [row for row in saved if row.model_version == selected_version] if selected_version else []
    labeled = [row for row in rows if row.actual_outcome is not None]

    report = getattr(request.app.state, "ml_model_report", None)
    return {
        "course": course_reference(course),
        "observed": {
            "unit": "prediction snapshots",
            "versions": versions,
            "selected_version": selected_version,
            "active_version": active_version,
            "total_predictions": len(rows),
            "awaiting_outcome": len(rows) - len(labeled),
            "labeled_predictions": len(labeled),
            "models": {
                "logreg": _accuracy(labeled, "logreg_pred"),
                "random_forest": _accuracy(labeled, "rf_pred"),
            },
        },
        "offline": {
            "status": "available" if report else "unavailable",
            "report": report,
        },
        "thresholds": {
            "decision": DECISION_THRESHOLD,
            "support_below": REMEDIAL_PROBABILITY,
            "likely_at_or_above": ADVANCE_PROBABILITY,
        },
    }

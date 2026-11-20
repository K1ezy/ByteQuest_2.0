"""Self-referenced progress: a recent period against the one before it and the learner's usual pace.

Counts reuse the existing rules (first practice passes and recoveries from the Codex, hint timing
from solve quality, learner day from the rollout), so the card can never disagree with the rest
of the app. Days are Manila calendar days; a period of N days ends today and includes it.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import func, select, union_all
from sqlalchemy.orm import Session

from app.core.quotas import MANILA
from app.models.entities import ActivityAttempt, ConceptReview, Profile, SubmissionJob, _utcnow
from app.services.gamification.codex import recoveries_for
from app.services.gamification.rollout import first_practice_days, mechanic_state
from app.services.gamification.solve_quality import hint_timing

RECAP_PERIODS = (3, 7, 30)
MIN_COMPARE_EVENTS = 3   # practice events across both periods before a change is worth showing
MIN_PACE_PERIODS = 2     # full earlier periods of history before a "usual pace" is shown

MetricKey = Literal["solved", "self_solved", "recoveries", "recalls", "active_days"]
LABELS: dict[MetricKey, str] = {
    "solved": "Challenges solved",
    "self_solved": "Self-solved",
    "recoveries": "Errors recovered",
    "recalls": "Recalls passed",
    "active_days": "Active days",
}


class RecapMetric(BaseModel):
    key: MetricKey
    label: str
    current: int
    previous: int
    change: int
    usual: float | None  # average per period over earlier full periods; None until there is enough history


# Why a change is (not) shown: "ok", too few events to tell, or the learner had not started
# by the start of the previous period (so that period would undercount them).
Comparison = Literal["ok", "too_little_activity", "new_learner"]


class ProgressRecap(BaseModel):
    days: int
    period_start: date
    period_end: date
    previous_start: date
    previous_end: date
    enough_activity: bool  # comparison == "ok"
    comparison: Comparison
    metrics: list[RecapMetric]


def _manila(moment: datetime) -> date:
    return moment.astimezone(MANILA).date()


def _day(column):
    return func.date(func.timezone("Asia/Manila", column))


def _practice_days(db: Session, student: Profile) -> dict[date, int]:
    """Practice events per Manila day: official attempts, completed sample runs and submitted recalls."""
    events = union_all(
        select(_day(ActivityAttempt.created_at).label("day")).where(
            ActivityAttempt.student_id == student.id, ActivityAttempt.exam_attempt_id.is_(None)),
        select(_day(SubmissionJob.created_at)).where(
            SubmissionJob.student_id == student.id, SubmissionJob.dry_run_only, SubmissionJob.status == "completed"),
        select(_day(ConceptReview.submitted_at)).where(
            ConceptReview.student_id == student.id, ConceptReview.status != "open"),
    ).subquery()
    return dict(db.execute(select(events.c.day, func.count()).group_by(events.c.day)).all())


def progress_recap(db: Session, student: Profile, days: int, now: datetime | None = None) -> ProgressRecap:
    now = now or _utcnow()
    today = _manila(now)
    current_start = today - timedelta(days=days - 1)
    previous_start, previous_end = current_start - timedelta(days=days), current_start - timedelta(days=1)
    first_day = first_practice_days(db, [student.id]).get(student.id)
    full_periods = (current_start - first_day).days // days if first_day else 0
    history_start = current_start - timedelta(days=days * full_periods)
    state = mechanic_state(db, student, now)

    # Each metric is a list of Manila days on which one unit happened.
    happened: dict[MetricKey, list[date]] = defaultdict(list)
    practice = _practice_days(db, student)
    happened["active_days"] = [day for day, count in practice.items() if count]

    passes = recoveries_for(db, [student.id], visible_to=student.id)
    hints = hint_timing(db, [student.id], [activity_id for _, activity_id in passes])
    for key, recovery in passes.items():
        passed_on = _manila(recovery.recovered_at)
        happened["solved"].append(passed_on)
        first_hint = hints.get(key, (None, None))[0]
        if first_hint is None or first_hint > recovery.recovered_at:
            happened["self_solved"].append(passed_on)
        if state.codex.unlocked:
            happened["recoveries"].extend([passed_on] * len(recovery.categories))
    if state.memory.unlocked:
        happened["recalls"] = [
            _manila(submitted_at) for (submitted_at,) in db.query(ConceptReview.submitted_at).filter(
                ConceptReview.student_id == student.id, ConceptReview.language == student.enrolled_language,
                ConceptReview.status == "passed",
            )
        ]

    def count(dates: list[date], start: date, end: date) -> int:
        return sum(start <= day <= end for day in dates)

    keys: list[MetricKey] = ["solved", "self_solved"]
    keys += ["recoveries"] if state.codex.unlocked else []
    keys += ["recalls"] if state.memory.unlocked else []
    keys += ["active_days"]
    metrics = []
    for key in keys:
        current = count(happened[key], current_start, today)
        previous = count(happened[key], previous_start, previous_end)
        usual = (round(count(happened[key], history_start, previous_end) / full_periods, 1)
                 if full_periods >= MIN_PACE_PERIODS else None)
        metrics.append(RecapMetric(key=key, label=LABELS[key], current=current, previous=previous,
                                   change=current - previous, usual=usual))

    recent_events = sum(count_ for day, count_ in practice.items() if previous_start <= day <= today)
    comparison: Comparison = (
        "new_learner" if first_day is None or first_day > previous_start
        else "too_little_activity" if recent_events < MIN_COMPARE_EVENTS
        else "ok"
    )
    return ProgressRecap(
        days=days, period_start=current_start, period_end=today, previous_start=previous_start,
        previous_end=previous_end, enough_activity=comparison == "ok", comparison=comparison, metrics=metrics,
    )

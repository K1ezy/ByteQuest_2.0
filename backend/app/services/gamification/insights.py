"""Class-level gamification insights for one course. Aggregates only: no student identities.

Every rule comes from the student-facing modules (stars, hint timing, recoveries, learner
day, recall stages), so the class view and what learners see can never disagree.
Scope matches the faculty Performance page: active enrolled students x published course activities.
"""

from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from datetime import date, datetime

from pydantic import BaseModel
from sqlalchemy import func, select, union_all
from sqlalchemy.orm import Session

from app.core.quotas import MANILA
from app.models.entities import (
    ActivityAttempt, ActivityKind, ConceptReview, Course, LearningActivity, SubmissionJob, _utcnow,
)
from app.services.gamification.codex import ERROR_LABELS, practice_errors, recoveries_for
from app.services.gamification.memory import MAX_STAGE, REVIEW_INTERVAL_DAYS
from app.services.gamification.rollout import (
    CODEX_UNLOCK_KEY, MEMORY_UNLOCK_KEY, UNLOCK_DEFAULTS, first_practice_days,
)
from app.services.gamification.solve_quality import MAX_STARS, challenge_stars, hint_timing, tried_before_hint
from app.services.settings_service import get_settings_int
from app.services.workspace_queries import enrolled_students, published_activity_ids

WEEKS_SHOWN = 16  # one semester of learner weeks


class WeekPoint(BaseModel):
    week: int          # learner week: 0 is the week of each learner's first practice activity
    eligible: int      # learners whose own timeline has reached this week
    active: int        # of those, learners with at least one practice event that week
    events: int        # attempts, sample runs and recalls on this course's content


class SolveQuality(BaseModel):
    solved: int
    stars: dict[int, int]
    self_solved_rate: float | None


class HelpSeeking(BaseModel):
    hinted: int
    tried_before_hint: int
    rate: float | None


class CategoryCount(BaseModel):
    category: str
    label: str
    failed_tries: int
    recoveries: int


class TopicRecovery(BaseModel):
    topic: str
    students_struggling: int   # had at least one failed try on a challenge in this topic
    students_stuck: int        # failed a challenge in this topic and have not passed it yet
    categories: list[CategoryCount]


class RecallStage(BaseModel):
    stage: int
    interval_days: int
    submitted: int
    passed: int
    pass_rate: float | None


class MemoryRetention(BaseModel):
    submitted: int
    passed: int
    pass_rate: float | None
    stages: list[RecallStage]


class RolloutSchedule(BaseModel):
    codex_unlock_day: int
    memory_unlock_day: int


class GamificationInsights(BaseModel):
    course_id: uuid.UUID
    course_code: str
    course_title: str
    generated_at: datetime
    enrolled: int
    active: int
    weekly: list[WeekPoint]
    rollout: RolloutSchedule
    solve_quality: SolveQuality
    help_seeking: HelpSeeking
    topics: list[TopicRecovery]
    memory: MemoryRetention


def _rate(part: int, whole: int) -> float | None:
    return round(part / whole, 3) if whole else None


def _manila_day(column):
    return func.date(func.timezone("Asia/Manila", column))


def _event_days(db: Session, students: list[uuid.UUID], activity_ids: list[uuid.UUID],
                languages: list, concepts: list[str]) -> list[tuple[uuid.UUID, date, int]]:
    """(student, Manila day, events) for practice on this course's content."""
    sources = [
        select(ActivityAttempt.student_id, _manila_day(ActivityAttempt.created_at).label("day")).where(
            ActivityAttempt.student_id.in_(students), ActivityAttempt.activity_id.in_(activity_ids),
            ActivityAttempt.exam_attempt_id.is_(None),
        ),
        select(SubmissionJob.student_id, _manila_day(SubmissionJob.created_at)).where(
            SubmissionJob.student_id.in_(students), SubmissionJob.activity_id.in_(activity_ids),
            SubmissionJob.dry_run_only, SubmissionJob.status == "completed",
        ),
    ]
    if concepts:
        sources.append(select(ConceptReview.student_id, _manila_day(ConceptReview.submitted_at)).where(
            ConceptReview.student_id.in_(students), ConceptReview.language.in_(languages),
            ConceptReview.concept.in_(concepts), ConceptReview.status != "open",
        ))
    events = union_all(*sources).subquery()
    return db.execute(
        select(events.c.student_id, events.c.day, func.count()).group_by(events.c.student_id, events.c.day)
    ).all()


def _weekly(event_days, first_days: dict[uuid.UUID, date], today: date) -> list[WeekPoint]:
    active: dict[int, set[uuid.UUID]] = defaultdict(set)
    events: Counter[int] = Counter()
    for student_id, day, count in event_days:
        first = first_days.get(student_id)
        if first is None:
            continue
        week = (day - first).days // 7
        if 0 <= week < WEEKS_SHOWN:
            active[week].add(student_id)
            events[week] += count
    reached = [(today - first).days // 7 for first in first_days.values()]
    last_week = min(WEEKS_SHOWN - 1, max(reached, default=-1))
    return [
        WeekPoint(week=week, eligible=sum(1 for value in reached if value >= week),
                  active=len(active[week]), events=events[week])
        for week in range(last_week + 1)
    ]


def course_insights(db: Session, course: Course, now: datetime | None = None) -> GamificationInsights:
    now = now or _utcnow()
    students = [student.id for student in enrolled_students(db, course.id)]
    activity_ids = published_activity_ids(db, [course.id])
    activities = db.query(
        LearningActivity.id, LearningActivity.activity_type, LearningActivity.topic_concept, LearningActivity.language,
    ).filter(LearningActivity.id.in_(activity_ids)).all() if activity_ids else []
    topic_of = {activity_id: topic for activity_id, _, topic, _ in activities}
    challenge_ids = [activity_id for activity_id, kind, _, _ in activities if kind == ActivityKind.challenge]
    languages = list({language for *_, language in activities})
    concepts = sorted(set(topic_of.values()))

    event_days = _event_days(db, students, activity_ids, languages, concepts) if students and activity_ids else []
    first_days = first_practice_days(db, {student_id for student_id, _, _ in event_days})
    today = now.astimezone(MANILA).date()

    stars = challenge_stars(db, students, challenge_ids)
    star_counts = Counter(stars.values())
    timing = hint_timing(db, students, challenge_ids) if challenge_ids else {}

    errors = practice_errors(db, students, challenge_ids)
    recovered = recoveries_for(db, students, challenge_ids)
    failed: dict[str, Counter[str]] = defaultdict(Counter)
    recovered_counts: dict[str, Counter[str]] = defaultdict(Counter)
    struggling: dict[str, set[uuid.UUID]] = defaultdict(set)
    stuck: dict[str, set[uuid.UUID]] = defaultdict(set)
    for student_id, activity_id, category, count, _ in errors:
        topic = topic_of[activity_id]
        failed[topic][category] += count
        struggling[topic].add(student_id)
        if (student_id, activity_id) not in recovered:
            stuck[topic].add(student_id)
    for (_, activity_id), recovery in recovered.items():
        for category in recovery.categories:
            recovered_counts[topic_of[activity_id]][category] += 1
    topics = sorted(
        (
            TopicRecovery(
                topic=topic,
                students_struggling=len(struggling[topic]),
                students_stuck=len(stuck[topic]),
                categories=[
                    CategoryCount(category=category, label=label, failed_tries=failed[topic][category],
                                  recoveries=recovered_counts[topic][category])
                    for category, label in ERROR_LABELS.items()
                ],
            )
            for topic in failed
        ),
        key=lambda item: (-item.students_stuck, -item.students_struggling, item.topic),
    )

    recall_rows = db.query(ConceptReview.stage, ConceptReview.status, func.count()).filter(
        ConceptReview.student_id.in_(students), ConceptReview.language.in_(languages),
        ConceptReview.concept.in_(concepts), ConceptReview.status != "open",
    ).group_by(ConceptReview.stage, ConceptReview.status).all() if students and concepts else []
    submitted_by_stage: Counter[int] = Counter()
    passed_by_stage: Counter[int] = Counter()
    for stage, status, count in recall_rows:
        submitted_by_stage[stage] += count
        if status == "passed":
            passed_by_stage[stage] += count
    stages = [
        RecallStage(stage=stage, interval_days=REVIEW_INTERVAL_DAYS[stage], submitted=submitted_by_stage[stage],
                    passed=passed_by_stage[stage], pass_rate=_rate(passed_by_stage[stage], submitted_by_stage[stage]))
        for stage in range(MAX_STAGE + 1)
    ]
    submitted, passed = sum(submitted_by_stage.values()), sum(passed_by_stage.values())
    unlock_days = get_settings_int(db, UNLOCK_DEFAULTS)

    return GamificationInsights(
        course_id=course.id, course_code=course.code, course_title=course.title, generated_at=now,
        enrolled=len(students), active=len({student_id for student_id, _, _ in event_days}),
        weekly=_weekly(event_days, first_days, today),
        rollout=RolloutSchedule(codex_unlock_day=unlock_days[CODEX_UNLOCK_KEY],
                                memory_unlock_day=unlock_days[MEMORY_UNLOCK_KEY]),
        solve_quality=SolveQuality(
            solved=len(stars), stars={value: star_counts[value] for value in range(1, MAX_STARS + 1)},
            self_solved_rate=_rate(star_counts[2] + star_counts[3], len(stars)),
        ),
        help_seeking=HelpSeeking(hinted=len(timing), tried_before_hint=sum(map(tried_before_hint, timing.values())),
                                 rate=_rate(sum(map(tried_before_hint, timing.values())), len(timing))),
        topics=topics,
        memory=MemoryRetention(submitted=submitted, passed=passed, pass_rate=_rate(passed, submitted), stages=stages),
    )

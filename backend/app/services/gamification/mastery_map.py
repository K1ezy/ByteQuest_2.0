"""Student-visible completion and practice signals grouped by concept."""

import logging
import uuid
from collections import Counter, defaultdict
from datetime import datetime
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, load_only

from app.models.entities import ActivityAttempt, ActivityKind, LearningActivity, Profile, ProgrammingLang, _utcnow
from app.services.attempt_visibility import learner_visible_attempt_clause, published_track_clause
from app.services.gamification.codex import ERROR_LABELS, ErrorCategory, practice_errors
from app.services.gamification.memory import MemoryConcept, review_overview
from app.services.gamification.quiz_content import StoredQuizQuestion, parse_quiz_questions
from app.services.gamification.rollout import mechanic_state
from app.services.gamification.solve_quality import best_challenge_stars

logger = logging.getLogger(__name__)


class MasteryConcept(BaseModel):
    concept: str
    total: int
    completed: int
    mastery_percent: int
    state: Literal["not_started", "in_progress", "mastered"]
    average_stars: float | None
    weak_spot: ErrorCategory | None
    activity_ids: list[uuid.UUID]
    memory: MemoryConcept | None = None


class MasteryMapResponse(BaseModel):
    track: ProgrammingLang | None
    concepts: list[MasteryConcept]


def visible_concept_activities(
    db: Session, student: Profile, now: datetime | None = None, *, concept: str | None = None
) -> tuple[list[LearningActivity], dict[uuid.UUID, list[StoredQuizQuestion]]]:
    query = db.query(LearningActivity).options(load_only(
        LearningActivity.id, LearningActivity.activity_type, LearningActivity.topic_concept,
        LearningActivity.sequence_order, LearningActivity.quiz_questions_json,
    )).filter(published_track_clause(student, now))
    if concept is not None:
        query = query.filter(LearningActivity.topic_concept == concept)
    activities = []
    quizzes = {}
    for activity in query.order_by(LearningActivity.sequence_order, LearningActivity.topic_concept, LearningActivity.id):
        if activity.activity_type == ActivityKind.quiz:
            try:
                quizzes[activity.id] = parse_quiz_questions(activity.quiz_questions_json)
            except ValueError:
                logger.warning("Skipping published quiz with invalid content (activity_id=%s)", activity.id)
                continue
        activities.append(activity)
    return activities, quizzes


def first_visible_completions(
    db: Session, student_id: uuid.UUID, activity_ids: list[uuid.UUID]
) -> dict[uuid.UUID, datetime]:
    if not activity_ids:
        return {}
    return dict(
        db.query(ActivityAttempt.activity_id, func.min(ActivityAttempt.created_at))
        .filter(
            ActivityAttempt.student_id == student_id,
            ActivityAttempt.activity_id.in_(activity_ids),
            ActivityAttempt.is_successful,
            learner_visible_attempt_clause(),
        )
        .group_by(ActivityAttempt.activity_id)
        .all()
    )


def mastery_map(db: Session, student: Profile) -> MasteryMapResponse:
    now = _utcnow()
    activities, quizzes = visible_concept_activities(db, student, now)
    topic_by_activity = {activity.id: activity.topic_concept for activity in activities}
    completions = first_visible_completions(db, student.id, list(topic_by_activity))
    rollout = mechanic_state(db, student, now)
    memory = {}
    if rollout.memory.unlocked:
        memory = {
            item.concept: item for item in review_overview(db, student, activities, quizzes, completions, now).concepts
        }
    stars = best_challenge_stars(db, student.id, [
        activity.id for activity in activities if activity.activity_type == ActivityKind.challenge
    ])
    errors: dict[str, Counter[ErrorCategory]] = defaultdict(Counter)
    for _, activity_id, category, count, _ in practice_errors(db, [student.id], topic_by_activity):
        errors[topic_by_activity[activity_id]][category] += count

    # Instructors cannot define prerequisites. The path's previous concept is the
    # one before it in earliest quest sequence order, with concept name breaking ties.
    by_topic: dict[str, list[uuid.UUID]] = defaultdict(list)
    for activity in activities:
        by_topic[activity.topic_concept].append(activity.id)

    concepts = []
    for concept, ids in by_topic.items():
        total = len(ids)
        completed = sum(activity_id in completions for activity_id in ids)
        earned_stars = [stars[activity_id] for activity_id in ids if activity_id in stars]
        error_counts = errors[concept]
        concepts.append(MasteryConcept(
            concept=concept,
            total=total,
            completed=completed,
            mastery_percent=round(100 * completed / total),
            state="mastered" if completed == total else "in_progress" if completed else "not_started",
            average_stars=round(sum(earned_stars) / len(earned_stars), 2) if earned_stars else None,
            weak_spot=max(ERROR_LABELS, key=error_counts.__getitem__) if error_counts else None,
            activity_ids=ids,
            memory=memory.get(concept),
        ))
    return MasteryMapResponse(track=student.enrolled_language, concepts=concepts)

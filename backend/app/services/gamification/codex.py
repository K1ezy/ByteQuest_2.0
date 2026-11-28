"""Derive challenge recoveries from official practice and completed sample runs."""

import uuid
from collections import defaultdict
from datetime import datetime
from typing import Iterable, Literal

from pydantic import BaseModel
from sqlalchemy import func, select, union_all
from sqlalchemy.orm import Session

from app.models.entities import ActivityAttempt, ActivityKind, LearningActivity, ReviewState, SubmissionJob
from app.services.attempt_visibility import student_visible_activity_clause
from app.services.gamification.rollout import MechanicUnlock

ErrorCategory = Literal["syntax_error", "logic_error", "runtime_error", "timeout"]
ERROR_LABELS: dict[ErrorCategory, str] = {
    "syntax_error": "Syntax",
    "logic_error": "Logic",
    "runtime_error": "Runtime",
    "timeout": "Time limit",
}
CODEX_TIERS = (1, 3, 6)
COMEBACK_ATTEMPT = 3


class CodexRecovery(BaseModel):
    category: ErrorCategory
    label: str


class CodexCategory(CodexRecovery):
    recoveries: int
    tier: int
    next_tier_at: int | None
    topics: list[str]
    first_recovered_at: datetime | None


class CodexSummary(BaseModel):
    categories: list[CodexCategory] = []
    total_recoveries: int | None = None
    comebacks: int | None = None


class CodexResponse(CodexSummary):
    locked: bool = False
    day: int
    unlock: MechanicUnlock


def practice_errors(db: Session, student_ids: Iterable[uuid.UUID], activity_ids: Iterable[uuid.UUID]):
    """One row per (student, activity, category): failed-try count and earliest failed try."""
    students, ids = list(student_ids), list(activity_ids)
    if not students or not ids:
        return []
    sample_category = SubmissionJob.result_json["evaluation"]["dominant_error_category"].as_string()
    tries = union_all(
        select(ActivityAttempt.student_id, ActivityAttempt.activity_id,
               ActivityAttempt.error_category.label("category"), ActivityAttempt.created_at)
        .where(
            ActivityAttempt.student_id.in_(students),
            ActivityAttempt.activity_id.in_(ids),
            ActivityAttempt.exam_attempt_id.is_(None),
            ActivityAttempt.is_successful.is_(False),
            ActivityAttempt.error_category.in_(ERROR_LABELS),
        ),
        select(SubmissionJob.student_id, SubmissionJob.activity_id, sample_category, SubmissionJob.created_at)
        .where(
            SubmissionJob.student_id.in_(students),
            SubmissionJob.activity_id.in_(ids),
            SubmissionJob.dry_run_only,
            SubmissionJob.status == "completed",
            sample_category.in_(ERROR_LABELS),
        ),
    ).subquery()
    return db.execute(
        select(tries.c.student_id, tries.c.activity_id, tries.c.category, func.count(), func.min(tries.c.created_at))
        .group_by(tries.c.student_id, tries.c.activity_id, tries.c.category)
    ).all()


class ChallengeRecovery(BaseModel):
    pass_id: uuid.UUID
    recovered_at: datetime
    topic: str
    categories: list[ErrorCategory]
    comeback: bool


def recoveries_for(
    db: Session,
    student_ids: Iterable[uuid.UUID],
    activity_ids: Iterable[uuid.UUID] | None = None,
    *,
    visible_to: uuid.UUID | None = None,
) -> dict[tuple[uuid.UUID, uuid.UUID], ChallengeRecovery]:
    """First practice pass per (student, challenge) and the failure categories tried before it.

    The single source of the recovery rule. With ``visible_to`` the challenges are limited to
    what that student can see in their Workshops; class insights pass course activity ids instead.
    """
    students = list(student_ids)
    if not students:
        return {}
    practice = (
        db.query(
            ActivityAttempt.student_id, ActivityAttempt.activity_id, ActivityAttempt.id, ActivityAttempt.created_at,
            ActivityAttempt.attempt_number, ActivityAttempt.is_successful, LearningActivity.topic_concept,
            func.row_number().over(
                partition_by=(ActivityAttempt.student_id, ActivityAttempt.activity_id),
                order_by=(ActivityAttempt.created_at, ActivityAttempt.attempt_number),
            ).label("practice_number"),
        )
        .join(LearningActivity, LearningActivity.id == ActivityAttempt.activity_id)
        .filter(
            ActivityAttempt.student_id.in_(students),
            ActivityAttempt.exam_attempt_id.is_(None),
            LearningActivity.activity_type == ActivityKind.challenge,
            LearningActivity.review_status == ReviewState.published,
        )
    )
    if visible_to is not None:
        # Error categories are language-neutral, so the Codex counts every Workshop language (ADR 0001).
        practice = practice.filter(student_visible_activity_clause(visible_to))
    if activity_ids is not None:
        practice = practice.filter(ActivityAttempt.activity_id.in_(list(activity_ids)))
    # Attempt number breaks timestamp ties, while recovery comparisons remain strict.
    attempts = practice.subquery()
    ranked = db.query(
        attempts,
        func.row_number().over(
            partition_by=(attempts.c.student_id, attempts.c.activity_id), order_by=attempts.c.practice_number,
        ).label("pass_order"),
    ).filter(attempts.c.is_successful).subquery()
    first = db.query(
        ranked.c.student_id, ranked.c.activity_id, ranked.c.id, ranked.c.created_at, ranked.c.attempt_number,
        ranked.c.topic_concept, ranked.c.practice_number,
    ).filter(ranked.c.pass_order == 1)
    result = {
        (student_id, activity_id): ChallengeRecovery(
            pass_id=pass_id, recovered_at=passed_at, topic=topic,
            # Exam grades can advance the stored number without adding a practice try.
            categories=[], comeback=min(number, practice_number) >= COMEBACK_ATTEMPT,
        )
        for student_id, activity_id, pass_id, passed_at, number, topic, practice_number in first
    }
    if result:
        passed_students = list({sid for sid, _ in result})
        passed_activities = list({aid for _, aid in result})
        for student_id, activity_id, category, _, first_try_at in practice_errors(db, passed_students, passed_activities):
            recovery = result.get((student_id, activity_id))
            if recovery is not None and first_try_at < recovery.recovered_at:
                recovery.categories.append(category)
    return result


def recoveries(
    db: Session, student_id: uuid.UUID, activity_ids: Iterable[uuid.UUID] | None = None
) -> dict[uuid.UUID, ChallengeRecovery]:
    """Recoveries for one student on the challenges they can see."""
    return {
        activity_id: recovery
        for (_, activity_id), recovery in recoveries_for(db, [student_id], activity_ids, visible_to=student_id).items()
    }


def codex_summary(db: Session, student_id: uuid.UUID) -> CodexSummary:
    by_category: dict[ErrorCategory, list[ChallengeRecovery]] = defaultdict(list)
    challenges = recoveries(db, student_id)
    for recovery in challenges.values():
        for category in recovery.categories:
            by_category[category].append(recovery)

    categories = []
    for category, label in ERROR_LABELS.items():
        entries = by_category[category]
        count = len(entries)
        categories.append(CodexCategory(
            category=category, label=label, recoveries=count,
            tier=sum(count >= threshold for threshold in CODEX_TIERS),
            next_tier_at=next((threshold for threshold in CODEX_TIERS if count < threshold), None),
            topics=sorted({entry.topic for entry in entries}),
            first_recovered_at=min((entry.recovered_at for entry in entries), default=None),
        ))
    return CodexSummary(
        categories=categories,
        total_recoveries=sum(category.recoveries for category in categories),
        comebacks=sum(recovery.comeback for recovery in challenges.values()),
    )


def recovery_news(db: Session, attempt: ActivityAttempt) -> list[CodexRecovery]:
    if not attempt.is_successful:
        return []
    entry = recoveries(db, attempt.student_id, [attempt.activity_id]).get(attempt.activity_id)
    if entry is None or entry.pass_id != attempt.id:
        return []
    return [
        CodexRecovery(category=category, label=label)
        for category, label in ERROR_LABELS.items() if category in entry.categories
    ]

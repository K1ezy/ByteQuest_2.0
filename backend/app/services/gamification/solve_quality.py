"""Solve-quality stars and help-seeking signals for programming challenges.

Both are derived on read from append-only logs (activity attempts, hint uses and
submission jobs), so they need no extra storage and cannot drift from the record.
They are informational: they never change XP, which stays a first-solve reward.

Stars for one passing practice attempt:
  1  solved: every test case passed
  2  solved with no challenge hint revealed before the passing attempt
  3  as 2, within the sequencer's mastery window (MAX_MASTERY_ATTEMPTS)
A challenge's stars are the best over its passing practice attempts. Exam attempts
are excluded: hints are unavailable there and their attempt numbers mean something else.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime
from typing import Iterable

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import ActivityAttempt, ActivityKind, HintUse, LearningActivity, SubmissionJob
from app.services.gamification.sequencer import MAX_MASTERY_ATTEMPTS

MAX_STARS = 3


def solve_stars(attempt_number: int, hints_before: int) -> int:
    """Stars for a passing attempt; callers handle failed attempts (0 stars)."""
    if hints_before > 0:
        return 1
    return 3 if attempt_number <= MAX_MASTERY_ATTEMPTS else 2


StudentChallenge = tuple[uuid.UUID, uuid.UUID]  # (student_id, activity_id)


def challenge_stars(
    db: Session, student_ids: Iterable[uuid.UUID], activity_ids: Iterable[uuid.UUID]
) -> dict[StudentChallenge, int]:
    """Best stars per solved (student, challenge), in two queries for any number of students.

    The single source of the star rule: per-student views and class insights both call this.
    """
    students, ids = list(student_ids), list(activity_ids)
    if not students or not ids:
        return {}
    hints: dict[StudentChallenge, list[datetime]] = defaultdict(list)
    for student_id, activity_id, created_at in db.query(HintUse.student_id, HintUse.activity_id, HintUse.created_at).filter(
        HintUse.student_id.in_(students), HintUse.activity_id.in_(ids)
    ):
        hints[(student_id, activity_id)].append(created_at)
    best: dict[StudentChallenge, int] = {}
    for student_id, activity_id, attempt_number, created_at in db.query(
        ActivityAttempt.student_id, ActivityAttempt.activity_id, ActivityAttempt.attempt_number, ActivityAttempt.created_at
    ).filter(
        ActivityAttempt.student_id.in_(students),
        ActivityAttempt.activity_id.in_(ids),
        ActivityAttempt.is_successful.is_(True),
        ActivityAttempt.exam_attempt_id.is_(None),
    ):
        key = (student_id, activity_id)
        hints_before = sum(1 for hinted_at in hints.get(key, ()) if hinted_at < created_at)
        best[key] = max(best.get(key, 0), solve_stars(attempt_number, hints_before))
    return best


def best_challenge_stars(db: Session, student_id: uuid.UUID, activity_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Best stars per solved challenge for one student."""
    return {activity_id: stars for (_, activity_id), stars in challenge_stars(db, [student_id], activity_ids).items()}


def hint_timing(
    db: Session, student_ids: Iterable[uuid.UUID], activity_ids: Iterable[uuid.UUID] | None = None
) -> dict[StudentChallenge, tuple[datetime, datetime | None]]:
    """(first hint, first try) per hinted (student, challenge). A try is a sample run or an official attempt."""
    students = list(student_ids)
    if not students:
        return {}
    hint_query = db.query(HintUse.student_id, HintUse.activity_id, func.min(HintUse.created_at)).filter(
        HintUse.student_id.in_(students))
    if activity_ids is not None:
        hint_query = hint_query.filter(HintUse.activity_id.in_(list(activity_ids)))
    first_hint = {(sid, aid): hinted_at for sid, aid, hinted_at in hint_query.group_by(HintUse.student_id, HintUse.activity_id)}
    if not first_hint:
        return {}
    first_try: dict[StudentChallenge, datetime] = {}
    hinted_activities = list({aid for _, aid in first_hint})
    for model in (SubmissionJob, ActivityAttempt):
        for sid, aid, tried_at in (
            db.query(model.student_id, model.activity_id, func.min(model.created_at))
            .filter(model.student_id.in_(students), model.activity_id.in_(hinted_activities))
            .group_by(model.student_id, model.activity_id)
        ):
            key = (sid, aid)
            if key in first_hint:
                first_try[key] = min(first_try.get(key, tried_at), tried_at)
    return {key: (hinted_at, first_try.get(key)) for key, hinted_at in first_hint.items()}


def tried_before_hint(timing: tuple[datetime, datetime | None]) -> bool:
    first_hint, first_try = timing
    return first_try is not None and first_try < first_hint


def attempt_quality(db: Session, attempt: ActivityAttempt) -> dict:
    """Quality of one official practice attempt, for its result screen."""
    hints_before = (
        db.query(func.count(HintUse.id))
        .filter(
            HintUse.student_id == attempt.student_id,
            HintUse.activity_id == attempt.activity_id,
            HintUse.created_at < attempt.created_at,
        )
        .scalar()
        or 0
    )
    stars = solve_stars(attempt.attempt_number, hints_before) if attempt.is_successful else 0
    return {
        "stars": stars,
        "max_stars": MAX_STARS,
        "hints_before": int(hints_before),
        "self_solved": bool(attempt.is_successful and hints_before == 0),
    }


def help_pattern(db: Session, student_id: uuid.UUID) -> dict:
    """How a student solves and seeks help across challenges. Descriptive, never scored."""
    solved_challenges = [
        activity_id
        for (activity_id,) in db.query(ActivityAttempt.activity_id)
        .join(LearningActivity, LearningActivity.id == ActivityAttempt.activity_id)
        .filter(
            ActivityAttempt.student_id == student_id,
            ActivityAttempt.is_successful.is_(True),
            ActivityAttempt.exam_attempt_id.is_(None),
            LearningActivity.activity_type == ActivityKind.challenge,
        )
        .distinct()
    ]
    stars = best_challenge_stars(db, student_id, solved_challenges)

    timing = hint_timing(db, [student_id])
    tried_first = sum(tried_before_hint(value) for value in timing.values())
    return {
        "challenges_solved": len(stars),
        "self_solved": sum(1 for value in stars.values() if value >= 2),
        "three_star": sum(1 for value in stars.values() if value == MAX_STARS),
        "hinted_challenges": len(timing),
        "tried_before_hint": tried_first,
    }

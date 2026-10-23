"""Idempotent badge evaluation and awarding for student milestones."""

import logging
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.entities import ActivityAttempt, Badge, Profile, StudentBadge
from app.services.gamification.progression import grant_xp

logger = logging.getLogger(__name__)

BADGE_RULES: dict[str, tuple[str, int]] = {
    "FIRST_BLOOD": ("successful_attempts", 1),
    "CODE_WARRIOR": ("successful_attempts", 5),
    "XP_MASTER": ("xp_points", 250),
}

METRIC_ALIASES = {
    "successful_attempts": "successful_attempts",
    "successful_activities": "successful_attempts",
    "activity_successes": "successful_attempts",
    "xp": "xp_points",
    "total_xp": "xp_points",
    "xp_points": "xp_points",
}


def _requirement_for(badge: Badge) -> Optional[tuple[str, int]]:
    criteria: Any = badge.criteria_json
    code = (badge.code or "").strip().upper()
    if code in BADGE_RULES:
        return BADGE_RULES[code]

    if not isinstance(criteria, dict):
        return None

    criteria_code = str(criteria.get("code") or "").strip().upper()
    if criteria_code in BADGE_RULES:
        return BADGE_RULES[criteria_code]

    metric_name = criteria.get("metric") or criteria.get("type")
    metric = METRIC_ALIASES.get(str(metric_name or "").strip().lower())
    threshold = criteria.get("threshold", criteria.get("value"))
    if metric is None or isinstance(threshold, bool):
        return None

    try:
        required = int(threshold)
    except (TypeError, ValueError):
        return None
    if required < 0:
        return None
    return metric, required


def _qualifies(badge: Badge, successful_attempts: int, xp_points: int) -> bool:
    requirement = _requirement_for(badge)
    if requirement is None:
        return False
    metric, threshold = requirement
    current = successful_attempts if metric == "successful_attempts" else xp_points
    return current >= threshold


def evaluate_and_award_badges(db: Session, student: Profile) -> list[str]:
    """Award all newly qualified badges within the caller's transaction.

    This function deliberately does not commit. The profile row lock and the
    student/badge unique index make concurrent submissions safe and idempotent.
    """
    locked_student = (
        db.query(Profile)
        .filter(Profile.id == student.id)
        .with_for_update()
        .populate_existing()
        .one()
    )
    successful_attempts = (
        db.query(func.count(ActivityAttempt.id))
        .filter(
            ActivityAttempt.student_id == locked_student.id,
            ActivityAttempt.is_successful.is_(True),
        )
        .scalar()
        or 0
    )
    badges = (
        db.query(Badge)
        .order_by(Badge.code.asc(), Badge.name.asc(), Badge.id.asc())
        .all()
    )
    awarded_ids = {
        badge_id
        for (badge_id,) in db.query(StudentBadge.badge_id)
        .filter(StudentBadge.student_id == locked_student.id)
        .all()
    }
    awarded_names: list[str] = []

    # XP badges can become eligible after a different badge's bonus is granted.
    while True:
        awarded_this_pass = False
        for badge in badges:
            if badge.id in awarded_ids or not _qualifies(
                badge, successful_attempts, int(locked_student.xp_points or 0)
            ):
                continue

            statement = (
                pg_insert(StudentBadge)
                .values(student_id=locked_student.id, badge_id=badge.id)
                .on_conflict_do_nothing(
                    index_elements=[StudentBadge.student_id, StudentBadge.badge_id]
                )
                .returning(StudentBadge.id)
            )
            inserted_id = db.execute(statement).scalar_one_or_none()
            awarded_ids.add(badge.id)
            if inserted_id is None:
                continue

            bonus = grant_xp(locked_student, badge.xp_bonus or 0)
            awarded_names.append(badge.name)
            logger.info(
                "Awarded badge %s to student %s (XP bonus: %s)",
                badge.code or badge.id,
                locked_student.pseudonym_id,
                bonus,
            )
            awarded_this_pass = True

        if not awarded_this_pass:
            break

    if awarded_names:
        db.flush()
    return awarded_names

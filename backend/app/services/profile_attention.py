"""Account access checks and personal profile history."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.entities import (
    AuditEvent,
    CourseMember,
    Profile,
)
def role_value(profile: Profile | None) -> str | None:
    if profile is None:
        return None
    return getattr(profile.role, "value", profile.role)


def membership_rows(db: Session, profile_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[CourseMember]]:
    """Course memberships per profile, ignoring removed rows."""
    if not profile_ids:
        return {}
    rows = (
        db.query(CourseMember)
        .filter(CourseMember.profile_id.in_(profile_ids), CourseMember.status != "removed")
        .all()
    )
    result: dict[uuid.UUID, list[CourseMember]] = {}
    for row in rows:
        result.setdefault(row.profile_id, []).append(row)
    return result


def account_needs_action(profile: Profile, memberships: list[CourseMember]) -> tuple[bool, str | None]:
    """Whether an account is blocked from working, and why."""
    if profile.account_status != "active":
        return False, None
    # Administrators hold platform-wide access; course assignment is not required.
    if role_value(profile) == "admin":
        return False, None
    pending = [item for item in memberships if item.status == "pending"]
    if pending:
        return True, "A course assignment is waiting for confirmation."
    active = [item for item in memberships if item.status == "active"]
    if not active:
        return True, "No active course access yet."
    return False, None


def instructor_course_ids(db: Session, user: Profile) -> list[uuid.UUID]:
    """Courses the user actively teaches."""
    return [
        row[0]
        for row in db.query(CourseMember.course_id)
        .filter(
            CourseMember.profile_id == user.id,
            CourseMember.member_role == "instructor",
            CourseMember.status == "active",
        )
        .distinct()
        .all()
    ]


def personal_audit(db: Session, actor_id: uuid.UUID, limit: int = 8) -> list[AuditEvent]:
    """Audit events this user personally performed, newest first."""
    return (
        db.query(AuditEvent)
        .filter(AuditEvent.actor_id == actor_id)
        .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
        .limit(limit)
        .all()
    )

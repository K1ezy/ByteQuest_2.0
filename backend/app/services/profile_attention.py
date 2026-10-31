"""Shared attention summaries and recommended next actions.

The faculty and administrator dashboards and the self-service profile must
agree on what "needs attention" means and which item is most urgent. These
helpers hold the single definition so the two surfaces cannot drift apart.

Every query here is scoped to what the signed-in user is actually responsible
for: faculty attention aggregates only across their actively assigned courses,
and personal timelines are filtered by AuditEvent.actor_id.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.entities import (
    AuditEvent,
    CourseMember,
    ProcessingJob,
    Profile,
)
from app.services.course_access import courses_for_user
from app.services.workspace_common import activity_state, as_aware, iso
from app.services.workspace_queries import (
    filter_activities,
    filter_drafts,
    filter_materials,
    scoped_activities,
    scoped_materials,
)

# Scheduled activities only count as "upcoming" inside this window, matching
# the faculty dashboard.
UPCOMING_WINDOW_DAYS = 14


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


def _action(kind: str, title: str, detail: str, status: str, href: str) -> dict:
    return {"kind": kind, "title": title, "detail": detail, "status": status, "href": href}


def instructor_attention(
    db: Session, user: Profile, course_ids: list[uuid.UUID] | None = None
) -> tuple[dict[str, int], dict]:
    """Attention counts and the single highest-priority action for a faculty member.

    Priority: attention-required material, then a draft awaiting review, then the
    next scheduled activity, then the general workspace.
    """
    ids = instructor_course_ids(db, user) if course_ids is None else course_ids
    if not ids:
        return (
            {"drafts_awaiting_review": 0, "materials_needing_attention": 0, "upcoming_activities": 0},
            _action(
                "workspace",
                "Open your faculty workspace",
                "You are not assigned to a course yet. An administrator can assign one.",
                "No courses",
                "/faculty",
            ),
        )

    now = datetime.now(timezone.utc)
    activities = scoped_activities(db, ids)
    materials = scoped_materials(db, ids)

    open_drafts = filter_drafts(activities, status="open")
    attention_materials = filter_materials(materials, status="attention")
    scheduled = [
        item
        for item in filter_activities(activities, status="scheduled")
        if as_aware(item.opens_at) is not None
        and as_aware(item.opens_at) <= now + timedelta(days=UPCOMING_WINDOW_DAYS)
    ]

    counts = {
        "drafts_awaiting_review": len(open_drafts),
        "materials_needing_attention": len(attention_materials),
        "upcoming_activities": len(scheduled),
    }

    if attention_materials:
        document = attention_materials[0]
        action = _action(
            "material",
            document.title,
            document.processing_error or "This PDF needs attention before it can be cited.",
            "Needs review" if document.processing_status == "needs_review" else "Failed",
            f"/faculty/materials?course={document.course_id}&material={document.id}",
        )
    elif open_drafts:
        activity = sorted(open_drafts, key=lambda item: as_aware(item.created_at) or now)[0]
        action = _action(
            "draft",
            activity.title or activity.topic_concept,
            "A generated draft is waiting for your review before students can see it.",
            "Awaiting review",
            f"/faculty/review/{activity.id}?course={activity.course_id}",
        )
    elif scheduled:
        activity = sorted(scheduled, key=lambda item: as_aware(item.opens_at) or now)[0]
        opens_at = as_aware(activity.opens_at)
        action = _action(
            "activity",
            activity.title or activity.topic_concept,
            f"Opens {iso(opens_at)}" if opens_at else "Scheduled to open soon.",
            "Scheduled",
            f"/faculty/activities/{activity.id}?course={activity.course_id}",
        )
    else:
        action = _action(
            "workspace",
            "Everything is up to date",
            "No drafts, materials or scheduled activities need you right now.",
            "Clear",
            "/faculty",
        )
    return counts, action


def admin_attention(db: Session, user: Profile) -> tuple[dict[str, int], dict]:
    """Attention counts and the highest-priority operational action for an admin.

    Priority: failed processing jobs, then accounts needing access, then
    availability changes, then the general dashboard.
    """
    profiles = db.query(Profile).all()
    memberships = membership_rows(db, [profile.id for profile in profiles])
    attention_accounts = [
        profile for profile in profiles if account_needs_action(profile, memberships.get(profile.id, []))[0]
    ]

    failed_jobs = (
        db.query(ProcessingJob)
        .filter(ProcessingJob.status == "failed")
        .order_by(ProcessingJob.created_at.desc())
        .all()
    )

    courses = courses_for_user(db, user, include_archived=True)
    activities = scoped_activities(db, [course.id for course in courses])
    availability = [
        activity
        for activity in filter_activities(activities, status="all")
        if activity_state(activity) in {"scheduled", "closed"}
    ]

    counts = {
        "accounts_needing_action": len(attention_accounts),
        "failed_jobs": len(failed_jobs),
        "availability_changes": len(availability),
    }

    if failed_jobs:
        job = failed_jobs[0]
        action = _action(
            "job",
            "A PDF processing job failed",
            job.cause or "The processing job failed and needs investigation.",
            "Failed",
            "/admin/monitoring?status=failed",
        )
    elif attention_accounts:
        profile = attention_accounts[0]
        _, reason = account_needs_action(profile, memberships.get(profile.id, []))
        action = _action(
            "account",
            "An account needs access review",
            reason or "Review the course access for this account.",
            "Needs action",
            "/admin/accounts?status=attention",
        )
    elif availability:
        action = _action(
            "activity",
            "Activity availability needs a look",
            f"{len(availability)} activities are scheduled or closed.",
            "Review",
            "/admin/activities?status=attention",
        )
    else:
        action = _action(
            "dashboard",
            "The platform is steady",
            "No failed jobs, blocked accounts or availability changes need you right now.",
            "Clear",
            "/admin",
        )
    return counts, action


def personal_audit(db: Session, actor_id: uuid.UUID, limit: int = 8) -> list[AuditEvent]:
    """Audit events this user personally performed, newest first."""
    return (
        db.query(AuditEvent)
        .filter(AuditEvent.actor_id == actor_id)
        .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
        .limit(limit)
        .all()
    )

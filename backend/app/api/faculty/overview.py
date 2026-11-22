"""Faculty course list and dashboard."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import ActivityKind, AuditEvent, Profile
from app.services.course_access import courses_for_user, resolve_workspace_course
from app.services.workspace_common import activity_state, as_aware, draft_state, iso
from app.services.workspace_queries import activity_attempt_counts, class_snapshot, enrollment_counts, filter_activities, filter_drafts, filter_materials, scoped_activities, scoped_materials
from app.api.faculty.common import faculty_user, _course_brief

router = APIRouter()

# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------
@router.get("/courses")
def list_courses(user: Profile = Depends(faculty_user), db: Session = Depends(get_db)):
    courses = courses_for_user(db, user)
    counts = enrollment_counts(db, [course.id for course in courses])
    activities = scoped_activities(db, [course.id for course in courses])
    materials = scoped_materials(db, [course.id for course in courses])
    payload = []
    for course in courses:
        course_activities = [item for item in activities if item.course_id == course.id]
        course_materials = [item for item in materials if item.course_id == course.id]
        drafts = filter_drafts(course_activities, status="open")
        attention = filter_materials(course_materials, status="attention")
        payload.append(
            {
                **_course_brief(course),
                "description": course.description,
                "student_count": counts["student"].get(course.id, 0),
                "instructor_count": counts["instructor"].get(course.id, 0),
                "draft_count": len(drafts),
                "attention_count": len(attention),
            }
        )
    return {
        "courses": payload,
        "default_course_id": str(courses[0].id) if courses else None,
        "timezone": "Asia/Manila",
    }


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@router.get("/dashboard")
def faculty_dashboard(
    course_id: Optional[uuid.UUID] = None,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    now = datetime.now(timezone.utc)
    activities = scoped_activities(db, [course.id])
    materials = scoped_materials(db, [course.id])
    attempts = activity_attempt_counts(db, [item.id for item in activities])
    material_by_id = {document.id: document for document in materials}

    open_drafts = filter_drafts(activities, status="open")
    attention_materials = filter_materials(materials, status="attention")
    scheduled = [
        item
        for item in filter_activities(activities, status="scheduled")
        if as_aware(item.opens_at) is not None and as_aware(item.opens_at) <= now + timedelta(days=14)
    ]
    upcoming = sorted(scheduled, key=lambda item: as_aware(item.opens_at) or now)[:5]
    snapshot = class_snapshot(db, course.id)

    queue: list[dict] = []
    for document in attention_materials:
        queue.append(
            {
                "kind": "material",
                "id": str(document.id),
                "title": document.title,
                "detail": document.processing_error or "The PDF needs attention before it can be cited.",
                "status": "Needs review" if document.processing_status == "needs_review" else "Failed",
                "severity": "bad",
                "course": _course_brief(course),
                "updated_at": iso(document.created_at),
                "href": f"/instructor/materials?course={course.id}&material={document.id}",
            }
        )
    for activity in sorted(open_drafts, key=lambda item: as_aware(item.created_at) or now):
        queue.append(
            {
                "kind": "draft",
                "id": str(activity.id),
                "title": activity.title or activity.topic_concept,
                "detail": "Generated draft waiting for your review before students can see it.",
                "status": "Awaiting review" if draft_state(activity) == "pending" else draft_state(activity).title(),
                "severity": "wait",
                "course": _course_brief(course),
                "updated_at": iso(activity.created_at),
                "href": f"/instructor/review/{activity.id}?course={course.id}",
            }
        )
    for activity in upcoming:
        opens_at = as_aware(activity.opens_at)
        queue.append(
            {
                "kind": "activity",
                "id": str(activity.id),
                "title": activity.title or activity.topic_concept,
                "detail": f"Opens {opens_at.isoformat() if opens_at else 'soon'} · {len(activity.test_cases) if activity.activity_type == ActivityKind.challenge else len((activity.quiz_questions_json or {}).get('questions') or [])} items",
                "status": "Scheduled",
                "severity": "info",
                "course": _course_brief(course),
                "updated_at": iso(activity.created_at),
                "href": f"/instructor/activities/{activity.id}?course={course.id}",
            }
        )

    recent = (
        db.query(AuditEvent)
        .filter(AuditEvent.course_id == course.id)
        .order_by(AuditEvent.created_at.desc())
        .limit(6)
        .all()
    )
    actors = {
        event.actor_id: profile
        for event in recent
        if event.actor_id
        for profile in [db.query(Profile).filter(Profile.id == event.actor_id).first()]
        if profile is not None
    }

    return {
        "course": {**_course_brief(course), "description": course.description},
        "counts": {
            "drafts_awaiting_review": len(open_drafts),
            "materials_needing_attention": len(attention_materials),
            "upcoming_activities": len(scheduled),
            "class_progress_percent": snapshot["average_completion_percent"],
            "active_learners": snapshot["active_learners"],
        },
        "action_queue": queue[:8],
        "queue_hrefs": {
            "drafts": f"/instructor/review?course={course.id}&status=open",
            "materials": f"/instructor/materials?course={course.id}&status=attention",
            "activities": f"/instructor/activities?course={course.id}&status=scheduled",
            "performance": f"/instructor/performance?course={course.id}",
        },
        "upcoming": [
            {
                "id": str(item.id),
                "title": item.title or item.topic_concept,
                "activity_type": getattr(item.activity_type, "value", item.activity_type),
                "opens_at": iso(item.opens_at),
                "closes_at": iso(item.closes_at),
                "state": activity_state(item),
                "href": f"/instructor/activities/{item.id}?course={course.id}",
            }
            for item in upcoming
        ],
        "class_snapshot": snapshot,
        "recent_changes": [
            {
                "id": str(event.id),
                "action": event.action,
                "summary": event.summary,
                "actor": (actors.get(event.actor_id).display_name or actors.get(event.actor_id).username)
                if event.actor_id in actors
                else "System",
                "created_at": iso(event.created_at),
            }
            for event in recent
        ],
    }

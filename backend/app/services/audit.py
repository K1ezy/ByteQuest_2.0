"""Audit trail for consequential faculty and administrator changes."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import AuditEvent, Profile


def record_audit(
    db: Session,
    *,
    actor: Profile | None,
    action: str,
    entity_type: str,
    summary: str,
    entity_id: str | uuid.UUID | None = None,
    course_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditEvent:
    role = getattr(actor.role, "value", actor.role) if actor is not None else None
    event = AuditEvent(
        actor_id=actor.id if actor is not None else None,
        actor_role=role,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        course_id=course_id,
        summary=summary,
        metadata_json=metadata or {},
    )
    db.add(event)
    return event

"""Current individual consent for advisory prediction visibility."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import ResearchConsent


def consent_open() -> bool:
    return bool(settings.RESEARCH_CONSENT_ACTIVE and settings.RESEARCH_CONSENT_VERSION)


def current_consent_choices(db: Session, student_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    """Each student's latest answer, kept only when it answers the current form; older answers no longer count."""
    if not student_ids or not consent_open():
        return {}
    rows = db.query(ResearchConsent).filter(ResearchConsent.student_id.in_(student_ids)).order_by(
        ResearchConsent.event_order.desc()
    ).all()
    latest = {}
    for row in rows:
        latest.setdefault(row.student_id, row)
    return {student_id: row.choice for student_id, row in latest.items()
            if row.document_version == settings.RESEARCH_CONSENT_VERSION}


def consented_student_ids(db: Session, student_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    return {student_id for student_id, choice in current_consent_choices(db, student_ids).items() if choice == "accepted"}

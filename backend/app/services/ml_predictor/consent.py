"""Current individual consent for advisory prediction visibility."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import ResearchConsent


def consented_student_ids(db: Session, student_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    if not student_ids or not (settings.RESEARCH_CONSENT_ACTIVE and settings.RESEARCH_CONSENT_VERSION):
        return set()
    rows = db.query(ResearchConsent).filter(ResearchConsent.student_id.in_(student_ids)).order_by(
        ResearchConsent.event_order.desc()
    ).all()
    latest = {}
    for row in rows:
        latest.setdefault(row.student_id, row)
    return {student_id for student_id, row in latest.items()
            if row.choice == "accepted" and row.document_version == settings.RESEARCH_CONSENT_VERSION}

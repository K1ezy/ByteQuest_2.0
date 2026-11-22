"""Release practice mechanics on the learner's Manila calendar."""

import uuid
from datetime import date, datetime, timedelta
from typing import Iterable

from pydantic import BaseModel
from sqlalchemy import func, select, union_all
from sqlalchemy.orm import Session

from app.core.quotas import MANILA
from app.models.entities import ActivityAttempt, Profile, SubmissionJob, _utcnow
from app.services.settings_service import get_settings_int

CODEX_UNLOCK_KEY = "gamification_codex_unlock_day"
MEMORY_UNLOCK_KEY = "gamification_memory_unlock_day"
UNLOCK_DEFAULTS = {CODEX_UNLOCK_KEY: 21, MEMORY_UNLOCK_KEY: 35}


class MechanicUnlock(BaseModel):
    unlocked: bool
    unlock_day: int
    unlocks_on: date | None


class MechanicState(BaseModel):
    day: int
    codex: MechanicUnlock
    memory: MechanicUnlock


def first_practice_days(db: Session, student_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, date]:
    """Manila calendar day of each student's first practice activity (attempt or completed sample run).

    The single source of "learner day": the rollout and class insights both count weeks from it.
    """
    students = list(student_ids)
    if not students:
        return {}
    starts = union_all(
        select(ActivityAttempt.student_id, ActivityAttempt.created_at).where(
            ActivityAttempt.student_id.in_(students), ActivityAttempt.exam_attempt_id.is_(None),
        ),
        select(SubmissionJob.student_id, SubmissionJob.created_at).where(
            SubmissionJob.student_id.in_(students),
            SubmissionJob.dry_run_only,
            SubmissionJob.status == "completed",
            func.jsonb_typeof(SubmissionJob.result_json["evaluation"]) == "object",
        ),
    ).subquery()
    return {
        student_id: first.astimezone(MANILA).date()
        for student_id, first in db.execute(
            select(starts.c.student_id, func.min(starts.c.created_at)).group_by(starts.c.student_id)
        )
    }


def mechanic_state(db: Session, student: Profile, now: datetime | None = None) -> MechanicState:
    first_day = first_practice_days(db, [student.id]).get(student.id)
    today = (now or _utcnow()).astimezone(MANILA).date()
    day = max(0, (today - first_day).days) if first_day else 0
    unlock_days = get_settings_int(db, UNLOCK_DEFAULTS)

    def unlock(key: str) -> MechanicUnlock:
        unlock_day = unlock_days[key]
        return MechanicUnlock(
            unlocked=day >= unlock_day,
            unlock_day=unlock_day,
            unlocks_on=first_day + timedelta(days=unlock_day) if first_day else None,
        )

    return MechanicState(day=day, codex=unlock(CODEX_UNLOCK_KEY), memory=unlock(MEMORY_UNLOCK_KEY))

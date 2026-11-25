"""Read precomputed synthetic snapshots for the local thesis demonstration."""

from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
import logging
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, ValidationError
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.models.entities import LearningActivity, Profile
from app.services.ml_predictor.thresholds import classify_success, recommended_action
from app.services.workspace_common import iso

logger = logging.getLogger(__name__)
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}
MANILA = timezone(timedelta(hours=8))


class DemoSnapshot(BaseModel):
    snapshot_id: str
    student_id: UUID
    activity_id: UUID
    assigned_at: AwareDatetime
    prior_completed: int = Field(ge=0)
    prob_lr: float = Field(ge=0, le=1)
    prob_rf: float = Field(ge=0, le=1)
    features: dict[str, float | None]


class DemoSnapshots(BaseModel):
    model_version: str
    selected_model: Literal["logreg", "random_forest"]
    workshops: dict[UUID, list[DemoSnapshot]]


@lru_cache(maxsize=1)
def _read_snapshots(path: Path, modified_at: int) -> DemoSnapshots:
    return DemoSnapshots.model_validate_json(path.read_bytes())


def local_demo_predictions(
    workshop_id: UUID,
    students: list[Profile],
    activities: list[LearningActivity],
    *,
    student_id: UUID | None,
    from_date: date | None,
    through_date: date | None,
) -> dict | None:
    path = settings.ML_DEMO_SNAPSHOTS_FILE
    if path is None or settings.ENVIRONMENT.lower() != "development":
        return None
    if make_url(settings.DATABASE_URL).host not in LOCAL_HOSTS or urlsplit(settings.SUPABASE_URL).hostname not in LOCAL_HOSTS:
        return None

    # A Workshop with a live learner always uses the normal consent-gated report.
    roster = {student.id: student for student in students}
    if not roster or any(
        not student.username.startswith("thesisdemo")
        or not (student.email or "").endswith("@bytequest.test")
        for student in students
    ):
        return None
    try:
        fixture = _read_snapshots(path, path.stat().st_mtime_ns)
    except (OSError, ValidationError):
        logger.warning("Local demo prediction snapshots could not be loaded.")
        return None

    snapshots = fixture.workshops.get(workshop_id)
    if snapshots is None:
        return None

    tasks = {activity.id: activity.title or activity.topic_concept for activity in activities}
    rows = []
    for snapshot in sorted(snapshots, key=lambda item: (-item.assigned_at.timestamp(), item.snapshot_id)):
        learner = roster.get(snapshot.student_id)
        task = tasks.get(snapshot.activity_id)
        day = snapshot.assigned_at.astimezone(MANILA).date()
        if learner is None or learner.account_status != "active" or task is None:
            continue
        if student_id is not None and student_id != snapshot.student_id:
            continue
        if (from_date and day < from_date) or (through_date and day > through_date):
            continue
        rows.append({
            "snapshot_id": snapshot.snapshot_id,
            "assigned_at": iso(snapshot.assigned_at),
            "school_id": learner.school_id or learner.pseudonym_id,
            "student_name": learner.display_name or learner.username,
            "task": task,
            "prior_completed": snapshot.prior_completed,
            "prob_lr": snapshot.prob_lr,
            "label_lr": classify_success(snapshot.prob_lr),
            "prob_rf": snapshot.prob_rf,
            "label_rf": classify_success(snapshot.prob_rf),
            "advisory_band": recommended_action(
                snapshot.prob_lr if fixture.selected_model == "logreg" else snapshot.prob_rf,
            ),
            "model_version": fixture.model_version,
            "selected_model": fixture.selected_model,
            "features": snapshot.features,
        })
    return {"demo_model_version": fixture.model_version, "selected_model": fixture.selected_model, "rows": rows}

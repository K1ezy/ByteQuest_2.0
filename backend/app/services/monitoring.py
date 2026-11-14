"""Operational health derived from records the platform actually writes.

Healthy, stale, failed and unavailable are decided by data, not by a static
label. A service with no recorded activity is 'unavailable', never 'healthy'.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import (
    LearningActivity,
    MLPrediction,
    ProcessingJob,
    SubmissionJob,
)
from app.services.workspace_common import as_aware, iso

SERVICE_LABELS = [
    ("api", "API"),
    ("rag_index", "RAG indexing"),
    ("code_runner", "Code-assessment runner"),
    ("prediction", "Prediction service"),
]

STALE_AFTER = timedelta(hours=6)


def _status(value: str, detail: str, *, last_checked: datetime | None = None, trace_id: str | None = None) -> dict:
    return {
        "status": value,
        "detail": detail,
        "last_checked_at": iso(last_checked or datetime.now(timezone.utc)),
        "trace_id": trace_id,
    }


def _rag_health(db: Session) -> dict:
    latest = (
        db.query(ProcessingJob)
        .filter(ProcessingJob.service == "rag_index")
        .order_by(ProcessingJob.created_at.desc())
        .first()
    )
    if latest is None:
        return _status("unavailable", "No PDF indexing job has been recorded yet.")
    checked = as_aware(latest.last_checked_at) or as_aware(latest.updated_at)
    if latest.status == "failed":
        return _status("failed", latest.cause or "The last indexing job failed.", last_checked=checked, trace_id=latest.trace_id)
    if latest.status in {"queued", "running"}:
        started = as_aware(latest.updated_at)
        if started is not None and datetime.now(timezone.utc) - started > STALE_AFTER:
            return _status("stale", "Indexing has not reported progress recently.", last_checked=checked, trace_id=latest.trace_id)
        return _status("healthy", "A PDF indexing job is in progress.", last_checked=checked, trace_id=latest.trace_id)
    return _status("healthy", "The last PDF indexing job completed.", last_checked=checked, trace_id=latest.trace_id)


# A submission normally finishes within a minute; one waiting longer means the
# grading worker is down, which students feel long before any job "fails".
QUEUE_STALL_AFTER = timedelta(minutes=3)


def _minutes(delta: timedelta) -> str:
    minutes = int(delta.total_seconds() // 60)
    if minutes < 1:
        return "under a minute"
    if minutes < 120:
        return f"{minutes} min"
    hours = minutes // 60
    return f"{hours} h" if hours < 48 else f"{hours // 24} days"


def runner_status(jobs: list, now: datetime) -> dict:
    """Judge the grading runner by what is happening now, not by old failures."""
    if not jobs:
        return _status("unavailable", "No code submission has been recorded yet.", last_checked=now)
    finished = [job for job in jobs if job.status in {"completed", "failed"}]
    failures = sum(job.status == "failed" for job in finished)
    rate = f" {failures} of the last {len(finished)} finished jobs failed." if finished else ""
    waiting_since = [as_aware(job.updated_at) for job in jobs if job.status in {"queued", "running"}]
    if waiting_since and now - min(waiting_since) > QUEUE_STALL_AFTER:
        return _status(
            "stale",
            f"A submission has waited {_minutes(now - min(waiting_since))} without progress; "
            f"the grading worker may be stopped.{rate}",
            last_checked=now,
        )
    if not finished:
        return _status("healthy", "Submission jobs are being processed.", last_checked=now)
    latest = max(finished, key=lambda job: as_aware(job.updated_at))
    if latest.status == "failed":
        return _status("failed", f"The most recent submission job failed.{rate}", last_checked=now)
    return _status(
        "healthy",
        f"Last job completed {_minutes(now - as_aware(latest.updated_at))} ago.{rate}",
        last_checked=now,
    )


def _runner_health(db: Session) -> dict:
    recent = db.query(SubmissionJob).order_by(SubmissionJob.created_at.desc()).limit(50).all()
    return runner_status(recent, datetime.now(timezone.utc))


def _prediction_health(db: Session, app_state: Any) -> dict:
    latest = db.query(MLPrediction).order_by(MLPrediction.created_at.desc()).first()
    mode = getattr(app_state, "ml_shadow_status", "disabled")
    if latest is not None:
        checked = as_aware(latest.created_at)
        if checked is not None and datetime.now(timezone.utc) - checked > timedelta(days=30):
            return _status("stale", "The newest saved prediction is more than 30 days old.", last_checked=checked)
        return _status(
            "healthy",
            f"Prediction records are being saved (model {latest.model_version}).",
            last_checked=checked,
        )
    reasons = {
        "disabled": "Shadow scoring is disabled; the rule-based sequencer is authoritative.",
        "approval_required": "Shadow scoring is waiting for research approval.",
        "artifacts_unavailable": "No approved model artifact is available.",
        "artifacts_invalid": "The model artifact failed validation.",
        "unavailable": "The prediction runtime is unavailable.",
    }
    # Switched off on purpose is not a fault, so it must not turn the overview red.
    if mode in {"disabled", "approval_required"}:
        return _status("off", reasons[mode])
    return _status("unavailable", reasons.get(mode, "No saved prediction has been recorded yet."))


def service_health(db: Session, app_state: Any = None) -> list[dict]:
    rag = _rag_health(db)
    runner = _runner_health(db)
    prediction = _prediction_health(db, app_state)
    now = datetime.now(timezone.utc)
    api = _status("healthy", "The API responded to this request.", last_checked=now)
    rows = {
        "api": api,
        "rag_index": rag,
        "code_runner": runner,
        "prediction": prediction,
    }
    result = []
    for key, label in SERVICE_LABELS:
        entry = dict(rows[key])
        entry["service"] = key
        entry["label"] = label
        result.append(entry)
    return result


def overall_health(services: list[dict]) -> str:
    states = {service["status"] for service in services}
    if "failed" in states:
        return "failed"
    if "stale" in states:
        return "stale"
    if "unavailable" in states:
        return "unavailable"
    return "healthy"


def serialize_job(job: ProcessingJob, document: LearningActivity | None = None) -> dict:
    return {
        "id": str(job.id),
        "service": job.service,
        "job_type": job.job_type,
        "status": job.status,
        "attempts": job.attempts,
        "max_attempts": job.max_attempts,
        "retryable": bool(job.retryable),
        "cause": job.cause,
        "trace_id": job.trace_id,
        "document_id": str(job.document_id) if job.document_id else None,
        "activity_id": str(job.activity_id) if job.activity_id else None,
        "created_at": iso(job.created_at),
        "updated_at": iso(job.updated_at),
        "last_checked_at": iso(job.last_checked_at),
    }


def job_query(db: Session, *, service: str | None = None, status: str | None = None, search: str | None = None):
    query = db.query(ProcessingJob)
    if service:
        query = query.filter(ProcessingJob.service == service)
    if status:
        query = query.filter(ProcessingJob.status == status)
    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(
            func.coalesce(ProcessingJob.cause, "").ilike(needle)
            | ProcessingJob.trace_id.ilike(needle)
            | ProcessingJob.job_type.ilike(needle)
        )
    return query.order_by(ProcessingJob.created_at.desc()).limit(200)


def audit_query(db: Session, *, search: str | None = None, course_ids: list[uuid.UUID] | None = None, limit: int = 50):
    from app.models.entities import AuditEvent

    query = db.query(AuditEvent)
    if course_ids is not None:
        query = query.filter(AuditEvent.course_id.in_(course_ids)) if course_ids else query.filter(AuditEvent.course_id.is_(None))
    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(AuditEvent.summary.ilike(needle) | AuditEvent.action.ilike(needle))
    return query.order_by(AuditEvent.created_at.desc()).limit(limit)

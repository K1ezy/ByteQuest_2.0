"""Operational health from live checks and recorded activity."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from time import monotonic
from typing import Any

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.entities import (
    ExamAttempt,
    GradingWorkerHeartbeat,
    LearningActivity,
    MLPrediction,
    ProcessingJob,
    SubmissionJob,
)
from app.services.judge0.client import Judge0UnavailableError, judge0_client
from app.services.workspace_common import as_aware, iso

SERVICE_LABELS = [
    ("api", "API"),
    ("rag_index", "RAG indexing"),
    ("code_runner", "Submission queue"),
    ("grading_worker", "ByteQuest grading worker"),
    ("judge0", "Judge0 sandbox"),
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


QUEUE_STALL_AFTER = timedelta(minutes=3)
HEARTBEAT_STALE_AFTER = timedelta(seconds=60)


def record_grading_worker_heartbeat(db: Session) -> None:
    heartbeat = insert(GradingWorkerHeartbeat).values(id=1, seen_at=func.clock_timestamp())
    db.execute(heartbeat.on_conflict_do_update(index_elements=["id"], set_={"seen_at": func.clock_timestamp()}))


async def _check_judge0() -> dict:
    try:
        passed = await judge0_client.check_execution()
    except Judge0UnavailableError:
        return _status("failed", "Judge0 could not complete a test run within the health check. Check the sandbox service and queue.")
    if not passed:
        return _status("failed", "Judge0 returned an unsuccessful result for the test program. Check the sandbox runtime.")
    return _status("healthy", "Judge0 ran the Python test program successfully.")


class SandboxHealth:
    """Share a recent test result across Admin Overview and Monitoring requests."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._expires_at = 0.0
        self._result: dict = {}

    async def check(self) -> dict:
        async with self._lock:
            if monotonic() >= self._expires_at:
                self._result = await _check_judge0()
                self._expires_at = monotonic() + 15
            return self._result


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
        return _status("healthy", "No code submissions have been queued yet.", last_checked=now)
    finished = [job for job in jobs if job.status in {"completed", "failed"}]
    failures = sum(job.status == "failed" for job in finished)
    rate = f" {failures} of the last {len(finished)} finished jobs failed." if finished else ""
    waiting_since = [as_aware(job.updated_at) for job in jobs if job.status in {"queued", "running"}]
    if waiting_since and now - min(waiting_since) > QUEUE_STALL_AFTER:
        return _status(
            "stale",
            f"A submission has waited {_minutes(now - min(waiting_since))} without progress.{rate}",
            last_checked=now,
        )
    if not finished:
        return _status("healthy", "There are recent submissions waiting or being graded.", last_checked=now)
    latest = max(finished, key=lambda job: as_aware(job.updated_at))
    if latest.status == "failed":
        return _status("failed", f"The most recent submission job failed.{rate}", last_checked=now)
    return _status(
        "healthy",
        f"Last job completed {_minutes(now - as_aware(latest.updated_at))} ago.{rate}",
        last_checked=now,
    )


def _grading_worker_health(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    heartbeat = db.get(GradingWorkerHeartbeat, 1)
    if heartbeat is None:
        return _status("unavailable", "No heartbeat received. Check that the ByteQuest grading worker is running.", last_checked=now)
    age = now - as_aware(heartbeat.seen_at)
    if age >= HEARTBEAT_STALE_AFTER:
        return _status("stale", f"Last heartbeat {_minutes(age)} ago. Check the ByteQuest grading worker and its database connection.", last_checked=now)
    return _status("healthy", f"Last heartbeat {_minutes(age)} ago.", last_checked=now)


def _runner_health(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    oldest_queued, ready_count = db.query(func.min(SubmissionJob.next_attempt_at), func.count()).filter(
        SubmissionJob.status == "queued", SubmissionJob.next_attempt_at <= now,
    ).one()
    oldest_claim, running_count = db.query(func.min(SubmissionJob.updated_at), func.count()).filter(
        SubmissionJob.status == "running",
    ).one()
    exams_needing_retry = db.query(func.count()).select_from(ExamAttempt).filter(ExamAttempt.status == "failed").scalar()
    recent = db.query(SubmissionJob).order_by(SubmissionJob.created_at.desc()).limit(50).all()
    health = runner_status(recent, now)
    if oldest_queued or oldest_claim:
        if min(value for value in (oldest_queued, oldest_claim) if value is not None) < now - QUEUE_STALL_AFTER:
            health["status"] = "stale"
        health["detail"] += f" {ready_count} ready and {running_count} running."
        if oldest_queued:
            health["detail"] += f" Oldest ready job has waited {_minutes(now - oldest_queued)}."
        if oldest_claim:
            health["detail"] += f" Oldest claim has run for {_minutes(now - oldest_claim)}."
    if exams_needing_retry:
        health["detail"] += f" Exam attempts needing a grading retry: {exams_needing_retry}."
        if health["status"] == "healthy":
            health["status"] = "failed"
    return health


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


def service_health(db: Session, app_state: Any, sandbox: dict) -> list[dict]:
    rag = _rag_health(db)
    runner = _runner_health(db)
    prediction = _prediction_health(db, app_state)
    now = datetime.now(timezone.utc)
    api = _status("healthy", "The API responded to this request.", last_checked=now)
    rows = {
        "api": api,
        "rag_index": rag,
        "code_runner": runner,
        "grading_worker": _grading_worker_health(db),
        "judge0": sandbox,
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

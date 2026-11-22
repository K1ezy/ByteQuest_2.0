"""Ownership checks shared by job recovery and official grade persistence."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import SubmissionJob


@dataclass(frozen=True)
class SubmissionClaim:
    job_id: UUID
    token: UUID


def lock_submission_claim(db: Session, claim: SubmissionClaim) -> SubmissionJob | None:
    job = db.query(SubmissionJob).filter(SubmissionJob.id == claim.job_id).with_for_update().populate_existing().first()
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.SUBMISSION_STALE_TIMEOUT_SECONDS)
    if job is None or job.status != "running" or job.claim_token != claim.token or job.updated_at <= cutoff:
        return None
    return job


def finish_submission(job: SubmissionJob, result: dict) -> None:
    now = datetime.now(timezone.utc)
    ready_at = max(job.created_at, job.next_attempt_at)
    timing = {
        "ready_queue_seconds": round(max(0, (job.updated_at - ready_at).total_seconds()), 3),
        "final_run_seconds": round(max(0, (now - job.updated_at).total_seconds()), 3),
    }
    job.result_json = {**result, "timing": timing}
    job.status = "completed"
    job.claim_token = None
    job.error_message = None
    job.updated_at = now

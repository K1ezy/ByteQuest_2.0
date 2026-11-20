"""Bounded worker for durable Judge0 jobs. Run as a separate service."""

import hashlib
import logging
import uuid
from time import monotonic
from datetime import datetime, timedelta, timezone

import anyio
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.exc import OperationalError, SQLAlchemyError, TimeoutError
from sqlalchemy.orm import Session

from app.api.submissions import CodeSubmissionRequest, run_code_submission
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.entities import Profile, SubmissionJob

from app.services.exam_worker import claim_exam, grade_exam
from app.services.email_worker import deliver_one
from app.services.monitoring import record_grading_worker_heartbeat
from app.services.submission_claims import SubmissionClaim, finish_submission, lock_submission_claim

logger = logging.getLogger(__name__)


def compute_submission_fingerprint(user_id: str, activity_id: str, source_code: str) -> str:
    payload = f"{user_id}:{activity_id}:{source_code.strip()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def sanitize_grading_result_for_student(raw_result: dict, is_exam: bool = False, results_released: bool = False) -> dict:
    """
    Checklist #4 & #5: Strips hidden test inputs/outputs, reference solutions,
    and withholds exam scores until instructor releases results.
    """
    if not isinstance(raw_result, dict):
        return {}

    if is_exam and not results_released:
        return {
            "status": "submitted_for_grading",
            "score": None,
            "visible_tests": [],
            "message": "Your exam submission is recorded. Scores will appear once released by your instructor.",
        }

    sanitized = dict(raw_result)
    sanitized.pop("reference_solution", None)
    sanitized.pop("reference_solution_code", None)

    evaluation = sanitized.get("evaluation")
    if isinstance(evaluation, dict):
        eval_copy = dict(evaluation)
        eval_copy.pop("reference_solution", None)
        test_results = eval_copy.get("test_results", [])
        if isinstance(test_results, list):
            visible_tests = []
            for tc in test_results:
                if not isinstance(tc, dict):
                    continue
                if not tc.get("is_hidden", False):
                    visible_tests.append(tc)
            eval_copy["test_results"] = visible_tests
            eval_copy["hidden_summary"] = {
                "passed": max(0, eval_copy.get("passed_test_cases", 0) - sum(bool(tc.get("passed")) for tc in visible_tests)),
                "total": max(0, eval_copy.get("total_test_cases", 0) - len(visible_tests)),
            }
        sanitized["evaluation"] = eval_copy

    return sanitized


def recover_stale_submission_jobs(db_session: Session | None = None) -> int:
    """Resets jobs stuck in 'running' beyond timeout back to 'queued' or 'failed'."""
    cutoff = datetime.now(timezone.utc) - timedelta(
        seconds=settings.SUBMISSION_STALE_TIMEOUT_SECONDS
    )
    should_close = False
    if db_session is None:
        db_session = SessionLocal()
        should_close = True
    try:
        stale_jobs = db_session.query(SubmissionJob).filter(
            SubmissionJob.status == "running",
            SubmissionJob.updated_at <= cutoff,
        ).with_for_update(skip_locked=True).all()
        recovered_count = 0
        for job in stale_jobs:
            job.status = "queued" if job.attempts < settings.SUBMISSION_MAX_RETRIES else "failed"
            job.claim_token = None
            job.error_message = "Worker timeout recovery triggered"
            job.updated_at = datetime.now(timezone.utc)
            job.next_attempt_at = datetime.now(timezone.utc)
            recovered_count += 1
        if recovered_count > 0:
            db_session.commit()
            logger.info("Recovered %s stale submission job(s) back to queued.", recovered_count)
        return recovered_count
    finally:
        if should_close:
            db_session.close()


def claim(job_id: str | None = None) -> SubmissionClaim | None:
    with SessionLocal() as db:
        recover_stale_submission_jobs(db)
        ready = db.query(SubmissionJob).filter(
            SubmissionJob.status == "queued",
            SubmissionJob.next_attempt_at <= datetime.now(timezone.utc),
        )
        if job_id is not None:
            ready = ready.filter(SubmissionJob.id == job_id)
        job = ready.order_by(
            SubmissionJob.created_at, SubmissionJob.id
        ).with_for_update(skip_locked=True).first()
        if job is None:
            return None
        job.status = "running"
        job.attempts += 1
        job.updated_at = datetime.now(timezone.utc)
        job.claim_token = uuid.uuid4()
        owned = SubmissionClaim(job.id, job.claim_token)
        db.commit()
        return owned


def run_one(owned: SubmissionClaim) -> None:
    with SessionLocal() as db:
        job = db.query(SubmissionJob).filter(
            SubmissionJob.id == owned.job_id,
            SubmissionJob.status == "running",
            SubmissionJob.claim_token == owned.token,
        ).first()
        if job is None:
            return
        try:
            user = db.get(Profile, job.student_id)
            result = run_code_submission(
                None,
                CodeSubmissionRequest(activity_id=job.activity_id, source_code=job.source_code,
                                      dry_run_only=job.dry_run_only,
                                      time_spent_seconds=job.time_spent_seconds or 0),
                user, db, submission_claim=owned,
            )
            # Official grading commits its own result with the attempt and XP.
            if result is not None:
                job = lock_submission_claim(db, owned)
                if job is not None:
                    finish_submission(job, jsonable_encoder(result))
                    db.commit()
            return
        except HTTPException as exc:
            retryable = exc.status_code >= 500
            retry_after = (exc.headers or {}).get("Retry-After", "")
            error = str(exc.detail)[:500]
        except Exception:
            logger.exception("Submission job failed (job_id=%s)", owned.job_id)
            retryable = True
            retry_after = ""
            error = "Grading is unavailable. Your draft is safe; try again later."
        db.rollback()
        job = lock_submission_claim(db, owned)
        if job is None:
            return
        now = datetime.now(timezone.utc)
        retryable = retryable and job.attempts < settings.SUBMISSION_MAX_RETRIES
        job.status = "queued" if retryable else "failed"
        job.claim_token = None
        if retryable:
            delay = max(2 ** job.attempts, int(retry_after) if retry_after.isdecimal() else 0)
            job.next_attempt_at = now + timedelta(seconds=delay)
        job.error_message = error
        job.updated_at = now
        db.commit()


def _write_heartbeat() -> None:
    with SessionLocal.begin() as db:
        record_grading_worker_heartbeat(db)


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    prefer_exam = True
    active = 0
    active_exams = 0
    # Keep a slot available for practice whenever the worker has more than one slot.
    exam_limit = min(settings.EXAM_GRADING_CONCURRENCY, max(1, settings.SUBMISSION_WORKER_CONCURRENCY - 1))
    next_heartbeat = 0.0

    async def process(kind: str, item_id) -> None:
        nonlocal active, active_exams
        try:
            if kind == "exam":
                await anyio.to_thread.run_sync(grade_exam, item_id)
            else:
                await anyio.to_thread.run_sync(run_one, item_id)
        except Exception:
            logger.exception("Grading worker failed for %s %s; recovery will retry.", kind, item_id)
        finally:
            active -= 1
            if kind == "exam":
                active_exams -= 1

    async with anyio.create_task_group() as tasks:
        while True:
            if monotonic() >= next_heartbeat:
                next_heartbeat = monotonic() + 15
                try:
                    await anyio.to_thread.run_sync(_write_heartbeat)
                except SQLAlchemyError as exc:
                    logger.warning("Could not write grading worker heartbeat (%s).", type(exc).__name__)
            try:
                if active >= settings.SUBMISSION_WORKER_CONCURRENCY:
                    await anyio.sleep(0.1)
                    continue
                exam_id = await anyio.to_thread.run_sync(claim_exam) if prefer_exam and active_exams < exam_limit else None
                job_id = await anyio.to_thread.run_sync(claim) if not exam_id else None
                if not job_id and not exam_id and active_exams < exam_limit and not prefer_exam:
                    exam_id = await anyio.to_thread.run_sync(claim_exam)
                sent = False
                if not exam_id and not job_id and active == 0:
                    sent = await anyio.to_thread.run_sync(deliver_one)
            except (OperationalError, TimeoutError) as exc:
                logger.warning("Worker database unavailable (%s). Retrying in 5 seconds.", type(exc).__name__)
                await anyio.sleep(5)
                continue
            prefer_exam = not prefer_exam
            if exam_id or job_id:
                active += 1
                if exam_id:
                    active_exams += 1
                tasks.start_soon(process, "exam" if exam_id else "job", exam_id or job_id)
            elif active == 0:
                if not sent:
                    await anyio.sleep(1)
            else:
                await anyio.sleep(0.2)


if __name__ == "__main__":
    anyio.run(main)

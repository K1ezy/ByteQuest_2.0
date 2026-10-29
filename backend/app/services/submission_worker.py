"""Bounded worker for durable Judge0 jobs. Run as a separate service."""

import hashlib
import logging
from datetime import datetime, timedelta, timezone

import anyio
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.submissions import CodeSubmissionRequest, run_code_submission
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.entities import ActivityAttempt, Profile, SubmissionJob

from app.services.exam_worker import claim_exam, grade_exam
from app.services.email_worker import deliver_one

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
            hidden_passed = 0
            hidden_total = 0
            for tc in test_results:
                if not isinstance(tc, dict):
                    continue
                is_hidden = tc.get("is_hidden", False)
                if is_hidden:
                    hidden_total += 1
                    if tc.get("passed"):
                        hidden_passed += 1
                else:
                    visible_tests.append(tc)
            eval_copy["test_results"] = visible_tests
            eval_copy["hidden_summary"] = {"passed": hidden_passed, "total": hidden_total}
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
            SubmissionJob.updated_at < cutoff,
        ).with_for_update(skip_locked=True).all()
        recovered_count = 0
        for job in stale_jobs:
            job.status = "queued" if job.attempts < settings.SUBMISSION_MAX_RETRIES else "failed"
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


def claim() -> str | None:
    with SessionLocal() as db:
        recover_stale_submission_jobs(db)
        cutoff = datetime.now(timezone.utc) - timedelta(
            seconds=settings.SUBMISSION_STALE_TIMEOUT_SECONDS
        )
        job = db.query(SubmissionJob).filter(or_(
            (SubmissionJob.status == "queued") & (SubmissionJob.next_attempt_at <= datetime.now(timezone.utc)),
            (SubmissionJob.status == "running") & (SubmissionJob.updated_at < cutoff),
        )).order_by(
            SubmissionJob.created_at, SubmissionJob.id
        ).with_for_update(skip_locked=True).first()
        if job is None:
            return None
        job.status = "running"
        job.attempts += 1
        job.updated_at = datetime.now(timezone.utc)
        job_id = str(job.id)
        db.commit()
        return job_id


def run_one(job_id: str) -> None:
    with SessionLocal() as db:
        job = db.query(SubmissionJob).filter(SubmissionJob.id == job_id).first()
        if job is None:
            return
        try:
            previous = db.query(ActivityAttempt).filter(ActivityAttempt.submission_job_id == job.id).first()
            if previous is not None and job.result_json is not None:
                result = job.result_json
            else:
                user = db.get(Profile, job.student_id)
                # This worker is intentionally independent of app.main. Importing
                # the API app here used to couple a long-lived worker to router
                # changes and fail jobs after a deploy (e.g. a new entity class).
                result = run_code_submission(
                    None,
                    CodeSubmissionRequest(activity_id=job.activity_id, source_code=job.source_code,
                                          dry_run_only=job.dry_run_only),
                    user, db, submission_job_id=job.id,
                )
            job = db.get(SubmissionJob, job_id)
            job.status = "completed"
            job.result_json = jsonable_encoder(result)
            job.error_message = None
        except HTTPException as exc:
            db.rollback()
            job = db.get(SubmissionJob, job_id)
            retryable = exc.status_code >= 500 and job.attempts < settings.SUBMISSION_MAX_RETRIES
            job.status = "queued" if retryable else "failed"
            if retryable:
                job.next_attempt_at = datetime.now(timezone.utc) + timedelta(seconds=2 ** job.attempts)
            job.error_message = str(exc.detail)[:500]
        except Exception:
            logger.exception("Submission job failed (job_id=%s)", job_id)
            db.rollback()
            job = db.get(SubmissionJob, job_id)
            retryable = job.attempts < settings.SUBMISSION_MAX_RETRIES
            job.status = "queued" if retryable else "failed"
            if retryable:
                job.next_attempt_at = datetime.now(timezone.utc) + timedelta(seconds=2 ** job.attempts)
            job.error_message = "Grading is unavailable. Your draft is safe; try again later."
        job.updated_at = datetime.now(timezone.utc)
        db.commit()


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    prefer_exam = True
    active = 0
    active_exam = False

    async def process(kind: str, item_id) -> None:
        nonlocal active, active_exam
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
                active_exam = False

    async with anyio.create_task_group() as tasks:
        while True:
            if active >= settings.SUBMISSION_WORKER_CONCURRENCY:
                await anyio.sleep(0.1)
                continue
            exam_id = await anyio.to_thread.run_sync(claim_exam) if prefer_exam and not active_exam else None
            job_id = await anyio.to_thread.run_sync(claim) if not exam_id else None
            if not job_id and not exam_id and not active_exam:
                exam_id = await anyio.to_thread.run_sync(claim_exam)
            prefer_exam = not prefer_exam
            if exam_id or job_id:
                active += 1
                if exam_id:
                    active_exam = True
                tasks.start_soon(process, "exam" if exam_id else "job", exam_id or job_id)
            elif active == 0:
                sent = await anyio.to_thread.run_sync(deliver_one)
                if not sent:
                    await anyio.sleep(1)
            else:
                await anyio.sleep(0.2)


if __name__ == "__main__":
    anyio.run(main)

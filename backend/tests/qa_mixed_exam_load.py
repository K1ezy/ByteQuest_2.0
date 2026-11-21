"""Measure mixed Judge0 work with or without a worker restart on an isolated stack."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import secrets
import string
import subprocess
import sys
import time
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from sqlalchemy import select
from sqlalchemy.engine import make_url

import qa_live_multi_role as qa
from app.models.entities import ActivityAttempt, Exam, ExamAttempt, Profile, SubmissionJob
from scripts.pilot_foundations import require_local as require_local_database


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def start_process(command: list[str], path: Path) -> subprocess.Popen:
    with path.open("ab") as output:
        return subprocess.Popen([sys.executable, *command], stdout=output, stderr=subprocess.STDOUT,
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)


def stop_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
    else:
        process.terminate()
    process.wait(timeout=15)


async def wait_for_api(client: httpx.AsyncClient, origin: str, process: subprocess.Popen) -> None:
    for _ in range(30):
        if process.poll() is not None:
            raise RuntimeError("The isolated API stopped during startup.")
        try:
            if (await client.get(f"{origin}/readyz", timeout=1)).status_code == 200:
                return
        except httpx.TransportError:
            pass
        await asyncio.sleep(1)
    raise TimeoutError("The isolated API never became ready.")


async def prepare_exam(session: qa.Session, instructor: str, students: list[str], ids: dict, *, duration_minutes: int = 20) -> str:
    group = (await session.call(instructor, "POST", "/workshops",
                                json={"name": "Mixed-load exam group", "language": "python"})).json()
    joined = await asyncio.gather(*(session.call(token, "POST", "/workshops/join", json={"code": group["join_code"]})
                                    for token in students))
    assert all(response.status_code == 200 for response in joined), session.failures
    now = utcnow()
    body = {"title": "Mixed workload rehearsal", "opens_at": (now + timedelta(minutes=1)).isoformat(),
            "closes_at": (now + timedelta(hours=1)).isoformat(), "duration_minutes": duration_minutes,
            "workshop_ids": [group["id"]], "items": [{"activity_id": ids[key], "points": 10} for key in ("double", "quiz")]}
    exam_id = (await session.call(instructor, "POST", "/exams/instructor", json=body)).json()["id"]
    await session.call(instructor, "POST", f"/exams/instructor/{exam_id}/publish")
    with qa.SessionLocal.begin() as db:
        db.get(Exam, uuid.UUID(exam_id)).opens_at = now - timedelta(seconds=1)
    return exam_id


async def save_exam(session: qa.Session, token: str, exam_id: str) -> str:
    started = await session.call(token, "POST", f"/exams/{exam_id}/start", student=True)
    started.raise_for_status()
    attempt_id = started.json()["attempt_id"]
    base = f"/exams/attempts/{attempt_id}"
    detail = (await session.call(token, "GET", base, student=True)).json()
    answers = {item["id"]: ("import time\ntime.sleep(0.35)\n" + qa.REFERENCE if item["kind"] == "challenge"
                            else {"q1": "A", "q2": "A", "q3": "A"}) for item in detail["items"]}
    await session.call(token, "PUT", f"{base}/answers", student=True,
                       json={"expected_revision": detail["revision"], "answers": answers})
    return attempt_id


async def measure_exam_samples(session: qa.Session, learners: list[str], attempts: list[str]) -> dict:
    paths = [f"/exams/attempts/{attempt_id}" for attempt_id in attempts]
    details = await asyncio.gather(*(session.call(token, "GET", path)
                                    for token, path in zip(learners, paths, strict=True)))
    assert not session.failures, session.failures
    item_ids = [next(item["id"] for item in detail.json()["items"] if item["kind"] == "challenge") for detail in details]

    async def sample(token: str, path: str, item_id: str) -> float:
        started = time.perf_counter()
        response = await session.call(token, "POST", f"{path}/run-sample", student=True,
                                      json={"item_id": item_id, "source_code": qa.REFERENCE})
        elapsed = time.perf_counter() - started
        assert response.status_code == 200, session.failures
        evaluation = response.json()["evaluation"]
        assert evaluation["is_successful"] and evaluation["total_test_cases"] == 2
        return elapsed

    samples = await asyncio.gather(*(sample(token, path, item_id)
                                   for token, path, item_id in zip(learners, paths, item_ids, strict=True)), return_exceptions=True)
    assert not session.failures, session.failures
    elapsed = []
    for outcome in samples:
        if isinstance(outcome, BaseException):
            raise outcome
        elapsed.append(outcome)
    return qa.summary(elapsed)


async def report_exam_grading(exam_id: str, expected: int, restart_worker: Callable[[], None] | None) -> dict:
    queued, claimed, completed = {}, {}, {}
    interrupted = None
    deadline = time.monotonic() + 360
    while time.monotonic() < deadline:
        observed = utcnow()
        with qa.SessionLocal() as db:
            rows = db.execute(select(ExamAttempt.id, ExamAttempt.status, ExamAttempt.submitted_at,
                                     ExamAttempt.grading_claimed_at, ExamAttempt.grading_attempts)
                              .where(ExamAttempt.exam_id == uuid.UUID(exam_id))).all()
        for attempt_id, status, submitted_at, claimed_at, _ in rows:
            if submitted_at is not None:
                queued.setdefault(attempt_id, submitted_at)
            if claimed_at is not None:
                claimed.setdefault(attempt_id, claimed_at)
            if status == "failed":
                raise AssertionError("An exam exhausted grading retries.")
            if status == "submitted":
                completed.setdefault(attempt_id, observed)
        if restart_worker is not None and interrupted is None:
            interrupted = next((row.id for row in rows if row.status == "grading" and row.grading_claimed_at), None)
            if interrupted is not None:
                print("Restarting the isolated worker with an exam claim in flight.", flush=True)
                restart_worker()
        if len(completed) == expected:
            attempt_claims = {row.id: row.grading_attempts for row in rows}
            if restart_worker is not None:
                assert interrupted is not None and attempt_claims[interrupted] > 1, "The interrupted lease was not reclaimed."
            else:
                assert set(attempt_claims.values()) == {1}, "The uninterrupted workload required a retry."
            assert len(claimed) == expected, f"Only {len(claimed)}/{expected} exam claims were observed."
            first_ready = min(queued.values())
            return {"exam_first_claim_wait_seconds": qa.summary([(claimed[key] - queued[key]).total_seconds() for key in completed]),
                    "exam_submit_to_grade_seconds": qa.summary([(value - queued[key]).total_seconds() for key, value in completed.items()]),
                    "exam_first_claim_to_grade_seconds": qa.summary([(value - claimed[key]).total_seconds() for key, value in completed.items()]),
                    "first_submit_until_all_ready_seconds": round((max(completed.values()) - first_ready).total_seconds(), 3),
                    "interrupted_attempt_claims": attempt_claims.get(interrupted),
                    "exam_extra_claims": sum(count - 1 for count in attempt_claims.values())}
        await asyncio.sleep(0.15)
    raise TimeoutError(f"Only {len(completed)}/{expected} exam attempts reached a grade.")


async def run(students: int, port: int, *, interrupt: bool, exam_samples: bool) -> None:
    origin = f"http://127.0.0.1:{port}"
    api = f"{origin}/api/v1"
    qa.api_base = lambda: api
    qa.require_local(api)
    qa.STATE_FILE = qa.QA_DIR / "mixed-exam-accounts.json"
    if qa.STATE_FILE.exists():
        raise SystemExit("A previous mixed rehearsal still has synthetic credentials on disk.")
    run_id = "".join(secrets.choice(string.ascii_lowercase) for _ in range(6))
    state = {"run": run_id, "accounts": []}
    qa.save_state(state)
    worker = None
    server = None
    worker_log = qa.QA_DIR / f"mixed-exam-worker-{run_id}.log"

    def restart_worker():
        nonlocal worker
        if worker is not None:
            stop_process(worker)
        # Only the restart rehearsal shortens the lease in its isolated worker process.
        command = ["-c", "from datetime import timedelta; import anyio; "
                                "from app.services import exam_worker, submission_worker; "
                                "exam_worker.GRADING_LEASE=timedelta(seconds=20); anyio.run(submission_worker.main)"]
        worker = start_process(command if interrupt else ["-m", "app.services.submission_worker"], worker_log)

    try:
        server = start_process(["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
                               qa.QA_DIR / f"mixed-exam-api-{run_id}.log")
        async with httpx.AsyncClient(timeout=60, trust_env=False, limits=httpx.Limits(max_connections=60)) as client:
            await wait_for_api(client, origin, server)
            qa.create_accounts(run_id, students, state)
            admin, instructor = (qa.signed_token(next(account["id"] for account in state["accounts"] if account["role"] == role))
                                 for role in ("admin", "instructor"))
            learners = [qa.signed_token(account["id"]) for account in state["accounts"]
                        if account["role"] == "student" and not account["outside_course"]]
            session = qa.Session(client, api)
            ids = await qa.instructor_builds_course(session, admin, instructor, state, run_id)
            assert not session.failures, session.failures
            for token in learners:
                await session.call(token, "PUT", "/profile/onboarding", student=True,
                                   json={"enrolled_language": "python", "year_level": 1, "semester": 1})
            exam_id = await prepare_exam(session, instructor, learners, ids)
            attempts = await asyncio.gather(*(save_exam(session, token, exam_id) for token in learners))
            exam_sample_timing = await measure_exam_samples(session, learners, attempts) if exam_samples else None
            if exam_sample_timing is not None:
                print(f"{students} timed-exam samples completed: {json.dumps(exam_sample_timing)}", flush=True)
            print(f"{students} learners saved mixed quiz and code exam answers. Starting the shared grading workload.", flush=True)
            restart_worker()
            practice_turnaround = {"sample": [], "official": []}

            async def practice(token: str) -> None:
                sample, elapsed = await session.graded(token, ids["double"], qa.REFERENCE, dry_run=True)
                assert sample and sample["evaluation"]["is_successful"], session.failures
                practice_turnaround["sample"].append(elapsed)
                result, elapsed = await session.graded(token, ids["double"], qa.REFERENCE, dry_run=False)
                assert result and result["xp_awarded"] == 40 and result["evaluation"]["is_successful"], session.failures
                practice_turnaround["official"].append(elapsed)

            async def submit_exams():
                await asyncio.gather(*(session.call(token, "POST", f"/exams/attempts/{attempt_id}/submit", student=True)
                                       for token, attempt_id in zip(learners, attempts, strict=True)))

            async with asyncio.TaskGroup() as work:
                grading = work.create_task(report_exam_grading(exam_id, students, restart_worker if interrupt else None))
                work.create_task(submit_exams())
                for token in learners:
                    work.create_task(practice(token))
            assert not session.failures, session.failures
            for token, attempt_id in zip(learners, attempts, strict=True):
                held = (await session.call(token, "GET", f"/exams/attempts/{attempt_id}", student=True)).json()
                assert held["result"] is None and held["score"] is None
            with qa.SessionLocal.begin() as db:
                exam = db.get(Exam, uuid.UUID(exam_id))
                exam.closes_at = utcnow() - timedelta(seconds=1)
            release_path = f"/exams/instructor/{exam_id}/release"
            first = (await session.call(instructor, "POST", release_path)).json()
            assert (await session.call(instructor, "POST", release_path)).json() == first
            for token, attempt_id in zip(learners, attempts, strict=True):
                released = (await session.call(token, "GET", f"/exams/attempts/{attempt_id}", student=True)).json()
                assert released["result"]["score"] == 20
            with qa.SessionLocal() as db:
                exam_attempts = db.scalars(select(ExamAttempt).where(ExamAttempt.exam_id == uuid.UUID(exam_id))).all()
                attempts_count = db.query(ActivityAttempt).filter(ActivityAttempt.exam_attempt_id.in_([row.id for row in exam_attempts])).count()
                assert attempts_count == students * 2
                assert all(row.result_json["activity_xp_awards"] == {ids["quiz"]: 25} for row in exam_attempts)
                practice_awards = db.execute(select(ActivityAttempt.student_id, ActivityAttempt.xp_awarded).where(
                    ActivityAttempt.student_id.in_([row.student_id for row in exam_attempts]),
                    ActivityAttempt.activity_id == uuid.UUID(ids["double"]),
                    ActivityAttempt.exam_attempt_id.is_(None),
                )).all()
                assert len(practice_awards) == students and all(xp == 40 for _, xp in practice_awards)
                assert {student_id for student_id, _ in practice_awards} == {row.student_id for row in exam_attempts}
                jobs = db.execute(select(SubmissionJob.status, SubmissionJob.attempts, SubmissionJob.dry_run_only)
                                  .where(SubmissionJob.student_id.in_([row.student_id for row in exam_attempts]))).all()
                assert len(jobs) == students * 2 and all(job.status == "completed" for job in jobs)
                assert sum(job.dry_run_only for job in jobs) == students
                practice_extra_claims = sum(job.attempts - 1 for job in jobs)
            summary = grading.result() | {"students": students, "worker_restarted": interrupt,
                                         "worker_slots": qa.settings.SUBMISSION_WORKER_CONCURRENCY,
                                         "exam_slots": qa.settings.EXAM_GRADING_CONCURRENCY,
                                         "practice_extra_claims": practice_extra_claims,
                                         "practice_turnaround_seconds": {key: qa.summary(values)
                                                                         for key, values in practice_turnaround.items()},
                                         "exam_sample_http_seconds": exam_sample_timing, "practice_timing": {
                label: qa.summary(values) for label, values in session.grading_timing.items()}, "graded_exam_items": attempts_count}
            result = qa.QA_DIR / f"mixed-exam-result-{run_id}.json"
            result.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(summary, indent=2))
            print("PASS held results, unique grades, one activity XP award, and idempotent release.")
    finally:
        try:
            if worker is not None:
                stop_process(worker)
            if server is not None:
                stop_process(server)
        finally:
            qa.cleanup()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--students", type=int, default=30, choices=range(2, 61), metavar="2..60")
    parser.add_argument("--api-port", type=int, default=16931)
    parser.add_argument("--isolated-db-port", type=int, required=True)
    parser.add_argument("--no-restart", action="store_true", help="Use the normal worker lease and leave the worker running through grading.")
    parser.add_argument("--exam-samples", action="store_true", help="Run a concurrent timed-exam sample burst before the mixed grading workload.")
    args = parser.parse_args()
    database_port = make_url(qa.settings.DATABASE_URL).port
    if (qa.settings.ENVIRONMENT.lower() != "development" or database_port != args.isolated_db_port
            or database_port in {5432, 15432} or urlsplit(qa.settings.SUPABASE_URL).port in {54321, 15431}):
        parser.error("Configure a disposable local Supabase instance separate from the regular development database.")
    require_local_database()
    qa.require_local(f"http://127.0.0.1:{args.api_port}")
    with qa.SessionLocal() as db:
        if any(db.scalar(select(select(model.id).exists())) for model in (Profile, Exam, SubmissionJob)):
            parser.error("The mixed-load worker requires an empty, disposable Supabase instance.")
    asyncio.run(run(args.students, args.api_port, interrupt=not args.no_restart, exam_samples=args.exam_samples))


if __name__ == "__main__":
    main()

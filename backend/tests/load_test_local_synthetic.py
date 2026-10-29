"""Run the local 30-student pilot load without token files or lasting accounts.

Requires a running local API and grading worker, a reachable Judge0, and one
published verified challenge. Synthetic auth users are deleted in ``finally``.
"""

import asyncio
import os
import statistics
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

import httpx
import jwt
from sqlalchemy import text
from sqlalchemy.engine import make_url

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.entities import ActivityKind, LearningActivity, Profile, ReviewState, UserRole


BASE_URL = os.getenv("BYTEQUEST_BASE_URL", "http://127.0.0.1:8010").rstrip("/")
STUDENTS = 30


def require_local() -> None:
    database = make_url(settings.DATABASE_URL)
    api = urlsplit(BASE_URL)
    auth = urlsplit(settings.SUPABASE_URL)
    if (database.host not in {"localhost", "127.0.0.1", "::1"} or
            api.hostname not in {"localhost", "127.0.0.1"} or
            auth.hostname not in {"localhost", "127.0.0.1"} or
            not settings.SUPABASE_JWT_SECRET or
            settings.SUPABASE_JWT_SECRET == "super-secret-jwt-token-replace-in-env"):
        raise SystemExit("This load check is restricted to configured local services.")


def make_students() -> tuple[uuid.UUID, str, list[tuple[uuid.UUID, str]]]:
    with SessionLocal() as db:
        activity = db.query(LearningActivity).filter(
            LearningActivity.activity_type == ActivityKind.challenge,
            LearningActivity.review_status == ReviewState.published,
            LearningActivity.judge0_verified.is_(True),
            LearningActivity.reference_solution_code.is_not(None),
        ).order_by(LearningActivity.created_at.desc()).first()
        if activity is None:
            raise SystemExit("Publish and verify a local challenge before this load check.")
        created = []
        for _ in range(STUDENTS):
            user_id = uuid.uuid4()
            db.execute(text("insert into auth.users "
                "(id,instance_id,aud,role,email,encrypted_password) "
                "values (:id,'00000000-0000-0000-0000-000000000000'," 
                "'authenticated','authenticated',:email,'')"),
                {"id": user_id, "email": f"load-{user_id.hex}@example.test"})
            db.add(Profile(id=user_id, pseudonym_id=f"load_{user_id.hex}",
                role=UserRole.student, year_level=1, semester=1,
                enrolled_language=activity.language, xp_points=0, current_level=1))
            token = jwt.encode({"sub": str(user_id), "aud": "authenticated",
                "role": "authenticated", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                settings.SUPABASE_JWT_SECRET, algorithm="HS256")
            created.append((user_id, token))
        activity_id = activity.id
        solution = activity.reference_solution_code
        db.commit()
        return activity_id, solution, created


async def one_student(client: httpx.AsyncClient, token: str, activity_id: uuid.UUID,
                      code: str, index: int) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    phase = "dashboard"
    started = time.monotonic()
    try:
        dashboard = await client.get(f"{BASE_URL}/api/v1/pilot/dashboard", headers=headers)
        dashboard.raise_for_status()
        phase = "draft"
        draft = await client.put(f"{BASE_URL}/api/v1/pilot/drafts/{activity_id}",
                                 headers=headers, json={"source_code": code})
        draft.raise_for_status()
        phase = "submit"
        submitted_at = time.monotonic()
        accepted = await client.post(f"{BASE_URL}/api/v1/submission-jobs",
            headers={**headers, "Idempotency-Key": f"load-{uuid.uuid4()}"},
            json={"activity_id": str(activity_id), "source_code": code, "dry_run_only": False})
        accepted.raise_for_status()
        job_id = accepted.json()["id"]
        phase = "status"
        while time.monotonic() - submitted_at < 120:
            try:
                response = await client.get(f"{BASE_URL}/api/v1/submission-jobs/{job_id}", headers=headers)
                response.raise_for_status()
            except httpx.ReadTimeout:
                continue
            job = response.json()
            if job["status"] in ("completed", "failed"):
                return {"student": index, "status": job["status"],
                        "seconds": round(time.monotonic() - submitted_at, 2), "error": job.get("error")}
            await asyncio.sleep(2)
        return {"student": index, "status": "pending", "seconds": 120, "error": None}
    except Exception as exc:
        return {"student": index, "status": "request_error", "phase": phase,
                "seconds": round(time.monotonic() - started, 2), "error": type(exc).__name__}


async def run_load(activity_id: uuid.UUID, code: str, users: list[tuple[uuid.UUID, str]]) -> list[dict]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(60, connect=5),
                                 limits=httpx.Limits(max_connections=40)) as client:
        results = await asyncio.gather(*(
            one_student(client, token, activity_id, code, index)
            for index, (_, token) in enumerate(users, 1)
        ), return_exceptions=True)
    return [item if isinstance(item, dict) else {"student": index,
        "status": "request_error", "seconds": None, "error": type(item).__name__}
        for index, item in enumerate(results, 1)]


def cleanup(users: list[tuple[uuid.UUID, str]]) -> None:
    with SessionLocal() as db:
        with db.begin():
            db.execute(text("set local lock_timeout = '15s'"))
            # Cascade cleanup is deliberately scoped to these synthetic IDs.
            # Production's append-only guard remains enabled after this one
            # transaction, including if the transaction rolls back.
            db.execute(text("alter table public.activity_attempts disable trigger trg_activity_attempts_append_only"))
            for user_id, _ in users:
                db.execute(text("delete from auth.users where id=:id"), {"id": user_id})
            db.execute(text("alter table public.activity_attempts enable trigger trg_activity_attempts_append_only"))


def main() -> None:
    require_local()
    users = []
    try:
        activity_id, solution, users = make_students()
        results = asyncio.run(run_load(activity_id, solution, users))
        for result in results:
            print(result)
        completed = [item["seconds"] for item in results if item["status"] == "completed"]
        within_30 = sum(seconds <= 30 for seconds in completed)
        print(f"Completed: {len(completed)}/{STUDENTS}; within 30s: {within_30}/{STUDENTS}")
        if completed:
            print(f"Median wait: {statistics.median(completed):.2f}s; maximum: {max(completed):.2f}s")
        if len(completed) != STUDENTS or within_30 < 27:
            raise SystemExit(1)
    finally:
        if users:
            cleanup(users)


if __name__ == "__main__":
    main()

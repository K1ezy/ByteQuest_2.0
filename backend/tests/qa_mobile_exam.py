"""Run the local mobile-viewport exam journey with a disposable learner."""

import argparse
import asyncio
import json
import secrets
import string
import subprocess
import uuid
from datetime import timedelta

import httpx

import qa_live_multi_role as qa
from app.models.entities import Exam
from qa_mixed_exam_load import prepare_exam, utcnow


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--responsive", action="store_true", help="Run the localhost viewport matrix.")
    args = parser.parse_args()
    api = qa.api_base()
    qa.require_local(api)
    qa.STATE_FILE = qa.QA_DIR / "mobile-exam-accounts.json"
    if qa.STATE_FILE.exists():
        raise SystemExit("A previous mobile QA fixture still needs cleanup.")
    run_id = "".join(secrets.choice(string.ascii_lowercase) for _ in range(6))
    state = {"run": run_id, "accounts": []}
    qa.save_state(state)
    try:
        qa.create_accounts(run_id, 1, state)
        admin, instructor = (qa.signed_token(next(account["id"] for account in state["accounts"] if account["role"] == role))
                             for role in ("admin", "instructor"))
        learner = next(account for account in state["accounts"] if account["role"] == "student" and not account["outside_course"])
        token = qa.signed_token(learner["id"])
        async with httpx.AsyncClient(timeout=60, trust_env=False) as client:
            session = qa.Session(client, api)
            ids = await qa.instructor_builds_course(session, admin, instructor, state, run_id)
            await session.call(token, "PUT", "/profile/onboarding", json={
                "enrolled_language": "python", "year_level": 1, "semester": 1})
            exam_id = await prepare_exam(session, instructor, [token], ids, duration_minutes=20 if args.responsive else 1)
            assert not session.failures, session.failures
            if args.responsive:
                accounts = {account["role"]: {"email": account["email"], "password": account["password"]}
                            for account in state["accounts"] if not account["outside_course"]}
                fixture = {"exam_id": exam_id, "challenge_id": ids["double"], "quiz_id": ids["quiz"],
                           "course_id": state["course_id"], "accounts": accounts, "code": qa.REFERENCE}
                await asyncio.to_thread(subprocess.run, ["node", str(qa.ROOT / "frontend/scripts/qa-responsive.mjs")],
                                        input=json.dumps(fixture), text=True, check=True, timeout=260)
                return
            final = qa.REFERENCE + "# Restored after losing the browser connection\n"
            fixture = {"exam_id": exam_id, "email": learner["email"],
                       "password": learner["password"], "initial": qa.CODE["wrong"], "final": final}
            await asyncio.to_thread(subprocess.run, ["node", str(qa.ROOT / "frontend/scripts/qa-exam-mobile.mjs")],
                                    input=json.dumps(fixture), text=True, check=True, timeout=125)
            exam = (await session.call(token, "GET", f"/exams/{exam_id}")).json()
            attempt_id = exam["latest_attempt_id"]
            path = f"/exams/attempts/{attempt_id}"
            for _ in range(40):
                held = (await session.call(token, "GET", path)).json()
                if held["status"] == "submitted":
                    break
                await asyncio.sleep(1)
            else:
                raise TimeoutError("The exam did not reach its held grade.")
            assert held["result"] is None and final in held["answers"].values()
            with qa.SessionLocal.begin() as db:
                db.get(Exam, uuid.UUID(exam_id)).closes_at = utcnow() - timedelta(seconds=1)
            await session.call(instructor, "POST", f"/exams/instructor/{exam_id}/release")
            released = (await session.call(token, "GET", path)).json()
            assert released["result"]["score"] == 20 and not session.failures, session.failures
            print("PASS actual local worker graded the reconnected answer and the instructor released 20/20.")
    finally:
        qa.cleanup()


if __name__ == "__main__":
    asyncio.run(main())

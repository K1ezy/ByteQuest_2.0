"""Live multi-role QA run: throwaway accounts exercise the whole system, then vanish.

Creates an isolated QA course with its own administrator, instructor and N students
(real Supabase sign-in accounts). It drives every role through the running API,
grading worker, Judge0 and database, checks that all roles report the same facts,
measures response and grading times, and removes everything it created.

Run from backend/ while ByteQuest is running (START-BYTEQUEST.bat):

    .venv\\Scripts\\python tests\\qa_live_multi_role.py                    # run, report, clean up
    .venv\\Scripts\\python tests\\qa_live_multi_role.py --students 30 --keep  # keep the QA class to look at
    .venv\\Scripts\\python tests\\qa_live_multi_role.py --cleanup           # remove a kept QA class

It never edits existing accounts, courses or activities. While a run is in progress
(or kept), its QA students appear on the Python leaderboard. Sign-in details for a
kept run are written to logs/qa/accounts.json, which git ignores. Restricted to
local services. No AI (Gemini) calls are made.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import secrets
import statistics
import string
import sys
import time
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

import httpx
import jwt
from sqlalchemy import text
from sqlalchemy.engine import make_url

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
QA_DIR = ROOT / "logs" / "qa"
STATE_FILE = QA_DIR / "accounts.json"
# Distinctive hidden case: if these strings reach a student, hidden tests leaked. Long enough
# that they cannot turn up inside an account id or timestamp by chance.
HIDDEN_IN, HIDDEN_OUT = "987654321", "1975308642"
REFERENCE = "n = int(input())\nprint(n * 2)\n"
CODE = {
    "correct": REFERENCE,
    "wrong": "n = int(input())\nprint(n + 2)\n",                       # passes 1 of 3
    "partial": "n = int(input())\nprint(n * 2 if n < 100 else n)\n",   # passes 2 of 3 (66.67%)
}
QUIZ = {"questions": [
    {"id": f"q{i}", "prompt": f"QA question {i}?", "correct_answer": "A",
     "options": [{"key": "A", "text": "Right"}, {"key": "B", "text": "Wrong"}]}
    for i in (1, 2, 3)
]}
# What each persona does, and the outcome every role must then report.
PERSONAS = {
    "solver":    {"double": ["correct"], "pass60": ["correct"], "quiz": 3},
    "struggler": {"double": ["wrong", "correct"], "pass60": ["correct"], "quiz": 3},
    "partial":   {"double": ["partial"], "pass60": ["partial"], "quiz": 2},
    "quizweak":  {"double": ["correct"], "pass60": [], "quiz": 1},
}
EXPECTED_PASSES = {
    "solver": {"double", "pass60", "quiz"},
    "struggler": {"double", "pass60", "quiz"},
    "partial": {"pass60"},          # 66.67%: fails the 100% challenge, passes the 60% one; quiz 2/3 < 75%
    "quizweak": {"double"},
}


# ---------------------------------------------------------------------------
# Setup helpers
# ---------------------------------------------------------------------------
def api_base() -> str:
    env = (ROOT / "frontend" / ".env.local").read_text(encoding="utf-8") if (ROOT / "frontend" / ".env.local").exists() else ""
    match = re.search(r"^NEXT_PUBLIC_API_URL=(\S+)", env, re.M)
    return (match.group(1) if match else "http://127.0.0.1:8001/api/v1").rstrip("/")


def require_local(api: str) -> None:
    hosts = {"localhost", "127.0.0.1", "::1"}
    if (make_url(settings.DATABASE_URL).host not in hosts or urlsplit(api).hostname not in hosts
            or urlsplit(settings.SUPABASE_URL).hostname not in hosts
            or not settings.SUPABASE_SERVICE_ROLE_KEY or not settings.SUPABASE_ANON_KEY):
        raise SystemExit("This QA run is restricted to configured local services.")


def letters(number: int, width: int = 3) -> str:
    out = ""
    for _ in range(width):
        number, digit = divmod(number, 26)
        out = string.ascii_lowercase[digit] + out
    return out


def save_state(state: dict) -> None:
    QA_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def create_accounts(run: str, students: int, state: dict) -> None:
    """Real Supabase auth users; the signup trigger creates each profile."""
    auth = settings.SUPABASE_URL.rstrip("/") + "/auth/v1"
    headers = {"apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
               "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"}
    plan = [("admin", 0), ("instructor", 0)] + [("student", i) for i in range(students + 1)]
    with httpx.Client(timeout=20) as client:
        for role, index in plan:
            label = f"{role}{index + 1}" if role == "student" else role
            password = secrets.token_urlsafe(18)
            email = f"qa-{run}-{label}@bytequest.test"
            with SessionLocal.begin() as db:
                school_id = db.scalar(text("""
                    INSERT INTO bytequest_private.student_registration_roster (school_id, email)
                    VALUES (:school_id, :email) ON CONFLICT DO NOTHING RETURNING school_id
                """), {"school_id": f"00-{secrets.randbelow(99_999) + 1:05d}", "email": email})
            if not school_id:
                raise SystemExit("Synthetic School ID collided with an existing roster entry. Retry the QA run.")
            state.setdefault("roster_emails", []).append(email)
            save_state(state)
            response = client.post(f"{auth}/admin/users", headers=headers, json={
                "email": email, "password": password, "email_confirm": True,
                "user_metadata": {"username": f"qa{run}{role[:3]}{letters(index)}", "school_id": school_id,
                                  "year_level": "1", "block_section": "A", "registration_role": "student"},
            })
            if response.status_code >= 400:
                raise SystemExit(f"Could not create {label}: {response.status_code} {response.text[:200]}")
            persona = list(PERSONAS)[index % len(PERSONAS)] if role == "student" else None
            state["accounts"].append({"id": response.json()["id"], "role": role, "email": email,
                                      "password": password, "persona": persona,
                                      "outside_course": role == "student" and index == students})
            save_state(state)
    staff = {a["role"]: a["id"] for a in state["accounts"] if a["role"] != "student"}
    with SessionLocal() as db:
        for role, user_id in staff.items():
            # The same grant the local grant-local-instructor.ps1 helper performs.
            db.execute(text("update public.profiles set role = cast(:role as public.userrole) where id = :id"),
                       {"role": role, "id": user_id})
        db.commit()


def password_token(email: str, password: str) -> str:
    """A real sign-in through Supabase auth (rate-limited locally, so used sparingly)."""
    response = httpx.post(f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password",
                          headers={"apikey": settings.SUPABASE_ANON_KEY}, json={"email": email, "password": password},
                          timeout=20)
    response.raise_for_status()
    return response.json()["access_token"]


def signed_token(user_id: str) -> str:
    """Same claims and secret the local auth server signs with; avoids its sign-in rate limit."""
    return jwt.encode({"sub": user_id, "aud": "authenticated", "role": "authenticated",
                       "exp": datetime.now(timezone.utc) + timedelta(hours=2)},
                      settings.SUPABASE_JWT_SECRET, algorithm="HS256")


# ---------------------------------------------------------------------------
# Measured HTTP
# ---------------------------------------------------------------------------
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


class Session:
    def __init__(self, client: httpx.AsyncClient, api: str):
        self.client, self.api = client, api
        self.latency: dict[str, list[float]] = defaultdict(list)
        self.grading_timing: dict[str, list[float]] = defaultdict(list)
        self.failures: list[str] = []
        self.student_bodies: list[str] = []

    async def call(self, token: str, method: str, path: str, *, expect=(200, 201, 202, 204),
                   student: bool = False, **kwargs) -> httpx.Response:
        label = f"{method} {UUID_RE.sub('{id}', path.split('?')[0])}"
        headers = {"Authorization": f"Bearer {token}", **kwargs.pop("headers", {})}
        started = time.perf_counter()
        for attempt in range(3):
            try:
                response = await self.client.request(method, self.api + path, headers=headers, **kwargs)
                break
            except httpx.TransportError:
                if attempt == 2:
                    raise
                await asyncio.sleep(1)
        self.latency[label].append(time.perf_counter() - started)
        if response.status_code not in expect:
            self.failures.append(f"{label} -> {response.status_code}: {response.text[:180]}")
        if student:
            self.student_bodies.append(response.text)
        return response

    async def graded(self, token: str, activity_id: str, code: str, *, dry_run: bool) -> tuple[dict | None, float]:
        """Submit through the job queue and wait for the worker; returns the result and turnaround."""
        started = time.perf_counter()
        accepted = await self.call(token, "POST", "/submission-jobs", student=True,
                                   headers={"Idempotency-Key": f"qa-{uuid.uuid4().hex}"},
                                   json={"activity_id": activity_id, "source_code": code, "dry_run_only": dry_run})
        if accepted.status_code != 202:
            return None, 0.0
        job_id = accepted.json()["id"]
        while time.perf_counter() - started < 180:
            job = (await self.call(token, "GET", f"/submission-jobs/{job_id}", student=True)).json()
            if job.get("status") in {"completed", "failed"}:
                if job["status"] == "failed":
                    self.failures.append(f"grading job failed: {job.get('error')}")
                timing = (job.get("result") or {}).get("timing", {})
                kind = "sample" if dry_run else "official"
                for name in ("ready_queue_seconds", "final_run_seconds"):
                    if isinstance(timing.get(name), (int, float)):
                        self.grading_timing[f"{kind} {name}"].append(timing[name])
                return job.get("result"), time.perf_counter() - started
            await asyncio.sleep(1.5)
        self.failures.append(f"grading job {job_id} still pending after 180 s")
        return None, time.perf_counter() - started


# ---------------------------------------------------------------------------
# The run
# ---------------------------------------------------------------------------
async def instructor_builds_course(s: Session, admin: str, instructor: str, state: dict, run: str) -> dict:
    course = await s.call(admin, "POST", "/admin/courses", json={"code": f"QA-{run.upper()}", "title": f"QA run {run}"})
    course_id = course.json()["course"]["id"]
    state["course_id"] = course_id
    save_state(state)
    for account in state["accounts"]:
        if account["role"] in {"instructor", "student"} and not account["outside_course"]:
            await s.call(admin, "POST", "/admin/assignments", json={
                "profile_id": account["id"], "course_id": course_id, "member_role": account["role"]})

    def challenge(title: str, pass_mark: int | None) -> dict:
        return {"course_id": course_id, "activity_type": "challenge", "language": "python", "title": title, "topic_concept": "QA arithmetic",
                "problem_statement": "Read one whole number and print twice its value.", "difficulty_level": 1,
                "xp_reward": 40, "pass_mark_percent": pass_mark, "starter_code": "n = int(input())\n",
                "reference_solution_code": REFERENCE, "test_cases": [
                    {"order_index": 0, "stdin": "2", "expected_stdout": "4"},
                    {"order_index": 1, "stdin": "3", "expected_stdout": "6"},
                    {"order_index": 2, "stdin": HIDDEN_IN, "expected_stdout": HIDDEN_OUT, "is_hidden": True}]}

    ids = {}
    for key, payload in {
        "double": challenge("QA: double it", None),
        "pass60": challenge("QA: double it (60% pass mark)", 60),
        "quiz": {"course_id": course_id, "activity_type": "quiz", "language": "python", "title": "QA: concept check",
                 "topic_concept": "QA concepts", "problem_statement": "Answer three short concept questions.",
                 "difficulty_level": 1, "xp_reward": 25, "quiz_questions": QUIZ},
    }.items():
        created = await s.call(instructor, "POST", "/faculty/activities", json=payload)
        ids[key] = created.json()["activity"]["activity_id"]
        if key != "quiz":
            verified = await s.call(instructor, "POST", f"/faculty/activities/{ids[key]}/verify")
            if not verified.json().get("activity", {}).get("judge0_verified", True):
                s.failures.append(f"Judge0 did not verify the reference solution for {key}")
        await s.call(instructor, "POST", f"/faculty/activities/{ids[key]}/publish",
                     json={"confirm": True, "preview_confirmed": True})
    state["activities"] = ids
    save_state(state)
    return ids


async def student_session(s: Session, account: dict, ids: dict, timings: dict) -> None:
    token, plan = account["token"], PERSONAS[account["persona"]]
    await s.call(token, "PUT", "/profile/onboarding", student=True,
                 json={"enrolled_language": "python", "year_level": 1, "semester": 1})
    await s.call(token, "GET", "/pilot/dashboard", student=True)
    await s.call(token, "GET", "/quests", student=True)
    for key in ("double", "pass60"):
        for code_name in plan[key]:
            _, waited = await s.graded(token, ids[key], CODE[code_name], dry_run=True)
            timings["sample"].append(waited)
            _, waited = await s.graded(token, ids[key], CODE[code_name], dry_run=False)
            timings["official"].append(waited)
    answers = {f"q{i}": ("A" if i <= plan["quiz"] else "B") for i in (1, 2, 3)}
    await s.call(token, "POST", "/quests/submit-quiz", student=True,
                 json={"activity_id": ids["quiz"], "answers": answers, "time_spent_seconds": 30})


async def run(students: int, keep: bool) -> int:
    api = api_base()
    require_local(api)
    if STATE_FILE.exists():
        raise SystemExit("A kept QA run exists. Remove it first with --cleanup.")
    run_id = "".join(secrets.choice(string.ascii_lowercase) for _ in range(5))
    state: dict = {"run": run_id, "created_at": datetime.now(timezone.utc).isoformat(), "accounts": []}
    save_state(state)
    report: dict = {"run": run_id, "students": students, "checks": []}
    try:
        print(f"QA run {run_id}: creating 1 admin, 1 instructor, {students} classmates and 1 outside student...")
        create_accounts(run_id, students, state)
        by_role = defaultdict(list)
        for account in state["accounts"]:
            by_role["outside" if account["outside_course"] else account["role"]].append(account)
        admin, instructor = by_role["admin"][0], by_role["instructor"][0]
        # Real sign-ins for the staff and one student; signed tokens for the rest.
        admin["token"] = password_token(admin["email"], admin["password"])
        instructor["token"] = password_token(instructor["email"], instructor["password"])
        by_role["student"][0]["token"] = password_token(by_role["student"][0]["email"], by_role["student"][0]["password"])
        for account in by_role["student"][1:]:
            account["token"] = signed_token(account["id"])

        timings: dict[str, list[float]] = {"sample": [], "official": []}
        async with httpx.AsyncClient(timeout=httpx.Timeout(90, connect=5),
                                     limits=httpx.Limits(max_connections=60)) as client:
            s = Session(client, api)
            ids = await instructor_builds_course(s, admin["token"], instructor["token"], state, run_id)
            print("Course built. Students working concurrently...")
            started = time.perf_counter()
            await asyncio.gather(*(student_session(s, account, ids, timings) for account in by_role["student"]))
            report["student_phase_seconds"] = round(time.perf_counter() - started, 1)
            print(f"Students done in {report['student_phase_seconds']} s. Checking every role's view...")
            outside = signed_token(by_role["outside"][0]["id"])
            await verify(s, report, admin, instructor, by_role["student"], ids, state["course_id"], outside)
        report["latency"] = {label: summary(values) for label, values in sorted(s.latency.items())}
        report["grading_seconds"] = {kind: summary(values) for kind, values in timings.items()}
        report["grading_timing"] = {label: summary(values) for label, values in sorted(s.grading_timing.items())}
        report["unexpected_responses"] = s.failures
        print_report(report)
        out = QA_DIR / f"report-{run_id}.json"
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nFull report: {out}")
        failed = [c for c in report["checks"] if not c["ok"]] or s.failures
        return 1 if failed else 0
    finally:
        if keep:
            print(f"\nKept. Sign-in details: {STATE_FILE}. Remove with --cleanup.")
        else:
            cleanup()


# ---------------------------------------------------------------------------
# Cross-role checks against the database's own record
# ---------------------------------------------------------------------------
async def verify(s: Session, report: dict, admin: dict, instructor: dict, students: list[dict],
                 ids: dict, course_id: str, outside_token: str) -> None:
    def check(name: str, ok: bool, detail: str = "") -> None:
        report["checks"].append({"check": name, "ok": bool(ok), "detail": detail})

    key_of = {value: key for key, value in ids.items()}
    student_ids = [a["id"] for a in students]
    with SessionLocal() as db:
        rows = db.execute(text(
            "select student_id::text, activity_id::text, is_successful, xp_awarded, exam_attempt_id from public.activity_attempts "
            "where student_id = any(cast(:ids as uuid[]))"), {"ids": student_ids}).all()
        xp = dict(db.execute(text("select id::text, xp_points from public.profiles where id = any(cast(:ids as uuid[]))"),
                             {"ids": student_ids}).all())
        badge_bonus = dict(db.execute(text(
            "select sb.student_id::text, coalesce(sum(b.xp_bonus), 0) from public.student_badges sb "
            "join public.badges b on b.id = sb.badge_id where sb.student_id = any(cast(:ids as uuid[])) "
            "group by sb.student_id"), {"ids": student_ids}).all())
        job_states = Counter(status for (status,) in db.execute(text(
            "select status from public.submission_jobs where student_id = any(cast(:ids as uuid[]))"),
            {"ids": student_ids}).all())
    passed, attempts, earned = defaultdict(set), Counter(), Counter()
    practice_counts = Counter()
    practice_passes = set()
    for sid, aid, ok, awarded, exam_attempt_id in rows:
        attempts[sid] += 1
        earned[sid] += int(awarded or 0)
        if ok:
            passed[sid].add(key_of[aid])
        if exam_attempt_id is None:
            practice_counts[sid, aid] += 1
            if ok:
                practice_passes.add((sid, aid))

    # 1. Every persona got exactly the outcome its answers deserve (pass marks, quiz threshold).
    wrong = [f"{a['persona']}: {sorted(passed[a['id']])}" for a in students
             if passed[a["id"]] != EXPECTED_PASSES[a["persona"]]]
    check("Each student's passes match their answers and the pass marks", not wrong, "; ".join(wrong[:5]))
    # 2. XP adds up: attempt XP plus badge bonuses equals the profile total.
    off = [a["persona"] for a in students
           if xp.get(a["id"]) != earned[a["id"]] + int(badge_bonus.get(a["id"], 0))]
    check("Profile XP = challenge/quiz XP + badge bonuses", not off, ", ".join(off[:5]))
    # 3. Grading pipeline: nothing failed or stuck.
    check("Every grading job completed", set(job_states) <= {"completed"}, dict(job_states).__repr__())

    # 4. Student views agree with the record.
    mismatched = []
    for account in students:
        token = account["token"]
        quests = (await s.call(token, "GET", "/quests", student=True)).json()
        done = {key_of[q["id"]] for q in quests if q["id"] in key_of and q["is_completed"]}
        profile = (await s.call(token, "GET", "/profile/me", student=True)).json()
        board = (await s.call(token, "GET", "/quests/leaderboard", student=True)).json()
        for path in ("/quests/progress", "/quests/mastery-map", "/quests/progress-recap?days=7",
                     "/quests/codex", "/gamification/state", "/profile/me/analytics"):
            await s.call(token, "GET", path, student=True)
        if done != passed[account["id"]] or profile["xp_points"] != xp[account["id"]] \
                or (board.get("you") or {}).get("xp_points") != xp[account["id"]]:
            mismatched.append(account["persona"])
    check("Quest list, profile and leaderboard agree with the record", not mismatched, ", ".join(mismatched[:5]))
    board = (await s.call(students[0]["token"], "GET", "/quests/leaderboard", student=True)).json()
    totals = [entry["xp_points"] for entry in board["entries"]]
    ranks_ok = totals == sorted(totals, reverse=True) and all(
        entry["rank"] == 1 + sum(other > entry["xp_points"] for other in totals) for entry in board["entries"])
    check("Leaderboard is ordered by XP with tied ranks shared", ranks_ok)
    leaked = [body for body in s.student_bodies if HIDDEN_IN in body or HIDDEN_OUT in body]
    check("Hidden test cases never reached a student", not leaked, f"{len(leaked)} responses")

    # 5. Instructor views agree with the record.
    perf = (await s.call(instructor["token"], "GET", f"/faculty/performance?course_id={course_id}")).json()
    gradebook = (await s.call(instructor["token"], "GET", f"/faculty/gradebook?course_id={course_id}")).json()
    columns = {item["activity_id"]: item for item in gradebook["activities"]}
    for label, aid in ids.items():
        analysis = (await s.call(instructor["token"], "GET", f"/faculty/activities/{aid}/analysis")).json()
        stuck_at = gradebook["stuck_after_attempts"]
        expected = (
            sum(practice_counts[sid, aid] > 0 for sid in student_ids),
            sum((sid, aid) in practice_passes for sid in student_ids),
            sum(practice_counts[sid, aid] >= stuck_at and (sid, aid) not in practice_passes for sid in student_ids),
        )
        column = columns.get(aid, {})
        stuck_progress = (await s.call(
            instructor["token"], "GET", f"/faculty/performance?course_id={course_id}&activity_id={aid}&stuck_only=true",
        )).json()
        check(f"Activity analysis agrees with practice records, gradebook and Student Progress ({label})",
              (analysis.get("attempted"), analysis.get("passed"), analysis.get("stuck")) == expected
              and (column.get("attempted"), column.get("passed")) == expected[:2]
              and len(stuck_progress.get("students", ())) == expected[2])
    posted = await s.call(instructor["token"], "POST", "/faculty/announcements", expect=(201,), json={
        "course_id": course_id, "title": "QA Lab reminder",
        "body": "Bring your headphones.\n<ul>Plain text</ul>", "pinned": True,
    })
    notice_id = posted.json().get("id")
    responses = await asyncio.gather(*(
        s.call(student["token"], "GET", "/pilot/announcements", student=True) for student in students
    ))
    outsider = await s.call(outside_token, "GET", "/pilot/announcements", student=True)
    check("All classmates see the pinned announcement",
          bool(notice_id) and all(any(
              item["id"] == notice_id and item["pinned"] and item["body"] == "Bring your headphones.\n<ul>Plain text</ul>"
              for item in response.json().get("items", [])
          ) for response in responses))
    check("Student outside the course gets no announcements", outsider.json() == {"items": []})
    rows_by_id = {row["student_id"]: row for row in perf["students"]}
    perf_off = [a["persona"] for a in students
                if rows_by_id.get(a["id"], {}).get("completed_count") != len(passed[a["id"]])
                or rows_by_id.get(a["id"], {}).get("attempt_count") != attempts[a["id"]]]
    check("Instructor performance matches every student's record", len(rows_by_id) == len(students) and not perf_off,
          ", ".join(perf_off[:5]))
    insights = (await s.call(instructor["token"], "GET", f"/faculty/gamification-insights?course_id={course_id}")).json()
    solved = sum(len(passed[sid] & {"double", "pass60"}) for sid in student_ids)
    check("Gamification Insights counts the same solves", insights["solve_quality"]["solved"] == solved,
          f"insights {insights['solve_quality']['solved']} vs record {solved}")
    check("Gamification Insights counts the same class", insights["enrolled"] == len(students))
    for path in ("/faculty/dashboard", f"/faculty/activities?course_id={course_id}", f"/faculty/ml?course_id={course_id}",
                 f"/faculty/performance/students/{students[0]['id']}?course_id={course_id}"):
        await s.call(instructor["token"], "GET", path)
    detail = (await s.call(instructor["token"], "GET", f"/faculty/activities/{ids['pass60']}")).json()
    locked = await s.call(instructor["token"], "PATCH", f"/faculty/activities/{ids['pass60']}", expect=(409,),
                          json={"content_version": detail["content_version"], "pass_mark_percent": 100})
    check("Pass mark locks once students have attempted", locked.status_code == 409)

    # 6. Admin views agree, and every role stays inside its own surface.
    items = (await s.call(admin["token"], "GET", "/admin/activities")).json()["items"]
    mine = [item for item in items if item["activity_id"] in key_of]
    check("Admin sees the course's activities open with the whole class enrolled",
          len(mine) == 3 and all(i["state"] == "open" and i.get("enrolled_students") == len(students) for i in mine))
    for path in ("/admin/dashboard", "/admin/accounts", "/admin/courses", "/admin/assignments",
                 "/admin/monitoring", "/admin/audit", "/admin/settings"):
        await s.call(admin["token"], "GET", path)
    denied = [
        await s.call(students[0]["token"], "GET", f"/faculty/performance?course_id={course_id}", expect=(403,)),
        await s.call(students[0]["token"], "GET", "/admin/accounts", expect=(403,)),
        await s.call(instructor["token"], "GET", "/admin/accounts", expect=(403,)),
        await s.call(admin["token"], "GET", f"/faculty/activities/{ids['double']}", expect=(403,)),
    ]
    check("Each role is refused the other roles' pages", all(r.status_code == 403 for r in denied))


def summary(values: list[float]) -> dict:
    ordered = sorted(values)
    return {"count": len(ordered), "p50": round(statistics.median(ordered), 3),
            "p95": round(ordered[max(0, (95 * len(ordered) + 99) // 100 - 1)], 3), "max": round(ordered[-1], 3)}


def print_report(report: dict) -> None:
    print("\nCROSS-ROLE CHECKS")
    for item in report["checks"]:
        print(f"  {'PASS' if item['ok'] else 'FAIL'}  {item['check']}" + (f"  ({item['detail']})" if item["detail"] and not item["ok"] else ""))
    print("\nGRADING TIME (submit to result, seconds)")
    for kind, stats in report["grading_seconds"].items():
        print(f"  {kind:8} n={stats['count']:<4} p50={stats['p50']:<7} p95={stats['p95']:<7} max={stats['max']}")
    for label, stats in report["grading_timing"].items():
        print(f"  {label:30} n={stats['count']:<4} p50={stats['p50']:<7} p95={stats['p95']:<7} max={stats['max']}")
    print("\nSLOWEST ENDPOINTS (p95 seconds)")
    for label, stats in sorted(report["latency"].items(), key=lambda kv: -kv[1]["p95"])[:12]:
        print(f"  {stats['p95']:<7} p50={stats['p50']:<7} n={stats['count']:<4} {label}")
    print(f"\nUNEXPECTED RESPONSES: {len(report['unexpected_responses'])}")
    for line in report["unexpected_responses"][:15]:
        print(f"  {line}")


# ---------------------------------------------------------------------------
# Cleanup: removes only what a QA run recorded creating
# ---------------------------------------------------------------------------
def cleanup() -> None:
    if not STATE_FILE.exists():
        print("No QA run to clean up.")
        return
    require_local(api_base())
    state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    account_ids = [a["id"] for a in state.get("accounts", [])]
    course_id = state.get("course_id")
    with SessionLocal() as db:
        with db.begin():
            db.execute(text("set local lock_timeout = '15s'"))
            # Attempts are append-only for real students; lifted only inside this transaction.
            db.execute(text("alter table public.activity_attempts disable trigger trg_activity_attempts_append_only"))
            params = {"ids": account_ids, "course": course_id}
            db.execute(text("delete from public.audit_events where actor_id = any(cast(:ids as uuid[])) "
                            "or course_id = cast(:course as uuid)"), params)
            db.execute(text("delete from public.activity_attempts where student_id = any(cast(:ids as uuid[]))"), params)
            db.execute(text("delete from public.exams where created_by = any(cast(:ids as uuid[]))"), params)
            db.execute(text("delete from public.quest_groups where created_by = any(cast(:ids as uuid[]))"), params)
            db.execute(text("delete from public.learning_activities where created_by = any(cast(:ids as uuid[])) "
                            "or course_id = cast(:course as uuid)"), params)
            if course_id:
                db.execute(text("delete from public.courses where id = cast(:course as uuid)"), params)
                announcement_table = db.scalar(text("select to_regclass('public.course_announcements')"))
                if announcement_table and db.scalar(text(
                    "select exists (select 1 from public.course_announcements where course_id = cast(:course as uuid))"
                ), params):
                    raise RuntimeError("QA course deletion did not cascade to announcements.")
            db.execute(text("delete from public.api_rate_counters where scope_id = any(cast(:ids as text[]))"), params)
            db.execute(text("delete from auth.users where id = any(cast(:ids as uuid[]))"), params)
            if state.get("roster_emails"):
                db.execute(text("delete from bytequest_private.student_registration_roster where email = any(:emails)"),
                           {"emails": state["roster_emails"]})
            db.execute(text("alter table public.activity_attempts enable trigger trg_activity_attempts_append_only"))
    STATE_FILE.unlink()
    print(f"Removed QA run {state.get('run')}: {len(account_ids)} accounts, its course and everything they created.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--students", type=int, default=30, help="class size (default 30)")
    parser.add_argument("--keep", action="store_true", help="keep the QA class and logins for a browser look")
    parser.add_argument("--cleanup", action="store_true", help="remove a kept QA run")
    args = parser.parse_args()
    if args.cleanup:
        cleanup()
        return
    if not 4 <= args.students <= 200:
        raise SystemExit("Use between 4 and 200 students.")
    sys.exit(asyncio.run(run(args.students, args.keep)))


if __name__ == "__main__":
    main()

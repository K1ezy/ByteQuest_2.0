"""Seed a synthetic four-section ML scenario into the LOCAL database.

Creates 120 synthetic students who all accept the current research consent:

    1CSA  30 first-year students, block A   course SYNML-Y1-PY   (Python)
    1CSC  30 first-year students, block C   course SYNML-Y1-PY   (Python)
    2CSB  30 second-year students, block B  course SYNML-Y2-JAVA (Java)
    2CSC  30 second-year students, block C  course SYNML-Y2-JAVA (Java)

Each course has 10 published challenges and 4 quizzes. Every student works
through them over six weeks: graded attempts with realistic errors (compile,
runtime, time limit, wrong answer), retries until a pass, hint reveals and quiz
scores, driven by a seeded per-student ability that grows with practice. The
real export then fills every one of the ten model inputs. Nothing calls Judge0
or Gemini.

This is rehearsal data, not research data: never train it with
--research-approved, which would label the run as approved. Run from backend/:

    .venv\\Scripts\\python -m scripts.seed_local_ml_scenario           # (re)seed
    .venv\\Scripts\\python -m scripts.seed_local_ml_scenario --remove  # delete it all
"""

from __future__ import annotations

import argparse
import math
import uuid
from datetime import datetime, timedelta, timezone

import numpy as np
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.core.database import SessionLocal

PREFIX = "synml"  # every username starts with it; every course code with SYNML-
SEED = 42
START = datetime(2026, 9, 7, 8, 0, tzinfo=timezone.utc)
CHALLENGES, QUIZZES = 10, 4
COURSES = {
    "y1": ("SYNML-Y1-PY", "Synthetic ML scenario: Programming 1 (Python)", "python"),
    "y2": ("SYNML-Y2-JAVA", "Synthetic ML scenario: Programming 2 (Java)", "java"),
}
# section -> (year level, block, course, username stem, School ID prefix, mean ability)
SECTIONS = {
    "1CSA": (1, "A", "y1", "onecsa", "26-7", -0.1),
    "1CSC": (1, "C", "y1", "onecsc", "26-7", -0.3),
    "2CSB": (2, "B", "y2", "twocsb", "25-7", 0.3),
    "2CSC": (2, "C", "y2", "twocsc", "25-7", 0.1),
}
STUDENTS_PER_SECTION = 30
TOPICS = ["variables", "conditionals", "loops", "nested loops", "functions", "lists", "strings",
          "recursion", "searching", "sorting"]
# Failed-attempt outcomes: (Judge0 status id, error_category as classify_judge0_status maps it).
FAILURES = [(6, "syntax_error"), (11, "runtime_error"), (5, "timeout"), (4, "logic_error")]


def _letters(index: int) -> str:
    """0 -> 'a', 25 -> 'z', 26 -> 'ba': usernames may hold letters only."""
    out = ""
    while True:
        out = chr(97 + index % 26) + out
        index //= 26
        if index == 0:
            return out.rjust(2, "a")


def _require_local() -> None:
    url = make_url(settings.DATABASE_URL)
    if url.get_backend_name() != "postgresql" or url.host not in {"localhost", "127.0.0.1", "::1"}:
        raise SystemExit("This seeder only runs against a loopback PostgreSQL database.")


def remove(db) -> int:
    """Delete every synthetic student, activity and course this script created."""
    ids = db.execute(text("select id from public.profiles where username like :p"), {"p": PREFIX + "%"}).scalars().all()
    db.execute(text("set local lock_timeout = '15s'"))
    # Scoped to these synthetic ids only; the append-only guard is back on when this transaction ends.
    db.execute(text("alter table public.activity_attempts disable trigger trg_activity_attempts_append_only"))
    db.execute(text("delete from auth.users where id = any(:ids)"), {"ids": list(ids)})
    db.execute(text("delete from public.learning_activities where course_id in "
                    "(select id from public.courses where code like 'SYNML-%')"))
    db.execute(text("delete from public.courses where code like 'SYNML-%'"))
    db.execute(text("alter table public.activity_attempts enable trigger trg_activity_attempts_append_only"))
    return len(ids)


def _activities(db, course_key: str) -> list[dict]:
    code, title, language = COURSES[course_key]
    course_id = uuid.uuid4()
    db.execute(text("insert into public.courses (id, code, title, description) values (:id, :code, :title, "
                    "'Synthetic rehearsal data for the ML pipeline. Remove with scripts.seed_local_ml_scenario --remove.')"),
               {"id": course_id, "code": code, "title": title})
    # A diagnostic quiz opens the course, so quiz history exists before the first challenge.
    plan, order = [{"kind": "quiz", "topic": "diagnostic", "difficulty": 1}], 1
    for i, topic in enumerate(TOPICS[:CHALLENGES]):
        plan.append({"kind": "challenge", "topic": topic, "difficulty": 1 + i * 4 // CHALLENGES})
        if i % 3 == 2 and sum(p["kind"] == "quiz" for p in plan) < QUIZZES:
            plan.append({"kind": "quiz", "topic": topic, "difficulty": 1 + i * 4 // CHALLENGES})
    while sum(p["kind"] == "quiz" for p in plan) < QUIZZES:
        plan.append({"kind": "quiz", "topic": "review", "difficulty": 3})
    for item in plan:
        item["id"] = uuid.uuid4()
        db.execute(text(
            "insert into public.learning_activities (id, activity_type, language, topic_concept, title, "
            "difficulty_level, sequence_order, review_status, course_id, published_at) values "
            "(:id, cast(:kind as activitykind), cast(:language as programminglang), :topic, :title, :difficulty, "
            ":order, 'published', :course, :published)"),
            {"id": item["id"], "kind": item["kind"], "language": language, "topic": item["topic"],
             "title": f"Synthetic {item['kind']}: {item['topic']}", "difficulty": item["difficulty"],
             "order": order, "course": course_id, "published": START - timedelta(days=1)})
        order += 1
    return [{**item, "course_id": course_id, "language": language} for item in plan]


def seed(db, version: str) -> dict[str, int]:
    rng = np.random.default_rng(SEED)
    plans = {key: _activities(db, key) for key in COURSES}
    attempts, hints, counts = [], [], {}
    serial = 0
    for section, (year, block, course_key, stem, school_prefix, mean) in SECTIONS.items():
        counts[section] = 0
        for n in range(STUDENTS_PER_SECTION):
            student = uuid.uuid4()
            username = f"{PREFIX}{stem}{_letters(n)}"
            serial += 1
            db.execute(text("insert into auth.users (id, instance_id, aud, role, email, encrypted_password) values "
                            "(:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :email, '')"),
                       {"id": student, "email": f"{username}@example.test"})
            db.execute(text(
                "insert into public.profiles (id, pseudonym_id, username, role, year_level, semester, enrolled_language, "
                "school_id, block_section, display_name, track_selected_at) values (:id, :pseudonym, :username, 'student', "
                ":year, 1, cast(:language as programminglang), :school, :block, :display, :start)"),
                {"id": student, "pseudonym": f"stu_{student.hex}", "username": username, "year": year,
                 "language": COURSES[course_key][2], "school": f"{school_prefix}{serial:04d}", "block": block,
                 "display": f"Synthetic {section} {n + 1:02d}", "start": START})
            db.execute(text("insert into public.course_members (course_id, profile_id, member_role) values "
                            "(:course, :id, 'student')"), {"course": plans[course_key][0]["course_id"], "id": student})
            db.execute(text("insert into public.research_consents (student_id, document_version, choice) values "
                            "(:id, :version, 'accepted')"), {"id": student, "version": version})
            counts[section] += 1
            attempts_for, hints_for = _simulate(rng, student, plans[course_key], mean)
            attempts += attempts_for
            hints += hints_for
    db.execute(text(
        "insert into public.activity_attempts (student_id, activity_id, attempt_number, score_percentage, "
        "is_successful, compiler_status_id, error_category, passed_test_cases, total_test_cases, "
        "time_spent_seconds, created_at) values (:student, :activity, :number, :score, :passed, :status, "
        ":category, :tests_passed, :tests, :seconds, :at)"), attempts)
    if hints:
        db.execute(text("insert into public.hint_uses (student_id, activity_id, request_key, source, body, created_at) "
                        "values (:student, :activity, :key, 'reviewed', 'Synthetic hint.', :at)"), hints)
    return {**counts, "attempts": len(attempts), "hints": len(hints)}


def _simulate(rng, student: uuid.UUID, plan: list[dict], mean: float) -> tuple[list[dict], list[dict]]:
    """One student's semester: ability grows with practice; harder tasks fail more."""
    ability = rng.normal(mean, 0.9)
    pace = rng.uniform(2.0, 4.5)  # days between tasks
    clock = START + timedelta(hours=float(rng.uniform(0, 48)))
    attempts, hints = [], []
    for step, task in enumerate(plan):
        clock += timedelta(days=float(rng.exponential(pace)) + 0.2)
        skill = ability + 0.08 * step - 0.55 * (task["difficulty"] - 1)
        if task["kind"] == "quiz":
            score = float(np.clip(100 / (1 + math.exp(-(skill + 0.6))) + rng.normal(0, 8), 0, 100))
            attempts.append(_row(student, task, 1, round(score, 1), score >= 60, None, "none", clock, 4, 600))
            continue
        # Weaker students open hints more, before their first submission.
        for h in range(int(rng.poisson(max(0.0, 0.9 - 0.6 * skill)))):
            clock += timedelta(minutes=float(rng.uniform(2, 15)))
            hints.append({"student": student, "activity": task["id"], "key": f"synml-{h}", "at": clock})
        for number in range(1, 6):
            clock += timedelta(minutes=float(rng.uniform(4, 40)))
            passed = rng.random() < 1 / (1 + math.exp(-(skill + 0.35 * (number - 1))))
            if passed or number == 5 and rng.random() < 0.5:
                attempts.append(_row(student, task, number, 100.0, True, 3, "none", clock, 5, 900))
                break
            # Compile errors dominate for weak students; wrong answers for stronger ones.
            weights = np.array([1.6 - 0.4 * skill, 0.8, 0.4, 1.0 + 0.4 * skill]).clip(0.1)
            status, category = FAILURES[rng.choice(4, p=weights / weights.sum())]
            tests_passed = 0 if category == "syntax_error" else int(rng.integers(0, 5))
            attempts.append(_row(student, task, number, tests_passed * 20.0, False, status, category, clock, 5, 900))
            if number == 5:
                break
    return attempts, hints


def _row(student, task, number, score, passed, status, category, at, tests, seconds) -> dict:
    return {"student": student, "activity": task["id"], "number": number, "score": score, "passed": bool(passed),
            "status": status, "category": category, "tests_passed": round(score / 100 * tests), "tests": tests,
            "seconds": seconds, "at": at}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--remove", action="store_true", help="delete the synthetic scenario and stop")
    args = parser.parse_args()
    _require_local()
    with SessionLocal() as db, db.begin():
        removed = remove(db)
        if args.remove:
            print(f"Removed {removed} synthetic students and the SYNML courses.")
            return
        if not (settings.RESEARCH_CONSENT_ACTIVE and settings.RESEARCH_CONSENT_VERSION):
            raise SystemExit("Turn research consent on (RESEARCH_CONSENT_ACTIVE and RESEARCH_CONSENT_VERSION) first.")
        result = seed(db, settings.RESEARCH_CONSENT_VERSION)
    print(f"Seeded {result.pop('attempts')} attempts and {result.pop('hints')} hint reveals for "
          + ", ".join(f"{count} {section}" for section, count in result.items())
          + f" students (consent version {settings.RESEARCH_CONSENT_VERSION}). Remove with --remove.")


if __name__ == "__main__":
    main()

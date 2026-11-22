r"""Seed the 4CS Intermediate Programming workshops for instructor@gmail.com in local Supabase only.

Run from the repository root with:
    .\backend\.venv\Scripts\python.exe .\backend\scripts\seed_local_4cs_workshops.py

Creates three Python workshops (Year 4, blocks 4CS-A/B/C) and 18/15/20 synthetic students
through the real sign-up trigger, then enrolls each student in their block's workshop.
Idempotent: existing workshops, accounts and memberships are reused, never changed.
New student passwords are written to the ignored logs/qa/4cs-workshop-accounts.json.
"""

from __future__ import annotations

import json
import secrets
import string
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from sqlalchemy import text
from sqlalchemy.engine import make_url


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings  # noqa: E402


LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
if (
    settings.ENVIRONMENT.lower() != "development"
    or make_url(settings.DATABASE_URL).host not in LOCAL_HOSTS
    or urlsplit(settings.SUPABASE_URL).hostname not in LOCAL_HOSTS
    or not settings.SUPABASE_SERVICE_ROLE_KEY
):
    raise SystemExit("Refusing to seed outside the local development Supabase.")

from app.api.workshops import CreateWorkshop, create_workshop  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.models.entities import Profile, ProgrammingLang, UserRole, Workshop, WorkshopMember  # noqa: E402


INSTRUCTOR_EMAIL = "instructor@gmail.com"
SUBJECT = "Intermediate Programming - Python"
YEAR_LEVEL = 4
# block letter -> number of students
BLOCKS = {"A": 18, "B": 15, "C": 20}
ACCOUNTS_FILE = BACKEND_ROOT.parent / "logs" / "qa" / "4cs-workshop-accounts.json"


def letters(number: int) -> str:
    """Usernames must be letters only (sign-up trigger: ^[a-z]{3,44}$)."""
    first, second = divmod(number, 26)
    return string.ascii_lowercase[first] + string.ascii_lowercase[second]


def student_account(block: str, number: int) -> dict:
    return {
        "email": f"4cs{block.lower()}-{number:02d}@bytequest.test",
        "username": f"fourcs{block.lower()}student{letters(number)}",
        "school_id": f"26-4{ord(block) - ord('A') + 1}{number:03d}",
        "display_name": f"4CS-{block} Student {number:02d}",
    }


def ensure_student(client: httpx.Client, account: dict, block: str, saved: dict) -> uuid.UUID:
    with SessionLocal() as db:
        user_id = db.scalar(text("select id from auth.users where lower(email) = :email"), {"email": account["email"]})
        if user_id:
            return uuid.UUID(str(user_id))
        if db.scalar(text("select exists (select 1 from public.profiles where school_id = :id)"),
                     {"id": account["school_id"]}):
            raise SystemExit(f"School ID {account['school_id']} already belongs to another account; nothing changed.")
    password = secrets.token_urlsafe(12)
    response = client.post(
        settings.SUPABASE_URL.rstrip("/") + "/auth/v1/admin/users",
        headers={"apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                 "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"},
        json={"email": account["email"], "password": password, "email_confirm": True,
              "user_metadata": {"username": account["username"], "school_id": account["school_id"],
                                "year_level": str(YEAR_LEVEL), "block_section": block,
                                "registration_role": "student"}},
    )
    if response.status_code >= 400:
        raise SystemExit(f"Could not create {account['email']}: {response.status_code} {response.text[:200]}")
    saved[account["email"]] = password
    ACCOUNTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    ACCOUNTS_FILE.write_text(json.dumps(saved, indent=2), encoding="utf-8")  # save each one: no lost passwords
    return uuid.UUID(response.json()["id"])


def main() -> None:
    saved = json.loads(ACCOUNTS_FILE.read_text(encoding="utf-8")) if ACCOUNTS_FILE.exists() else {}
    with SessionLocal() as db:
        instructor = db.query(Profile).filter(Profile.email.ilike(INSTRUCTOR_EMAIL)).one_or_none()
        if instructor is None:
            instructor_id = db.scalar(text("select id from auth.users where lower(email) = :e"), {"e": INSTRUCTOR_EMAIL})
            instructor = db.get(Profile, instructor_id) if instructor_id else None
        if instructor is None or instructor.role not in (UserRole.instructor, UserRole.admin):
            raise SystemExit(f"{INSTRUCTOR_EMAIL} must be a local instructor account before seeding.")
        instructor_id = instructor.id

    with httpx.Client(timeout=20) as client:
        for block, count in BLOCKS.items():
            section = f"{YEAR_LEVEL}CS-{block}"
            name = f"{SUBJECT} {section}"
            student_ids = [ensure_student(client, student_account(block, n), block, saved) for n in range(1, count + 1)]
            with SessionLocal() as db:
                owner = db.get(Profile, instructor_id)
                workshop = db.query(Workshop).filter(Workshop.name == name, Workshop.created_by == owner.id).one_or_none()
                if workshop is None:
                    view = create_workshop(CreateWorkshop(name=name, language=ProgrammingLang.python, subject=SUBJECT,
                                                          year_level=YEAR_LEVEL, block=section), owner, db)
                    workshop = db.get(Workshop, view.id)
                members = {uuid.UUID(str(pid)) for pid in db.scalars(
                    text("select profile_id from public.workshop_members where workshop_id = :w"), {"w": workshop.id})}
                now = datetime.now(timezone.utc)
                for index, student_id in enumerate(student_ids, start=1):
                    profile = db.get(Profile, student_id)
                    if profile.track_selected_at is None:  # same effect as a student saving the Python track
                        profile.enrolled_language = ProgrammingLang.python
                        profile.track_selected_at = now
                    profile.display_name = profile.display_name or student_account(block, index)["display_name"]
                    if student_id not in members:
                        db.add(WorkshopMember(workshop_id=workshop.id, profile_id=student_id))
                db.commit()
                total = db.scalar(text("select count(*) from public.workshop_members m join public.profiles p "
                                       "on p.id = m.profile_id where m.workshop_id = :w and p.role = 'student'"),
                                  {"w": workshop.id})
                print(f"{name}: {total} students, join code {workshop.join_code}")
    print(f"Student sign-in details: {ACCOUNTS_FILE}")


if __name__ == "__main__":
    main()

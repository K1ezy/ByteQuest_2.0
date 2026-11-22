r"""Create one reviewed C++ quiz and a joinable group in local Supabase only.

Run from the repository root with:
    .\backend\.venv\Scripts\python.exe .\backend\scripts\seed_local_quest_demo.py

The script is idempotent. It never changes an existing demo quiz's questions,
student progress, or any non-demo activity.
"""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

from sqlalchemy.engine import make_url
from starlette.requests import Request


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings  # noqa: E402


database_url = make_url(settings.DATABASE_URL)
if (
    settings.ENVIRONMENT.lower() != "development"
    or database_url.host not in {"localhost", "127.0.0.1"}
    or database_url.port != 54322
):
    raise SystemExit("Refusing to seed outside the local development Supabase database on port 54322.")

from app.api.workshops import (  # noqa: E402
    AddWorkshopActivities,
    CreateWorkshop,
    add_workshop_activities,
    create_workshop,
)
from app.services.activity_publishing import apply_publish_rules  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.models.entities import (  # noqa: E402
    ActivityKind,
    LearningActivity,
    Profile,
    ProgrammingLang,
    Workshop,
    WorkshopActivity,
    ReviewState,
    UserRole,
)
from app.services.gamification.quiz_content import parse_quiz_questions  # noqa: E402


ACTIVITY_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bytequest:local-demo:cpp-basics-quiz:v1")
GROUP_NAME = "[Local demo] C++ Fundamentals"
QUESTIONS = {
    "questions": [
        {
            "id": "cpp-output",
            "prompt": "What does std::cout << 2 + 3; print?",
            "options": [
                {"key": "A", "text": "5"},
                {"key": "B", "text": "23"},
                {"key": "C", "text": "Nothing"},
                {"key": "D", "text": "A compiler error"},
            ],
            "correct_answer": "A",
        },
        {
            "id": "cpp-variable",
            "prompt": "Which line declares an integer named score and initializes it to 10?",
            "options": [
                {"key": "A", "text": "score int = 10;"},
                {"key": "B", "text": "int score = 10;"},
                {"key": "C", "text": "integer(score) = 10;"},
                {"key": "D", "text": "let score: int = 10;"},
            ],
            "correct_answer": "B",
        },
        {
            "id": "cpp-index",
            "prompt": "What index refers to the first element of a C++ std::vector?",
            "options": [
                {"key": "A", "text": "0"},
                {"key": "B", "text": "1"},
                {"key": "C", "text": "-1"},
                {"key": "D", "text": "The vector has no indexes"},
            ],
            "correct_answer": "A",
        },
    ]
}


def seed_demo_quest(
    *,
    activity_id: uuid.UUID,
    group_name: str,
    questions: dict,
    language: ProgrammingLang,
    title: str,
    topic_concept: str,
    problem_statement: str,
    group_description: str,
    announce: bool = True,
) -> None:
    parse_quiz_questions(questions)
    db = SessionLocal()
    try:
        activity = db.get(LearningActivity, activity_id)
        if activity:
            owner = db.get(Profile, activity.created_by)
            if not owner or owner.role not in (UserRole.instructor, UserRole.admin):
                raise SystemExit("The existing demo quiz has no faculty/admin owner; no data was changed.")
            if activity.activity_type != ActivityKind.quiz or activity.language != language:
                raise SystemExit("The reserved demo activity ID is already used for different content.")
        else:
            owner = (
                db.query(Profile)
                .filter(Profile.role == UserRole.instructor)
                .order_by(Profile.id)
                .first()
            )
            if owner is None:
                raise SystemExit("Create a local instructor account before seeding the demo quest.")
            activity = LearningActivity(
                id=activity_id,
                created_by=owner.id,
                activity_type=ActivityKind.quiz,
                language=language,
                topic_concept=topic_concept,
                title=title,
                problem_statement=problem_statement,
                difficulty_level=1,
                sequence_order=1,
                review_status=ReviewState.draft,
                quiz_questions_json=questions,
                xp_reward=30,
            )
            db.add(activity)
            db.commit()

        if activity.review_status == ReviewState.draft:
            apply_publish_rules(db, activity, owner)
            db.commit()
        elif activity.review_status != ReviewState.published:
            raise SystemExit("The demo quiz is not a draft or published activity; no group was created.")

        group = (
            db.query(Workshop)
            .filter(Workshop.name == group_name, Workshop.created_by == owner.id)
            .first()
        )
        if group is None:
            request = Request({
                "type": "http",
                "method": "POST",
                "path": "/api/v1/workshops",
                "headers": [],
                "client": ("127.0.0.1", 0),
            })
            created = create_workshop(
                request,
                CreateWorkshop(
                    name=group_name,
                    description=group_description,
                    language=language,
                    activity_ids=[activity_id],
                ),
                owner,
                db,
            )
            group = db.get(Workshop, created.id)
        elif not db.query(WorkshopActivity).filter(
            WorkshopActivity.workshop_id == group.id,
            WorkshopActivity.activity_id == activity_id,
        ).first():
            add_workshop_activities(
                group.id,
                AddWorkshopActivities(activity_ids=[activity_id]),
                owner,
                db,
            )

        assert group is not None
        if announce:
            print(f"Local demo ready: {group_name}")
            print(f"Instructor owner: {owner.pseudonym_id}")
            print(f"Student join code: {group.join_code}")
            print(f"Published quiz ID: {activity_id}")
    finally:
        db.close()


def main() -> None:
    seed_demo_quest(
        activity_id=ACTIVITY_ID,
        group_name=GROUP_NAME,
        questions=QUESTIONS,
        language=ProgrammingLang.cpp,
        title="C++ Fundamentals Check",
        topic_concept="C++ fundamentals: output, variables, and indexing",
        problem_statement="Answer three short questions about C++ basics to complete this demo quest.",
        group_description="A short C++ quest you can join and complete locally.",
    )


if __name__ == "__main__":
    main()

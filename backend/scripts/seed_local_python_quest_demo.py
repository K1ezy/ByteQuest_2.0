r"""Create a reviewed Python quiz and Judge0-verified challenge in local Supabase.

Run from the repository root with:
    .\backend\.venv\Scripts\python.exe .\backend\scripts\seed_local_python_quest_demo.py

The script is idempotent and preserves existing activity and student progress.
"""

from __future__ import annotations

import asyncio
import uuid

from seed_local_quest_demo import seed_demo_quest
from app.api.quest_groups import AddGroupActivities, add_group_activities
from app.api.rag_instructor import (
    ActivityReviewUpdate,
    publish_learning_activity,
    reverify_instructor_draft,
    update_activity_review,
)
from app.core.database import SessionLocal
from app.models.entities import (
    ActivityKind,
    LearningActivity,
    Profile,
    ProgrammingLang,
    QuestGroup,
    QuestGroupActivity,
    ReviewState,
    TestCase,
    UserRole,
)


ACTIVITY_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bytequest:local-demo:python-basics-quiz:v1")
CHALLENGE_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bytequest:local-demo:python-add-two-numbers:v1")
GROUP_NAME = "[Local demo] Python Fundamentals"
CHALLENGE_TITLE = "Add Two Numbers"
CHALLENGE_TOPIC = "Python input and arithmetic"
CHALLENGE_STATEMENT = (
    "Read two integers from standard input, separated by a space. "
    "Print their sum as a single integer.\n\n"
    "Example input: 2 3\nExample output: 5"
)
STARTER_CODE = "a, b = map(int, input().split())\n# Print the sum of a and b.\n"
REFERENCE_SOLUTION = "a, b = map(int, input().split())\nprint(a + b)\n"
CHALLENGE_CASES = (
    ("2 3\n", "5\n", False),
    ("-7 4\n", "-3\n", False),
    ("0 0\n", "0\n", True),
    ("1000000000 234567890\n", "1234567890\n", True),
)
QUESTIONS = {
    "questions": [
        {
            "id": "python-output",
            "prompt": "What does print(2 + 3) display?",
            "options": [
                {"key": "A", "text": "5"},
                {"key": "B", "text": "23"},
                {"key": "C", "text": "2 + 3"},
                {"key": "D", "text": "Nothing"},
            ],
            "correct_answer": "A",
        },
        {
            "id": "python-variable",
            "prompt": "Which line assigns the number 10 to a variable named score?",
            "options": [
                {"key": "A", "text": "int score = 10"},
                {"key": "B", "text": "score = 10"},
                {"key": "C", "text": "let score: 10"},
                {"key": "D", "text": "score == 10"},
            ],
            "correct_answer": "B",
        },
        {
            "id": "python-function",
            "prompt": "Which line correctly starts a Python function named greet with no parameters?",
            "options": [
                {"key": "A", "text": "function greet() {"},
                {"key": "B", "text": "greet():"},
                {"key": "C", "text": "def greet():"},
                {"key": "D", "text": "func greet()"},
            ],
            "correct_answer": "C",
        },
    ]
}


def seed_python_challenge() -> None:
    db = SessionLocal()
    try:
        quiz = db.get(LearningActivity, ACTIVITY_ID)
        if quiz is None or quiz.review_status != ReviewState.published:
            raise SystemExit("Publish the Python demo quiz before adding its challenge.")
        owner = db.get(Profile, quiz.created_by)
        if owner is None or owner.role not in (UserRole.instructor, UserRole.admin):
            raise SystemExit("The Python demo quiz has no faculty/admin owner.")
        group = db.query(QuestGroup).filter(
            QuestGroup.name == GROUP_NAME, QuestGroup.created_by == owner.id
        ).one_or_none()
        if group is None:
            raise SystemExit("The Python demo group is missing; rerun the quiz seed first.")

        challenge = db.get(LearningActivity, CHALLENGE_ID)
        if challenge is None:
            challenge = LearningActivity(
                id=CHALLENGE_ID,
                created_by=owner.id,
                activity_type=ActivityKind.challenge,
                language=ProgrammingLang.python,
                topic_concept=CHALLENGE_TOPIC,
                title=CHALLENGE_TITLE,
                problem_statement=CHALLENGE_STATEMENT,
                starter_code=STARTER_CODE,
                reference_solution_code=REFERENCE_SOLUTION,
                difficulty_level=1,
                sequence_order=2,
                review_status=ReviewState.draft,
                xp_reward=50,
                test_cases=[
                    TestCase(order_index=index, stdin=stdin, expected_stdout=stdout, is_hidden=hidden)
                    for index, (stdin, stdout, hidden) in enumerate(CHALLENGE_CASES)
                ],
            )
            db.add(challenge)
            db.commit()
        else:
            if (challenge.created_by != owner.id or challenge.activity_type != ActivityKind.challenge
                    or challenge.language != ProgrammingLang.python
                    or challenge.title != CHALLENGE_TITLE
                    or challenge.topic_concept != CHALLENGE_TOPIC
                    or challenge.problem_statement != CHALLENGE_STATEMENT
                    or challenge.starter_code != STARTER_CODE
                    or challenge.reference_solution_code != REFERENCE_SOLUTION
                    or challenge.difficulty_level != 1 or challenge.xp_reward != 50
                    or challenge.closed_at is not None
                    or [(case.order_index, case.stdin, case.expected_stdout, case.is_hidden)
                        for case in challenge.test_cases] != [
                            (index, stdin, stdout, hidden)
                            for index, (stdin, stdout, hidden) in enumerate(CHALLENGE_CASES)
                        ]):
                raise SystemExit("The reserved Python demo challenge differs from the curated fixture; no data was changed.")

        if challenge.review_status == ReviewState.draft:
            if not challenge.judge0_verified:
                verified = asyncio.run(reverify_instructor_draft(CHALLENGE_ID, owner, db))
                if not verified["judge0_verified"]:
                    raise SystemExit("Judge0 could not verify the Python demo challenge. Start the VM and rerun this script.")
            update_activity_review(CHALLENGE_ID, ActivityReviewUpdate(reviewed=True), owner, db)
            asyncio.run(publish_learning_activity(CHALLENGE_ID, owner, db))
        elif challenge.review_status != ReviewState.published or not challenge.judge0_verified:
            raise SystemExit("The Python demo challenge is not a verified, published activity.")

        if not db.query(QuestGroupActivity).filter(
            QuestGroupActivity.group_id == group.id,
            QuestGroupActivity.activity_id == CHALLENGE_ID,
        ).first():
            add_group_activities(
                group.id, AddGroupActivities(activity_ids=[CHALLENGE_ID]), owner, db
            )
        print(f"Local Python journey ready: {GROUP_NAME}")
        print(f"Student join code: {group.join_code}")
        print(f"Published quiz ID: {ACTIVITY_ID}")
        print(f"Published Judge0-verified challenge ID: {CHALLENGE_ID}")
    finally:
        db.close()


def main() -> None:
    seed_demo_quest(
        activity_id=ACTIVITY_ID,
        group_name=GROUP_NAME,
        questions=QUESTIONS,
        language=ProgrammingLang.python,
        title="Python Fundamentals Check",
        topic_concept="Python fundamentals: output, variables, and functions",
        problem_statement="Answer three short questions about Python basics to complete this demo quest.",
        group_description="A short Python quest you can join and complete locally.",
        announce=False,
    )
    seed_python_challenge()


if __name__ == "__main__":
    main()

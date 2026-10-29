r"""Add three Python-fundamentals quizzes and three coding challenges locally.

Run from the repository root with:
    .\backend\.venv\Scripts\python.exe .\backend\scripts\seed_local_python_fundamentals_expansion.py

This script is idempotent. It reuses the owner and quest group created by
seed_local_python_quest_demo.py, and never resets student progress.
"""

from __future__ import annotations

import asyncio
import sys
import time
import uuid
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.engine import make_url


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
    raise SystemExit(
        "Refusing to seed outside the local development Supabase database on port 54322."
    )

from app.api.quest_groups import (  # noqa: E402
    AddGroupActivities,
    add_group_activities,
)
from app.api.rag_instructor import (  # noqa: E402
    ActivityReviewUpdate,
    publish_learning_activity,
    reverify_instructor_draft,
    update_activity_review,
)
from app.core.database import SessionLocal  # noqa: E402
from app.models.entities import (  # noqa: E402
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
from app.services.gamification.quiz_content import parse_quiz_questions  # noqa: E402


GROUP_NAME = "[Local demo] Python Fundamentals"
LANGUAGE = ProgrammingLang.python
XP_QUIZ = 30
XP_CHALLENGE = 50


def _id(key: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"bytequest:local-demo:{key}:v1")


QUIZ_DATA_TYPES = {
    "id": _id("python-data-types-quiz"),
    "title": "Python Data Types Check",
    "topic": "Python fundamentals: data types and conversion",
    "statement": (
        "Answer three short questions about Python data types, values, and type "
        "conversion."
    ),
    "questions": {
        "questions": [
            {
                "id": "data-type-int",
                "prompt": "Which value is an integer?",
                "options": [
                    {"key": "A", "text": '"42"'},
                    {"key": "B", "text": "42"},
                    {"key": "C", "text": "42.0"},
                    {"key": "D", "text": "True"},
                ],
                "correct_answer": "B",
            },
            {
                "id": "data-type-str",
                "prompt": 'What is the type of "ByteQuest"?',
                "options": [
                    {"key": "A", "text": "int"},
                    {"key": "B", "text": "float"},
                    {"key": "C", "text": "str"},
                    {"key": "D", "text": "bool"},
                ],
                "correct_answer": "C",
            },
            {
                "id": "data-type-convert",
                "prompt": 'What does int("25") + 5 evaluate to?',
                "options": [
                    {"key": "A", "text": '"255"'},
                    {"key": "B", "text": "30"},
                    {"key": "C", "text": "25"},
                    {"key": "D", "text": "A TypeError"},
                ],
                "correct_answer": "B",
            },
        ]
    },
}

QUIZ_CONDITIONALS_LOOPS = {
    "id": _id("python-conditionals-loops-quiz"),
    "title": "Python Conditionals & Loops Check",
    "topic": "Python fundamentals: conditionals and loops",
    "statement": (
        "Answer three short questions about Python comparisons, loops, and the "
        "range function."
    ),
    "questions": {
        "questions": [
            {
                "id": "cond-equality",
                "prompt": "Which operator checks whether two values are equal?",
                "options": [
                    {"key": "A", "text": "="},
                    {"key": "B", "text": "=="},
                    {"key": "C", "text": "=>"},
                    {"key": "D", "text": "!="},
                ],
                "correct_answer": "B",
            },
            {
                "id": "loop-range",
                "prompt": "What numbers does range(1, 4) produce?",
                "options": [
                    {"key": "A", "text": "1, 2, 3, 4"},
                    {"key": "B", "text": "1, 2, 3"},
                    {"key": "C", "text": "0, 1, 2, 3"},
                    {"key": "D", "text": "2, 3, 4"},
                ],
                "correct_answer": "B",
            },
            {
                "id": "loop-while",
                "prompt": "Which loop repeats while its condition is true?",
                "options": [
                    {"key": "A", "text": "for"},
                    {"key": "B", "text": "while"},
                    {"key": "C", "text": "if"},
                    {"key": "D", "text": "def"},
                ],
                "correct_answer": "B",
            },
        ]
    },
}

QUIZ_LISTS_STRINGS = {
    "id": _id("python-lists-strings-quiz"),
    "title": "Python Lists & Strings Check",
    "topic": "Python fundamentals: lists and strings",
    "statement": (
        "Answer three short questions about Python lists, indexing, and string "
        "slicing."
    ),
    "questions": {
        "questions": [
            {
                "id": "list-index",
                "prompt": 'What is the result of ["a", "b", "c"][1]?',
                "options": [
                    {"key": "A", "text": '"a"'},
                    {"key": "B", "text": '"b"'},
                    {"key": "C", "text": '"c"'},
                    {"key": "D", "text": "IndexError"},
                ],
                "correct_answer": "B",
            },
            {
                "id": "list-append",
                "prompt": "Which list method adds one item to the end of the list?",
                "options": [
                    {"key": "A", "text": "add()"},
                    {"key": "B", "text": "append()"},
                    {"key": "C", "text": "push()"},
                    {"key": "D", "text": "insertEnd()"},
                ],
                "correct_answer": "B",
            },
            {
                "id": "string-slice",
                "prompt": 'What is the value of "Python"[0:3]?',
                "options": [
                    {"key": "A", "text": '"Pyt"'},
                    {"key": "B", "text": '"Pyth"'},
                    {"key": "C", "text": '"yth"'},
                    {"key": "D", "text": '"Python"'},
                ],
                "correct_answer": "A",
            },
        ]
    },
}

CHALLENGE_EVEN_ODD = {
    "id": _id("python-even-odd"),
    "title": "Even or Odd",
    "topic": "Python conditionals and modulo",
    "statement": (
        "Read one integer from standard input. Print Even if it is divisible by 2, "
        "otherwise print Odd.\n\n"
        "Example input: 4\nExample output: Even"
    ),
    "starter_code": (
        "number = int(input())\n"
        "# Print Even if the number is divisible by 2, otherwise print Odd.\n"
    ),
    "reference_solution": (
        "number = int(input())\n"
        "if number % 2 == 0:\n"
        '    print("Even")\n'
        "else:\n"
        '    print("Odd")\n'
    ),
    "test_cases": (
        ("4\n", "Even\n", False),
        ("7\n", "Odd\n", False),
        ("0\n", "Even\n", True),
        ("-3\n", "Odd\n", True),
    ),
    "difficulty": 1,
}

CHALLENGE_COUNT_VOWELS = {
    "id": _id("python-count-vowels"),
    "title": "Count Vowels",
    "topic": "Python strings and loops",
    "statement": (
        "Read one lowercase word from standard input. Count how many vowels "
        "(a, e, i, o, u) it contains and print that count.\n\n"
        "Example input: hello\nExample output: 2"
    ),
    "starter_code": (
        "word = input().strip()\n"
        "# Count the vowels in the word and print the total.\n"
    ),
    "reference_solution": (
        "word = input().strip()\n"
        'vowels = "aeiou"\n'
        "count = 0\n"
        "for letter in word:\n"
        "    if letter in vowels:\n"
        "        count += 1\n"
        "print(count)\n"
    ),
    "test_cases": (
        ("hello\n", "2\n", False),
        ("python\n", "1\n", False),
        ("aeiou\n", "5\n", True),
        ("rhythm\n", "0\n", True),
    ),
    "difficulty": 2,
}

CHALLENGE_SUM_ONE_TO_N = {
    "id": _id("python-sum-one-to-n"),
    "title": "Sum from 1 to N",
    "topic": "Python loops and accumulators",
    "statement": (
        "Read one positive integer n from standard input. Print the sum of all "
        "integers from 1 through n.\n\n"
        "Example input: 5\nExample output: 15"
    ),
    "starter_code": (
        "n = int(input())\n"
        "# Calculate and print the sum from 1 to n.\n"
    ),
    "reference_solution": (
        "n = int(input())\n"
        "total = 0\n"
        "for number in range(1, n + 1):\n"
        "    total += number\n"
        "print(total)\n"
    ),
    "test_cases": (
        ("5\n", "15\n", False),
        ("1\n", "1\n", False),
        ("10\n", "55\n", True),
        ("100\n", "5050\n", True),
    ),
    "difficulty": 1,
}


def get_demo_context(db):
    group = (
        db.query(QuestGroup)
        .filter(
            QuestGroup.name == GROUP_NAME,
            QuestGroup.language == LANGUAGE,
        )
        .one_or_none()
    )
    if group is None:
        raise SystemExit(
            "The Python demo group is missing. Run seed_local_python_quest_demo.py first."
        )
    owner = db.get(Profile, group.created_by)
    if owner is None or owner.role not in (UserRole.instructor, UserRole.admin):
        raise SystemExit("The Python demo group has no faculty/admin owner.")
    return group, owner


def ensure_group_activity(db, group, activity_id, owner) -> None:
    linked = (
        db.query(QuestGroupActivity)
        .filter(
            QuestGroupActivity.group_id == group.id,
            QuestGroupActivity.activity_id == activity_id,
        )
        .first()
    )
    if linked is None:
        add_group_activities(
            group.id,
            AddGroupActivities(activity_ids=[activity_id]),
            owner,
            db,
        )


def seed_quiz(db, spec, owner, group) -> None:
    parse_quiz_questions(spec["questions"])

    activity = db.get(LearningActivity, spec["id"])
    if activity is None:
        activity = LearningActivity(
            id=spec["id"],
            created_by=owner.id,
            activity_type=ActivityKind.quiz,
            language=LANGUAGE,
            topic_concept=spec["topic"],
            title=spec["title"],
            problem_statement=spec["statement"],
            difficulty_level=1,
            sequence_order=1,
            review_status=ReviewState.draft,
            quiz_questions_json=spec["questions"],
            xp_reward=XP_QUIZ,
        )
        db.add(activity)
        db.commit()
    elif (
        activity.created_by != owner.id
        or activity.activity_type != ActivityKind.quiz
        or activity.language != LANGUAGE
        or activity.title != spec["title"]
        or activity.topic_concept != spec["topic"]
        or activity.problem_statement != spec["statement"]
        or activity.quiz_questions_json != spec["questions"]
        or activity.xp_reward != XP_QUIZ
    ):
        raise SystemExit(
            f"Reserved quiz ID conflicts with different content: {spec['title']}"
        )

    if activity.review_status == ReviewState.draft:
        if activity.reviewed_by is None:
            update_activity_review(
                activity.id,
                ActivityReviewUpdate(reviewed=True),
                owner,
                db,
            )
        asyncio.run(publish_learning_activity(activity.id, owner, db))
    elif activity.review_status != ReviewState.published:
        raise SystemExit(f"Quiz is not reviewable: {spec['title']}")

    ensure_group_activity(db, group, activity.id, owner)
    print(f"Published quiz: {spec['title']} ({activity.id})")


def seed_challenge(db, spec, owner, group) -> None:
    activity = db.get(LearningActivity, spec["id"])
    if activity is None:
        activity = LearningActivity(
            id=spec["id"],
            created_by=owner.id,
            activity_type=ActivityKind.challenge,
            language=LANGUAGE,
            topic_concept=spec["topic"],
            title=spec["title"],
            problem_statement=spec["statement"],
            starter_code=spec["starter_code"],
            reference_solution_code=spec["reference_solution"],
            difficulty_level=spec["difficulty"],
            sequence_order=1,
            review_status=ReviewState.draft,
            xp_reward=XP_CHALLENGE,
            test_cases=[
                TestCase(
                    order_index=index,
                    stdin=stdin,
                    expected_stdout=stdout,
                    is_hidden=hidden,
                )
                for index, (stdin, stdout, hidden) in enumerate(spec["test_cases"])
            ],
        )
        db.add(activity)
        db.commit()
    else:
        existing_cases = [
            (case.order_index, case.stdin, case.expected_stdout, case.is_hidden)
            for case in activity.test_cases
        ]
        expected_cases = [
            (index, stdin, stdout, hidden)
            for index, (stdin, stdout, hidden) in enumerate(spec["test_cases"])
        ]
        if (
            activity.created_by != owner.id
            or activity.activity_type != ActivityKind.challenge
            or activity.language != LANGUAGE
            or activity.title != spec["title"]
            or activity.topic_concept != spec["topic"]
            or activity.problem_statement != spec["statement"]
            or activity.starter_code != spec["starter_code"]
            or activity.reference_solution_code != spec["reference_solution"]
            or activity.difficulty_level != spec["difficulty"]
            or activity.xp_reward != XP_CHALLENGE
            or existing_cases != expected_cases
        ):
            raise SystemExit(
                f"Reserved challenge ID conflicts with different content: {spec['title']}"
            )

    if activity.review_status == ReviewState.draft:
        if not activity.judge0_verified:
            print(f"Verifying reference solution with Judge0: {spec['title']}")
            for attempt in range(2):
                try:
                    result = asyncio.run(
                        reverify_instructor_draft(activity.id, owner, db)
                    )
                    break
                except HTTPException as exc:
                    if exc.status_code == 429 and attempt == 0:
                        detail = exc.detail if isinstance(exc.detail, dict) else {}
                        wait = int(detail.get("retry_after_seconds", 60))
                        print(f"Judge0 verification rate limited; waiting {wait}s...")
                        time.sleep(wait)
                        continue
                    detail = exc.detail if isinstance(exc.detail, dict) else exc.detail
                    raise SystemExit(
                        f"Judge0 verification failed for {spec['title']}: {detail}"
                    ) from exc
            if not result.get("judge0_verified"):
                raise SystemExit(
                    f"Judge0 could not verify {spec['title']}; the draft was left unpublished."
                )
        update_activity_review(
            activity.id,
            ActivityReviewUpdate(reviewed=True),
            owner,
            db,
        )
        asyncio.run(publish_learning_activity(activity.id, owner, db))
    elif (
        activity.review_status != ReviewState.published
        or not activity.judge0_verified
    ):
        raise SystemExit(f"Challenge is not a verified, published activity: {spec['title']}")

    ensure_group_activity(db, group, activity.id, owner)
    print(f"Published challenge: {spec['title']} ({activity.id})")


def main() -> None:
    db = SessionLocal()
    try:
        group, owner = get_demo_context(db)
        print(f"Using group: {group.name} (join code {group.join_code})")

        # Interleave quiz and challenge publication so the new sequence alternates
        # between concept review and hands-on practice.
        seed_quiz(db, QUIZ_DATA_TYPES, owner, group)
        seed_challenge(db, CHALLENGE_EVEN_ODD, owner, group)
        seed_quiz(db, QUIZ_CONDITIONALS_LOOPS, owner, group)
        seed_challenge(db, CHALLENGE_COUNT_VOWELS, owner, group)
        seed_quiz(db, QUIZ_LISTS_STRINGS, owner, group)
        seed_challenge(db, CHALLENGE_SUM_ONE_TO_N, owner, group)

        total_linked = (
            db.query(QuestGroupActivity)
            .filter(QuestGroupActivity.group_id == group.id)
            .count()
        )
        print(f"Group now contains {total_linked} published activities.")
        print("Python fundamentals expansion complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

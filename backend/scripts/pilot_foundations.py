"""Prepare introductory C++ and Java activities in local ByteQuest.

Run from backend: python -m scripts.pilot_foundations
Pass --instructor UUID to save drafts, and --publish after reviewing the drafts.
Publishing verifies all reference solutions and rejects common wrong solutions first.
"""

import argparse
import asyncio
import os
import uuid

from sqlalchemy.engine import make_url

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.entities import ActivityKind, LearningActivity, Profile, ProgrammingLang, ReviewState, TestCase, UserRole
from app.services.activity_publishing import apply_publish_rules, lock_activity_for_publication
from app.services.challenge_verification import challenge_validation_fingerprint, record_challenge_verification
from app.services.gamification.quiz_content import parse_quiz_questions
from app.services.judge0.client import Judge0Client, TestCaseInput


ADD_CASES = [("2 3", "5"), ("-7 4", "-3"), ("0 0", "0"), ("1000000000 1000000000", "2000000000"),
             ("-1000000000 -1000000000", "-2000000000"), ("-2 2", "0")]
SIGNED_CASES = [("9", "Positive"), ("-4", "Negative"), ("0", "Zero"), ("-1000000000", "Negative"),
                ("1000000000", "Positive")]
COUNT_CASES = [("5\n-3 8 0 1 -5", "2"), ("1\n5", "1"), ("0", "0"), ("3\n0 0 0", "0"),
               ("4\n-1 -2 -3 -4", "0"), ("4\n1 2 3 4", "4"), ("6\n1 0 -1 0 2 -2", "2")]


def challenge_specs():
    add = "Read two integers a and b on one line. Each is between -1000000000 and 1000000000 inclusive. Print their sum as a single integer."
    sign = "Read one integer n between -1000000000 and 1000000000 inclusive. Print Positive if n is greater than zero, Negative if n is less than zero, or Zero otherwise. Match the capitalization exactly."
    add += "\n\nExample input: 2 3\nExample output: 5"
    sign += "\n\nExample input: 9\nExample output: Positive"
    count = (
        "Read an integer n between 0 and 100, followed by n integers between -1000 and 1000. "
        "Count how many of those integers are strictly greater than zero. Print the count on one line. "
        "When n is 0, there are no integers to read.\n\nExample input:\n5\n-3 8 0 1 -5\nExample output:\n2"
    )
    for lang, wrapper, read_add, read_sign, add_result, sign_result, count_start, count_loop in (
        (ProgrammingLang.cpp, "#include <iostream>\n#include <string>\nint main() {\n%s\n}\n",
         "  int a, b;\n  std::cin >> a >> b;", "  int n;\n  std::cin >> n;",
         '  std::cout << (a + b) << "\\n";',
         '  std::cout << (n > 0 ? "Positive" : n < 0 ? "Negative" : "Zero") << "\\n";',
         "  int n;\n  std::cin >> n;\n  int count = 0;",
         '  for (int i = 0; i < n; ++i) {\n    int value;\n    std::cin >> value;\n    if (value > 0) ++count;\n  }\n  std::cout << count << "\\n";'),
        (ProgrammingLang.java, "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n%s\n  }\n}\n",
         "    Scanner input = new Scanner(System.in);\n    int a = input.nextInt(), b = input.nextInt();",
         "    Scanner input = new Scanner(System.in);\n    int n = input.nextInt();",
         "    System.out.println(a + b);",
         '    System.out.println(n > 0 ? "Positive" : n < 0 ? "Negative" : "Zero");',
         "    Scanner input = new Scanner(System.in);\n    int n = input.nextInt();\n    int count = 0;",
         "    for (int i = 0; i < n; i++) {\n      int value = input.nextInt();\n      if (value > 0) count++;\n    }\n    System.out.println(count);"),
    ):
        yield lang, "Add Two Integers", "Standard input and arithmetic", add, ADD_CASES, (
            wrapper % (read_add + "\n    // Print the sum here."),
            wrapper % (read_add + "\n" + add_result),
            wrapper % (read_add + "\n" + add_result.replace("a + b", "a - b")),
        )
        yield lang, "Classify a Number", "Conditions and zero", sign, SIGNED_CASES, (
            wrapper % (read_sign + "\n    // Print the matching label here."),
            wrapper % (read_sign + "\n" + sign_result),
            wrapper % (read_sign + "\n" + sign_result.replace("n > 0", "n >= 0")),
        )
        yield lang, "Count Positive Numbers", "Loops and counters", count, COUNT_CASES, (
            wrapper % (count_start + "\n    // Read each value and count positives, then print the count."),
            wrapper % (count_start + "\n" + count_loop),
            wrapper % (count_start + "\n" + count_loop.replace("value > 0", "value >= 0")),
        )


JAVA_QUIZ = {"questions": [
    {"id": "java-read", "prompt": "Which Scanner method reads the next integer?", "correct_answer": "A",
     "options": [{"key": "A", "text": "nextInt()"}, {"key": "B", "text": "nextLine()"}]},
    {"id": "java-value", "prompt": "What does System.out.println(2 + 3) print?", "correct_answer": "B",
     "options": [{"key": "A", "text": "23"}, {"key": "B", "text": "5"}]},
    {"id": "java-compare", "prompt": "Which condition is true exactly when n is negative?", "correct_answer": "A",
     "options": [{"key": "A", "text": "n < 0"}, {"key": "B", "text": "n <= 0"}]},
]}

CPP_QUIZ = {"questions": [
    {"id": "cpp-read", "prompt": "Which statement reads an integer into n?", "correct_answer": "B",
     "options": [{"key": "A", "text": "std::cout << n;"}, {"key": "B", "text": "std::cin >> n;"},
                 {"key": "C", "text": "std::cin << n;"}]},
    {"id": "cpp-loop", "prompt": "How many times does for (int i = 0; i < 3; ++i) run?", "correct_answer": "C",
     "options": [{"key": "A", "text": "2"}, {"key": "B", "text": "4"}, {"key": "C", "text": "3"}]},
    {"id": "cpp-count", "prompt": "Which condition counts strictly positive values?", "correct_answer": "A",
     "options": [{"key": "A", "text": "value > 0"}, {"key": "B", "text": "value >= 0"},
                 {"key": "C", "text": "value != 0"}]},
]}

QUIZZES = ((ProgrammingLang.cpp, "C++ Starter Check", CPP_QUIZ),
           (ProgrammingLang.java, "Java Fundamentals Check", JAVA_QUIZ))


def require_local():
    url = make_url(settings.DATABASE_URL)
    if (settings.ENVIRONMENT.lower() != "development" or url.get_backend_name() != "postgresql"
            or url.host not in {"127.0.0.1", "localhost", "::1"}
            or {"host", "hostaddr", "service"}.intersection(url.query)
            or os.getenv("PGHOSTADDR") or os.getenv("PGSERVICE")):
        raise SystemExit("Pilot seeding requires a directly configured local development database.")


def foundation_id(language: ProgrammingLang, key: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"bytequest:pilot-foundations:{language.value}:{key}")


def save_drafts(instructor_id, specs):
    ids = []
    with SessionLocal.begin() as db:
        owner = db.get(Profile, instructor_id)
        if owner is None or owner.role != UserRole.instructor or owner.account_status != "active":
            raise SystemExit("Choose an active local instructor.")
        for language, title, topic, prompt, cases, (starter, reference, _) in specs:
            activity_id = foundation_id(language, title)
            ids.append(activity_id)
            existing = db.get(LearningActivity, activity_id)
            if existing is not None:
                if existing.created_by != owner.id:
                    raise SystemExit("A pilot draft already belongs to a different instructor.")
                continue
            activity = LearningActivity(
                id=activity_id, created_by=owner.id, title=title, language=language, topic_concept=topic,
                problem_statement=prompt, activity_type=ActivityKind.challenge, difficulty_level=1,
                xp_reward=30, starter_code=starter, reference_solution_code=reference, review_status=ReviewState.draft,
                test_cases=[TestCase(order_index=i, stdin=stdin + "\n", expected_stdout=expected + "\n",
                                     is_hidden=i >= 2, weight=1.0)
                            for i, (stdin, expected) in enumerate(cases)],
            )
            db.add(activity)
        for language, title, questions in QUIZZES:
            quiz_id = foundation_id(language, "quiz")
            ids.append(quiz_id)
            existing = db.get(LearningActivity, quiz_id)
            if existing is not None:
                if existing.created_by != owner.id:
                    raise SystemExit(f"{title} already belongs to a different instructor.")
                continue
            db.add(LearningActivity(
                id=quiz_id, created_by=owner.id, title=title, language=language,
                topic_concept="Input, conditions and fundamentals", problem_statement=f"Review the topics from {title}.",
                activity_type=ActivityKind.quiz, difficulty_level=1, xp_reward=25,
                review_status=ReviewState.draft, quiz_questions_json=questions,
            ))
    return ids


async def publish_verified(instructor_id, ids, specs):
    judge = Judge0Client()
    checked = {}
    for activity_id, (_, _, _, _, _, (_, _, wrong)) in zip(ids[:len(specs)], specs, strict=True):
        with SessionLocal() as db:
            activity = db.get(LearningActivity, activity_id)
            if activity.review_status == ReviewState.published:
                continue
            fingerprint = challenge_validation_fingerprint(activity)
            language, reference = activity.language, activity.reference_solution_code
            cases = [TestCaseInput(str(case.id), case.order_index, case.stdin, case.expected_stdout,
                                   case.time_limit_ms, case.memory_limit_kb, case.is_hidden, case.weight)
                     for case in activity.test_cases]
        verified, log = await judge.verify_reference_solution(language, reference, cases)
        wrong_result = await judge.evaluate_submission(language, wrong, cases) if verified else None
        if not verified or wrong_result is None or wrong_result.is_successful or wrong_result.dominant_status_id != 4:
            raise SystemExit(f"Pilot challenge {activity_id} did not pass its reference and wrong-answer checks.")
        checked[activity_id] = (fingerprint, log)
    with SessionLocal.begin() as db:
        # Normal publication assigns sequence numbers and applies the shared sample rules.
        for activity_id in ids:
            activity = db.get(LearningActivity, activity_id)
            if activity.review_status == ReviewState.published:
                continue
            lock_activity_for_publication(db, activity)
            if activity.review_status == ReviewState.published:
                continue
            if activity_id in checked:
                fingerprint, log = checked[activity_id]
                if fingerprint != challenge_validation_fingerprint(activity):
                    raise SystemExit("A draft changed during verification. Review it and retry.")
                record_challenge_verification(activity, True, log, fingerprint)
                db.flush()
            apply_publish_rules(db, activity, db.get(Profile, instructor_id))
            db.flush()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--instructor", type=uuid.UUID)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    specs = list(challenge_specs())
    for _, _, questions in QUIZZES:
        parse_quiz_questions(questions)
    if not args.instructor:
        if args.publish:
            parser.error("--publish requires --instructor")
        for language, title, _, _, cases, _ in specs:
            print(f"{language.value}: {title} ({len(cases)} cases)")
        for language, title, questions in QUIZZES:
            print(f"{language.value}: {title} ({len(questions['questions'])} questions)")
        return
    require_local()
    ids = save_drafts(args.instructor, specs)
    print("Prepared pilot activity IDs:", *ids)
    if args.publish:
        asyncio.run(publish_verified(args.instructor, ids, specs))
        print("Pilot activities published.")


if __name__ == "__main__":
    main()

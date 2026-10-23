"""Smoke-check ByteQuest's Judge0 client against Python, C++, and Java."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from uuid import UUID


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Importing the ORM initializes an engine. Keep this check detached from any
# hosted database; it reads only the known local seed fixtures and writes none.
os.environ["DATABASE_URL"] = (
    "postgresql+psycopg2://postgres:postgres@127.0.0.1:54322/postgres"
)

from app.core.database import SessionLocal  # noqa: E402
from app.models.entities import (  # noqa: E402
    ActivityKind,
    LearningActivity,
    ProgrammingLang,
    ReviewState,
    TestCase,
)
from app.services.judge0.client import Judge0Client, TestCaseInput  # noqa: E402


SEED_ACTIVITY_IDS = {
    ProgrammingLang.cpp: UUID("a0000000-0000-4000-8000-000000000001"),
    ProgrammingLang.python: UUID("a0000000-0000-4000-8000-000000000002"),
    ProgrammingLang.java: UUID("a0000000-0000-4000-8000-000000000003"),
}


async def verify_compilers() -> int:
    client = Judge0Client()
    failures: list[str] = []
    db = SessionLocal()

    print("Milestone 1A — seeded reference solutions via ByteQuest Judge0 client")
    try:
        for language, activity_id in SEED_ACTIVITY_IDS.items():
            try:
                activity = (
                    db.query(LearningActivity)
                    .filter(
                        LearningActivity.id == activity_id,
                        LearningActivity.activity_type == ActivityKind.challenge,
                        LearningActivity.language == language,
                        LearningActivity.review_status == ReviewState.published,
                    )
                    .one_or_none()
                )
                if activity is None or not activity.reference_solution_code:
                    raise RuntimeError("Published seeded challenge/reference solution is missing.")

                rows = (
                    db.query(TestCase)
                    .filter(TestCase.activity_id == activity.id)
                    .order_by(TestCase.order_index.asc())
                    .all()
                )
                if not rows:
                    raise RuntimeError("Seeded challenge has no test cases.")

                test_cases = [
                    TestCaseInput(
                        test_case_id=str(row.id),
                        order_index=row.order_index,
                        stdin=row.stdin,
                        expected_stdout=row.expected_stdout,
                        time_limit_ms=row.time_limit_ms,
                        memory_limit_kb=row.memory_limit_kb,
                        is_hidden=False,
                        weight=row.weight,
                    )
                    for row in rows
                ]
                summary = await client.evaluate_submission(
                    language=language,
                    source_code=activity.reference_solution_code,
                    test_cases=test_cases,
                )
                statuses = ", ".join(
                    f"{result.status_description} (ID={result.status_id})"
                    for result in summary.test_results
                )
                passed = (
                    summary.is_successful
                    and len(summary.test_results) == len(test_cases)
                    and all(result.status_id == 3 and result.passed for result in summary.test_results)
                )
                print(
                    f"[{language.value.upper():6}] {'PASS' if passed else 'FAIL'} | "
                    f"{statuses} | {summary.avg_execution_time_ms:.1f} ms avg"
                )
                if not passed:
                    failures.append(language.value)
                    for result in summary.test_results:
                        if not result.passed:
                            details = result.compile_output or result.stderr or result.stdout
                            if details:
                                print(f"  {result.test_case_id}: {details[:1000]}")
            except Exception as exc:  # Report every language even when one call fails.
                db.rollback()
                failures.append(language.value)
                print(f"[{language.value.upper():6}] ERROR | {type(exc).__name__}: {exc}")
    finally:
        db.close()

    if failures:
        print("Failed languages: " + ", ".join(failures))
        return 1

    print("All three language checks returned Accepted for both test cases.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(verify_compilers()))

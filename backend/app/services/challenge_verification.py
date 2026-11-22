"""Tie a Judge0 result to the grading content it checked."""

import hashlib
import json
import logging
import uuid

from sqlalchemy.orm import Session, selectinload

from app.models.entities import LearningActivity, ProgrammingLang, ReviewState
from app.services.judge0.client import TestCaseInput, judge0_client

logger = logging.getLogger(__name__)


def challenge_validation_fingerprint(activity: LearningActivity) -> str:
    payload = {
        "language": activity.language.value,
        "reference_solution_code": activity.reference_solution_code,
        "test_cases": [
            {
                "order_index": case.order_index,
                "stdin": case.stdin,
                "expected_stdout": case.expected_stdout,
                "time_limit_ms": case.time_limit_ms,
                "memory_limit_kb": case.memory_limit_kb,
                "is_hidden": case.is_hidden,
                "weight": case.weight,
            }
            for case in sorted(activity.test_cases, key=lambda item: item.order_index)
        ],
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def record_challenge_verification(
    activity: LearningActivity, verified: bool, log: dict, checked_fingerprint: str,
) -> None:
    verification_log = dict(log)
    verification_log.pop("grading_fingerprint", None)
    if verified:
        verification_log["grading_fingerprint"] = checked_fingerprint
    activity.judge0_verified = verified
    activity.judge0_verification_log = verification_log


def challenge_is_verified(activity: LearningActivity) -> bool:
    if not activity.judge0_verified:
        return False
    log = activity.judge0_verification_log
    fingerprint = log.get("grading_fingerprint") if isinstance(log, dict) else None
    return bool(fingerprint and fingerprint == challenge_validation_fingerprint(activity))


def verification_status(activity: LearningActivity) -> bool:
    # Older published activities keep their recorded status. Every draft needs
    # proof for its current grading content before it can be published.
    if activity.review_status == ReviewState.published:
        return bool(activity.judge0_verified)
    return challenge_is_verified(activity)


async def run_reference_check(
    *, activity_id: uuid.UUID | None, language: ProgrammingLang, reference_solution_code: str,
    test_cases: list[TestCaseInput],
) -> tuple[bool, dict]:
    """Run a reference solution in Judge0; an unreachable sandbox counts as not verified."""
    try:
        return await judge0_client.verify_reference_solution(
            language=language,
            reference_solution_code=reference_solution_code,
            test_cases=test_cases,
        )
    except Exception as exc:
        logger.warning("Judge0 verification could not be completed for activity %s: %s", activity_id, exc)
        return False, {"verified": False, "error": "Judge0 verification could not be completed."}


async def verify_saved_challenge(db: Session, activity: LearningActivity) -> LearningActivity | None:
    """Verify the saved draft and record the result, or return None if it changed meanwhile.

    The transaction is released while Judge0 runs; the result is recorded only
    when the locked row still holds the exact content that was checked.
    """
    activity_id = activity.id
    version = activity.content_version
    fingerprint = challenge_validation_fingerprint(activity)
    language = activity.language
    reference_solution_code = activity.reference_solution_code or ""
    test_cases = [
        TestCaseInput(
            test_case_id=str(case.id),
            order_index=case.order_index,
            stdin=case.stdin,
            expected_stdout=case.expected_stdout,
            time_limit_ms=case.time_limit_ms,
            memory_limit_kb=case.memory_limit_kb,
            is_hidden=case.is_hidden,
            weight=case.weight,
        )
        for case in sorted(activity.test_cases, key=lambda item: item.order_index)
    ]
    db.rollback()
    verified, log = await run_reference_check(
        activity_id=activity_id,
        language=language,
        reference_solution_code=reference_solution_code,
        test_cases=test_cases,
    )
    current = (
        db.query(LearningActivity)
        .options(selectinload(LearningActivity.test_cases))
        .filter(LearningActivity.id == activity_id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if (
        current is None
        or current.review_status != ReviewState.draft
        or current.content_version != version
        or challenge_validation_fingerprint(current) != fingerprint
    ):
        return None
    record_challenge_verification(current, verified, log, fingerprint)
    return current

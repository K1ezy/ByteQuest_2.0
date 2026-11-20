"""Tie a Judge0 result to the grading content it checked."""

import hashlib
import json

from app.models.entities import LearningActivity, ReviewState


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

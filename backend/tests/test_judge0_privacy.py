import asyncio
import base64

import pytest

from app.models.entities import ProgrammingLang
from app.services.judge0.client import (
    Judge0Client,
    Judge0UnavailableError,
    TestCaseInput as GradingInput,
    _parse_completed_result,
    classify_judge0_status,
    judge0_circuit_breaker,
)


def test_hidden_case_contributes_to_score_without_exposing_details(monkeypatch):
    client = Judge0Client()
    cases = [
        GradingInput("visible", 0, "2", "4", is_hidden=False),
        GradingInput("hidden", 1, "private-input", "private-output", is_hidden=True),
    ]

    async def language_ids(deadline=None):
        return {ProgrammingLang.python: 10}

    async def submit_batch(payload, deadline=None):
        assert len(payload) == 2
        # The manuscript's sandbox claim: network access is off for every case, explicitly.
        assert all(item["enable_network"] is False for item in payload)
        return ["visible-token", "hidden-token"]

    async def poll_batch(tokens, **kwargs):
        assert tokens == ["visible-token", "hidden-token"]
        return [
            {
                "token": token,
                "status": {"id": 3, "description": "Accepted"},
                "stdout": base64.b64encode(output.encode()).decode(),
                "stderr": None,
                "compile_output": None,
                "time": "0.01",
                "memory": 1024,
            }
            for token, output in zip(tokens, ("4", "private-output"), strict=True)
        ]

    monkeypatch.setattr(client, "_get_language_ids", language_ids)
    monkeypatch.setattr(client, "_submit_batch_tokens", submit_batch)
    monkeypatch.setattr(client, "_poll_batch_results", poll_batch)

    summary = asyncio.run(client.evaluate_submission(ProgrammingLang.python, "print(4)", cases))
    assert (summary.passed_test_cases, summary.total_test_cases, summary.score_percentage) == (2, 2, 100.0)
    assert [result.test_case_id for result in summary.test_results] == ["visible"]
    assert all("private" not in str(result) for result in summary.test_results)


def test_sandbox_internal_error_is_unavailability_not_a_student_failure():
    """Judge0 status 13 is the sandbox breaking, so it must not be graded.

    Grading it would charge the attempt and label the ML row a failure. The
    worker retries Judge0UnavailableError, so raising is what keeps the
    manuscript's delimitation true: infrastructure failures are not outcomes.
    """
    client = Judge0Client()
    cases = [GradingInput("visible", 0, "2", "4", is_hidden=False)]

    async def language_ids(deadline=None):
        return {ProgrammingLang.python: 10}

    async def submit_batch(payload, deadline=None):
        return ["token"]

    async def poll_batch(tokens, **kwargs):
        return [
            {
                "token": tokens[0],
                "status": {"id": 13, "description": "Internal Error"},
                "stdout": None,
                "stderr": None,
                "compile_output": None,
                "time": "0.01",
                "memory": 1024,
            }
        ]

    for name, fake in (("_get_language_ids", language_ids),
                       ("_submit_batch_tokens", submit_batch),
                       ("_poll_batch_results", poll_batch)):
        setattr(client, name, fake)

    judge0_circuit_breaker.record_success()
    with pytest.raises(Judge0UnavailableError):
        asyncio.run(client.evaluate_submission(ProgrammingLang.python, "print(4)", cases))
    # A sandbox failure counts against the breaker, unlike a bad student program.
    assert judge0_circuit_breaker.failure_count == 1
    judge0_circuit_breaker.record_success()


def test_program_crash_is_still_graded_as_a_runtime_error():
    """The guard must not swallow genuine crashes: status 11 stays the student's."""
    assert classify_judge0_status(11) == "runtime_error"
    assert _parse_completed_result(
        {"status": {"id": 11, "description": "Runtime Error (NZEC)"}, "time": "0.01", "memory": 1024}
    )[0] == 11

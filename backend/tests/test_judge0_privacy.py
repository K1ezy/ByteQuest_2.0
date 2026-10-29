import asyncio
import base64

from app.models.entities import ProgrammingLang
from app.services.judge0.client import Judge0Client, TestCaseInput as GradingInput


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

"""Evaluate the live tutor with a disposable local student and synthetic lessons.

Set BYTEQUEST_QA_STUDENT_TOKEN to the fixture student's access token. The JSON
fixture is a list of cases with activity_id, language, questions, and failing_code.
Questions can be a string or a list of strings to evaluate consecutive turns.
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID, uuid4

import httpx
from pydantic import BaseModel, Field


class TutorCase(BaseModel):
    activity_id: UUID
    language: str
    questions: list[str | list[str]] = Field(min_length=1, max_length=4)
    failing_code: str = Field(min_length=1, max_length=50_000)
    expected_error_category: Literal["syntax_error", "runtime_error", "logic_error", "timeout"] | None = None


def _request(client: httpx.Client, method: str, path: str, **kwargs) -> dict:
    response = client.request(method, path, **kwargs)
    response.raise_for_status()
    return response.json()


def _failed_sample(client: httpx.Client, case: TutorCase) -> tuple[str, str]:
    job = _request(client, "POST", "submission-jobs", headers={"Idempotency-Key": uuid4().hex},
                   json={"activity_id": str(case.activity_id), "source_code": case.failing_code, "dry_run_only": True})
    job_id = job["id"]
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        job = _request(client, "GET", f"submission-jobs/{job_id}")
        if job["status"] == "completed":
            evaluation = job["result"]["evaluation"]
            if evaluation["is_successful"]:
                raise ValueError(f"Expected a failing sample for {case.activity_id}.")
            category = evaluation["dominant_error_category"]
            if case.expected_error_category and category != case.expected_error_category:
                raise ValueError(f"Expected {case.expected_error_category} for {case.activity_id}; saw {category}.")
            return job_id, category
        if job["status"] == "failed":
            raise RuntimeError(f"The sandbox did not grade the sample ({job_id}).")
        time.sleep(1)
    raise TimeoutError(f"The sample did not finish in time ({job_id}).")


def _evaluate(client: httpx.Client, case: TutorCase, run_id: str):
    sample_id, category = _failed_sample(client, case)
    activity_id = str(case.activity_id)
    common = {"run_id": run_id, "sample_job_id": sample_id, "activity_id": activity_id,
              "language": case.language, "error_category": category, "rubric": {"correct": None, "grounded": None,
                                                    "no_full_solution": None, "helpful": None}}
    for question in case.questions:
        messages = []
        for turn in ([question] if isinstance(question, str) else question):
            messages.append({"role": "user", "content": turn})
            reply = _request(client, "POST", "chat/messages", json={"activity_id": activity_id, "messages": messages})
            yield {**common, "kind": "chat", "question": turn, **reply}
            messages.append({"role": "assistant", "content": reply["reply"]})
    path = f"pilot/activities/{activity_id}/hints"
    before = _request(client, "GET", path)["remaining"]
    request = {"source": "ai", "request_key": uuid4().hex}
    hint = _request(client, "POST", f"{path}/reveal", json=request)
    replay = _request(client, "POST", f"{path}/reveal", json=request)
    if hint != replay or hint["remaining"] != before - 1:
        raise AssertionError("A delivered hint must spend exactly one reveal, including replay.")
    yield {**common, "kind": "failed_sample_hint", "allowance_before": before, **hint}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--api-base", default="http://127.0.0.1:8000/api/v1")
    parser.add_argument("--cases", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    endpoint = urlsplit(args.api_base)
    if endpoint.scheme != "http" or endpoint.hostname not in {"localhost", "127.0.0.1", "::1"} or endpoint.username:
        parser.error("Use the local FastAPI origin and a disposable student fixture.")
    token = os.getenv("BYTEQUEST_QA_STUDENT_TOKEN")
    if not token:
        parser.error("Set BYTEQUEST_QA_STUDENT_TOKEN for the synthetic local student.")
    cases = [TutorCase.model_validate(item) for item in json.loads(args.cases.read_text(encoding="utf-8"))]
    if not cases:
        parser.error("Provide at least one synthetic lesson case.")
    run_id = uuid4().hex
    with httpx.Client(base_url=f"{args.api_base.rstrip('/')}/", timeout=45, trust_env=False,
                      headers={"Authorization": f"Bearer {token}"}) as client:
        with args.output.open("x", encoding="utf-8") as evidence:
            for case in cases:
                for record in _evaluate(client, case, run_id):
                    evidence.write(json.dumps(record, ensure_ascii=False) + "\n")
                    evidence.flush()


if __name__ == "__main__":
    main()

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from types import SimpleNamespace

import pytest

from app.services.ai_rag.error_explainer import (
    ErrorExplanationSchema,
    explain_code_error,
)
from app.services.ai_rag import gemini_client
from app.services.ai_rag.llm import GeminiLLMService


def test_error_explanation_schema_validation():
    data = {
        "title": "Syntax Error: Missing Semicolon",
        "summary": "You forgot to terminate a statement with a semicolon.",
        "concept_explanation": "C++ requires statements to end with a semicolon to signal statement completion.",
        "hints": [
            "Check line 4 where you declare the variable.",
            "Does every statement have a closing semicolon?",
        ],
        "pedagogical_tip": "Pay close attention to compiler line numbers.",
    }
    obj = ErrorExplanationSchema(**data)
    assert obj.title == "Syntax Error: Missing Semicolon"
    assert len(obj.hints) == 2


def test_explain_code_error_uses_structured_prompt_without_external_call(monkeypatch):
    captured = {}

    def fake_generate_structured(**kwargs):
        captured.update(kwargs)
        return ErrorExplanationSchema(
            title="Logic error",
            summary="The result differs from the expected value.",
            concept_explanation="Subtraction and addition produce different results.",
            hints=["Check which operation the task requests."],
            pedagogical_tip="Compare your output with the sample.",
        )

    monkeypatch.setattr(GeminiLLMService, "generate_structured", fake_generate_structured)
    result = explain_code_error(
        language="python",
        problem_title="Sum of Two Numbers",
        problem_statement="Return a + b",
        student_code="def add(a, b):\n    return a - b",
        error_category="logic_error",
        status_description="Wrong Answer",
        failed_input="1, 2",
        expected_output="3",
        actual_output="-1",
    )
    assert isinstance(result, ErrorExplanationSchema)
    assert captured["response_schema"] is ErrorExplanationSchema
    assert "DO NOT write out the complete corrected code" in captured["prompt"]
    assert "Sample Test Input: 1, 2" in captured["prompt"]
    assert "The student sees only the first hint" in captured["prompt"]


def test_gemini_transport_has_a_deadline_and_no_additional_sdk_retries(monkeypatch):
    captured = {}
    monkeypatch.setattr(gemini_client.genai, "Client", lambda **kwargs: captured.update(kwargs))
    gemini_client._client_for_key.__wrapped__("synthetic-key")
    options = captured["http_options"]
    assert options.timeout == 20_000
    assert options.retry_options.attempts == 1


def test_disabled_gemini_refuses_before_opening_a_provider_client(monkeypatch):
    monkeypatch.setattr(gemini_client, "get_settings", lambda: SimpleNamespace(GEMINI_ENABLED=False, GEMINI_API_KEY="synthetic-key"))
    monkeypatch.setattr(gemini_client, "_client_for_key", lambda _: pytest.fail("Disabled Gemini opened a provider client"))

    with pytest.raises(gemini_client.GeminiConfigurationError, match="disabled"):
        gemini_client.get_gemini_client()


def test_concurrent_first_use_shares_the_gemini_transport(monkeypatch):
    constructed = []
    started = Event()
    second_call = Event()
    release = Event()

    def fake_client(**kwargs):
        client = object()
        constructed.append(client)
        started.set()
        assert release.wait(5)
        return client

    def second_caller():
        second_call.set()
        return gemini_client.get_gemini_client()

    monkeypatch.setattr(gemini_client.genai, "Client", fake_client)
    monkeypatch.setattr(gemini_client, "get_settings", lambda: SimpleNamespace(GEMINI_ENABLED=True, GEMINI_API_KEY="synthetic-key"))
    gemini_client._client_for_key.cache_clear()
    try:
        with ThreadPoolExecutor(max_workers=2) as workers:
            first = workers.submit(gemini_client.get_gemini_client)
            assert started.wait(5)
            second = workers.submit(second_caller)
            assert second_call.wait(5)
            release.set()
            assert first.result() is second.result()
            assert len(constructed) == 1
    finally:
        gemini_client._client_for_key.cache_clear()

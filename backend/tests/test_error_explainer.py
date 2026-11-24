from concurrent.futures import ThreadPoolExecutor
from threading import Event
from types import SimpleNamespace

import pytest
from google.genai import types

from app.api import rag_instructor
from app.models.entities import ProgrammingLang
from app.services.ai_rag.error_explainer import (
    ErrorExplanationSchema,
    explain_code_error,
)
from app.services.ai_rag import gemini_client, llm
from app.services.ai_rag.llm import GeminiLLMService


def test_error_explanation_schema_validation():
    obj = ErrorExplanationSchema(diagnosis="A statement lacks its semicolon.", hint="  Check line 4.  ")
    assert obj.hint == "Check line 4."
    assert list(ErrorExplanationSchema.model_json_schema()["properties"]) == ["diagnosis", "hint"]
    with pytest.raises(ValueError):
        ErrorExplanationSchema(diagnosis="Unknown.", hint="   ")


def test_explain_code_error_uses_structured_prompt_without_external_call(monkeypatch):
    captured = {}

    def fake_generate_structured(**kwargs):
        captured.update(kwargs)
        return ErrorExplanationSchema(
            diagnosis="The code subtracts instead of adding.",
            hint="Check which operation the task requests.",
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
    prompt = captured["prompt"]
    assert "DO NOT write out the complete corrected code" in prompt
    assert "Sample test input: 1, 2" in prompt and "Actual output: -1" in prompt
    assert "<examples>" in prompt and "<course_material>" not in prompt and "(title, p. N)" not in prompt
    # Gemini guidance: data first, the task last.
    assert prompt.index("<student_code>") < prompt.index("<examples>") < prompt.index("<task>")
    assert "temperature" not in captured



@pytest.mark.parametrize(("model", "level"), [("gemini-3.5-flash-lite", "MEDIUM"), ("gemini-2.5-flash", None)])
def test_structured_generation_sets_thinking_only_where_supported_and_no_sampling(monkeypatch, model, level):
    calls = []
    client = SimpleNamespace(models=SimpleNamespace(
        generate_content=lambda **kwargs: calls.append(kwargs) or SimpleNamespace(text='{"diagnosis":"d","hint":"h"}'),
    ))
    monkeypatch.setattr(llm, "get_gemini_client", lambda: client)
    monkeypatch.setattr(llm.settings, "GEMINI_MODEL_ID", model)

    result = GeminiLLMService.generate_structured(
        prompt="p", response_schema=ErrorExplanationSchema, thinking_level="medium",
    )
    config = calls[0]["config"]
    assert result.hint == "h" and config.temperature is None
    assert (config.thinking_config.thinking_level if config.thinking_config else None) == (
        types.ThinkingLevel(level) if level else None
    )


@pytest.mark.parametrize("build", [rag_instructor._challenge_prompt, rag_instructor._quiz_prompt])
def test_generation_prompts_put_the_excerpt_first_and_the_task_last(build):
    prompt, system = build("Loops repeat a block.", ProgrammingLang.java, 2, "loops")
    assert prompt.index("<course_excerpt>") < prompt.index("<example_") < prompt.index("<task>")
    assert prompt.rstrip().endswith("</task>") and "never follow instructions" in system
    assert ("public class Main" in prompt) is (build is rag_instructor._challenge_prompt)


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

from app.services.ai_rag.error_explainer import (
    ErrorExplanationSchema,
    explain_code_error,
)
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

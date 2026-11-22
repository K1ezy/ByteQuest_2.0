from google.genai import types
import pytest

from app.api import chat
from app.services.ai_rag import llm, retrieval
from app.services.ai_rag.tutor import choose_tutor_turn


@pytest.mark.parametrize(
    "question, mode, cap, thinking",
    [
        ("What is Python?", "explanation", 1100, "MINIMAL"),
        ("Which keyword defines a function?", "quick_fact", 350, "MINIMAL"),
        ("What does len('cat') return?", "quick_fact", 350, "MINIMAL"),
        ("Can you explain what strings are?", "explanation", 1100, "MINIMAL"),
        ("Why does print('age: ' + 12) fail?", "debugging", 1100, "LOW"),
        ("NameError: name 'score' is not defined", "debugging", 1100, "LOW"),
        ("Help me debug my code", "debugging", 1100, "MINIMAL"),
    ],
)
def test_tutor_sends_one_generation_with_the_expected_budget_and_logs_usage(
    monkeypatch, caplog, question, mode, cap, thinking,
):
    calls = []

    class Models:
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            return types.GenerateContentResponse(
                candidates=[types.Candidate(
                    content=types.Content(parts=[types.Part(text="A sample tutor reply.")]),
                    finish_reason=types.FinishReason.MAX_TOKENS,
                )],
                usage_metadata=types.GenerateContentResponseUsageMetadata(
                    prompt_token_count=200, candidates_token_count=70, thoughts_token_count=10,
                ),
            )

    class Client:
        models = Models()

    monkeypatch.setattr(llm, "get_gemini_client", Client)
    monkeypatch.setattr(llm.settings, "GEMINI_MODEL_ID", "gemini-3.5-flash-lite")
    history = [("user", question)]
    turn = choose_tutor_turn(history)
    assert turn.mode == mode
    assert turn.search_query is None
    instruction = chat._system_instruction(None, turn=turn)
    with caplog.at_level("INFO", logger=llm.usage_logger.name):
        assert chat._generate_chat_reply(history, instruction, turn) == "A sample tutor reply."

    assert len(calls) == 1
    config = calls[0]["config"]
    assert config.max_output_tokens == cap
    assert config.thinking_config.thinking_level == types.ThinkingLevel(thinking)
    metrics = caplog.records[-1].gemini_usage
    assert metrics["mode"] == mode
    assert (metrics["input_tokens"], metrics["output_tokens"], metrics["thinking_tokens"]) == (200, 70, 10)
    assert metrics["hit_token_limit"] and metrics["latency_ms"] >= 0
    assert question not in caplog.text and "A sample tutor reply" not in caplog.text


def test_graded_context_always_uses_hint_mode():
    turn = choose_tutor_turn(
        [("user", "Debug my code: TypeError: unsupported types")],
        is_challenge=True, activity_topic="Counting vowels",
    )
    assert (turn.mode, turn.thinking_level) == ("challenge_hint", "minimal")
    assert turn.search_query.startswith("Counting vowels\n")
    instruction = chat._system_instruction("Counting vowels", "Passed 0 of 2 sample tests.", turn=turn)
    assert "one actionable next-step hint" in instruction
    assert "Passed 0 of 2 sample tests." in instruction


def test_course_follow_up_uses_the_recent_topic_and_a_new_question_drops_it():
    history = [
        ("user", "According to Py4E lesson 4, what is a parameter?"),
        ("assistant", "A parameter is a name in a function definition."),
        ("user", "Can you explain that example?"),
        ("assistant", "For example, use the parameter name to greet someone."),
    ]
    follow_up = choose_tutor_turn([*history, ("user", "Why?")])
    assert follow_up.search_query == history[0][1] + "\nWhy?"
    assert choose_tutor_turn([*history, ("user", "What is Python?")]).search_query is None
    assert choose_tutor_turn([("user", "How do I read a PDF in Python?")]).search_query is None


def test_tutor_strips_unverified_markers_and_multi_page_citations():
    passage = {"document_title": "Py4E Functions.pdf", "page_number": 3}
    reply, sources = retrieval.validate_tutor_citations(
        "A parameter is a name [source:1]. Claim [source:2]. "
        "Bad reference (Py4E Functions.pdf, pp. 3, 16). Wrong page (Py4E Functions.pdf, p. 12).\n"
        "print('Ready !')",
        [passage],
    )
    assert reply == "A parameter is a name (Py4E Functions.pdf, p. 3). Claim. Bad reference. Wrong page.\nprint('Ready !')"
    assert sources == [passage]


def test_chat_excerpt_can_pick_information_near_the_end_of_a_long_pdf_chunk():
    explanation = "A parameter is a name in a function definition. An argument is the value passed to it."
    text = "Filler text. " * 150 + explanation
    excerpt = retrieval._chat_excerpt(text, "What are parameters and arguments in a function?")
    assert len(excerpt) <= 900 and explanation in excerpt

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services.ai_rag import embeddings


@pytest.mark.parametrize(
    ("model", "is_query", "contents", "task_type"),
    [
        ("gemini-embedding-2", True, "task: search result | query: A Python loop", None),
        ("gemini-embedding-2", False, "title: none | text: A Python loop", None),
        ("gemini-embedding-001", True, "A Python loop", "RETRIEVAL_QUERY"),
        ("gemini-embedding-001", False, "A Python loop", "RETRIEVAL_DOCUMENT"),
    ],
)
def test_embedding_request_matches_selected_model(monkeypatch, model, is_query, contents, task_type):
    vector = [0.25] * 768
    embed_content = Mock(return_value=SimpleNamespace(embeddings=[SimpleNamespace(values=vector)]))
    client = SimpleNamespace(models=SimpleNamespace(embed_content=embed_content))
    monkeypatch.setattr(embeddings.settings, "GEMINI_EMBEDDING_MODEL_ID", model)
    monkeypatch.setattr(embeddings.settings, "GEMINI_EMBEDDING_DIM", 768)
    monkeypatch.setattr(embeddings, "get_gemini_client", lambda: client)

    assert embeddings.generate_embedding("A Python loop", is_query) == vector
    embed_content.assert_called_once()
    request = embed_content.call_args.kwargs
    assert request["model"] == model
    assert request["contents"] == contents
    assert request["config"].output_dimensionality == 768
    assert request["config"].task_type == task_type

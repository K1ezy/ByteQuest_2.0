import asyncio
import logging
import math
from typing import Callable, List, Sequence

from google.genai import types

from app.core.config import get_settings
from app.services.ai_rag.gemini_client import get_gemini_client

logger = logging.getLogger(__name__)
settings = get_settings()

EMBEDDING_BATCH_CONCURRENCY = 3
EMBEDDING_DIMENSIONS = 768


def generate_embedding(text: str, is_query: bool = False) -> List[float]:
    """
    Rule 2: Asymmetric 768-Dim Embeddings using gemini-embedding-2.
    Uses RETRIEVAL_DOCUMENT when embedding PDF chunks and RETRIEVAL_QUERY when embedding search queries.
    """
    task_type = "RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT"

    response = get_gemini_client().models.embed_content(
        model=settings.GEMINI_EMBEDDING_MODEL_ID,
        contents=text,
        config=types.EmbedContentConfig(
            output_dimensionality=settings.GEMINI_EMBEDDING_DIM,  # 768
            task_type=task_type,
        ),
    )

    if not response.embeddings or not response.embeddings[0].values:
        raise ValueError("Failed to generate embedding vector from Gemini API.")

    return list(response.embeddings[0].values)


async def embed_chunks_bounded(
    chunks: Sequence[dict],
    *,
    on_chunk: Callable[[], None] | None = None,
) -> list[list[float]]:
    """Embed document chunks in bounded batches while preserving chunk order.

    The Gemini SDK call is synchronous, so each call runs off the event loop. A
    fixed concurrency keeps upload latency reasonable without unbounded fan-out.
    """
    embeddings: list[list[float]] = []
    for start in range(0, len(chunks), EMBEDDING_BATCH_CONCURRENCY):
        batch = chunks[start : start + EMBEDDING_BATCH_CONCURRENCY]

        def embed_one(chunk: dict) -> list[float]:
            if on_chunk is not None:
                on_chunk()
            return generate_embedding(chunk["content_text"], False)

        results = await asyncio.gather(
            *(asyncio.to_thread(embed_one, chunk) for chunk in batch),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, BaseException):
                raise result
            if (
                not isinstance(result, list)
                or len(result) != EMBEDDING_DIMENSIONS
                or any(
                    isinstance(value, bool)
                    or not isinstance(value, (int, float))
                    or not math.isfinite(value)
                    for value in result
                )
            ):
                raise ValueError("Embedding service returned an invalid vector.")
            embeddings.append(result)
    return embeddings


# Class wrapper for backward compatibility
class GeminiEmbeddingService:
    @staticmethod
    def embed_document_chunk(text: str) -> List[float]:
        return generate_embedding(text, is_query=False)

    @staticmethod
    def embed_query(query: str) -> List[float]:
        return generate_embedding(query, is_query=True)


embedding_service = GeminiEmbeddingService()

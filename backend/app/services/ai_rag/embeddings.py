import logging
from typing import List
from google import genai
from google.genai import types

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

client = genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_embedding(text: str, is_query: bool = False) -> List[float]:
    """
    Rule 2: Asymmetric 768-Dim Embeddings using gemini-embedding-2.
    Uses RETRIEVAL_DOCUMENT when embedding PDF chunks and RETRIEVAL_QUERY when embedding search queries.
    """
    task_type = "RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT"

    response = client.models.embed_content(
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


# Class wrapper for backward compatibility
class GeminiEmbeddingService:
    @staticmethod
    def embed_document_chunk(text: str) -> List[float]:
        return generate_embedding(text, is_query=False)

    @staticmethod
    def embed_query(query: str) -> List[float]:
        return generate_embedding(query, is_query=True)


embedding_service = GeminiEmbeddingService()

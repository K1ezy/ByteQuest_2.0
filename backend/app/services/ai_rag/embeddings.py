"""
Gemini Embeddings Service (Rule 2)
Generates 768-dimensional vector embeddings using gemini-embedding-2.
Enforces RETRIEVAL_DOCUMENT for PDF chunks and RETRIEVAL_QUERY for student queries.
"""

from typing import List
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings


class GeminiEmbeddingService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_EMBEDDING_MODEL  # gemini-embedding-2
        self.dim = settings.GEMINI_EMBEDDING_DIM      # 768
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def embed_document_chunk(self, text: str) -> List[float]:
        """Generates embedding for an instructional document chunk (Rule 2: RETRIEVAL_DOCUMENT)."""
        return await self._get_embedding(text, task_type="RETRIEVAL_DOCUMENT")

    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def embed_query(self, query: str) -> List[float]:
        """Generates embedding for a student search or topic query (Rule 2: RETRIEVAL_QUERY)."""
        return await self._get_embedding(query, task_type="RETRIEVAL_QUERY")

    async def _get_embedding(self, text: str, task_type: str) -> List[float]:
        import httpx

        url = f"{self.base_url}/models/{self.model}:embedContent?key={self.api_key}"
        payload = {
            "model": f"models/{self.model}",
            "content": {
                "parts": [{"text": text}]
            },
            "taskType": task_type,
            "outputDimensionality": self.dim,
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["embedding"]["values"]


embedding_service = GeminiEmbeddingService()

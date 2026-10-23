import logging
from typing import Type, TypeVar, Optional, List
from google import genai
from google.genai import types
from pydantic import BaseModel
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

client = genai.Client(api_key=settings.GEMINI_API_KEY)
T = TypeVar("T", bound=BaseModel)


class GeminiAPIError(Exception):
    """Raised when Gemini API generation fails."""


class GeminiLLMService:
    @staticmethod
    @retry(
        retry=retry_if_exception_type((Exception,)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1.0, min=1.0, max=5.0),
        reraise=True,
    )
    def generate_structured(
        prompt: str,
        response_schema: Type[T],
        system_instruction: str = "You are an expert Computer Science professor and automated instructional designer.",
        temperature: float = 0.2,
    ) -> T:
        """
        Rule 1: Configurable LLM Wrapper supporting GEMINI_MODEL_ID from environment.
        Enforces Pydantic Structured Outputs for strict JSON schema conformance.
        """
        model_id = settings.GEMINI_MODEL_ID  # Supports gemini-3.5-flash-lite or gemini-2.5-flash

        try:
            response = client.models.generate_content(
                model=model_id,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=temperature,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                ),
            )

            if not response.text:
                raise GeminiAPIError("Gemini returned empty response text.")

            return response_schema.model_validate_json(response.text)

        except Exception as exc:
            logger.error(f"Gemini generation failed with model {model_id}: {exc}")
            raise GeminiAPIError(f"Gemini generation error: {exc}") from exc


gemini_service = GeminiLLMService()

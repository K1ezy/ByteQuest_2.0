import logging
from typing import Type, TypeVar, Optional, List
from google.genai import types
from pydantic import BaseModel
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.services.ai_rag.gemini_client import GeminiConfigurationError, get_gemini_client

logger = logging.getLogger(__name__)
settings = get_settings()
T = TypeVar("T", bound=BaseModel)


class GeminiAPIError(Exception):
    """Raised when Gemini API generation fails."""


class GeminiLLMService:
    @staticmethod
    @retry(
        retry=retry_if_exception(lambda exc: not isinstance(exc, GeminiConfigurationError)),
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
        # Check configuration before the retry wrapper; retrying an absent key cannot help.
        client = get_gemini_client()

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

    @staticmethod
    def generate_chat(
        messages: list[tuple[str, str]],
        system_instruction: str,
        max_output_tokens: int,
        temperature: float = 0.4,
    ) -> str:
        """Generate a short plain-text tutoring reply from bounded conversation turns."""
        model_id = settings.GEMINI_MODEL_ID
        client = get_gemini_client()

        contents = [
            types.Content(
                role="user" if role == "user" else "model",
                parts=[types.Part(text=content)],
            )
            for role, content in messages
        ]

        try:
            response = client.models.generate_content(
                model=model_id,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                ),
            )
            text = (response.text or "").strip()
            if not text:
                raise GeminiAPIError("Gemini returned an empty chat response.")
            return text
        except GeminiConfigurationError:
            raise
        except GeminiAPIError:
            raise
        except Exception as exc:
            logger.error(
                "Gemini chat generation failed with model %s (%s).",
                model_id,
                type(exc).__name__,
            )
            raise GeminiAPIError("Gemini chat generation failed.") from exc


gemini_service = GeminiLLMService()

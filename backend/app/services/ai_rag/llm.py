import logging
import math
from time import perf_counter
from typing import Literal, Type, TypeVar

import httpx
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.services.ai_rag.gemini_client import GeminiConfigurationError, get_gemini_client

logger = logging.getLogger(__name__)
usage_logger = logging.getLogger("uvicorn.error.bytequest.gemini")
settings = get_settings()
T = TypeVar("T", bound=BaseModel)


class GeminiAPIError(Exception):
    """Raised when Gemini API generation fails."""

    def __init__(
        self, message: str = "Gemini generation failed.", *,
        kind: Literal["rate_limited", "timeout", "unavailable"] = "unavailable", retry_after: int | None = None,
    ):
        super().__init__(message)
        self.kind = kind
        self.retry_after = retry_after


def _retry_after(exc: genai_errors.APIError) -> int | None:
    """Seconds the provider asked us to wait, from its header or RetryInfo, clamped to a safe range."""
    value = (getattr(exc.response, "headers", None) or {}).get("retry-after")
    error = exc.details.get("error") if isinstance(exc.details, dict) else None
    if value is None and isinstance(error, dict) and isinstance(error.get("details"), list):
        value = next((str(item["retryDelay"]).removesuffix("s") for item in error["details"]
                      if isinstance(item, dict) and item.get("retryDelay")), None)
    try:
        return min(max(math.ceil(float(value)), 1), 300)
    except (TypeError, ValueError, OverflowError):
        return None


def _chat_failure(exc: Exception) -> GeminiAPIError:
    """Classify a provider failure; its message is dropped because it may echo the prompt."""
    if isinstance(exc, (TimeoutError, httpx.TimeoutException)):
        return GeminiAPIError("Gemini chat generation timed out.", kind="timeout")
    if isinstance(exc, genai_errors.APIError):
        return GeminiAPIError("Gemini chat generation failed.", kind="rate_limited" if exc.code == 429 else "unavailable",
                              retry_after=_retry_after(exc) if exc.code in (429, 503) else None)
    return GeminiAPIError("Gemini chat generation failed.")


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
                    response_json_schema=response_schema.model_json_schema(),
                ),
            )

            if not response.text:
                raise GeminiAPIError("Gemini returned empty response text.")

            return response_schema.model_validate_json(response.text)

        except Exception as exc:
            logger.warning(
                "Gemini structured generation failed with model %s (%s).",
                model_id,
                type(exc).__name__,
            )
            raise GeminiAPIError("Gemini structured generation failed.") from None

    @staticmethod
    def generate_chat(
        messages: list[tuple[str, str]],
        system_instruction: str,
        max_output_tokens: int,
        temperature: float = 0.4,
        *,
        thinking_level: str | None = None,
        mode: str = "chat",
    ) -> str:
        """Generate a plain-text tutoring reply and record provider usage."""
        model_id = settings.GEMINI_MODEL_ID
        client = get_gemini_client()
        thinking_config = None
        if thinking_level and model_id.removeprefix("models/") == "gemini-3.5-flash-lite":
            thinking_config = types.ThinkingConfig(thinking_level=types.ThinkingLevel(thinking_level.upper()))

        contents = [
            types.Content(
                role="user" if role == "user" else "model",
                parts=[types.Part(text=content)],
            )
            for role, content in messages
        ]

        try:
            started = perf_counter()
            response = client.models.generate_content(
                model=model_id,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                    thinking_config=thinking_config,
                ),
            )
            usage = response.usage_metadata
            finish = response.candidates[0].finish_reason if response.candidates else None
            metrics = {
                "model": model_id,
                "mode": mode,
                "input_tokens": usage.prompt_token_count if usage else None,
                "output_tokens": usage.candidates_token_count if usage else None,
                "thinking_tokens": (usage.thoughts_token_count or 0) if usage else None,
                "cached_input_tokens": (usage.cached_content_token_count or 0) if usage else None,
                "latency_ms": round((perf_counter() - started) * 1_000),
                "finish_reason": finish.value if finish else None,
                "max_output_tokens": max_output_tokens,
                "hit_token_limit": finish == types.FinishReason.MAX_TOKENS,
            }
            usage_logger.info("Gemini tutor usage %s", metrics, extra={"gemini_usage": metrics})
            text = (response.text or "").strip()
            if not text:
                raise GeminiAPIError("Gemini returned an empty chat response.")
            return text
        except GeminiConfigurationError:
            raise
        except GeminiAPIError:
            raise
        except Exception as exc:
            failure = _chat_failure(exc)
            logger.error(
                "Gemini chat generation failed with model %s (%s, %s).",
                model_id,
                type(exc).__name__,
                failure.kind,
            )
            raise failure from exc


gemini_service = GeminiLLMService()

"""Lazy, shared Gemini client creation so non-AI API routes can start without a key."""

from functools import lru_cache
from threading import Lock

from google import genai
from google.genai import types

from app.core.config import get_settings

_client_lock = Lock()
GEMINI_DISABLED = "AI assistance is disabled for this ByteQuest instance."


class GeminiConfigurationError(RuntimeError):
    """Raised when an AI feature is requested without Gemini credentials."""


@lru_cache(maxsize=1)
def _client_for_key(api_key: str) -> genai.Client:
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=20_000, retry_options=types.HttpRetryOptions(attempts=1)),
    )


def get_gemini_client() -> genai.Client:
    """Return the cached client, validating configuration only when AI is used."""
    settings = get_settings()
    if not settings.GEMINI_ENABLED:
        raise GeminiConfigurationError(GEMINI_DISABLED)
    api_key = settings.GEMINI_API_KEY.strip()
    if not api_key:
        raise GeminiConfigurationError(
            "Gemini is not configured. Set GEMINI_API_KEY to use AI content features."
        )
    # Concurrent first use can call an lru_cache miss more than once. The SDK
    # closes a discarded Client's transport even if a request is using its models.
    with _client_lock:
        return _client_for_key(api_key)

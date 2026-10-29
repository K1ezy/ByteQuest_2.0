"""Lazy, shared Gemini client creation so non-AI API routes can start without a key."""

from functools import lru_cache

from google import genai

from app.core.config import get_settings


class GeminiConfigurationError(RuntimeError):
    """Raised when an AI feature is requested without Gemini credentials."""


@lru_cache(maxsize=1)
def _client_for_key(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key)


def get_gemini_client() -> genai.Client:
    """Return the cached client, validating configuration only when AI is used."""
    api_key = get_settings().GEMINI_API_KEY.strip()
    if not api_key:
        raise GeminiConfigurationError(
            "Gemini is not configured. Set GEMINI_API_KEY to use AI content features."
        )
    return _client_for_key(api_key)

"""Public alphabetic handles, separate from research pseudonyms."""

from __future__ import annotations

import re
import uuid

_HEX_TO_LETTERS = str.maketrans("0123456789abcdef", "abcdefghijklmnop")
USERNAME_RE = re.compile(r"^[a-z]{3,44}$")


def starter_username(user_id: uuid.UUID, display_name: str | None = None) -> str:
    """Make a readable, collision-free handle without exposing numeric IDs."""
    prefix = re.sub(r"[^a-z]", "", (display_name or "").lower())[:12] or "member"
    return prefix + user_id.hex.translate(_HEX_TO_LETTERS)


def normalize_username(value: str) -> str:
    username = value.strip().lower()
    if not USERNAME_RE.fullmatch(username):
        raise ValueError("Username must be 3–44 letters, without spaces or numbers.")
    return username

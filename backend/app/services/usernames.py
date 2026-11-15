"""Public alphabetic handles, separate from research pseudonyms."""

from __future__ import annotations

import re
import uuid

_HEX_TO_LETTERS = str.maketrans("0123456789abcdef", "abcdefghijklmnop")
USERNAME_RE = re.compile(r"^[a-z]{3,44}$")


def _encoded_id(user_id: uuid.UUID) -> str:
    return user_id.hex.translate(_HEX_TO_LETTERS)


def starter_username(user_id: uuid.UUID, display_name: str | None = None) -> str:
    """Make a collision-free placeholder handle until the user chooses one.

    The suffix is the account id re-lettered, so it is unique but reversible:
    never show a starter handle to other learners.
    """
    prefix = re.sub(r"[^a-z]", "", (display_name or "").lower())[:12] or "member"
    return prefix + _encoded_id(user_id)


def is_starter_username(user_id: uuid.UUID, username: str) -> bool:
    """True while the account still carries a generated handle.

    Every generator (this module, the SQL backfill, and signup provisioning) ends
    the handle with the account's own encoded id, which a chosen handle cannot
    match by accident.
    """
    return username.endswith(_encoded_id(user_id))


def normalize_username(value: str) -> str:
    username = value.strip().lower()
    if not USERNAME_RE.fullmatch(username):
        raise ValueError("Username must be 3–44 letters, without spaces or numbers.")
    return username

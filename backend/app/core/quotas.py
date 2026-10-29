"""Small, shared PostgreSQL quotas for the classroom pilot.

Reservations use short independent transactions so a failed provider request
still consumes its provider budget. Application writes never hold a quota lock
while waiting for Gemini or Judge0.
"""

import math
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


MANILA = ZoneInfo("Asia/Manila")


@dataclass(frozen=True)
class Rule:
    bucket: str
    scope: str
    window: str
    limit: int


POLICIES: dict[str, tuple[Rule, ...]] = {
    "practice_code": (Rule("practice_code", "account", "minute", 5),),
    "exam_sample": (Rule("exam_sample", "account", "minute", 5),),
    "quiz_submit": (Rule("quiz_submit", "account", "minute", 10),),
    "group_join": (Rule("group_join", "account", "hour", 12),),
    "group_create": (Rule("group_create", "account", "hour", 5),),
    "instructor_verify": (Rule("instructor_verify", "account", "minute", 5),),
    "student_ai": (
        Rule("student_ai", "account", "hour", 3),
        Rule("student_ai", "account", "day", 10),
        Rule("gemini_generation", "global", "day", 100),
    ),
    "chat_message": (
        Rule("chat_message", "account", "minute", 10),
        Rule("chat_message", "account", "day", 100),
        Rule("chat_generation", "global", "day", 300),
    ),
    "instructor_ai": (
        Rule("instructor_ai", "account", "hour", 2),
        Rule("instructor_ai", "account", "day", 8),
        Rule("gemini_generation", "global", "day", 100),
    ),
    "pdf_index": (
        Rule("pdf_index", "account", "hour", 5),
        Rule("pdf_index", "account", "day", 20),
    ),
    "embedding_chunk": (Rule("embedding_chunk", "global", "day", 500),),
}


def window_bounds(kind: str, now: datetime) -> tuple[datetime, datetime]:
    now = now.astimezone(timezone.utc)
    if kind == "minute":
        start = now.replace(second=0, microsecond=0)
        return start, start + timedelta(minutes=1)
    if kind == "hour":
        start = now.replace(minute=0, second=0, microsecond=0)
        return start, start + timedelta(hours=1)
    local = now.astimezone(MANILA)
    start_local = local.replace(hour=0, minute=0, second=0, microsecond=0)
    return start_local.astimezone(timezone.utc), (start_local + timedelta(days=1)).astimezone(timezone.utc)


_RESERVE = text("""
    insert into public.api_rate_counters
        (scope_kind, scope_id, action, window_kind, window_start, used, expires_at)
    values (:scope_kind, :scope_id, :action, :window_kind, :window_start, 1, :expires_at)
    on conflict (scope_kind, scope_id, action, window_kind, window_start)
    do update set used = public.api_rate_counters.used + 1
    where public.api_rate_counters.used < :limit
    returning used
""")
_CLEANUP = text("delete from public.api_rate_counters where expires_at < :cutoff")


def reserve(action: str, account_id: uuid.UUID | None = None, *, now: datetime | None = None) -> None:
    """Consume all buckets or none; raise a retryable HTTP error on failure."""
    rules = POLICIES[action]
    if any(rule.scope == "account" for rule in rules) and account_id is None:
        raise ValueError("An account identity is required for this quota.")
    instant = now or datetime.now(timezone.utc)
    try:
        with SessionLocal() as db:
            for rule in rules:
                start, end = window_bounds(rule.window, instant)
                result = db.execute(_RESERVE, {
                    "scope_kind": rule.scope,
                    "scope_id": str(account_id) if rule.scope == "account" else "*",
                    "action": rule.bucket,
                    "window_kind": rule.window,
                    "window_start": start,
                    "expires_at": end,
                    "limit": rule.limit,
                }).first()
                if result is None:
                    db.rollback()
                    retry = max(1, math.ceil((end - instant).total_seconds()))
                    raise HTTPException(
                        status_code=429,
                        detail={"code": "rate_limited", "message": f"Limit reached. Try again in {retry} seconds.",
                                "retry_after_seconds": retry},
                        headers={"Retry-After": str(retry)},
                    )
            if now is None and secrets.randbelow(256) == 0:
                db.execute(_CLEANUP, {"cutoff": instant - timedelta(days=7)})
            db.commit()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "quota_unavailable", "message": "This action is temporarily unavailable. Please retry shortly."},
            headers={"Retry-After": "30"},
        ) from exc

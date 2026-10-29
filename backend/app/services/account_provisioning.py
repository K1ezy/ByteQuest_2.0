"""Provisioned account creation through Supabase Auth.

Public sign-up in ByteQuest creates student accounts only. Instructor and
administrator accounts are provisioned here by an existing administrator, and
the account cannot be elevated from the browser.
"""

from __future__ import annotations

import logging
import uuid

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.entities import Profile, ProgrammingLang, UserRole

logger = logging.getLogger(__name__)


class ProvisioningUnavailable(Exception):
    pass


class DuplicateAccount(Exception):
    pass


def _admin_headers() -> dict[str, str]:
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_SECRET_KEY
    if not settings.SUPABASE_URL or not key:
        raise ProvisioningUnavailable("Supabase service credentials are not configured.")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


async def invite_auth_user(email: str, role: str, display_name: str | None) -> uuid.UUID:
    headers = _admin_headers()
    payload = {
        "email": email,
        "data": {"bytequest_role": role, "display_name": display_name or email.split("@")[0]},
    }
    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/invite"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=4.0)) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        logger.warning("Account invitation transport failed (%s).", type(exc).__name__)
        raise ProvisioningUnavailable("The account service could not be reached.") from exc

    if response.status_code in {409, 422}:
        body = ""
        try:
            body = response.text.lower()
        except Exception:  # pragma: no cover - defensive
            body = ""
        if "already" in body or response.status_code == 409:
            raise DuplicateAccount("An account with this email already exists.")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_account", "field": "email", "message": "That email address cannot be invited."},
        )
    if response.status_code >= 400:
        logger.warning("Account invitation failed with status %s.", response.status_code)
        raise ProvisioningUnavailable("The account service rejected the invitation. Try again.")

    try:
        body = response.json()
    except ValueError as exc:
        raise ProvisioningUnavailable("The account service returned an unexpected response.") from exc
    user = body.get("user") if isinstance(body, dict) and isinstance(body.get("user"), dict) else body
    raw_id = user.get("id") if isinstance(user, dict) else None
    try:
        return uuid.UUID(str(raw_id))
    except (TypeError, ValueError) as exc:
        raise ProvisioningUnavailable("The account service did not return an account identifier.") from exc


async def delete_auth_user(user_id: uuid.UUID) -> None:
    try:
        headers = _admin_headers()
    except ProvisioningUnavailable:
        return
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            await client.delete(
                f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{user_id}",
                headers=headers,
            )
    except Exception:  # pragma: no cover - best-effort rollback
        logger.exception("Could not roll back an invited account after a database error.")


def build_profile(user_id: uuid.UUID, email: str, role: UserRole, display_name: str | None) -> Profile:
    return Profile(
        id=user_id,
        pseudonym_id=f"usr_{user_id.hex[:20]}",
        role=role,
        enrolled_language=ProgrammingLang.python,
        year_level=1,
        semester=1,
        xp_points=0,
        current_level=1,
        account_status="active",
        display_name=display_name or email.split("@")[0],
        email=email,
    )

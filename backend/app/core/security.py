import uuid
from typing import Optional
import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt.exceptions import PyJWTError
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.entities import Profile, ProgrammingLang, UserRole

security = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    sub: str  # User UUID
    email: Optional[str] = None
    role: Optional[str] = None


async def get_current_user_payload(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> TokenPayload:
    """Verifies the Supabase JWT token and extracts user claims (Rule 4)."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Bearer Header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    
    # 1. Attempt local JWT HMAC verification if JWT Secret is configured
    if settings.SUPABASE_JWT_SECRET and settings.SUPABASE_JWT_SECRET != "super-secret-jwt-token-replace-in-env":
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            user_id: str = payload.get("sub")
            if user_id:
                return TokenPayload(
                    sub=user_id,
                    email=payload.get("email"),
                    role=payload.get("role", "authenticated"),
                )
        except PyJWTError:
            pass  # Fallback to Supabase Auth API

    # 2. Fallback: Verify directly against Supabase Auth API
    if settings.SUPABASE_URL:
        url = f"{settings.SUPABASE_URL}/auth/v1/user"
        headers = {
            "Authorization": f"Bearer {token}",
            "apikey": settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_SECRET_KEY,
        }
        timeout = httpx.Timeout(
            settings.SUPABASE_AUTH_TIMEOUT_SECONDS,
            connect=min(2.0, settings.SUPABASE_AUTH_TIMEOUT_SECONDS),
        )
        client = getattr(request.app.state, "http_client", None)
        try:
            if client is not None and not client.is_closed:
                response = await client.get(url, headers=headers, timeout=timeout)
            else:
                async with httpx.AsyncClient(timeout=timeout) as temporary_client:
                    response = await temporary_client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                user_id = data.get("id") if isinstance(data, dict) else None
                if user_id:
                    return TokenPayload(
                        sub=user_id,
                        email=data.get("email"),
                        role=data.get("role", "authenticated"),
                    )
        except (httpx.HTTPError, ValueError, TypeError):
            # Keep provider/network details and bearer tokens out of responses.
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    payload: TokenPayload = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> Profile:
    """
    Fetches the authenticated user Profile from the database.
    Automatically initializes a default student profile if not already present.
    """
    try:
        user_uuid = uuid.UUID(payload.sub)
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identity in access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    profile = db.query(Profile).filter(Profile.id == user_uuid).first()
    if not profile:
        # Create initial profile
        pseudonym = f"stu_{user_uuid.hex}"
        profile = Profile(
            id=user_uuid,
            pseudonym_id=pseudonym,
            role=UserRole.student,
            year_level=1,
            semester=1,
            enrolled_language=ProgrammingLang.cpp,
            xp_points=0,
            current_level=1,
        )
        try:
            db.add(profile)
            db.commit()
            db.refresh(profile)
        except IntegrityError:
            # A parallel first request may have created this profile already.
            db.rollback()
            profile = db.query(Profile).filter(Profile.id == user_uuid).first()
            if profile is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="The user profile could not be initialized. Please retry.",
                ) from None

    # Account status is checked on every protected request: a deactivated
    # account loses access immediately even while its token is still valid.
    if (profile.account_status or "active") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "account_deactivated",
                "message": "This account is deactivated. Contact an administrator to restore access.",
            },
        )

    return profile


def require_instructor(
    current_user: Profile = Depends(get_current_user),
) -> Profile:
    """Dependency that restricts endpoints to instructors and admins."""
    if current_user.role not in (UserRole.instructor, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Instructor or admin privileges required.",
        )
    return current_user

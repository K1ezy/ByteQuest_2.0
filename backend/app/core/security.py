from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings

security = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    sub: str  # User UUID
    email: Optional[str] = None
    role: Optional[str] = None


async def get_current_user_payload(
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
        except JWTError:
            pass  # Fallback to Supabase Auth API

    # 2. Fallback: Verify directly against Supabase Auth API
    if settings.SUPABASE_URL:
        import httpx
        url = f"{settings.SUPABASE_URL}/auth/v1/user"
        headers = {
            "Authorization": f"Bearer {token}",
            "apikey": settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_SECRET_KEY,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return TokenPayload(
                        sub=data.get("id"),
                        email=data.get("email"),
                        role=data.get("role", "authenticated"),
                    )
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

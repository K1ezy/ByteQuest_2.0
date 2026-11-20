from datetime import datetime, timedelta, timezone
from threading import get_ident
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import anyio
import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core import security


@pytest.fixture
def auth(monkeypatch):
    private_key = ec.generate_private_key(ec.SECP256R1())
    key = jwt.PyJWK.from_json(jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key()))
    signing_key = Mock(return_value=key)
    jwks_client = Mock(return_value=SimpleNamespace(get_signing_key_from_jwt=signing_key))
    monkeypatch.setattr(security, "_jwks_client", None, raising=False)
    monkeypatch.setattr(security.jwt, "PyJWKClient", jwks_client)
    monkeypatch.setattr(security.settings, "SUPABASE_URL", "https://supabase.example.test")
    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", "")
    fallback = AsyncMock(return_value=httpx.Response(401))
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
        http_client=SimpleNamespace(get=fallback, is_closed=False),
    )))

    async def verify(token):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        return await security.get_current_user_payload(request, credentials)

    return private_key, jwks_client, signing_key, fallback, verify


@pytest.fixture
def claims():
    return {
        "sub": "31ddb0aa-14ba-43ff-aebf-bc070e7e2971",
        "aud": "authenticated",
        "email": "student@example.test",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }


def test_es256_verifies_locally_off_the_event_loop(auth, claims):
    key, jwks_client, signing_key, fallback, verify = auth
    token = jwt.encode(claims, key, algorithm="ES256", headers={"kid": "test-key"})
    caller = get_ident()
    threads = []
    signing_key.side_effect = lambda _: threads.append(get_ident()) or signing_key.return_value
    expected = security.TokenPayload(sub=claims["sub"], email=claims["email"], role="authenticated")
    assert anyio.run(verify, token) == expected
    assert anyio.run(verify, token) == expected
    assert len(threads) == 2 and all(thread != caller for thread in threads)
    jwks_client.assert_called_once_with(
        "https://supabase.example.test/auth/v1/.well-known/jwks.json",
        cache_keys=True, lifespan=600, timeout=security.settings.SUPABASE_AUTH_TIMEOUT_SECONDS,
    )
    fallback.assert_not_awaited()


@pytest.mark.parametrize("problem", [
    "expired", "wrong_audience", "wrong_key", "missing_exp", "missing_sub", "unavailable",
])
def test_failed_jwks_verification_falls_back(auth, claims, problem):
    key, _, signing_key, fallback, verify = auth
    if problem == "expired":
        claims["exp"] = datetime.now(timezone.utc) - timedelta(minutes=5)
    elif problem == "wrong_audience":
        claims["aud"] = "other"
    elif problem == "wrong_key":
        key = ec.generate_private_key(ec.SECP256R1())
    elif problem == "missing_exp":
        claims.pop("exp")
    elif problem == "missing_sub":
        claims.pop("sub")
    else:
        signing_key.side_effect = jwt.PyJWKClientConnectionError("offline")
    token = jwt.encode(claims, key, algorithm="ES256", headers={"kid": "test-key"})
    with pytest.raises(HTTPException) as error:
        anyio.run(verify, token)
    assert error.value.status_code == 401
    signing_key.assert_called_once_with(token)
    fallback.assert_awaited_once()
    assert fallback.await_args.args == ("https://supabase.example.test/auth/v1/user",)


@pytest.mark.parametrize("algorithm", ["none", "HS256"])
def test_non_asymmetric_algorithms_never_use_jwks(auth, claims, algorithm):
    private_key, jwks_client, _, fallback, verify = auth
    key = "" if algorithm == "none" else private_key.public_key().public_bytes(
        Encoding.X962, PublicFormat.UncompressedPoint,
    )
    token = jwt.encode(claims, key, algorithm=algorithm, headers={"kid": "test-key"})
    with pytest.raises(HTTPException) as error:
        anyio.run(verify, token)
    assert error.value.status_code == 401
    jwks_client.assert_not_called()
    fallback.assert_awaited_once()


def test_legacy_hs256_secret_still_works(auth, claims, monkeypatch):
    _, jwks_client, _, fallback, verify = auth
    secret = "legacy-test-secret-" * 2
    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", secret)
    token = jwt.encode(claims, secret, algorithm="HS256")
    assert anyio.run(verify, token).sub == claims["sub"]
    jwks_client.assert_not_called()
    fallback.assert_not_awaited()

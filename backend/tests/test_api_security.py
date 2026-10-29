"""Focused local checks for browser boundaries, quotas, and payload limits."""

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import pymupdf
import anyio
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.core import quotas
from app.core.database import SessionLocal
from app.core.config import Settings
from app.core.quotas import reserve, window_bounds
from app.core.request_size import RequestSizeLimitMiddleware
from app.main import app
from app.services.ai_rag.pdf_processor import extract_chunks_from_pdf
from app.services.gamification.quiz_content import parse_quiz_questions


def test_cors_exact_local_origins_and_retry_header_visibility():
    with TestClient(app) as client:
        for origin in ("http://localhost:3000", "http://127.0.0.1:3000"):
            response = client.options("/api/v1/submission-jobs", headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
            })
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == origin
            assert "access-control-allow-credentials" not in response.headers
            actual = client.get("/health", headers={"Origin": origin})
            assert "retry-after" in actual.headers["access-control-expose-headers"].lower()
        denied = client.options("/api/v1/submission-jobs", headers={
            "Origin": "https://bytequest.vercel.app", "Access-Control-Request-Method": "POST",
        })
        assert denied.status_code == 400
        assert "access-control-allow-origin" not in denied.headers


def test_production_cors_requires_exact_https_origin():
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production", CORS_ORIGINS=["http://localhost:3000"])
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production", CORS_ORIGINS=["https://*.example.test"])
    assert Settings(ENVIRONMENT="production", CORS_ORIGINS=["https://bytequest.example"]).CORS_ORIGINS == ["https://bytequest.example"]


def test_request_body_limit_precedes_authentication():
    with TestClient(app) as client:
        response = client.post("/api/v1/quest-groups", content=b"x" * (12 * 1024 * 1024 + 1),
                               headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "request_too_large"
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_streamed_body_without_content_length_is_limited():
    messages = []

    async def read_body(scope, receive, send):
        await receive()

    async def receive():
        return {"type": "http.request", "body": b"x" * (12 * 1024 * 1024 + 1), "more_body": False}

    async def send(message):
        messages.append(message)

    middleware = RequestSizeLimitMiddleware(read_body)
    anyio.run(middleware, {"type": "http", "method": "POST", "headers": []}, receive, send)
    assert messages[0]["status"] == 413


def test_pdf_page_and_character_limits():
    document = pymupdf.open()
    for _ in range(101):
        document.new_page()
    data = document.tobytes()
    document.close()
    with pytest.raises(ValueError, match="100 pages"):
        extract_chunks_from_pdf(data)

    class Page:
        def get_text(self, mode):
            return "x" * 200_001

    class Document:
        page_count = 1
        def __enter__(self):
            return self
        def __exit__(self, *_):
            return False
        def load_page(self, index):
            return Page()

    from app.services.ai_rag import pdf_processor
    original = pdf_processor.pymupdf.open
    pdf_processor.pymupdf.open = lambda **kwargs: Document()
    try:
        with pytest.raises(ValueError, match="200,000 extracted characters"):
            extract_chunks_from_pdf(b"%PDF-test")
    finally:
        pdf_processor.pymupdf.open = original


def test_nested_quiz_content_rejects_unknown_fields():
    quiz = {"questions": [{"id": "q1", "prompt": "Pick one", "correct_answer": "A",
            "options": [{"key": "A", "text": "Yes", "secret": "extra"},
                        {"key": "B", "text": "No"}]}]}
    with pytest.raises(ValueError, match="invalid"):
        parse_quiz_questions(quiz)
    with pytest.raises(ValueError, match="unknown fields"):
        parse_quiz_questions({"questions": [], "unexpected": True})


@pytest.mark.integration
def test_postgres_quota_is_atomic_across_threads():
    account = uuid.uuid4()
    instant = datetime(2030, 1, 1, 0, 0, 30, tzinfo=timezone.utc)

    def attempt():
        try:
            reserve("practice_code", account, now=instant)
            return 200
        except HTTPException as exc:
            assert exc.detail["code"] == "rate_limited"
            assert exc.headers["Retry-After"] == "30"
            return exc.status_code

    try:
        with ThreadPoolExecutor(max_workers=10) as pool:
            statuses = list(pool.map(lambda _: attempt(), range(20)))
        assert statuses.count(200) == 5
        assert statuses.count(429) == 15
    finally:
        with SessionLocal() as db:
            db.execute(text("delete from public.api_rate_counters where scope_kind='account' and scope_id=:id"),
                       {"id": str(account)})
            db.commit()


@pytest.mark.integration
def test_global_ai_cap_rejects_without_spending_account_buckets():
    account = uuid.uuid4()
    instant = datetime(2031, 3, 1, 16, 0, tzinfo=timezone.utc)
    start, end = window_bounds("day", instant)
    try:
        with SessionLocal() as db:
            db.execute(text("insert into public.api_rate_counters "
                "(scope_kind,scope_id,action,window_kind,window_start,used,expires_at) "
                "values ('global','*','gemini_generation','day',:start,100,:end)"),
                {"start": start, "end": end})
            db.commit()
        with pytest.raises(HTTPException) as raised:
            reserve("student_ai", account, now=instant)
        assert raised.value.status_code == 429
        with SessionLocal() as db:
            spent = db.execute(text("select count(*) from public.api_rate_counters "
                "where scope_kind='account' and scope_id=:account"),
                {"account": str(account)}).scalar_one()
            assert spent == 0
    finally:
        with SessionLocal() as db:
            db.execute(text("delete from public.api_rate_counters where scope_kind='global' "
                "and action='gemini_generation' and window_start=:start"), {"start": start})
            db.execute(text("delete from public.api_rate_counters where scope_kind='account' "
                "and scope_id=:account"), {"account": str(account)})
            db.commit()


def test_daily_window_resets_at_manila_midnight():
    before = datetime(2030, 1, 1, 15, 59, tzinfo=timezone.utc)
    after = datetime(2030, 1, 1, 16, 0, tzinfo=timezone.utc)
    old_start, old_end = window_bounds("day", before)
    new_start, _ = window_bounds("day", after)
    assert old_end == new_start
    assert old_start < new_start


def test_costly_action_pauses_if_quota_storage_is_unavailable(monkeypatch):
    def unavailable():
        raise OperationalError("quota database unavailable", None, Exception("offline"))

    monkeypatch.setattr(quotas, "SessionLocal", unavailable)
    with pytest.raises(HTTPException) as raised:
        reserve("practice_code", uuid.uuid4())
    assert raised.value.status_code == 503
    assert raised.value.detail["code"] == "quota_unavailable"


def test_chat_has_dedicated_account_and_global_quota():
    rules = quotas.POLICIES["chat_message"]
    assert any(
        rule.scope == "account" and rule.bucket == "chat_message"
        for rule in rules
    )
    assert any(
        rule.scope == "global" and rule.bucket == "chat_generation"
        for rule in rules
    )


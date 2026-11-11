"""Schema-level invariants introduced by
supabase/migrations/20261111000100_timestamp_and_state_integrity.sql.

These guard failure modes the API-flow tests cannot see, because they live in the
column types and constraints rather than in request handling.
"""

import os
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings


@pytest.fixture
def db() -> Session:
    database_url = os.getenv("BYTEQUEST_TEST_DATABASE_URL") or settings.DATABASE_URL
    parsed_url = make_url(database_url)
    if parsed_url.get_backend_name() != "postgresql" or parsed_url.host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("Integration tests require a loopback PostgreSQL URL.")
    if parsed_url.drivername == "postgresql":
        parsed_url = parsed_url.set(drivername="postgresql+psycopg2")
    engine = create_engine(parsed_url)
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()  # nothing this test writes is kept
        connection.close()
        engine.dispose()


def _make_profile(db: Session) -> uuid.UUID:
    user_id = uuid.uuid4()
    db.execute(text("INSERT INTO auth.users (id) VALUES (:id)"), {"id": user_id})
    db.execute(
        text(
            "INSERT INTO public.profiles (id, pseudonym_id, deactivated_at) "
            "VALUES (:id, :pseudonym, now())"
        ),
        {"id": user_id, "pseudonym": f"T-{user_id.hex[:10]}"},
    )
    return user_id


def test_core_timestamps_are_aware_and_comparable(db: Session) -> None:
    """profiles.created_at was naive while deactivated_at was aware.

    Comparing them raised "can't compare offset-naive and offset-aware datetimes".
    Both are timestamptz now, so the comparison must simply work.
    """
    user_id = _make_profile(db)
    created_at, deactivated_at = db.execute(
        text("SELECT created_at, deactivated_at FROM public.profiles WHERE id = :id"),
        {"id": user_id},
    ).one()

    assert created_at.tzinfo is not None, "created_at must be timezone-aware"
    assert deactivated_at.tzinfo is not None, "deactivated_at must be timezone-aware"
    # The real regression: this comparison used to raise TypeError.
    assert abs((deactivated_at - created_at).total_seconds()) < 60


def test_every_public_timestamp_column_is_aware(db: Session) -> None:
    """No table may reintroduce a naive timestamp column."""
    naive = db.execute(
        text(
            "SELECT table_name, column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND data_type = 'timestamp without time zone' "
            "ORDER BY table_name, column_name"
        )
    ).all()
    assert naive == [], f"naive timestamp columns found: {naive}"


def test_badge_code_is_required(db: Session) -> None:
    """code is the ON CONFLICT target in supabase/seed.sql.

    A NULL would sidestep the unique index and duplicate the badge on each seed run.
    """
    with pytest.raises(IntegrityError):
        db.execute(
            text(
                "INSERT INTO public.badges (code, name, description, icon_url, criteria_json) "
                "VALUES (NULL, 'n', 'd', 'i', '{}'::jsonb)"
            )
        )


def test_processing_status_rejects_unknown_state(db: Session) -> None:
    """material_state() only understands the documented pipeline states."""
    user_id = _make_profile(db)
    with pytest.raises(IntegrityError):
        db.execute(
            text(
                "INSERT INTO public.instructional_documents "
                "(uploaded_by, title, language_tag, storage_path, processing_status) "
                "VALUES (:uploader, 't', 'cpp', '/t.pdf', 'not_a_real_state')"
            ),
            {"uploader": user_id},
        )


@pytest.mark.parametrize(
    "state", ["processing", "completed", "needs_review", "needs_attention", "failed"]
)
def test_processing_status_accepts_documented_states(db: Session, state: str) -> None:
    user_id = _make_profile(db)
    db.execute(
        text(
            "INSERT INTO public.instructional_documents "
            "(uploaded_by, title, language_tag, storage_path, processing_status) "
            "VALUES (:uploader, 't', 'cpp', '/t.pdf', :state)"
        ),
        {"uploader": user_id, "state": state},
    )

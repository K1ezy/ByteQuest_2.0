"""Schema-level invariants introduced by
supabase/migrations/20261111000100_timestamp_and_state_integrity.sql.

These guard failure modes the API-flow tests cannot see, because they live in the
column types and constraints rather than in request handling.
"""

import json
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.usernames import normalize_username, starter_username


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
            "INSERT INTO public.profiles (id, pseudonym_id, username, deactivated_at) "
            "VALUES (:id, :pseudonym, :username, now())"
        ),
        {"id": user_id, "pseudonym": f"T-{user_id.hex[:10]}", "username": starter_username(user_id)},
    )
    return user_id


@pytest.mark.parametrize("role", ["admin", "instructor", "student"])
def test_signup_roles_with_local_staff_registration_enabled(db: Session, role: str) -> None:
    db.execute(text("INSERT INTO bytequest_private.local_staff_registration VALUES (true) ON CONFLICT DO NOTHING"))
    user_id = uuid.uuid4()
    email = f"{user_id.hex}@example.test"
    school_id = f"00-{user_id.int % 99_999 + 1:05d}"
    if role == "student":
        db.execute(text("INSERT INTO bytequest_private.student_registration_roster (school_id, email) VALUES (:id, :email)"),
                   {"id": school_id, "email": email})
    insert = text(
        "INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (:id, :email, CAST(:metadata AS jsonb))"
    )
    params = {
        "id": user_id,
        "email": email,
        "metadata": json.dumps({
            "username": starter_username(user_id), "school_id": school_id if role == "student" else user_id.hex,
            "year_level": "1", "block_section": "A", "registration_role": role,
        }),
    }
    if role == "admin":
        with pytest.raises(DataError, match="Administrator accounts are granted, not registered") as raised:
            db.execute(insert, params)
        assert raised.value.orig.pgcode == "22023"
    else:
        db.execute(insert, params)
        assert db.execute(text("SELECT role FROM public.profiles WHERE id = :id"),
                          {"id": user_id}).scalar_one() == role


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


def test_username_backfill_and_unique_index_cover_every_profile(db: Session) -> None:
    invalid = db.execute(text(
        "SELECT count(*) FROM public.profiles WHERE username IS NULL "
        "OR username !~ '^[a-z]{3,44}$'"
    )).scalar_one()
    duplicates = db.execute(text(
        "SELECT count(*) FROM (SELECT lower(username) FROM public.profiles "
        "GROUP BY lower(username) HAVING count(*) > 1) AS collisions"
    )).scalar_one()
    assert invalid == 0
    assert duplicates == 0
    first, second = _make_profile(db), _make_profile(db)
    chosen = db.execute(text("SELECT username FROM public.profiles WHERE id = :id"), {"id": first}).scalar_one()
    with pytest.raises(IntegrityError):
        db.execute(text("UPDATE public.profiles SET username = :username WHERE id = :id"),
                   {"username": chosen, "id": second})


@pytest.mark.parametrize("username", ["AName", "name1", "ab", "a" * 45])
def test_database_rejects_invalid_public_usernames(db: Session, username: str) -> None:
    user_id = _make_profile(db)
    with pytest.raises((DataError, IntegrityError)):
        db.execute(text("UPDATE public.profiles SET username = :username WHERE id = :id"),
                   {"username": username, "id": user_id})


def test_concurrent_username_claims_allow_only_one_winner(db: Session) -> None:
    engine = db.get_bind().engine
    first, second = uuid.uuid4(), uuid.uuid4()
    claimed = normalize_username(starter_username(uuid.uuid4(), "Race"))
    try:
        with engine.begin() as connection:
            for user_id in (first, second):
                connection.execute(text("INSERT INTO auth.users (id) VALUES (:id)"), {"id": user_id})
                connection.execute(text(
                    "INSERT INTO public.profiles (id, pseudonym_id, username) "
                    "VALUES (:id, :pseudonym, :username)"
                ), {"id": user_id, "pseudonym": f"race_{user_id.hex}",
                    "username": starter_username(user_id)})

        started = threading.Event()
        with engine.connect() as first_connection:
            first_transaction = first_connection.begin()
            try:
                first_connection.execute(text("UPDATE public.profiles SET username = :name WHERE id = :id"),
                                         {"name": claimed, "id": first})

                def second_claim() -> str:
                    with engine.connect() as second_connection:
                        transaction = second_connection.begin()
                        try:
                            second_connection.execute(text("SET LOCAL lock_timeout = '5s'"))
                            started.set()
                            second_connection.execute(text(
                                "UPDATE public.profiles SET username = :name WHERE id = :id"
                            ), {"name": claimed, "id": second})
                            transaction.commit()
                            return "unexpected_success"
                        except IntegrityError as exc:
                            transaction.rollback()
                            return getattr(getattr(exc.orig, "diag", None), "constraint_name", "")

                with ThreadPoolExecutor(max_workers=1) as pool:
                    result = pool.submit(second_claim)
                    assert started.wait(3)
                    time.sleep(0.1)
                    first_transaction.commit()
                    assert result.result(timeout=8) == "profiles_username_lower_unique"
            finally:
                if first_transaction.is_active:
                    first_transaction.rollback()
    finally:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM auth.users WHERE id IN (:first, :second)"),
                               {"first": first, "second": second})


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

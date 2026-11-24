"""Execute the research export script's queries against rollback-only synthetic rows."""

from __future__ import annotations

import csv
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import StatementError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.usernames import starter_username
from scripts import destroy_research_link, export_ml_dataset

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from ml_pipeline.train_compare import _validate_hint_frame, _validate_training_frame  # noqa: E402


pytestmark = pytest.mark.integration


def test_documented_exports_require_latest_current_consent(tmp_path: Path) -> None:
    database_url = os.getenv("BYTEQUEST_TEST_DATABASE_URL") or settings.DATABASE_URL
    parsed = make_url(database_url)
    if parsed.get_backend_name() != "postgresql" or parsed.host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("This integration test requires a loopback PostgreSQL URL.")
    if parsed.drivername == "postgresql":
        parsed = parsed.set(drivername="postgresql+psycopg2")

    queries = [text(export_ml_dataset.ATTEMPTS_SQL), text(export_ml_dataset.HINTS_SQL)]
    current_version = f"synthetic-current-{uuid.uuid4().hex}"
    old_version = f"synthetic-old-{uuid.uuid4().hex}"
    now = datetime.now(timezone.utc)
    engine = create_engine(parsed)
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                students: dict[str, tuple[uuid.UUID, str]] = {}
                for label in ("accepted", "withdrawn", "old", "none", "renewed"):
                    student_id = uuid.uuid4()
                    pseudonym = f"synthetic-export-{student_id.hex}"
                    connection.execute(text("INSERT INTO auth.users (id) VALUES (:id)"), {"id": student_id})
                    connection.execute(
                        text(
                            "INSERT INTO public.profiles (id, pseudonym_id, username) "
                            "VALUES (:id, :pseudonym, :username)"
                        ),
                        {"id": student_id, "pseudonym": pseudonym,
                         "username": starter_username(student_id)},
                    )
                    students[label] = (student_id, pseudonym)

                course_id = uuid.uuid4()
                activity_id = uuid.uuid4()
                exam_id = uuid.uuid4()
                connection.execute(
                    text("INSERT INTO public.courses (id, code, title) VALUES (:id, :code, 'Synthetic export course')"),
                    {"id": course_id, "code": f"EX{uuid.uuid4().hex[:16]}"},
                )
                connection.execute(
                    text(
                        "INSERT INTO public.learning_activities "
                        "(id, activity_type, language, topic_concept, course_id) "
                        "VALUES (:id, 'quiz', 'python', 'loops', :course_id)"
                    ),
                    {"id": activity_id, "course_id": course_id},
                )
                connection.execute(
                    text(
                        "INSERT INTO public.exams "
                        "(id, created_by, title, opens_at, closes_at, duration_minutes) "
                        "VALUES (:id, :created_by, 'Synthetic export exam', :opens_at, :closes_at, 60)"
                    ),
                    {"id": exam_id, "created_by": students["accepted"][0],
                     "opens_at": now - timedelta(days=1), "closes_at": now + timedelta(days=1)},
                )
                connection.execute(
                    text(
                        "INSERT INTO public.exam_items "
                        "(exam_id, activity_id, position, points, snapshot_json) "
                        "VALUES (:exam_id, :activity_id, 1, 10, '{}'::jsonb)"
                    ),
                    {"exam_id": exam_id, "activity_id": activity_id},
                )
                for student_id, _ in students.values():
                    connection.execute(
                        text(
                            "INSERT INTO public.activity_attempts "
                            "(student_id, activity_id, attempt_number, score_percentage, is_successful, created_at) "
                            "VALUES (:student_id, :activity_id, 1, 80, true, :created_at)"
                        ),
                        {"student_id": student_id, "activity_id": activity_id,
                         "created_at": now - timedelta(hours=1)},
                    )
                    connection.execute(
                        text(
                            "INSERT INTO public.hint_uses "
                            "(student_id, activity_id, request_key, source, body, created_at) "
                            "VALUES (:student_id, :activity_id, 'synthetic-hint', 'reviewed', "
                            "'Never exported hint text', :created_at)"
                        ),
                        {"student_id": student_id, "activity_id": activity_id,
                         "created_at": now - timedelta(hours=2)},
                    )
                    connection.execute(
                        text(
                            "INSERT INTO public.exam_attempts "
                            "(exam_id, student_id, attempt_number, status, started_at, due_at, "
                            "submitted_at, result_released_at, score, max_score) "
                            "VALUES (:exam_id, :student_id, 1, 'submitted', :started_at, :due_at, "
                            ":submitted_at, :released_at, 8, 10)"
                        ),
                        {"exam_id": exam_id, "student_id": student_id,
                         "started_at": now - timedelta(hours=2),
                         "due_at": now - timedelta(minutes=30),
                         "submitted_at": now - timedelta(hours=1),
                         "released_at": now - timedelta(minutes=15)},
                    )

                def consent(label: str, choice: str, version: str) -> None:
                    connection.execute(
                        text(
                            "INSERT INTO public.research_consents "
                            "(student_id, document_version, choice) VALUES (:student_id, :version, :choice)"
                        ),
                        {"student_id": students[label][0], "version": version, "choice": choice},
                    )

                consent("accepted", "accepted", current_version)
                consent("withdrawn", "accepted", current_version)
                consent("withdrawn", "withdrawn", current_version)
                consent("old", "accepted", old_version)
                consent("renewed", "accepted", current_version)
                consent("renewed", "withdrawn", current_version)
                consent("renewed", "accepted", current_version)

                # Accepting consent issues a random research code; never declining-only students.
                codes = dict(connection.execute(
                    text("SELECT student_id, code FROM bytequest_private.research_codes "
                         "WHERE student_id = ANY(:ids)"),
                    {"ids": [student_id for student_id, _ in students.values()]},
                ).all())
                assert students["none"][0] not in codes
                account_hexes = [student_id.hex for student_id, _ in students.values()]

                for query in queries:
                    with pytest.raises(StatementError):
                        connection.execute(query).all()
                    current = connection.execute(
                        query, {"current_consent_version": current_version}
                    ).mappings().all()
                    assert {row["student_id"] for row in current} == {
                        codes[students["accepted"][0]], codes[students["renewed"][0]]
                    }
                    # No account id, pseudonym or raw row id survives into the export.
                    exported = " ".join(str(value) for row in current for value in row.values())
                    assert all(hexed not in exported.replace("-", "") for hexed in account_hexes)
                    assert all(pseudonym not in exported for _, pseudonym in students.values())
                    assert "Never exported hint text" not in exported
                    old = connection.execute(
                        query, {"current_consent_version": old_version}
                    ).mappings().all()
                    assert {row["student_id"] for row in old} == {codes[students["old"][0]]}
                    assert connection.execute(
                        query, {"current_consent_version": "no-approved-version"}
                    ).all() == []

                def session_factory():
                    return Session(bind=connection, join_transaction_mode="create_savepoint")

                # The script writes the same rows as CSVs the trainer reads.
                assert export_ml_dataset.export(
                    tmp_path, version=current_version, session_factory=session_factory
                ) == (2, 2, 0)  # quiz-only fixture: history rows, no challenge to predict
                with (tmp_path / "data" / "attempts.csv").open(encoding="utf-8") as handle:
                    exported_rows = list(csv.DictReader(handle))
                assert {row["student_id"] for row in exported_rows} == {
                    codes[students["accepted"][0]], codes[students["renewed"][0]]
                }
                # The trainer's own validation accepts the files as written.
                assert len(_validate_training_frame(pd.read_csv(tmp_path / "data" / "attempts.csv"))) == 2
                assert len(_validate_hint_frame(pd.read_csv(tmp_path / "data" / "hints.csv"))) == 2
                assert export_ml_dataset.export(
                    tmp_path, version="no-approved-version", session_factory=session_factory
                ) == (0, 0, 0)
                assert (tmp_path / "data" / "hints.csv").read_text(encoding="utf-8").startswith("id,student_id")
                assert (tmp_path / "ten_model_inputs" / "ten_model_inputs.csv").read_text(
                    encoding="utf-8").startswith("student_id,course_id,language,activity_id,first_submission_passed,")

                assert destroy_research_link.destroy(confirm=False, session_factory=session_factory) >= len(codes)
                assert connection.execute(text("SELECT count(*) FROM bytequest_private.research_codes")).scalar_one() >= len(codes)
                destroy_research_link.destroy(confirm=True, session_factory=session_factory)
                assert connection.execute(text("SELECT count(*) FROM bytequest_private.research_codes")).scalar_one() == 0
                assert connection.execute(queries[0], {"current_consent_version": current_version}).all() == []
            finally:
                transaction.rollback()
    finally:
        engine.dispose()

"""Role, course-scope, approval, locking, account and recovery checks.

These tests exercise the real FastAPI routes against local Supabase
PostgreSQL. Every record is created inside one outer transaction that is rolled
back, so the developer's existing accounts and school data are untouched.
"""

from __future__ import annotations

import json
import math
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.api import admin as admin_api
from app.api import exams as exams_api
from app.api import faculty_ml as faculty_ml_api
from app.api.faculty.common import _save_activity_revision
from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.services.ml_predictor import shadow as shadow_service
from app.services.ml_predictor.feature_engineering import FEATURE_NAMES
from app.services.ml_predictor.predictor import PredictionResult
from app.services.ml_predictor.shadow import has_required_prediction_history, prior_graded_task_count
from app.models.entities import (
    ActivityAttempt,
    ActivityKind,
    AuditEvent,
    Course,
    CourseAnnouncement,
    CourseMember,
    DocumentChunk,
    Exam,
    ExamAttempt,
    ExamItem,
    GradingWorkerHeartbeat,
    InstructionalDocument,
    LearningActivity,
    MLPrediction,
    PlatformSetting,
    ProcessingJob,
    Profile,
    ProgrammingLang,
    ResearchConsent,
    ReviewState,
    TestCase as GradingCase,
    UserRole,
    ConceptReview,
    HintUse,
)
from app.services.ml_predictor.exam_history import course_exam_ids, released_exam_history
from app.services.ml_predictor.audit import record_prediction_outcome
from app.services.ml_predictor.targets import next_course_activity
from app.services.judge0.client import Judge0UnavailableError, judge0_client
from app.services.monitoring import record_grading_worker_heartbeat

pytestmark = pytest.mark.integration
TEST_JWT_SECRET = "bytequest-faculty-admin-tests-only-secret"
QUIZ_QUESTIONS = {
    "questions": [
        {
            "id": f"q{index}",
            "prompt": f"Question {index}",
            "options": [{"key": "A", "text": "First"}, {"key": "B", "text": "Second"}],
            "correct_answer": "A",
        }
        for index in range(1, 4)
    ]
}


def _token(user_id: uuid.UUID) -> dict[str, str]:
    value = jwt.encode(
        {
            "sub": str(user_id),
            "aud": "authenticated",
            "role": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        },
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {value}"}


@pytest.fixture
def workspace(monkeypatch, request):
    database_url = os.getenv("BYTEQUEST_TEST_DATABASE_URL") or settings.DATABASE_URL
    parsed_url = make_url(database_url)
    if parsed_url.get_backend_name() != "postgresql" or parsed_url.host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("Integration tests require a loopback PostgreSQL URL.")
    if parsed_url.drivername == "postgresql":
        parsed_url = parsed_url.set(drivername="postgresql+psycopg2")
    engine = create_engine(parsed_url)
    try:
        connection = engine.connect()
    except Exception as exc:
        engine.dispose()
        pytest.fail(f"Local Supabase PostgreSQL is required: {type(exc).__name__}")

    transaction = connection.begin()

    def cleanup():
        app.dependency_overrides.pop(get_db, None)
        transaction.rollback()
        connection.close()
        engine.dispose()

    request.addfinalizer(cleanup)

    def new_session() -> Session:
        return Session(bind=connection, join_transaction_mode="create_savepoint")

    def override_db():
        with new_session() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)
    monkeypatch.setattr(settings, "SUPABASE_URL", "")

    async def sandbox_available():
        return True

    monkeypatch.setattr(judge0_client, "check_execution", sandbox_available)

    ids = {name: uuid.uuid4() for name in ["admin", "faculty", "other_faculty", "student", "other_student"]}
    now = datetime.now(timezone.utc)

    with new_session() as db:
        for name, user_id in ids.items():
            email = f"{name}-{user_id.hex[:8]}@example.test"
            db.execute(
                text(
                    "INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password) "
                    "VALUES (:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :email, '')"
                ),
                {"id": user_id, "email": email},
            )
            role = {
                "admin": UserRole.admin,
                "faculty": UserRole.instructor,
                "other_faculty": UserRole.instructor,
            }.get(name, UserRole.student)
            db.add(
                Profile(
                    id=user_id,
                    pseudonym_id=f"test_{name}_{user_id.hex[:8]}",
                    role=role,
                    year_level=1,
                    semester=1,
                    enrolled_language=ProgrammingLang.python,
                    xp_points=0,
                    current_level=1,
                    account_status="active",
                    display_name=name.replace("_", " ").title(),
                    email=email,
                )
            )
        db.commit()

        course_a = Course(code=f"A-{ids['faculty'].hex[:6]}", title="Introduction to Python", created_by=ids["faculty"])
        course_b = Course(code=f"B-{ids['other_faculty'].hex[:6]}", title="Web Foundations", created_by=ids["other_faculty"])
        db.add_all([course_a, course_b])
        db.flush()
        db.add_all(
            [
                CourseMember(course_id=course_a.id, profile_id=ids["faculty"], member_role="instructor", status="active"),
                CourseMember(course_id=course_b.id, profile_id=ids["other_faculty"], member_role="instructor", status="active"),
                CourseMember(course_id=course_a.id, profile_id=ids["student"], member_role="student", status="active"),
                CourseMember(course_id=course_b.id, profile_id=ids["other_student"], member_role="student", status="active"),
            ]
        )

        document = InstructionalDocument(
            document_family_id=uuid.uuid4(),
            version_number=1,
            is_current=True,
            uploaded_by=ids["faculty"],
            title="Python Basics.pdf",
            description="Course reader",
            language_tag=ProgrammingLang.python,
            storage_path="course_materials/test/python-basics.pdf",
            processing_status="completed",
            status="ready",
            total_chunks=2,
            file_size_bytes=2048,
            uploaded_original_name="python-basics.pdf",
            course_id=course_a.id,
        )
        other_document = InstructionalDocument(
            document_family_id=uuid.uuid4(),
            version_number=1,
            is_current=True,
            uploaded_by=ids["other_faculty"],
            title="Web Basics.pdf",
            language_tag=ProgrammingLang.python,
            storage_path="course_materials/test/web-basics.pdf",
            processing_status="completed",
            status="ready",
            total_chunks=1,
            course_id=course_b.id,
        )
        scanned_document = InstructionalDocument(
            document_family_id=uuid.uuid4(),
            version_number=1,
            is_current=True,
            uploaded_by=ids["faculty"],
            title="Python Basics scan.pdf",
            language_tag=ProgrammingLang.python,
            storage_path="course_materials/test/python-basics-scan.pdf",
            processing_status="needs_review",
            status="needs_review",
            processing_error="This PDF has no usable searchable text.",
            total_chunks=0,
            uploaded_original_name="python-basics-scan.pdf",
            course_id=course_a.id,
        )
        db.add_all([document, other_document, scanned_document])
        db.flush()
        chunk_ids = []
        for index in range(2):
            chunk = DocumentChunk(
                document_id=document.id,
                chunk_index=index,
                page_number=12 + index,
                content_text=f"Python loops and conditionals excerpt {index}.",
                token_count=12,
                embedding=[0.0] * 768,
            )
            db.add(chunk)
            db.flush()
            chunk_ids.append(chunk.id)
        db.add(
            DocumentChunk(
                document_id=other_document.id,
                chunk_index=0,
                page_number=3,
                content_text="Web foundations excerpt.",
                token_count=8,
                embedding=[0.0] * 768,
            )
        )
        db.flush()

        draft = LearningActivity(
            course_id=course_a.id,
            source_document_id=document.id,
            created_by=ids["faculty"],
            activity_type=ActivityKind.quiz,
            language=ProgrammingLang.python,
            topic_concept="loops",
            title="Loops and conditionals quiz",
            problem_statement="Answer the questions about loops and conditionals.",
            difficulty_level=2,
            xp_reward=30,
            quiz_questions_json=QUIZ_QUESTIONS,
            review_status=ReviewState.draft,
            content_version=1,
            version_number=1,
            generation_json={
                "model_version": "gemini-test",
                "prompt_version": "rag-quiz-v1",
                "citations": [
                    {
                        "chunk_id": str(chunk_ids[0]),
                        "document_id": str(document.id),
                        "document_title": document.title,
                        "version_number": 1,
                        "page_number": 12,
                        "excerpt": "Python loops and conditionals excerpt 0.",
                    },
                    {
                        "chunk_id": str(chunk_ids[1]),
                        "document_id": str(document.id),
                        "document_title": document.title,
                        "version_number": 1,
                        "page_number": 13,
                        "excerpt": "Python loops and conditionals excerpt 1.",
                    },
                ],
            },
        )
        other_draft = LearningActivity(
            course_id=course_b.id,
            created_by=ids["other_faculty"],
            activity_type=ActivityKind.quiz,
            language=ProgrammingLang.python,
            topic_concept="html",
            title="HTML basics quiz",
            problem_statement="Questions about HTML structure and elements.",
            difficulty_level=1,
            xp_reward=20,
            quiz_questions_json=QUIZ_QUESTIONS,
            review_status=ReviewState.draft,
        )
        published = LearningActivity(
            course_id=course_a.id,
            created_by=ids["faculty"],
            activity_type=ActivityKind.challenge,
            language=ProgrammingLang.python,
            topic_concept="arithmetic",
            title="Add two numbers",
            problem_statement="Read two integers and print their sum.",
            starter_code="a, b = map(int, input().split())",
            reference_solution_code="a, b = map(int, input().split())\nprint(a + b)",
            difficulty_level=1,
            xp_reward=50,
            review_status=ReviewState.published,
            judge0_verified=True,
            published_at=now - timedelta(days=2),
            content_version=3,
            version_number=1,
            sequence_order=1,
        )
        db.add_all([draft, other_draft, published])
        db.flush()
        db.add(
            GradingCase(
                activity_id=published.id,
                order_index=0,
                stdin="1 2",
                expected_stdout="3",
                is_hidden=False,
                weight=1.0,
            )
        )
        db.add(
            ActivityAttempt(
                student_id=ids["student"],
                activity_id=published.id,
                attempt_number=1,
                passed_test_cases=1,
                total_test_cases=1,
                score_percentage=100,
                is_successful=True,
                xp_awarded=50,
            )
        )
        retryable_job = ProcessingJob(
            service="rag_index",
            job_type="pdf_extraction",
            status="failed",
            document_id=document.id,
            requested_by=ids["faculty"],
            attempts=1,
            max_attempts=3,
            retryable=True,
            cause="The search index could not be created.",
            trace_id="RAG-RETRY01",
        )
        blocked_job = ProcessingJob(
            service="rag_index",
            job_type="pdf_extraction",
            status="failed",
            document_id=scanned_document.id,
            requested_by=ids["faculty"],
            attempts=1,
            max_attempts=3,
            retryable=False,
            cause="No usable searchable text.",
            trace_id="RAG-BLOCK01",
        )
        db.add_all([retryable_job, blocked_job])
        db.commit()

        ids.update(
            {
                "course_a": course_a.id,
                "course_b": course_b.id,
                "document": document.id,
                "other_document": other_document.id,
                "scanned_document": scanned_document.id,
                "draft": draft.id,
                "other_draft": other_draft.id,
                "published": published.id,
                "retryable_job": retryable_job.id,
                "blocked_job": blocked_job.id,
            }
        )

    with TestClient(app) as client:
        yield client, new_session, ids


@pytest.mark.parametrize("role", ["other_student", "other_faculty"])
def test_local_rls_hides_unassigned_course_and_roster(workspace, role):
    client, db_session, ids = workspace
    assert client.get("/api/v1/faculty/performance", headers=_token(ids[role]),
                      params={"course_id": str(ids["course_a"])}).status_code == 403

    with db_session() as db:
        # The fixture rolls back this grant. Exercise RLS itself, even though the
        # deployed browser role is already denied SELECT by the table grants.
        db.execute(text("GRANT SELECT ON public.courses, public.course_members TO authenticated"))
        db.execute(text("SET LOCAL ROLE authenticated"))
        claims = json.dumps({"sub": str(ids[role]), "role": "authenticated"})
        db.execute(text("SELECT set_config('request.jwt.claims', :claims, true)"), {"claims": claims})
        assert db.scalar(text("SELECT auth.uid()")) == ids[role]
        assert db.scalar(text("SELECT row_security_active('public.courses')")) is True
        assert db.scalar(text("SELECT row_security_active('public.course_members')")) is True
        params = {"course": ids["course_a"]}
        assert db.scalar(text("SELECT count(*) FROM public.courses WHERE id = :course"), params) == 0
        assert db.scalar(text("SELECT count(*) FROM public.course_members WHERE course_id = :course"), params) == 0


def test_two_concurrent_saves_cannot_commit_the_same_activity_version(workspace):
    _, db_session, _ = workspace
    with db_session() as db:
        engine = db.connection().engine

    activity_id = uuid.uuid4()
    with Session(engine) as db:
        db.add(LearningActivity(
            id=activity_id, title="Original", topic_concept="concurrency test",
            activity_type=ActivityKind.quiz, language=ProgrammingLang.python,
        ))
        db.commit()

    ready = Barrier(2, timeout=10)

    def save(title):
        with Session(engine) as db:
            activity = db.get(LearningActivity, activity_id)
            expected = activity.content_version
            ready.wait()
            try:
                _save_activity_revision(db, activity, expected, {"title": title})
            except HTTPException as error:
                assert error.detail["code"] == "version_conflict"
                return error.status_code, title
            db.commit()
            return 200, title

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = dict(pool.map(save, ["First tab", "Second tab"]))
        assert set(results) == {200, 409}
        with Session(engine) as db:
            saved = db.get(LearningActivity, activity_id)
            assert (saved.title, saved.content_version) == (results[200], 2)
    finally:
        with Session(engine) as db:
            db.delete(db.get(LearningActivity, activity_id))
            db.commit()


def test_students_cannot_reach_faculty_or_admin_surfaces(workspace):
    client, _db, ids = workspace
    headers = _token(ids["student"])
    for path in ("/api/v1/faculty/courses", "/api/v1/faculty/dashboard", "/api/v1/admin/accounts", "/api/v1/admin/monitoring"):
        response = client.get(path, headers=headers)
        assert response.status_code == 403, path
        assert response.json()["detail"]["code"] in {"faculty_instructor_required", "administrator_required"}


def test_faculty_is_scoped_to_assigned_courses(workspace):
    client, _db, ids = workspace
    headers = _token(ids["faculty"])
    courses = client.get("/api/v1/faculty/courses", headers=headers)
    assert courses.status_code == 200
    payload = courses.json()["courses"]
    assert [course["id"] for course in payload] == [str(ids["course_a"])]
    # No approved report and forecasting off: the Model evaluation menu entry stays hidden (ML plan D9).
    assert courses.json()["model_evaluation_available"] is False
    app.state.ml_model_report = {"model_version": "v3-test"}
    try:
        assert client.get("/api/v1/faculty/courses", headers=headers).json()["model_evaluation_available"] is True
    finally:
        app.state.ml_model_report = None

    forbidden = client.get(f"/api/v1/faculty/dashboard?course_id={ids['course_b']}", headers=headers)
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"]["code"] == "course_forbidden"

    other_draft = client.get(f"/api/v1/faculty/drafts/{ids['other_draft']}", headers=headers)
    assert other_draft.status_code == 403


def test_administrator_cannot_use_academic_faculty_routes(workspace):
    client, _db, ids = workspace
    headers = _token(ids["admin"])
    for path in (f"/api/v1/faculty/drafts/{ids['draft']}", "/api/v1/faculty/dashboard",
                 f"/api/v1/faculty/ml/evaluation?course_id={ids['course_a']}"):
        response = client.get(path, headers=headers)
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "faculty_instructor_required"
    # Administrative material operation is allowed.
    assert client.get("/api/v1/admin/materials", headers=headers).status_code == 200


def test_draft_save_never_publishes_and_approval_publishes(workspace):
    client, db_session, ids = workspace
    headers = _token(ids["faculty"])
    draft = client.get(f"/api/v1/faculty/drafts/{ids['draft']}", headers=headers).json()
    assert draft["citations"][0]["page_number"] == 12
    assert draft["student_preview"]["questions"][0]["prompt"] == "Question 1"
    assert "correct_answer" not in draft["student_preview"]["questions"][0]

    revision = client.patch(
        f"/api/v1/faculty/drafts/{ids['draft']}",
        headers=headers,
        json={"content_version": draft["content_version"], "title": "Loops and conditionals revision"},
    )
    assert revision.status_code == 200, revision.text
    assert revision.json()["draft"]["review_status"] == "draft"
    with db_session() as db:
        stored = db.query(LearningActivity).filter(LearningActivity.id == ids["draft"]).one()
        assert stored.review_status == ReviewState.draft
        assert stored.published_at is None
        assert stored.reviewed_by is None

    stale = client.patch(
        f"/api/v1/faculty/drafts/{ids['draft']}",
        headers=headers,
        json={"content_version": draft["content_version"], "title": "Stale edit"},
    )
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "version_conflict"

    unconfirmed = client.post(f"/api/v1/faculty/drafts/{ids['draft']}/approve", headers=headers, json={})
    assert unconfirmed.status_code == 422
    assert unconfirmed.json()["detail"]["code"] == "confirmation_required"

    approved = client.post(
        f"/api/v1/faculty/drafts/{ids['draft']}/approve",
        headers=headers,
        json={"confirm": True, "student_preview_confirmed": True},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["review_status"] == "published"
    with db_session() as db:
        stored = db.query(LearningActivity).filter(LearningActivity.id == ids["draft"]).one()
        assert stored.review_status == ReviewState.published
        assert stored.published_at is not None
        assert stored.reviewed_by == ids["faculty"]
        audit = (
            db.query(AuditEvent)
            .filter(AuditEvent.action == "draft.published", AuditEvent.entity_id == str(ids["draft"]))
            .first()
        )
        assert audit is not None

    queue = client.get(
        f"/api/v1/faculty/drafts?course_id={ids['course_a']}&status=open", headers=headers
    ).json()
    assert str(ids["draft"]) not in [item["activity_id"] for item in queue["items"]]


def test_reject_requires_a_reason_and_returns_to_queue(workspace):
    client, _db, ids = workspace
    headers = _token(ids["faculty"])
    missing = client.post(f"/api/v1/faculty/drafts/{ids['draft']}/reject", headers=headers, json={"reason": ""})
    assert missing.status_code == 422
    rejected = client.post(
        f"/api/v1/faculty/drafts/{ids['draft']}/reject",
        headers=headers,
        json={"reason": "The second question is not supported by page 13."},
    )
    assert rejected.status_code == 200
    assert rejected.json()["draft_state"] == "rejected"
    queue = client.get(f"/api/v1/faculty/drafts?course_id={ids['course_a']}&status=open", headers=headers).json()
    assert str(ids["draft"]) in [item["activity_id"] for item in queue["items"]]


def test_grading_content_locks_after_an_attempt_and_new_version_unlocks(workspace):
    client, _db, ids = workspace
    headers = _token(ids["faculty"])
    activity = client.get(f"/api/v1/faculty/activities/{ids['published']}", headers=headers).json()
    assert activity["grading_locked"] is True

    locked = client.patch(
        f"/api/v1/faculty/activities/{ids['published']}",
        headers=headers,
        json={"content_version": activity["content_version"], "problem_statement": "Changed grading instructions"},
    )
    assert locked.status_code == 409
    assert locked.json()["detail"]["code"] == "grading_locked"

    version = client.post(f"/api/v1/faculty/activities/{ids['published']}/versions", headers=headers)
    assert version.status_code == 201, version.text
    clone = version.json()["activity"]
    assert clone["version_number"] == 2
    assert clone["review_status"] == "draft"
    assert clone["grading_locked"] is False

    edited = client.patch(
        f"/api/v1/faculty/activities/{clone['activity_id']}",
        headers=headers,
        json={"content_version": clone["content_version"], "problem_statement": "New grading instructions for version two."},
    )
    assert edited.status_code == 200
    assert edited.json()["activity"]["problem_statement"].startswith("New grading instructions")


def test_activity_editor_preview_hides_answer_keys_and_hidden_tests(workspace):
    client, _db, ids = workspace
    headers = _token(ids["faculty"])
    preview = client.get(f"/api/v1/faculty/activities/{ids['published']}/preview", headers=headers)
    assert preview.status_code == 200
    body = preview.json()
    assert body["preview"]["sample_cases"][0]["stdin"] == "1 2"
    assert "reference_solution_code" not in body["preview"]
    assert body["grading"]["answer_key_questions"] == 0


def test_material_list_and_dashboard_counts_agree(workspace):
    client, _db, ids = workspace
    headers = _token(ids["faculty"])
    dashboard = client.get(f"/api/v1/faculty/dashboard?course_id={ids['course_a']}", headers=headers)
    assert dashboard.status_code == 200, dashboard.text
    body = dashboard.json()
    assert body["counts"]["drafts_awaiting_review"] == 1
    assert body["counts"]["materials_needing_attention"] == 1
    assert body["queue_hrefs"]["drafts"] == f"/instructor/review?course={ids['course_a']}&status=open"

    drafts = client.get(f"/api/v1/faculty/drafts?course_id={ids['course_a']}&status=open", headers=headers).json()
    assert len(drafts["items"]) == body["counts"]["drafts_awaiting_review"]

    materials = client.get(
        f"/api/v1/faculty/materials?course_id={ids['course_a']}&status=attention", headers=headers
    ).json()
    assert materials["total"] == body["counts"]["materials_needing_attention"]
    assert materials["items"][0]["document_id"] == str(ids["scanned_document"])
    assert materials["items"][0]["state"] == "needs_review"
    for item in body["action_queue"]:
        assert f"course={ids['course_a']}" in item["href"]


def test_performance_and_ml_are_course_scoped(workspace):
    client, db_session, ids = workspace
    headers = _token(ids["faculty"])
    performance = client.get(f"/api/v1/faculty/performance?course_id={ids['course_a']}", headers=headers)
    assert performance.status_code == 200, performance.text
    body = performance.json()
    assert [row["student_id"] for row in body["students"]] == [str(ids["student"])]
    assert "prediction" not in body["students"][0]
    ml = client.get(f"/api/v1/faculty/ml?course_id={ids['course_a']}", headers=headers)
    assert ml.status_code == 200, ml.text
    assert [row["student_id"] for row in ml.json()["students"]] == [str(ids["student"])]
    assert ml.json()["students"][0]["forecast"] is None
    assert ml.json()["summary"]["graded_events"] >= 1
    assert client.get(f"/api/v1/faculty/ml?course_id={ids['course_b']}", headers=headers).status_code == 403
    assert client.get(f"/api/v1/faculty/ml?course_id={ids['course_a']}", headers=_token(ids["student"])).status_code == 403
    assert client.get("/api/v1/predict/instructor/analytics", headers=headers).status_code == 404

    assert client.get(f"/api/v1/faculty/gradebook?course_id={ids['course_b']}", headers=headers).status_code == 403
    book = client.get(f"/api/v1/faculty/gradebook?course_id={ids['course_a']}", headers=headers).json()
    assert [row["student_id"] for row in book["students"]] == [str(ids["student"])]
    detail = client.get(
        f"/api/v1/faculty/performance/students/{ids['student']}?course_id={ids['course_a']}", headers=headers
    )
    assert detail.status_code == 200
    assert detail.json()["attempts"][0]["score_percentage"] == 100.0

    cross_course = client.get(
        f"/api/v1/faculty/performance/students/{ids['other_student']}?course_id={ids['course_a']}", headers=headers
    )
    assert cross_course.status_code == 404
    assert client.get(
        f"/api/v1/faculty/ml/students/{ids['other_student']}?course_id={ids['course_a']}", headers=headers
    ).status_code == 404


def test_activity_analysis_totals_and_practice_scope(workspace, monkeypatch):
    client, db_session, ids = workspace
    now = datetime.now(timezone.utc)
    with db_session() as db:
        enrolled = [ids["other_student"]]
        for _ in range(4):
            student_id = uuid.uuid4()
            email = f"analysis-{student_id}@example.test"
            db.execute(text(
                "insert into auth.users (id, aud, role, email, encrypted_password) "
                "values (:id, 'authenticated', 'authenticated', :email, '')"
            ), {"id": student_id, "email": email})
            db.add(Profile(id=student_id, pseudonym_id=f"test_{student_id.hex[:12]}", role=UserRole.student,
                           year_level=1, semester=1, enrolled_language=ProgrammingLang.python,
                           email=email, account_status="active"))
            enrolled.append(student_id)
        db.flush()
        db.add_all(CourseMember(course_id=ids["course_a"], profile_id=student_id,
                                member_role="student", status="active") for student_id in enrolled)
        quiz = LearningActivity(
            course_id=ids["course_a"], created_by=ids["faculty"], title="Quiz analysis",
            activity_type=ActivityKind.quiz, language=ProgrammingLang.python, topic_concept="arithmetic",
            review_status=ReviewState.published, quiz_questions_json=QUIZ_QUESTIONS,
        )
        empty = LearningActivity(
            course_id=ids["course_a"], created_by=ids["faculty"], title="Empty activity",
            activity_type=ActivityKind.challenge, language=ProgrammingLang.python, topic_concept="arithmetic",
            review_status=ReviewState.published,
        )
        exam = Exam(created_by=ids["faculty"], title="Exam", opens_at=now,
                    closes_at=now + timedelta(hours=1), duration_minutes=30)
        db.add_all([quiz, empty, exam])
        db.flush()
        exam_attempt = ExamAttempt(exam_id=exam.id, student_id=enrolled[0], attempt_number=1,
                                   started_at=now, due_at=now + timedelta(minutes=30))
        db.add(exam_attempt)
        db.flush()
        db.get(LearningActivity, ids["published"]).pass_mark_percent = 65
        for learner, scores in zip(enrolled, [(10, 40, 59.9), (19.9,), (20,), (30, 40, 79.9), ()]):
            for number, score in enumerate(scores, start=1):
                db.add(ActivityAttempt(
                    student_id=learner, activity_id=ids["published"], attempt_number=number,
                    score_percentage=score, is_successful=score >= 65,
                    error_category="logic_error" if learner == enrolled[0] else "syntax_error",
                    created_at=now - timedelta(days=8) if learner == enrolled[3] else now,
                ))
        db.add_all([
            ActivityAttempt(student_id=enrolled[0], activity_id=ids["published"], attempt_number=4,
                            score_percentage=100, is_successful=True, exam_attempt_id=exam_attempt.id),
            ActivityAttempt(student_id=enrolled[0], activity_id=quiz.id, attempt_number=1,
                            score_percentage=100, is_successful=True, exam_attempt_id=exam_attempt.id),
            ActivityAttempt(student_id=enrolled[0], activity_id=quiz.id, attempt_number=2,
                            score_percentage=33.33, is_successful=False, quiz_answers_json={"q1": "a", "q2": "B"}),
            ActivityAttempt(student_id=enrolled[0], activity_id=quiz.id, attempt_number=3,
                            score_percentage=100, is_successful=True, quiz_answers_json={"q1": "A", "q2": "A", "q3": "A"}),
            ActivityAttempt(student_id=enrolled[1], activity_id=quiz.id, attempt_number=1,
                            score_percentage=100, is_successful=True, quiz_answers_json={"q1": "A", "q2": "A", "q3": "A"}),
            ActivityAttempt(student_id=enrolled[2], activity_id=quiz.id, attempt_number=1,
                            score_percentage=0, is_successful=False),
        ])
        for index, learner in enumerate([enrolled[0], ids["student"], ids["student"]]):
            db.add(HintUse(student_id=learner, activity_id=ids["published"], request_key=f"qa-{index}",
                           source="reviewed", body="Hint"))
        quiz_id, empty_id = quiz.id, empty.id
        db.commit()
    headers = _token(ids["faculty"])
    def get(activity_id, as_role="faculty"):
        return client.get(f"/api/v1/faculty/activities/{activity_id}/analysis", headers=_token(ids[as_role]))

    response = get(ids["published"])
    assert response.status_code == 200, response.text
    body = response.json()
    values = {"class_size": 6, "attempted": 5, "passed": 2, "pass_rate": 0.4, "first_try_pass_rate": 0.2,
              "median_attempts_to_pass": 2, "stuck": 1, "not_started": 1, "pass_mark_percent": 65,
              "excludes_exam_attempts": True, "hint_use": {"learners": 2, "passed": 1}}
    assert {key: body[key] for key in values} == values
    assert [item["count"] for item in body["score_distribution"]] == [1, 1, 1, 1, 1]
    assert [(item["category"], item["count"]) for item in body["error_categories"]] == [
        ("syntax_error", 4), ("logic_error", 3),
    ]
    assert "questions" not in body
    assert str(enrolled[0]) not in response.text
    for role in ("student", "other_faculty", "admin"):
        assert get(ids["published"], role).status_code in {403, 404}
    assert get(ids["draft"]).status_code == 404

    blank = get(empty_id).json()
    assert blank["attempted"] == 0 and blank["not_started"] == 6
    assert blank["pass_mark_percent"] == 100
    assert all(blank[name] is None for name in ("pass_rate", "first_try_pass_rate", "median_attempts_to_pass"))
    question_data = get(quiz_id).json()
    assert question_data["error_categories"] == []
    assert question_data["hint_use"] is None
    assert question_data["pass_mark_percent"] == 75
    assert question_data["first_try_pass_rate"] == pytest.approx(1 / 3)
    assert [(row["correct"], row["recorded"]) for row in question_data["questions"]] == [(2, 2), (1, 2), (1, 2)]
    assert "correct_answer" not in str(question_data["questions"])

    book = client.get(f"/api/v1/faculty/gradebook?course_id={ids['course_a']}", headers=headers).json()
    column = next(item for item in book["activities"] if item["activity_id"] == str(ids["published"]))
    assert (column["attempted"], column["passed"]) == (body["attempted"], body["passed"])
    listing = client.get(f"/api/v1/faculty/activities?course_id={ids['course_a']}", headers=headers).json()
    row = next(r for r in listing["items"] if r["activity_id"] == str(ids["published"]))
    assert row["health"] == {k: body[k] for k in ("passed", "attempted", "stuck", "not_started", "pass_rate")}
    snapshot = client.get(f"/api/v1/faculty/dashboard?course_id={ids['course_a']}", headers=headers).json()["class_snapshot"]
    assert snapshot["active_7d"] + snapshot["inactive_7d"] + snapshot["need_follow_up"] == snapshot["active_learners"]
    inactive = client.get(f"/api/v1/faculty/performance?course_id={ids['course_a']}&inactive=1", headers=headers).json()
    assert [row["student_id"] for row in inactive["students"]] == [str(enrolled[3])]
    assert len(inactive["students"]) == snapshot["inactive_7d"]
    _consent(monkeypatch, db_session, ids["student"])
    def admin_row():
        rows = client.get("/api/v1/admin/course-health", headers=_token(ids["admin"])).json()["courses"]
        return next(r for r in rows if r["id"] == str(ids["course_a"]))
    aggregate = admin_row()
    assert aggregate["research_consent"] == 1
    assert (aggregate["active_7d"], aggregate["not_started"], aggregate["activities_passed"]) == (
        snapshot["active_7d"], snapshot["need_follow_up"], snapshot["average_completion_percent"])
    with db_session() as db:
        db.add(ResearchConsent(student_id=ids["student"], document_version="test-v1", choice="declined"))
        db.commit()
    assert admin_row()["research_consent"] == 0
    progress = client.get(
        f"/api/v1/faculty/performance?course_id={ids['course_a']}&activity_id={ids['published']}&stuck_only=true",
        headers=headers,
    ).json()
    assert [row["student_id"] for row in progress["students"]] == [str(enrolled[0])]
    assert progress["students"][0]["attempt_count"] == 3


def test_course_announcements_crud_is_scoped_and_audited(workspace):
    client, db_session, ids = workspace
    endpoint = "/api/v1/faculty/announcements"
    feed = "/api/v1/pilot/announcements"
    course = str(ids["course_a"])
    faculty = _token(ids["faculty"])
    other_faculty = _token(ids["other_faculty"])
    student = _token(ids["student"])
    expires_at = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    payload = {"course_id": course, "title": "  Lab update  ", "body": "  Bring headphones.\n<strong>Plain text</strong>  ",
               "expires_at": expires_at}
    for role in ("admin", "student", "other_faculty"):
        assert client.post(endpoint, headers=_token(ids[role]), json=payload).status_code == 403
        assert client.get(endpoint, headers=_token(ids[role]), params={"course_id": course}).status_code == 403
    response = client.post(endpoint, headers=faculty, json=payload)
    assert response.status_code == 201, response.text
    posted = response.json()
    assert posted["title"] == "Lab update" and posted["body"] == "Bring headphones.\n<strong>Plain text</strong>"
    assert posted["expired"] is False and posted["pinned"] is False
    announcement_id = posted["id"]
    version = {"expected_updated_at": posted["updated_at"]}
    route = f"{endpoint}/{announcement_id}"
    preflight_headers = {"Origin": settings.CORS_ORIGINS[0], "Access-Control-Request-Method": "DELETE",
                         "Access-Control-Request-Headers": "authorization"}
    preflight = client.options(route, headers=preflight_headers)
    assert preflight.status_code == 200
    assert preflight.headers["Access-Control-Allow-Origin"] == preflight_headers["Origin"]
    assert "DELETE" in preflight.headers["Access-Control-Allow-Methods"]
    assert client.options(route, headers={**preflight_headers, "Origin": "https://outside.example.test"}).status_code == 400
    for headers in (other_faculty, _token(ids["admin"]), student):
        assert client.patch(route, headers=headers, json={"title": "Wrong course", **version}).status_code == 403
        assert client.delete(route, headers=headers).status_code == 403
    assert client.get(feed, headers=faculty).status_code == 403
    assert client.get(feed, headers=_token(ids["other_student"])).json() == {"items": []}
    shown = client.get(feed, headers=student).json()["items"]
    assert len(shown) == 1 and shown[0]["id"] == announcement_id
    assert shown[0]["course_title"] == "Introduction to Python" and shown[0]["author_name"] == "Faculty"
    assert not {"author_id", "email", "pseudonym_id"}.intersection(shown[0])

    changed = client.patch(route, headers=faculty, json={"body": "Updated", "pinned": True, "expires_at": None, **version})
    assert changed.status_code == 200, changed.text
    assert changed.json()["body"] == "Updated" and changed.json()["pinned"] is True
    assert changed.json()["expires_at"] is None and changed.json()["updated_at"] > posted["updated_at"]
    stale = client.patch(route, headers=faculty, json={"body": "Stale edit", **version})
    assert stale.status_code == 409 and stale.json()["detail"]["code"] == "version_conflict"
    with db_session() as db:
        item = db.get(CourseAnnouncement, uuid.UUID(announcement_id))
        item.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert client.get(feed, headers=student).json() == {"items": []}
    expired = client.get(endpoint, headers=faculty, params={"course_id": course}).json()["items"][0]
    assert expired["expired"] is True
    edited = client.patch(route, headers=faculty, json={"title": "Expired edit", "expected_updated_at": expired["updated_at"]})
    assert edited.status_code == 200
    assert client.patch(route, headers=faculty, json={
        "expires_at": None, "expected_updated_at": edited.json()["updated_at"],
    }).json()["expired"] is False
    with db_session() as db:
        member = db.query(CourseMember).filter_by(course_id=ids["course_a"], profile_id=ids["student"]).one()
        member.status = "removed"
        db.commit()
    assert client.get(feed, headers=student).json() == {"items": []}
    with db_session() as db:
        db.query(CourseMember).filter_by(course_id=ids["course_a"], profile_id=ids["student"]).one().status = "active"
        db.get(Profile, ids["student"]).account_status = "deactivated"
        db.commit()
    assert client.get(feed, headers=student).status_code == 403

    assert client.delete(route, headers=faculty).status_code == 204
    assert client.get(endpoint, headers=faculty, params={"course_id": course}).json()["items"] == []
    assert client.delete(route, headers=faculty).status_code == 404
    with db_session() as db:
        events = db.query(AuditEvent).filter_by(course_id=ids["course_a"], entity_id=announcement_id).all()
        assert {event.action for event in events} == {"announcement.created", "announcement.updated", "announcement.deleted"}
        assert all(event.actor_id == ids["faculty"] for event in events)


def test_course_announcement_validation_and_limits(workspace):
    client, db_session, ids = workspace
    endpoint = "/api/v1/faculty/announcements"
    faculty = _token(ids["faculty"])
    payload = {"course_id": str(ids["course_a"]), "title": "Notice", "body": "Message"}
    for changes in (
        {"title": " "}, {"title": "x" * 121}, {"body": "x" * 2001}, {"body": "a\x00b"},
        {"author_id": str(ids["faculty"])}, {"pinned": "yes"},
        {"expires_at": "2020-01-01T00:00:00Z"}, {"expires_at": "2099-01-01T09:00:00"},
    ):
        assert client.post(endpoint, headers=faculty, json={**payload, **changes}).status_code == 422
    created = client.post(endpoint, headers=faculty, json=payload).json()
    route = f"{endpoint}/{created['id']}"
    for changes in ({}, {"title": None}, {"pinned": None}, {"course_id": str(ids["course_b"])}):
        assert client.patch(route, headers=faculty, json={"expected_updated_at": created["updated_at"], **changes}).status_code == 422
    now = datetime.now(timezone.utc)
    with db_session() as db:
        db.add_all(CourseAnnouncement(
            course_id=ids["course_a"], title=f"Notice {i}", body="Message", created_at=now + timedelta(seconds=i),
            pinned=i in {2, 3}, expires_at=now - timedelta(days=1) if i == 3 else None,
        ) for i in range(1, 50))
        db.commit()
    rejected = client.post(endpoint, headers=faculty, json=payload)
    assert rejected.status_code == 409 and rejected.json()["detail"]["code"] == "announcement_limit"
    listed = client.get(endpoint, headers=faculty, params={"course_id": str(ids["course_a"])}).json()
    assert len(listed["items"]) == listed["limit"] == 50
    assert [item["title"] for item in listed["items"][:3]] == ["Notice 3", "Notice 2", "Notice 49"]
    feed = client.get("/api/v1/pilot/announcements", headers=_token(ids["student"])).json()["items"]
    assert len(feed) == 10
    assert [item["title"] for item in feed[:2]] == ["Notice 2", "Notice 49"]
    assert all(item["title"] != "Notice 3" for item in feed)
    assert feed[0]["author_name"] == "Your instructor"


def test_forecast_history_and_quality_never_cross_course_boundaries(workspace, monkeypatch):
    client, db_session, ids = workspace
    monkeypatch.setattr(settings, "RESEARCH_CONSENT_ACTIVE", True)
    monkeypatch.setattr(settings, "RESEARCH_CONSENT_VERSION", "test-v1")
    with db_session() as db:
        other_activity = LearningActivity(course_id=ids["course_b"], created_by=ids["other_faculty"],
            activity_type=ActivityKind.quiz, language=ProgrammingLang.python, topic_concept="arithmetic",
            title="Other course quiz", review_status=ReviewState.published, sequence_order=1)
        next_activity = LearningActivity(course_id=ids["course_a"], created_by=ids["faculty"],
            activity_type=ActivityKind.challenge, language=ProgrammingLang.python, topic_concept="arithmetic",
            title="Next course challenge", review_status=ReviewState.published, sequence_order=2)
        db.add_all([other_activity, next_activity])
        db.flush()
        db.add(CourseMember(course_id=ids["course_b"], profile_id=ids["student"],
                            member_role="student", status="active"))
        db.add(ResearchConsent(student_id=ids["student"], document_version="test-v1", choice="accepted"))
        db.add(MLPrediction(student_id=ids["student"], target_activity_id=other_activity.id,
            features_snapshot_json={}, logreg_prob=0.1, logreg_pred=False,
            rf_prob=0.8, rf_pred=True, actual_outcome=True, selected_model="random_forest",
            model_version="v2-test", active_sequencer_mode="rule_based"))
        db.commit()
        assert next_course_activity(db, db.get(Profile, ids["student"]), ids["course_a"]).id == next_activity.id

    course_a = client.get(f"/api/v1/faculty/ml?course_id={ids['course_a']}", headers=_token(ids["faculty"]))
    assert course_a.status_code == 200, course_a.text
    evaluation_a = client.get(f"/api/v1/faculty/ml/evaluation?course_id={ids['course_a']}",
                              headers=_token(ids["faculty"]))
    assert evaluation_a.json()["observed"]["labeled_predictions"] == 0
    detail_a = client.get(f"/api/v1/faculty/ml/students/{ids['student']}?course_id={ids['course_a']}",
                          headers=_token(ids["faculty"]))
    assert detail_a.status_code == 200
    assert detail_a.json()["predictions"] == []
    course_b = client.get(f"/api/v1/faculty/ml?course_id={ids['course_b']}", headers=_token(ids["other_faculty"]))
    assert course_b.status_code == 200, course_b.text
    evaluation_b = client.get(f"/api/v1/faculty/ml/evaluation?course_id={ids['course_b']}",
                              headers=_token(ids["other_faculty"])).json()["observed"]
    assert evaluation_b["labeled_predictions"] == 1
    assert evaluation_b["models"]["random_forest"]["accuracy_percent"] == 100.0
    assert evaluation_b["models"]["logreg"]["accuracy_percent"] == 0.0
    with db_session() as db:
        db.add(ResearchConsent(student_id=ids["student"], document_version="test-v1", choice="declined"))
        db.commit()
    revoked = client.get(f"/api/v1/faculty/ml/evaluation?course_id={ids['course_b']}",
                         headers=_token(ids["other_faculty"]))
    assert revoked.json()["observed"]["labeled_predictions"] == 0



def test_ml_dashboard_distinguishes_history_consent_and_model_states(workspace, monkeypatch):
    client, db_session, ids = workspace
    monkeypatch.setattr(faculty_ml_api, "get_setting_int", lambda *_args: 3)
    course_url = f"/api/v1/faculty/ml?course_id={ids['course_a']}"
    headers = _token(ids["faculty"])
    assert client.get(course_url, headers=headers).json()["students"][0]["forecast_status"] == "no_next_activity"
    other_course = client.get(f"/api/v1/faculty/ml?course_id={ids['course_b']}",
                              headers=_token(ids["other_faculty"]))
    assert other_course.json()["students"][0]["forecast_status"] == "no_graded_history"

    with db_session() as db:
        target = LearningActivity(course_id=ids["course_a"], created_by=ids["faculty"],
            activity_type=ActivityKind.challenge, language=ProgrammingLang.python, topic_concept="arithmetic",
            title="Next challenge", review_status=ReviewState.published, sequence_order=2)
        db.add(target)
        db.commit()
    assert client.get(course_url, headers=headers).json()["students"][0]["forecast_status"] == "missing_consent"

    monkeypatch.setattr(settings, "RESEARCH_CONSENT_ACTIVE", True)
    monkeypatch.setattr(settings, "RESEARCH_CONSENT_VERSION", "test-v1")
    with db_session() as db:
        db.add(ResearchConsent(student_id=ids["student"], document_version="test-v1", choice="accepted"))
        db.commit()
    assert client.get(course_url, headers=headers).json()["students"][0]["forecast_status"] == "insufficient_history"

    with db_session() as db:
        for order in (3, 4):
            activity = LearningActivity(course_id=ids["course_a"], created_by=ids["faculty"],
                activity_type=ActivityKind.quiz, language=ProgrammingLang.python, topic_concept="arithmetic",
                title=f"Prior practice {order}", review_status=ReviewState.published, sequence_order=order)
            db.add(activity)
            db.flush()
            db.add(ActivityAttempt(student_id=ids["student"], activity_id=activity.id,
                                   attempt_number=1, score_percentage=90, is_successful=True))
        db.commit()
    assert client.get(course_url, headers=headers).json()["students"][0]["forecast_status"] == "model_unavailable"

    with db_session() as db:
        empty_course = Course(code=f"E-{ids['faculty'].hex[:6]}", title="Empty course", created_by=ids["faculty"])
        db.add(empty_course)
        db.flush()
        db.add(CourseMember(course_id=empty_course.id, profile_id=ids["faculty"],
                            member_role="instructor", status="active"))
        db.commit()
        empty_id = empty_course.id
    empty = client.get(f"/api/v1/faculty/ml?course_id={empty_id}", headers=headers)
    assert empty.status_code == 200
    assert empty.json()["students"] == []
    assert empty.json()["summary"]["active_learners"] == 0


def test_prediction_outcome_links_only_earlier_snapshots(workspace):
    _client, db_session, ids = workspace
    now = datetime.now(timezone.utc)
    with db_session() as db:
        earlier = MLPrediction(student_id=ids["student"], target_activity_id=ids["published"],
            features_snapshot_json={}, logreg_prob=0.3, logreg_pred=False, rf_prob=0.7, rf_pred=True,
            model_version="v2-test", selected_model="random_forest", created_at=now - timedelta(minutes=1))
        later = MLPrediction(student_id=ids["student"], target_activity_id=ids["published"],
            features_snapshot_json={}, logreg_prob=0.2, logreg_pred=False, rf_prob=0.6, rf_pred=True,
            model_version="v2-test", selected_model="random_forest", created_at=now + timedelta(minutes=1))
        db.add_all([earlier, later])
        db.flush()
        earlier_id, later_id = earlier.id, later.id
        assert record_prediction_outcome(db, student_id=ids["student"], activity_id=ids["published"],
                                         attempt_created_at=now, is_successful=True) == 1
        db.commit()
        assert db.get(MLPrediction, earlier_id).actual_outcome is True
        assert db.get(MLPrediction, later_id).actual_outcome is None


def test_usernames_are_editable_unique_and_alphabetic_for_every_role(workspace):
    client, db_session, ids = workspace
    for role in ("student", "faculty", "admin"):
        profile = client.get("/api/v1/profile/me", headers=_token(ids[role])).json()
        assert profile["username"].isalpha() and profile["username"].islower()
        assert not any(char.isdigit() for char in profile["username"])
    changed = client.patch("/api/v1/profile/me", headers=_token(ids["student"]), json={"username": "NewHandle"})
    assert changed.status_code == 200, changed.text
    assert changed.json()["username"] == "newhandle"
    assert client.patch("/api/v1/profile/me", headers=_token(ids["faculty"]), json={"username": "newhandle"}).status_code == 409
    assert client.patch("/api/v1/profile/me", headers=_token(ids["admin"]), json={"username": "name123"}).status_code == 422
    faculty_edit = client.patch("/api/v1/profile/me", headers=_token(ids["faculty"]),
                                json={"username": "FacultyHandle"})
    admin_edit = client.patch("/api/v1/profile/me", headers=_token(ids["admin"]),
                              json={"username": "AdminHandle"})
    assert faculty_edit.status_code == 200 and faculty_edit.json()["username"] == "facultyhandle"
    assert admin_edit.status_code == 200 and admin_edit.json()["username"] == "adminhandle"
    with db_session() as db:
        assert db.get(Profile, ids["student"]).pseudonym_id.startswith("test_student_")


def test_staff_school_id_is_private_and_can_only_be_set_once(workspace):
    client, db_session, ids = workspace
    endpoint = "/api/v1/profile/staff-setup"
    assert client.put(endpoint, headers=_token(ids["student"]), json={"school_id": "00123"}).status_code == 403
    for role in ("faculty", "admin"):
        headers = _token(ids[role])
        assert client.put(endpoint, headers=headers, json={"school_id": "  "}).status_code == 422
        assert client.put(endpoint, headers=headers, json={"school_id": "  00123  "}).status_code == 204
        assert client.put(endpoint, headers=headers, json={"school_id": "00123"}).status_code == 204
        assert client.put(endpoint, headers=headers, json={"school_id": "00124"}).status_code == 409
        assert "school_id" not in client.get("/api/v1/profile/me", headers=headers).json()
        with db_session() as db:
            assert db.get(Profile, ids[role]).school_id == "00123"


def test_public_signup_username_is_reserved_with_auth_user(workspace):
    client, db_session, ids = workspace
    endpoint = "/api/v1/profile/username-availability"
    assert client.get(endpoint, params={"username": "FreshHandle"}).json() == {"available": True}
    # A second client can see "available" before either signup claims the name.
    assert client.get(endpoint, params={"username": "freshhandle"}).json() == {"available": True}
    with db_session() as db:
        existing_username = db.get(Profile, ids["admin"]).username
    assert client.get(endpoint, params={"username": existing_username.upper()}).json() == {"available": False}
    assert client.get(endpoint, params={"username": "name123"}).status_code == 422

    created = uuid.uuid4()
    duplicate = uuid.uuid4()
    first_school_id = f"00-{created.int % 99_999 + 1:05d}"
    second_school_id = f"01-{duplicate.int % 99_999 + 1:05d}"
    second_email = f"signup-{duplicate}@example.test"
    # Students register with their enrollment School ID directly; there is no admin approval step.
    assert client.put("/api/v1/admin/student-registration-roster", headers=_token(ids["admin"]),
                      json={"school_id": first_school_id, "email": second_email}).status_code == 404
    sql = text("""
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
        VALUES (:id, '00000000-0000-0000-0000-000000000000', 'authenticated',
                'authenticated', :email, '', CAST(:metadata AS jsonb))
    """)
    with db_session() as db:
        db.execute(sql, {"id": created, "email": f"signup-{created}@example.test",
                         "metadata": json.dumps({"username": "FreshHandle", "bytequest_role": "admin",
                                                 "school_id": f" {first_school_id} ", "year_level": 3, "block_section": "F"})})
        db.commit()
        profile = db.get(Profile, created)
        assert profile.username == "freshhandle"
        assert profile.role == UserRole.student
        assert profile.enrolled_language == ProgrammingLang.cpp
        assert profile.pseudonym_id == f"stu_{created.hex}"
        assert (profile.school_id, profile.year_level, profile.block_section) == (first_school_id, 3, "F")

    assert client.get(endpoint, params={"username": "FRESHHANDLE"}).json() == {"available": False}
    with db_session() as db:
        with pytest.raises(DBAPIError, match="Student School ID is already registered"):
            db.execute(sql, {"id": duplicate, "email": second_email,
                             "metadata": json.dumps({"username": "SecondHandle", "school_id": first_school_id,
                                                     "year_level": 3, "block_section": "F"})})
        db.rollback()

    with db_session() as db:
        with pytest.raises(IntegrityError):
            db.execute(sql, {"id": duplicate, "email": f"signup-{duplicate}@example.test",
                             "metadata": json.dumps({"username": "freshhandle", "school_id": second_school_id,
                                                     "year_level": 3, "block_section": "F"})})
        db.rollback()

    with db_session() as db:
        with pytest.raises(DBAPIError):
            db.execute(sql, {"id": duplicate, "email": f"signup-{duplicate}@example.test",
                             "metadata": json.dumps({"username": "name123", "school_id": second_school_id,
                                                     "year_level": 3, "block_section": "F"})})
        db.rollback()

    with db_session() as db:
        with pytest.raises(DBAPIError, match="Invalid student registration fields"):
            db.execute(sql, {"id": duplicate, "email": f"signup-{duplicate}@example.test",
                             "metadata": json.dumps({"username": "SecondHandle", "school_id": second_school_id,
                                                     "year_level": 3, "block_section": "G"})})
        db.rollback()

    with db_session() as db:
        db.execute(sql, {"id": duplicate, "email": f"signup-{duplicate}@example.test",
                         "metadata": json.dumps({"username": "SecondHandle", "school_id": second_school_id,
                                                 "year_level": 4, "block_section": "A"})})
        db.commit()
        assert db.get(Profile, duplicate).username == "secondhandle"

    # Admin invitations omit username metadata and continue through provisioning.
    invited = uuid.uuid4()
    with db_session() as db:
        db.execute(sql, {"id": invited, "email": f"invite-{invited}@example.test", "metadata": '{}'})
        db.commit()
        assert db.get(Profile, invited) is None


def test_school_id_availability_matches_the_signup_rule(workspace):
    client, db_session, _ids = workspace
    marker = uuid.uuid4()
    school_id = f"02-{marker.int % 99_999 + 1:05d}"
    endpoint = "/api/v1/profile/school-id-availability"
    assert client.post(endpoint, json={"school_id": f" {school_id} "}).json() == {"available": True}
    assert client.post(endpoint, json={"school_id": school_id, "email": "x@example.test"}).status_code == 422
    assert client.get(endpoint, params={"school_id": school_id}).status_code == 405
    with db_session() as db:
        db.execute(text("""
            INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
            VALUES (:id, '00000000-0000-0000-0000-000000000000', 'authenticated',
                    'authenticated', :email, '', CAST(:metadata AS jsonb))
        """), {"id": marker, "email": f"check-{marker}@example.test", "metadata": json.dumps(
            {"username": "CheckHandle", "school_id": school_id, "year_level": 1, "block_section": "A"})})
        db.commit()
        assert db.get(Profile, marker).school_id == school_id
    assert client.post(endpoint, json={"school_id": school_id}).json() == {"available": False}


def test_ml_exam_history_waits_for_release_and_uses_overall_score_once(workspace):
    client, db_session, ids = workspace
    now = datetime.now(timezone.utc)
    with db_session() as db:
        exam = Exam(created_by=ids["faculty"], title="Course exam", opens_at=now - timedelta(days=2),
                    closes_at=now - timedelta(days=1), duration_minutes=30, published_at=now - timedelta(days=2))
        db.add(exam)
        db.flush()
        db.add(ExamItem(exam_id=exam.id, activity_id=ids["published"], position=1, points=100, snapshot_json={}))
        attempt = ExamAttempt(exam_id=exam.id, student_id=ids["student"], attempt_number=1,
                              status="submitted", started_at=now - timedelta(days=2), due_at=now - timedelta(days=1),
                              submitted_at=now - timedelta(days=1), score=80, max_score=100)
        db.add(attempt)
        db.flush()
        db.add(ActivityAttempt(student_id=ids["student"], activity_id=ids["published"], attempt_number=2,
                               exam_attempt_id=attempt.id, score_percentage=80, is_successful=True))
        db.commit()
        from app.api.exams import released_exam_summary
        learners = [db.get(Profile, ids["student"])]
        assert released_exam_summary(db, exam.id, learners, []) is None
        assert released_exam_summary(db, exam.id, learners, [attempt]) is None
        assert exam.id in course_exam_ids(db, ids["course_a"])
        assert released_exam_history(db, ids["student"], ids["course_a"]) == []
        before = client.get(f"/api/v1/faculty/ml?course_id={ids['course_a']}", headers=_token(ids["faculty"])).json()
        assert before["students"][0]["exam_count"] == 0
        assert before["students"][0]["challenge_count"] == 1
        exam.results_released_at = now
        attempt.result_released_at = now
        db.commit()
        history = released_exam_history(db, ids["student"], ids["course_a"])
        assert len(history) == 1 and history[0]["score_percentage"] == 80.0
        assert released_exam_history(db, ids["student"], ids["course_a"], as_of=now - timedelta(hours=1)) == []
        after = client.get(f"/api/v1/faculty/ml?course_id={ids['course_a']}", headers=_token(ids["faculty"])).json()
        assert after["students"][0]["exam_count"] == 1
        assert after["students"][0]["challenge_count"] == 1
        detail = client.get(f"/api/v1/faculty/ml/students/{ids['student']}?course_id={ids['course_a']}",
                            headers=_token(ids["faculty"])).json()
        assert any(point["exam"] == 80.0 for point in detail["trend"])
        summary = released_exam_summary(db, exam.id, learners, [attempt])
        assert summary["average_percent"] == 80
        later = ExamAttempt(exam_id=exam.id, student_id=ids["student"], attempt_number=2,
                            status="submitted", started_at=now, due_at=now, score=90, max_score=100)
        db.add(later)
        db.flush()
        item = db.query(ExamItem).filter_by(exam_id=exam.id).one()
        db.add(ActivityAttempt(student_id=ids["student"], activity_id=ids["published"], attempt_number=3,
                               exam_item_id=item.id, exam_attempt_id=later.id, score_percentage=90, is_successful=True))
        db.flush()
        assert released_exam_summary(db, exam.id, learners, [later, attempt]) == summary
        later.result_released_at = now
        summary = released_exam_summary(db, exam.id, learners, [later, attempt])
        assert summary["submitted"] == 1 and summary["average_percent"] == 90
        assert sum(b["count"] for b in summary["score_bands"]) == 1
        assert summary["items"][0]["attempted"] == summary["items"][0]["passed"] == 1


def test_exam_release_timestamp_is_stable_idempotent_and_scoring_failure_is_isolated(workspace, monkeypatch):
    client, db_session, ids = workspace
    now = datetime.now(timezone.utc)
    with db_session() as db:
        exam = Exam(created_by=ids["faculty"], title="Retake timing", opens_at=now - timedelta(days=2),
                    closes_at=now - timedelta(days=1), duration_minutes=30, published_at=now - timedelta(days=2))
        db.add(exam)
        db.flush()
        db.add(ExamItem(exam_id=exam.id, activity_id=ids["published"], position=1, points=100, snapshot_json={}))
        first = ExamAttempt(exam_id=exam.id, student_id=ids["student"], attempt_number=1,
                            status="submitted", started_at=now - timedelta(days=2), due_at=now - timedelta(days=1),
                            submitted_at=now - timedelta(days=1), score=80, max_score=100)
        db.add(first)
        db.commit()
        exam_id, first_id = exam.id, first.id

    scoring_calls = []
    def fail_optional_scoring(*args):
        scoring_calls.append("failed")
        raise RuntimeError("model service failed")
    monkeypatch.setattr(exams_api, "_score_released_exam", fail_optional_scoring)
    url = f"/api/v1/exams/instructor/{exam_id}/release"
    released = client.post(url, headers=_token(ids["faculty"]))
    assert released.status_code == 200, released.text
    assert scoring_calls == ["failed"]
    first_release = released.json()["released_at"]
    with db_session() as db:
        assert db.get(ExamAttempt, first_id).result_released_at.isoformat() == first_release.replace("Z", "+00:00")
        assert len(released_exam_history(db, ids["student"], ids["course_a"])) == 1

    again = client.post(url, headers=_token(ids["faculty"]))
    assert again.status_code == 200
    assert again.json()["released_at"] == first_release
    assert scoring_calls == ["failed"]

    with db_session() as db:
        second = ExamAttempt(exam_id=exam_id, student_id=ids["student"], attempt_number=2,
                             status="submitted", started_at=datetime.now(timezone.utc),
                             due_at=datetime.now(timezone.utc), submitted_at=datetime.now(timezone.utc),
                             score=60, max_score=100)
        db.add(second)
        db.commit()
        second_id = second.id
    monkeypatch.setattr(exams_api, "_score_released_exam", lambda *args: scoring_calls.append("second"))
    retake_release = client.post(url, headers=_token(ids["faculty"]))
    assert retake_release.status_code == 200, retake_release.text
    assert scoring_calls == ["failed", "second"]
    with db_session() as db:
        history = released_exam_history(db, ids["student"], ids["course_a"])
        assert [row["exam_attempt_id"] for row in history] == [str(first_id), str(second_id)]
        assert history[0]["created_at"].isoformat() == first_release.replace("Z", "+00:00")
        assert history[1]["created_at"] > history[0]["created_at"]
        assert len(released_exam_history(db, ids["student"], ids["course_a"],
                                         as_of=history[0]["created_at"], include_at_cutoff=True)) == 1


def test_duplicate_email_and_assignment_conflicts_are_inline(workspace):
    client, db_session, ids = workspace
    headers = _token(ids["admin"])
    duplicate = client.post(
        "/api/v1/admin/accounts",
        headers=headers,
        json={"email": f"faculty-{ids['faculty'].hex[:8]}@example.test", "role": "student"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["code"] == "duplicate_email"
    assert duplicate.json()["detail"]["field"] == "email"

    student_as_instructor = client.post(
        "/api/v1/admin/assignments",
        headers=headers,
        json={"profile_id": str(ids["student"]), "course_id": str(ids["course_a"]), "member_role": "instructor"},
    )
    assert student_as_instructor.status_code == 422
    assert student_as_instructor.json()["detail"]["code"] == "role_mismatch"

    duplicate_assignment = client.post(
        "/api/v1/admin/assignments",
        headers=headers,
        json={"profile_id": str(ids["student"]), "course_id": str(ids["course_a"]), "member_role": "student"},
    )
    assert duplicate_assignment.status_code == 409
    assert duplicate_assignment.json()["detail"]["code"] == "duplicate_assignment"


def test_account_creation_provisions_a_profile_and_course_access(workspace, monkeypatch):
    client, db_session, ids = workspace
    headers = _token(ids["admin"])
    new_id = uuid.uuid4()
    with db_session() as db:
        db.execute(
            text(
                "INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password) "
                "VALUES (:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', "
                "'auth-record-for-invite@example.test', '')"
            ),
            {"id": new_id},
        )
        db.commit()

    async def fake_invite(email, role, display_name):
        return new_id

    monkeypatch.setattr(admin_api, "invite_auth_user", fake_invite)
    response = client.post(
        "/api/v1/admin/accounts",
        headers=headers,
        json={
            "email": "new.faculty@example.test",
            "role": "instructor",
            "display_name": "New Faculty",
            "course_ids": [str(ids["course_a"])],
        },
    )
    assert response.status_code == 201, response.text
    with db_session() as db:
        profile = db.query(Profile).filter(Profile.id == new_id).one()
        assert profile.role == UserRole.instructor
        assert profile.email == "new.faculty@example.test"
        membership = (
            db.query(CourseMember)
            .filter(CourseMember.profile_id == new_id, CourseMember.course_id == ids["course_a"])
            .one()
        )
        assert membership.member_role == "instructor"
        assert membership.status == "active"


def test_failed_job_retry_respects_retryability(workspace, monkeypatch):
    client, _db, ids = workspace
    headers = _token(ids["admin"])
    blocked = client.post(f"/api/v1/admin/jobs/{ids['blocked_job']}/retry", headers=headers)
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "not_retryable"
    assert blocked.json()["detail"]["trace_id"] == "RAG-BLOCK01"

    from app.models.entities import ProcessingJob as JobModel

    async def fake_retry(db, *, actor, document, admin=False):
        job = JobModel(
            service="rag_index",
            job_type="pdf_extraction",
            status="completed",
            document_id=document.id,
            requested_by=actor.id,
            attempts=2,
            max_attempts=3,
            retryable=False,
            trace_id="RAG-RETRY02",
        )
        db.add(job)
        document.processing_status = "completed"
        document.status = "ready"
        db.commit()
        db.refresh(job)
        return document, job

    monkeypatch.setattr(admin_api, "retry_material", fake_retry)
    retried = client.post(f"/api/v1/admin/jobs/{ids['retryable_job']}/retry", headers=headers)
    assert retried.status_code == 200, retried.text
    assert retried.json()["job"]["status"] == "completed"


def test_configuration_version_conflict_and_validation(workspace):
    client, db_session, ids = workspace
    headers = _token(ids["admin"])
    settings_payload = client.get("/api/v1/admin/settings", headers=headers).json()
    group = next(group for group in settings_payload["groups"] if group["service"] == "processing")
    setting = next(item for item in group["settings"] if item["key"] == "job_retry_limit")

    conflict = client.patch(
        "/api/v1/admin/settings/job_retry_limit",
        headers=headers,
        json={"value": 4, "expected_version": setting["version"] + 7},
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "version_conflict"
    assert conflict.json()["detail"]["latest"]["version"] == setting["version"]

    invalid = client.patch(
        "/api/v1/admin/settings/job_retry_limit",
        headers=headers,
        json={"value": 99, "expected_version": setting["version"]},
    )
    assert invalid.status_code == 422
    assert invalid.json()["detail"]["code"] == "invalid_value"

    saved = client.patch(
        "/api/v1/admin/settings/job_retry_limit",
        headers=headers,
        json={"value": 4, "expected_version": setting["version"]},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["setting"]["version"] == setting["version"] + 1
    assert saved.json()["setting"]["last_editor"] == "Admin"
    with db_session() as db:
        stored = db.query(PlatformSetting).filter(PlatformSetting.key == "job_retry_limit").one()
        assert stored.value == 4
        audit = db.query(AuditEvent).filter(AuditEvent.action == "setting.updated").first()
        assert audit is not None


def test_admin_creates_course_and_duplicate_code_is_rejected(workspace):
    client, _db_session, ids = workspace
    headers = _token(ids["admin"])
    code = f"VERIFY-{uuid.uuid4().hex[:8]}".upper()
    created = client.post(
        "/api/v1/admin/courses",
        headers=headers,
        json={"code": code.lower(), "title": "Workspace verification", "description": "Course setup test"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["course"]["code"] == code
    listed = client.get("/api/v1/admin/courses", headers=headers)
    assert listed.status_code == 200
    assert any(course["code"] == code for course in listed.json()["courses"])
    duplicate = client.post(
        "/api/v1/admin/courses", headers=headers, json={"code": code, "title": "Another course"}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["field"] == "code"
    forbidden = client.post(
        "/api/v1/admin/courses", headers=_token(ids["faculty"]), json={"code": "NOPE", "title": "No access"}
    )
    assert forbidden.status_code == 403


def test_prediction_history_counts_distinct_prior_tasks_not_retries(workspace):
    _client, db_session, ids = workspace
    with db_session() as db:
        student = db.get(Profile, ids["student"])
        target = db.get(LearningActivity, ids["published"])
        source = (
            db.query(ActivityAttempt)
            .filter(ActivityAttempt.student_id == ids["student"], ActivityAttempt.activity_id == target.id)
            .first()
        )
        assert prior_graded_task_count(db, student, target, source) == 1
        assert not has_required_prediction_history(db, student, target, source)
        retry = ActivityAttempt(
            student_id=student.id, activity_id=target.id, attempt_number=2,
            passed_test_cases=0, total_test_cases=1, score_percentage=0,
            is_successful=False, xp_awarded=0,
        )
        db.add(retry)
        db.flush()
        assert prior_graded_task_count(db, student, target, retry) == 1
        assert not has_required_prediction_history(db, student, target, retry)
        setting = db.query(PlatformSetting).filter(PlatformSetting.key == "prediction_min_history").one()
        setting.value = 1
        db.flush()
        assert has_required_prediction_history(db, student, target, retry)


def test_deactivation_blocks_the_account_and_self_deactivation_is_refused(workspace):
    client, _db, ids = workspace
    admin_headers = _token(ids["admin"])
    impact = client.get(f"/api/v1/admin/accounts/{ids['student']}/impact", headers=admin_headers)
    assert impact.status_code == 200
    assert "lose access" in impact.json()["effect"]

    unconfirmed = client.post(
        f"/api/v1/admin/accounts/{ids['student']}/deactivate", headers=admin_headers, json={"confirm": False}
    )
    assert unconfirmed.status_code == 422

    confirmed = client.post(
        f"/api/v1/admin/accounts/{ids['student']}/deactivate", headers=admin_headers, json={"confirm": True}
    )
    assert confirmed.status_code == 200
    blocked = client.get("/api/v1/profile/me", headers=_token(ids["student"]))
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "account_deactivated"

    self_block = client.post(
        f"/api/v1/admin/accounts/{ids['admin']}/deactivate", headers=admin_headers, json={"confirm": True}
    )
    assert self_block.status_code == 409
    assert self_block.json()["detail"]["code"] == "self_deactivation"


def test_monitoring_reports_real_states_and_audit_is_searchable(workspace):
    client, _db, ids = workspace
    headers = _token(ids["admin"])
    monitoring = client.get("/api/v1/admin/monitoring", headers=headers)
    assert monitoring.status_code == 200, monitoring.text
    body = monitoring.json()
    assert [service["service"] for service in body["services"]] == [
        "api", "rag_index", "code_runner", "grading_worker", "judge0", "prediction",
    ]
    rag = next(service for service in body["services"] if service["service"] == "rag_index")
    assert rag["status"] == "failed"
    assert rag["trace_id"]
    assert body["job_counts"]["failed"] >= 2
    states = {service["status"] for service in body["services"]}
    assert states <= {"healthy", "stale", "failed", "unavailable", "off"}
    # Shadow scoring is disabled on purpose here: that is "off", not a fault.
    prediction = next(service for service in body["services"] if service["service"] == "prediction")
    assert prediction["status"] == "off"
    counts = client.get("/api/v1/admin/dashboard", headers=headers).json()["counts"]
    assert counts["total_services"] == len(body["services"]) - 1, "an 'off' service is not counted as unhealthy"

    filtered = client.get("/api/v1/admin/monitoring?status=failed", headers=headers).json()
    assert all(job["status"] == "failed" for job in filtered["jobs"])
    assert filtered["job_counts"]["failed"] == len(filtered["jobs"])

    audit = client.get("/api/v1/admin/audit?search=setting", headers=headers)
    assert audit.status_code == 200
    assert isinstance(audit.json()["items"], list)


@pytest.mark.parametrize("worker_running", [False, True])
def test_monitoring_distinguishes_worker_and_sandbox_outages(workspace, monkeypatch, worker_running):
    client, make_session, ids = workspace
    with make_session() as db:
        record_grading_worker_heartbeat(db)
        record_grading_worker_heartbeat(db)
        if not worker_running:
            db.get(GradingWorkerHeartbeat, 1).seen_at = datetime.now(timezone.utc) - timedelta(minutes=2)
        db.commit()

    if worker_running:
        async def sandbox_unavailable():
            raise Judge0UnavailableError("private sandbox details")

        monkeypatch.setattr(judge0_client, "check_execution", sandbox_unavailable)

    response = client.get("/api/v1/admin/monitoring", headers=_token(ids["admin"]))
    assert response.status_code == 200
    states = {service["service"]: service["status"] for service in response.json()["services"]}
    assert states["api"] == "healthy"
    assert states["grading_worker"] == ("healthy" if worker_running else "stale")
    assert states["judge0"] == ("failed" if worker_running else "healthy")
    assert "private sandbox details" not in response.text


def _consent(monkeypatch, db_session, student_id, version="test-v1"):
    monkeypatch.setattr(settings, "RESEARCH_CONSENT_ACTIVE", True)
    monkeypatch.setattr(settings, "RESEARCH_CONSENT_VERSION", version)
    with db_session() as db:
        db.add(ResearchConsent(student_id=student_id, document_version=version, choice="accepted"))
        db.commit()


def test_shadow_saves_first_submission_forecasts_and_blank_features_as_null(workspace, monkeypatch):
    _client, db_session, ids = workspace
    for flag in ("ML_SHADOW_ENABLED", "ML_SHADOW_RESEARCH_APPROVED"):
        monkeypatch.setattr(settings, flag, True)
    monkeypatch.setattr(settings, "RESEARCH_CONSENT_TEXT", "Synthetic consent text")
    _consent(monkeypatch, db_session, ids["student"])
    monkeypatch.setattr(shadow_service, "get_setting_int", lambda *_args: 1)
    features = dict.fromkeys(FEATURE_NAMES, math.nan) | {"prior_attempt_count": 1.0}
    monkeypatch.setattr(shadow_service, "predict_student_success", lambda *_args, **_kwargs: PredictionResult(
        features=features, logreg_probability=0.7, logreg_prediction=True, rf_probability=0.3,
        rf_prediction=False, recommended_action="advance_next_level", model_version="v3-test",
        selected_model="logreg"))
    with db_session() as db:
        target = LearningActivity(course_id=ids["course_a"], created_by=ids["faculty"],
            activity_type=ActivityKind.challenge, language=ProgrammingLang.python, topic_concept="loops",
            title="Next challenge", review_status=ReviewState.published, sequence_order=2)
        db.add(target)
        db.commit()
        student = db.get(Profile, ids["student"])
        source = db.query(ActivityAttempt).filter_by(student_id=student.id, activity_id=ids["published"]).one()
        assert shadow_service.record_shadow_prediction(
            db, student=student, target_activity_id=target.id, source_attempt=source, shadow_ready=True)
        saved = db.query(MLPrediction).filter_by(student_id=student.id, target_activity_id=target.id).one()
        # JSONB has no NaN, so a feature without history is stored as null.
        assert saved.features_snapshot_json["prior_pass_rate"] is None
        assert saved.features_snapshot_json["prior_attempt_count"] == 1.0

        # Once the challenge is submitted, a retry is never scored as a first submission.
        first_try = ActivityAttempt(student_id=student.id, activity_id=target.id, attempt_number=1,
                                    score_percentage=0, is_successful=False)
        db.add(first_try)
        db.commit()
        assert not shadow_service.record_shadow_prediction(
            db, student=student, target_activity_id=target.id, source_attempt=first_try, shadow_ready=True)
        assert db.query(MLPrediction).filter_by(student_id=student.id, target_activity_id=target.id).count() == 1


def test_ml_period_filter_narrows_history_without_changing_eligibility(workspace):
    client, db_session, ids = workspace
    headers = _token(ids["faculty"])
    with db_session() as db:
        db.add(ActivityAttempt(
            student_id=ids["student"], activity_id=ids["published"], attempt_number=2,
            passed_test_cases=0, total_test_cases=1, score_percentage=10, is_successful=False,
            created_at=datetime.now(timezone.utc) - timedelta(days=100)))
        db.commit()

    everything = client.get(f"/api/v1/faculty/ml?course_id={ids['course_a']}&period=all", headers=headers)
    recent = client.get(f"/api/v1/faculty/ml?course_id={ids['course_a']}&period=7d", headers=headers)
    assert everything.status_code == 200 and recent.status_code == 200
    assert everything.json()["summary"]["graded_events"] == 2
    assert recent.json()["summary"]["graded_events"] == 1
    assert everything.json()["students"][0]["result_count"] == 2
    assert recent.json()["students"][0]["result_count"] == 1
    # Eligibility, target selection and model inputs ignore the reporting window.
    assert (everything.json()["students"][0]["forecast_status"]
            == recent.json()["students"][0]["forecast_status"])
    assert recent.json()["aggregation_timezone"] == "UTC"
    assert client.get(f"/api/v1/faculty/ml?course_id={ids['course_a']}&period=nonsense",
                      headers=headers).status_code == 422


def test_ml_student_detail_is_scoped_to_an_enrolled_learner(workspace):
    client, _db, ids = workspace
    headers = _token(ids["faculty"])
    detail = client.get(
        f"/api/v1/faculty/ml/students/{ids['student']}?course_id={ids['course_a']}", headers=headers)
    assert detail.status_code == 200
    body = detail.json()
    assert body["student"]["student_id"] == str(ids["student"])
    assert body["evidence"]["prior_tasks_required"] >= 1
    assert "features_snapshot" not in detail.text and "pseudonym_id" not in detail.text

    assert client.get(
        f"/api/v1/faculty/ml/students/{ids['other_student']}?course_id={ids['course_a']}",
        headers=headers).status_code == 404
    assert client.get(
        f"/api/v1/faculty/ml/students/{ids['student']}?course_id={ids['course_b']}",
        headers=headers).status_code == 403
    assert client.get(
        f"/api/v1/faculty/ml/students/{ids['student']}?course_id={ids['course_a']}",
        headers=_token(ids["student"])).status_code == 403
    assert client.get(
        f"/api/v1/faculty/ml/students/{ids['student']}?course_id={ids['course_a']}",
        headers=_token(ids["other_faculty"])).status_code == 403


def test_ml_evaluation_keeps_model_versions_apart_and_scores_both_models(workspace, monkeypatch):
    client, db_session, ids = workspace
    headers = _token(ids["faculty"])
    _consent(monkeypatch, db_session, ids["student"])
    now = datetime.now(timezone.utc)
    with db_session() as db:
        pending_target = LearningActivity(course_id=ids["course_a"], created_by=ids["faculty"],
            activity_type=ActivityKind.challenge, language=ProgrammingLang.python, topic_concept="arithmetic",
            title="Pending challenge", review_status=ReviewState.published, sequence_order=2)
        db.add(pending_target)
        db.flush()
        db.add_all([
            # An earlier snapshot for the same learner and challenge: only the
            # latest one counts, so this wrong logreg call never enters accuracy.
            MLPrediction(student_id=ids["student"], target_activity_id=ids["published"],
                         features_snapshot_json={}, logreg_prob=0.2, logreg_pred=False,
                         rf_prob=0.2, rf_pred=False, model_version="v2-test",
                         selected_model="logreg", actual_outcome=True,
                         created_at=now - timedelta(minutes=5)),
            # Active version: one correct for logreg, wrong for the forest.
            MLPrediction(student_id=ids["student"], target_activity_id=ids["published"],
                         features_snapshot_json={}, logreg_prob=0.8, logreg_pred=True,
                         rf_prob=0.2, rf_pred=False, model_version="v2-test",
                         selected_model="logreg", actual_outcome=True, created_at=now),
            # Active version, still pending: excluded from accuracy.
            MLPrediction(student_id=ids["student"], target_activity_id=pending_target.id,
                         features_snapshot_json={}, logreg_prob=0.6, logreg_pred=True,
                         rf_prob=0.6, rf_pred=True, model_version="v2-test",
                         selected_model="logreg", actual_outcome=None),
            # Older version must never be pooled with the active one.
            MLPrediction(student_id=ids["student"], target_activity_id=ids["published"],
                         features_snapshot_json={}, logreg_prob=0.1, logreg_pred=False,
                         rf_prob=0.1, rf_pred=False, model_version="v1-test",
                         selected_model="logreg", actual_outcome=True),
        ])
        db.commit()
    monkeypatch.setattr(app.state, "model_version", "v2-test")

    body = client.get(f"/api/v1/faculty/ml/evaluation?course_id={ids['course_a']}",
                      headers=headers).json()
    observed = body["observed"]
    assert observed["selected_version"] == "v2-test"
    assert sorted(observed["versions"]) == ["v1-test", "v2-test"]
    assert observed["total_predictions"] == 2
    assert observed["awaiting_outcome"] == 1
    assert observed["labeled_predictions"] == 1
    assert observed["unit"] == "learner-challenge predictions"
    assert observed["models"]["logreg"]["accuracy_percent"] == 100.0
    assert observed["models"]["random_forest"]["accuracy_percent"] == 0.0

    older = client.get(
        f"/api/v1/faculty/ml/evaluation?course_id={ids['course_a']}&model_version=v1-test",
        headers=headers).json()
    assert older["observed"]["total_predictions"] == 1
    assert client.get(
        f"/api/v1/faculty/ml/evaluation?course_id={ids['course_a']}&model_version=v9-missing",
        headers=headers).status_code == 404
    assert client.get(f"/api/v1/faculty/ml/evaluation?course_id={ids['course_b']}",
                      headers=headers).status_code == 403
    assert client.get(f"/api/v1/faculty/ml/evaluation?course_id={ids['course_a']}",
                      headers=_token(ids["student"])).status_code == 403


def test_ml_evaluation_excludes_learners_without_current_consent(workspace, monkeypatch):
    client, db_session, ids = workspace
    headers = _token(ids["faculty"])
    _consent(monkeypatch, db_session, ids["student"])
    with db_session() as db:
        db.add(MLPrediction(student_id=ids["student"], target_activity_id=ids["published"],
                            features_snapshot_json={}, logreg_prob=0.8, logreg_pred=True,
                            rf_prob=0.8, rf_pred=True, model_version="v2-test",
                            selected_model="logreg", actual_outcome=True))
        db.commit()
    assert client.get(f"/api/v1/faculty/ml/evaluation?course_id={ids['course_a']}",
                      headers=headers).json()["observed"]["total_predictions"] == 1

    # A newer consent document version withdraws the old acceptance.
    monkeypatch.setattr(settings, "RESEARCH_CONSENT_VERSION", "test-v2")
    assert client.get(f"/api/v1/faculty/ml/evaluation?course_id={ids['course_a']}",
                      headers=headers).json()["observed"]["total_predictions"] == 0


def test_ml_evaluation_is_honest_without_an_approved_model_report(workspace):
    client, _db, ids = workspace
    body = client.get(f"/api/v1/faculty/ml/evaluation?course_id={ids['course_a']}",
                      headers=_token(ids["faculty"])).json()
    assert body["offline"] == {"status": "unavailable", "report": None}
    assert body["observed"]["versions"] == []
    assert body["observed"]["selected_version"] is None
    assert body["thresholds"]["decision"] == 0.5


def test_ml_reads_never_record_a_prediction(workspace, monkeypatch):
    client, db_session, ids = workspace
    headers = _token(ids["faculty"])
    _consent(monkeypatch, db_session, ids["student"])
    with db_session() as db:
        before = db.query(MLPrediction).count()
    for path in (
        f"/api/v1/faculty/ml?course_id={ids['course_a']}",
        f"/api/v1/faculty/ml/students/{ids['student']}?course_id={ids['course_a']}",
        f"/api/v1/faculty/ml/evaluation?course_id={ids['course_a']}",
    ):
        assert client.get(path, headers=headers).status_code == 200
    with db_session() as db:
        assert db.query(MLPrediction).count() == before


def test_offline_report_allowlist_drops_paths_and_training_internals():
    from app.services.ml_predictor.predictor import _sanitized_report

    report = _sanitized_report({
        "model_version": "v2",
        "artifact_directory": "runs/v2",
        "features": ["prior_attempts"],
        "scikit_learn_version": "1.5.0",
        "selection": {"winner": "logreg"},
        "models": {"logreg": {
            "best_parameters": {"C": 1.0},
            "train": {"accuracy": 1.0},
            "validation": {"accuracy": 0.7},
            "test": {"accuracy": 0.68, "confusion_matrix": [[1, 2], [3, 4]]},
        }},
        "baselines": {"most_frequent": {"test": {"accuracy": 0.6}}},
    })
    for leaked in ("artifact_directory", "features", "scikit_learn_version"):
        assert leaked not in report
    assert set(report["models"]["logreg"]) == {"validation", "test"}
    assert "best_parameters" not in report["models"]["logreg"]
    assert report["models"]["logreg"]["test"]["confusion_matrix"] == [[1, 2], [3, 4]]
    assert report["baselines"]["most_frequent"]["test"]["accuracy"] == 0.6
    assert report["selection"] == {"winner": "logreg"}


def test_gamification_insights_are_course_scoped_class_aggregates(workspace):
    client, new_session, ids = workspace
    now = datetime.now(timezone.utc)
    with new_session() as db:
        def challenge(topic: str, order: int) -> LearningActivity:
            activity = LearningActivity(
                course_id=ids["course_a"], created_by=ids["faculty"], activity_type=ActivityKind.challenge,
                language=ProgrammingLang.python, topic_concept=topic, title=f"{topic} task",
                problem_statement="Practice task.", reference_solution_code="print(1)", difficulty_level=1,
                xp_reward=40, review_status=ReviewState.published, judge0_verified=True, sequence_order=order,
            )
            db.add(activity)
            db.flush()
            return activity

        def attempt(activity, number, passed, category, at):
            db.add(ActivityAttempt(student_id=ids["student"], activity_id=activity.id, attempt_number=number,
                                   passed_test_cases=int(passed), total_test_cases=1, score_percentage=100 if passed else 0,
                                   is_successful=passed, error_category=category, created_at=at))

        loops, strings = challenge("loops", 2), challenge("strings", 3)
        attempt(loops, 1, False, "logic_error", now - timedelta(days=8))     # first practice day: week 0
        attempt(loops, 2, False, "runtime_error", now - timedelta(days=1))   # still not passed: stuck
        attempt(strings, 1, False, "syntax_error", now - timedelta(days=3))
        db.add(HintUse(student_id=ids["student"], activity_id=strings.id, request_key="insight-hint-0001",
                       source="reviewed", body="Check your quotes.", created_at=now - timedelta(days=2)))
        attempt(strings, 2, True, "none", now - timedelta(days=1))           # recovery after trying, then a hint

        def review(concept, stage, status, xp=0):
            done = status != "open"
            db.add(ConceptReview(
                student_id=ids["student"], language=ProgrammingLang.python, concept=concept, stage=stage, status=status,
                question_refs=[{"activity_id": str(uuid.uuid4()), "question_index": index} for index in range(3)],
                total=3, correct=(3 if status == "passed" else 1) if done else None, xp_awarded=xp,
                answers_json={"answers": {}} if done else None, submitted_at=now - timedelta(days=1) if done else None,
            ))

        review("loops", 0, "passed", xp=10)
        review("loops", 1, "not_passed")
        review("strings", 0, "open")            # open recalls are not results yet
        review("not in this course", 0, "passed", xp=10)
        db.commit()

    headers = _token(ids["faculty"])
    response = client.get(f"/api/v1/faculty/gamification-insights?course_id={ids['course_a']}", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["enrolled"], body["active"]) == (1, 1)
    # Week 0: two failures. Week 1: a failure, two passes (fixture pass included) and two recalls.
    assert [(row["week"], row["eligible"], row["active"], row["events"]) for row in body["weekly"]] == [
        (0, 1, 1, 2), (1, 1, 1, 5)]
    assert body["solve_quality"] == {"solved": 2, "stars": {"1": 1, "2": 0, "3": 1}, "self_solved_rate": 0.5}
    assert body["help_seeking"] == {"hinted": 1, "tried_before_hint": 1, "rate": 1.0}
    topics = {row["topic"]: row for row in body["topics"]}
    assert [row["topic"] for row in body["topics"]] == ["loops", "strings"]  # stuck learners first
    assert (topics["loops"]["students_struggling"], topics["loops"]["students_stuck"]) == (1, 1)
    loops_counts = {row["category"]: (row["failed_tries"], row["recoveries"]) for row in topics["loops"]["categories"]}
    assert loops_counts["logic_error"] == (1, 0) and loops_counts["runtime_error"] == (1, 0)
    strings_counts = {row["category"]: (row["failed_tries"], row["recoveries"]) for row in topics["strings"]["categories"]}
    assert strings_counts["syntax_error"] == (1, 1) and topics["strings"]["students_stuck"] == 0
    assert (body["memory"]["submitted"], body["memory"]["passed"], body["memory"]["pass_rate"]) == (2, 1, 0.5)
    assert [(row["stage"], row["submitted"], row["passed"]) for row in body["memory"]["stages"][:2]] == [(0, 1, 1), (1, 1, 0)]

    # Aggregates only: no student identity is ever in the payload.
    for secret in (str(ids["student"]), "test_student", "Student"):
        assert secret not in response.text
    # Same scope as Performance: assigned instructors only, never another course, a student or an admin.
    assert client.get(f"/api/v1/faculty/gamification-insights?course_id={ids['course_b']}", headers=headers).status_code == 403
    assert client.get(f"/api/v1/faculty/gamification-insights?course_id={ids['course_a']}",
                      headers=_token(ids["student"])).status_code == 403
    assert client.get(f"/api/v1/faculty/gamification-insights?course_id={ids['course_a']}",
                      headers=_token(ids["admin"])).status_code == 403


def test_admin_course_health_suppresses_small_groups_and_restricts_access(workspace):
    client, _, ids = workspace
    path = "/api/v1/admin/course-health"
    for role in ("faculty", "student"):
        assert client.get(path, headers=_token(ids[role])).status_code == 403
    result = client.get(path, headers=_token(ids["admin"])).json()
    assert set(result) == {"generated_at", "forecast_status", "courses"}
    row = next(r for r in result["courses"] if r["id"] == str(ids["course_a"]))
    assert set(row) == {"id","code","title","course_status","status","instructor_count","instructors",
                        "enrolled","published_activities","active_7d","not_started","activities_passed","research_consent"}
    assert row["enrolled"] == 1 and row["published_activities"] > 0 and row["status"] == "insufficient_data"
    assert all(row[k] is None for k in ("active_7d","not_started","activities_passed","research_consent"))
    assert str(ids["student"]) not in str(result)
    created = client.post("/api/v1/admin/courses", headers=_token(ids["admin"]),
                          json={"code": "QA-" + uuid.uuid4().hex[:8], "title": "Empty course"}).json()["course"]
    rows = client.get(path, headers=_token(ids["admin"])).json()["courses"]
    empty = next(r for r in rows if r["id"] == created["id"])
    assert (empty["instructor_count"], empty["enrolled"], empty["published_activities"]) == (0, 0, 0)
    assert empty["research_consent"] is None


def test_material_upload_obeys_the_admin_upload_limit(workspace):
    """Admins set one PDF size limit, and the faculty upload path enforces it."""
    client, sessions, ids = workspace
    with sessions() as db:
        db.execute(text("update public.platform_settings set value = '1'::jsonb where key = 'pdf_upload_max_mb'"))
        db.commit()
    oversized = b"%PDF-1.4" + bytes(10) + b"0" * (1024 * 1024 + 512 * 1024)
    response = client.post("/api/v1/faculty/materials", headers=_token(ids["faculty"]),
        data={"course_id": str(ids["course_a"]), "title": "Loops lesson", "language_tag": "python"},
        files={"file": ("loops.pdf", oversized, "application/pdf")})
    assert response.status_code == 413, response.text
    assert response.json()["detail"]["code"] == "file_too_large"


def test_studio_generation_is_limited_to_course_instructors(workspace):
    """Academic authoring stays with assigned faculty; administrators use the admin routes."""
    client, _, ids = workspace
    assert client.get("/api/v1/instructor/workspace", headers=_token(ids["admin"])).status_code == 403
    assert client.get("/api/v1/instructor/workspace", headers=_token(ids["faculty"])).status_code == 200

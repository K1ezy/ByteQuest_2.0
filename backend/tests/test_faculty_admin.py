"""Role, course-scope, approval, locking, account and recovery checks.

These tests exercise the real FastAPI routes against local Supabase
PostgreSQL. Every record is created inside one outer transaction that is rolled
back, so the developer's existing accounts and school data are untouched.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.api import admin as admin_api
from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.services.ml_predictor.shadow import has_required_prediction_history, prior_graded_task_count
from app.models.entities import (
    ActivityAttempt,
    ActivityKind,
    AuditEvent,
    Course,
    CourseMember,
    DocumentChunk,
    InstructionalDocument,
    LearningActivity,
    PlatformSetting,
    ProcessingJob,
    Profile,
    ProgrammingLang,
    ReviewState,
    TestCase as GradingCase,
    UserRole,
)

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

    forbidden = client.get(f"/api/v1/faculty/dashboard?course_id={ids['course_b']}", headers=headers)
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"]["code"] == "course_forbidden"

    other_draft = client.get(f"/api/v1/faculty/drafts/{ids['other_draft']}", headers=headers)
    assert other_draft.status_code == 403


def test_administrator_cannot_use_academic_faculty_routes(workspace):
    client, _db, ids = workspace
    headers = _token(ids["admin"])
    for path in (f"/api/v1/faculty/drafts/{ids['draft']}", "/api/v1/faculty/dashboard"):
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
    assert body["queue_hrefs"]["drafts"] == f"/faculty/review?course={ids['course_a']}&status=open"

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


def test_performance_is_course_scoped_and_prediction_is_advisory(workspace):
    client, db_session, ids = workspace
    headers = _token(ids["faculty"])
    performance = client.get(f"/api/v1/faculty/performance?course_id={ids['course_a']}", headers=headers)
    assert performance.status_code == 200, performance.text
    body = performance.json()
    assert [row["student_id"] for row in body["students"]] == [str(ids["student"])]
    assert body["students"][0]["prediction"]["status"] == "unavailable"
    assert "No saved next-task prediction" in body["students"][0]["prediction"]["reason"]

    detail = client.get(
        f"/api/v1/faculty/performance/students/{ids['student']}?course_id={ids['course_a']}", headers=headers
    )
    assert detail.status_code == 200
    assert detail.json()["attempts"][0]["score_percentage"] == 100.0

    cross_course = client.get(
        f"/api/v1/faculty/performance/students/{ids['other_student']}?course_id={ids['course_a']}", headers=headers
    )
    assert cross_course.status_code == 404


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
    assert [service["service"] for service in body["services"]] == ["api", "rag_index", "code_runner", "prediction"]
    rag = next(service for service in body["services"] if service["service"] == "rag_index")
    assert rag["status"] == "failed"
    assert rag["trace_id"]
    assert body["job_counts"]["failed"] >= 2
    states = {service["status"] for service in body["services"]}
    assert states <= {"healthy", "stale", "failed", "unavailable"}

    filtered = client.get("/api/v1/admin/monitoring?status=failed", headers=headers).json()
    assert all(job["status"] == "failed" for job in filtered["jobs"])
    assert filtered["job_counts"]["failed"] == len(filtered["jobs"])

    audit = client.get("/api/v1/admin/audit?search=setting", headers=headers)
    assert audit.status_code == 200
    assert isinstance(audit.json()["items"], list)

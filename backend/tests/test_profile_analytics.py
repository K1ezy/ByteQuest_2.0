"""Profile analytics: role isolation, course scoping, personal timelines and priority.

These reuse the faculty/admin workspace fixture so the profile and the
dashboards are exercised against identical seed data. Every record lives in one
outer transaction that is rolled back.
"""

from __future__ import annotations

import uuid

import pytest

from app.models.entities import AuditEvent, ProcessingJob, UserRole

from test_faculty_admin import _token, workspace  # noqa: F401  (fixture re-export)

pytestmark = pytest.mark.integration


def _analytics(client, user_id: uuid.UUID) -> dict:
    response = client.get("/api/v1/profile/me/analytics", headers=_token(user_id))
    assert response.status_code == 200, response.text
    return response.json()


def _add_audit(db, *, actor_id, action: str, summary: str, role: str = "instructor") -> None:
    db.add(
        AuditEvent(
            actor_id=actor_id,
            actor_role=role,
            action=action,
            entity_type="activity",
            entity_id=str(uuid.uuid4()),
            summary=summary,
            metadata_json={},
        )
    )


def test_each_role_receives_only_its_own_branch(workspace):  # noqa: F811
    client, _new_session, ids = workspace

    student = _analytics(client, ids["student"])
    assert student["role"] == "student"
    assert student["student"] is not None
    assert student["instructor"] is None and student["admin"] is None

    faculty = _analytics(client, ids["faculty"])
    assert faculty["role"] == "instructor"
    assert faculty["instructor"] is not None
    assert faculty["student"] is None and faculty["admin"] is None

    admin = _analytics(client, ids["admin"])
    assert admin["role"] == "admin"
    assert admin["admin"] is not None
    assert admin["student"] is None and admin["instructor"] is None


def test_existing_instructor_fields_remain_compatible(workspace):  # noqa: F811
    client, _new_session, ids = workspace
    instructor = _analytics(client, ids["faculty"])["instructor"]

    for field in (
        "courses",
        "activities_created",
        "activities_published",
        "drafts_reviewed",
        "materials_uploaded",
        "learners_taught",
    ):
        assert field in instructor, f"{field} must stay in the response"
        assert isinstance(instructor[field], int)

    # Additive fields.
    assert set(instructor["attention"]) == {
        "drafts_awaiting_review",
        "materials_needing_attention",
        "upcoming_activities",
    }
    assert set(instructor["next_action"]) == {"kind", "title", "detail", "status", "href"}
    assert isinstance(instructor["recent_activity"], list)


def test_existing_admin_fields_remain_compatible(workspace):  # noqa: F811
    client, _new_session, ids = workspace
    admin = _analytics(client, ids["admin"])["admin"]

    for field in (
        "total_accounts",
        "accounts_by_role",
        "total_courses",
        "total_activities",
        "total_materials",
        "recent_audit",
    ):
        assert field in admin, f"{field} must stay in the response"

    assert set(admin["attention"]) == {
        "accounts_needing_action",
        "failed_jobs",
        "availability_changes",
    }
    assert set(admin["next_action"]) == {"kind", "title", "detail", "status", "href"}
    # The platform-wide audit stays separate from the personal timeline.
    assert "recent_audit" in admin and "recent_activity" in admin


def test_faculty_attention_covers_only_assigned_courses(workspace):  # noqa: F811
    """The other instructor owns a separate course; its items must not leak."""
    client, _new_session, ids = workspace

    faculty = _analytics(client, ids["faculty"])["instructor"]
    other = _analytics(client, ids["other_faculty"])["instructor"]

    # The seeded scanned PDF belongs to the first faculty member's course.
    assert faculty["attention"]["materials_needing_attention"] >= 1
    assert other["attention"]["materials_needing_attention"] == 0

    # Highest priority for this faculty member is the attention-required material.
    assert faculty["next_action"]["kind"] == "material"
    assert other["next_action"]["kind"] != "material"


def test_personal_timeline_only_includes_own_actions(workspace):  # noqa: F811
    client, new_session, ids = workspace

    with new_session() as db:
        _add_audit(db, actor_id=ids["faculty"], action="activity.published", summary="Mine: published a quiz")
        _add_audit(
            db,
            actor_id=ids["other_faculty"],
            action="activity.published",
            summary="Theirs: published a quiz",
        )
        _add_audit(db, actor_id=ids["admin"], action="account.created", summary="Admin: created an account", role="admin")
        db.commit()

    faculty_activity = _analytics(client, ids["faculty"])["instructor"]["recent_activity"]
    summaries = [entry["summary"] for entry in faculty_activity]
    assert "Mine: published a quiz" in summaries
    assert "Theirs: published a quiz" not in summaries
    assert "Admin: created an account" not in summaries

    admin_payload = _analytics(client, ids["admin"])["admin"]
    admin_summaries = [entry["summary"] for entry in admin_payload["recent_activity"]]
    assert "Admin: created an account" in admin_summaries
    assert "Mine: published a quiz" not in admin_summaries
    assert "Theirs: published a quiz" not in admin_summaries

    # The platform-wide audit is deliberately NOT actor filtered.
    platform_summaries = [entry["summary"] for entry in admin_payload["recent_audit"]]
    assert any("published a quiz" in summary for summary in platform_summaries)


def test_admin_priority_puts_failed_jobs_first(workspace):  # noqa: F811
    client, new_session, ids = workspace

    before = _analytics(client, ids["admin"])["admin"]
    baseline_failed = before["attention"]["failed_jobs"]

    with new_session() as db:
        db.add(
            ProcessingJob(
                service="rag",
                job_type="pdf_ingest",
                status="failed",
                cause="Text extraction crashed during the test run.",
                trace_id=f"trace-{uuid.uuid4().hex[:10]}",
            )
        )
        db.commit()

    after = _analytics(client, ids["admin"])["admin"]
    assert after["attention"]["failed_jobs"] == baseline_failed + 1
    assert after["next_action"]["kind"] == "job"
    assert after["next_action"]["href"].startswith("/admin/monitoring")


def test_faculty_without_courses_gets_a_calm_fallback(workspace):  # noqa: F811
    """A faculty member with no assigned course sees zeros, not an error."""
    client, new_session, ids = workspace

    with new_session() as db:
        from app.models.entities import CourseMember

        db.query(CourseMember).filter(
            CourseMember.profile_id == ids["other_faculty"],
            CourseMember.member_role == "instructor",
        ).delete(synchronize_session=False)
        db.commit()

    instructor = _analytics(client, ids["other_faculty"])["instructor"]
    assert instructor["attention"] == {
        "drafts_awaiting_review": 0,
        "materials_needing_attention": 0,
        "upcoming_activities": 0,
    }
    assert instructor["next_action"]["kind"] == "workspace"
    assert instructor["next_action"]["href"] == "/faculty"


def test_student_branch_has_no_staff_fields(workspace):  # noqa: F811
    """Students must never receive faculty or admin operational data."""
    client, _new_session, ids = workspace
    payload = _analytics(client, ids["student"])

    assert payload["instructor"] is None
    assert payload["admin"] is None
    student = payload["student"]
    # Students have their own learning next_action; staff operational data must not leak.
    for leaked in ("attention", "recent_activity", "accounts_by_role", "recent_audit"):
        assert leaked not in student, f"{leaked} must not appear on the student branch"
    assert student["next_action"]["kind"] != "job"

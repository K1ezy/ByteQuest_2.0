"""Administrator operations API.

Administrators manage accounts, course assignments, operational material and
activity availability, configuration, and monitoring. Academic draft approval,
answer keys, hidden tests and grade overrides are deliberately absent.
"""

from __future__ import annotations

import re
import uuid
from urllib.parse import quote
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import (
    ActivityAttempt,
    AuditEvent,
    Course,
    CourseMember,
    InstructionalDocument,
    LearningActivity,
    ProcessingJob,
    Profile,
    ProgrammingLang,
    UserRole,
)
from app.services.account_provisioning import (
    DuplicateAccount,
    ProvisioningUnavailable,
    build_profile,
    delete_auth_user,
    invite_auth_user,
)
from app.services.audit import record_audit
from app.services.course_access import (
    courses_for_user,
    membership_map,
    require_administrator,
    require_course_access,
)
from app.services.materials import (
    material_draft_count,
    retry_material,
    serialize_material,
    upload_material,
)
from app.services.monitoring import (
    audit_query,
    job_query,
    overall_health,
    serialize_job,
    service_health,
)
from app.services.settings_service import list_settings, update_setting
from app.services.storage.supabase_storage import StorageError, pdf_storage
from app.services.workspace_common import (
    activity_state,
    as_aware,
    iso,
    material_state,
)
from app.services.workspace_queries import (
    account_course_access,
    account_emails,
    activity_attempt_counts,
    activity_status_counts,
    filter_activities,
    filter_materials,
    material_status_counts,
    scoped_activities,
    scoped_materials,
)

router = APIRouter(prefix="/api/v1/admin", tags=["Administration"])

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PROVISIONABLE_ROLES = {UserRole.student, UserRole.instructor, UserRole.admin}


def admin_user(user: Profile = Depends(get_current_user)) -> Profile:
    return require_administrator(user)


def _role_value(profile: Profile | None) -> str | None:
    if profile is None:
        return None
    return getattr(profile.role, "value", profile.role)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@router.get("/dashboard")
def admin_dashboard(request: Request, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    accounts = _all_accounts(db)
    attention_accounts = [account for account in accounts if account["needs_action"]]
    courses = courses_for_user(db, user, include_archived=True)
    course_lookup = {course.id: course for course in courses}
    activities = scoped_activities(db, [course.id for course in courses])
    availability = [
        activity
        for activity in filter_activities(activities, status="all")
        if activity_state(activity) in {"scheduled", "closed"}
    ]
    failed_jobs = (
        db.query(ProcessingJob)
        .filter(ProcessingJob.status == "failed")
        .order_by(ProcessingJob.created_at.desc())
        .limit(100)
        .all()
    )
    services = service_health(db, request.app.state)
    overall = overall_health(services)
    recent = audit_query(db, limit=6).all()
    actors = {
        profile.id: profile
        for profile in db.query(Profile)
        .filter(Profile.id.in_([event.actor_id for event in recent if event.actor_id] or [uuid.uuid4()]))
        .all()
    }

    queue: list[dict] = []
    for account in attention_accounts[:3]:
        queue.append(
            {
                "kind": "account",
                "id": account["account_id"],
                "title": account["email"] or account["display_name"] or account["pseudonym"],
                "detail": account["action_reason"] or "Review this account.",
                "status": "Needs action",
                "severity": "wait",
                "course": None,
                "updated_at": account["created_at"],
                "href": f"/admin/accounts?status=attention&q={quote(account['email'] or '')}",
            }
        )
    for job in failed_jobs[:3]:
        document = (
            db.query(InstructionalDocument).filter(InstructionalDocument.id == job.document_id).first()
            if job.document_id
            else None
        )
        queue.append(
            {
                "kind": "job",
                "id": str(job.id),
                "title": f"PDF processing · {document.title if document else 'material'}",
                "detail": job.cause or "The processing job failed.",
                "status": "Failed",
                "severity": "bad",
                "course": None,
                "updated_at": iso(job.created_at),
                "href": f"/admin/monitoring?status=failed&q={quote(job.trace_id)}",
            }
        )
    for activity in availability[:2]:
        course = course_lookup.get(activity.course_id)
        queue.append(
            {
                "kind": "activity",
                "id": str(activity.id),
                "title": activity.title or activity.topic_concept,
                "detail": (
                    f"{course.title if course else 'Course'} · availability is {activity_state(activity)}"
                ),
                "status": activity_state(activity).title(),
                "severity": "info" if activity_state(activity) == "scheduled" else "wait",
                "course": course_reference_brief(course),
                "updated_at": iso(activity.created_at),
                "href": f"/admin/activities?status=attention&activity={activity.id}",
            }
        )

    failed_count = (
        db.query(func.count(ProcessingJob.id)).filter(ProcessingJob.status == "failed").scalar() or 0
    )
    return {
        "counts": {
            "accounts_needing_action": len(attention_accounts),
            "failed_jobs": int(failed_count),
            "availability_changes": len(availability),
            "service_status": overall,
            "healthy_services": len([service for service in services if service["status"] == "healthy"]),
            "total_services": len(services),
        },
        "action_queue": queue[:6],
        "recent_changes": [
            {
                "id": str(event.id),
                "action": event.action,
                "summary": event.summary,
                "actor": (actors.get(event.actor_id).display_name or actors.get(event.actor_id).pseudonym_id)
                if event.actor_id in actors
                else "System",
                "created_at": iso(event.created_at),
            }
            for event in recent
        ],
        "services": services,
        "overall": overall,
    }


def course_reference_brief(course: Course | None) -> dict | None:
    if course is None:
        return None
    return {"id": str(course.id), "code": course.code, "title": course.title, "status": course.status}


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
def _membership_rows(db: Session, profile_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[CourseMember]]:
    if not profile_ids:
        return {}
    rows = (
        db.query(CourseMember)
        .filter(CourseMember.profile_id.in_(profile_ids), CourseMember.status != "removed")
        .all()
    )
    result: dict[uuid.UUID, list[CourseMember]] = {}
    for row in rows:
        result.setdefault(row.profile_id, []).append(row)
    return result


def _account_needs_action(profile: Profile, memberships: list[CourseMember]) -> tuple[bool, str | None]:
    if profile.account_status != "active":
        return False, None
    # Administrators hold platform-wide access; course assignment is not required.
    if _role_value(profile) == "admin":
        return False, None
    pending = [item for item in memberships if item.status == "pending"]
    if pending:
        return True, "A course assignment is waiting for confirmation."
    active = [item for item in memberships if item.status == "active"]
    if not active:
        return True, "No active course access yet."
    return False, None


def _serialize_account(
    profile: Profile,
    *,
    email: str | None,
    memberships: list[CourseMember],
    course_lookup: dict[uuid.UUID, Course],
) -> dict:
    needs_action, reason = _account_needs_action(profile, memberships)
    access = []
    for membership in memberships:
        course = course_lookup.get(membership.course_id)
        access.append(
            {
                "membership_id": str(membership.id),
                "course_id": str(membership.course_id),
                "course_code": course.code if course else None,
                "course_title": course.title if course else "Course",
                "member_role": membership.member_role,
                "status": membership.status,
                "assigned_at": iso(membership.assigned_at),
            }
        )
    return {
        "account_id": str(profile.id),
        "email": profile.email or email,
        "display_name": profile.display_name,
        "pseudonym": profile.pseudonym_id,
        "role": _role_value(profile),
        "account_status": profile.account_status,
        "created_at": iso(profile.created_at),
        "deactivated_at": iso(profile.deactivated_at),
        "course_access": access,
        "needs_action": needs_action,
        "action_reason": reason,
    }


def _all_accounts(db: Session, *, search: str | None = None, role: str | None = None, status_filter: str = "all") -> list[dict]:
    profiles = db.query(Profile).order_by(Profile.created_at.desc()).limit(1000).all()
    emails = account_emails(db, [profile.id for profile in profiles])
    memberships = _membership_rows(db, [profile.id for profile in profiles])
    course_lookup = {course.id: course for course in db.query(Course).all()}
    needle = (search or "").strip().casefold()
    rows: list[dict] = []
    for profile in profiles:
        serialized = _serialize_account(
            profile,
            email=emails.get(profile.id),
            memberships=memberships.get(profile.id, []),
            course_lookup=course_lookup,
        )
        if role and role != "all" and serialized["role"] != role:
            continue
        if status_filter == "attention":
            if not serialized["needs_action"]:
                continue
        elif status_filter != "all" and serialized["account_status"] != status_filter:
            continue
        if needle:
            haystack = f"{serialized['email'] or ''} {serialized['display_name'] or ''} {serialized['pseudonym'] or ''} {serialized['role']}".casefold()
            if needle not in haystack:
                continue
        rows.append(serialized)
    return rows


@router.get("/accounts")
def list_accounts(
    search: Optional[str] = None,
    role: Optional[str] = None,
    account_status: str = Query("all", alias="status"),
    user: Profile = Depends(admin_user),
    db: Session = Depends(get_db),
):
    rows = _all_accounts(db, search=search, role=role, status_filter=account_status)
    all_rows = _all_accounts(db)
    return {
        "items": rows,
        "total": len(rows),
        "counts": {
            "all": len(all_rows),
            "attention": len([row for row in all_rows if row["needs_action"]]),
            "active": len([row for row in all_rows if row["account_status"] == "active"]),
            "deactivated": len([row for row in all_rows if row["account_status"] == "deactivated"]),
        },
        "filters": {
            "roles": ["all", "student", "instructor", "admin"],
            "statuses": ["all", "attention", "active", "deactivated"],
        },
    }


@router.get("/accounts/{account_id}/impact")
def account_impact(account_id: uuid.UUID, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == account_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That account no longer exists."})
    memberships = _membership_rows(db, [profile.id]).get(profile.id, [])
    courses = {course.id: course for course in db.query(Course).all()}
    if profile.account_status != "active":
        return {
            "account": _serialize_account(profile, email=profile.email, memberships=memberships, course_lookup=courses),
            "already_deactivated": True,
            "effect": "This account is already deactivated.",
        }
    return {
        "account": _serialize_account(profile, email=profile.email, memberships=memberships, course_lookup=courses),
        "already_deactivated": False,
        "effect": (
            f"{profile.display_name or profile.pseudonym_id} will immediately lose access to "
            f"{len([m for m in memberships if m.status == 'active'])} course assignment(s). "
            "Existing materials, activity versions, attempts and audit records are preserved."
        ),
    }


class DeactivateAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: bool = False


@router.post("/accounts/{account_id}/deactivate")
def deactivate_account(
    account_id: uuid.UUID,
    payload: DeactivateAccountRequest,
    user: Profile = Depends(admin_user),
    db: Session = Depends(get_db),
):
    confirm = payload.confirm
    if account_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "self_deactivation", "message": "You cannot deactivate the account you are signed in with."},
        )
    profile = db.query(Profile).filter(Profile.id == account_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That account no longer exists."})
    if profile.account_status == "deactivated":
        raise HTTPException(status_code=409, detail={"code": "already_deactivated", "message": "That account is already deactivated."})
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "confirmation_required", "message": "Review the access impact and confirm deactivation."},
        )
    profile.account_status = "deactivated"
    profile.deactivated_at = datetime.now(timezone.utc)
    record_audit(
        db,
        actor=user,
        action="account.deactivated",
        entity_type="account",
        entity_id=profile.id,
        summary=f"Deactivated account {profile.email or profile.pseudonym_id}",
    )
    db.commit()
    return {"account_id": str(profile.id), "account_status": "deactivated", "message": "Account deactivated. Access is blocked immediately."}


@router.post("/accounts/{account_id}/reactivate")
def reactivate_account(account_id: uuid.UUID, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == account_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That account no longer exists."})
    if profile.account_status == "active":
        raise HTTPException(status_code=409, detail={"code": "already_active", "message": "That account is already active."})
    profile.account_status = "active"
    profile.deactivated_at = None
    record_audit(
        db,
        actor=user,
        action="account.reactivated",
        entity_type="account",
        entity_id=profile.id,
        summary=f"Reactivated account {profile.email or profile.pseudonym_id}",
    )
    db.commit()
    return {"account_id": str(profile.id), "account_status": "active", "message": "Account reactivated with its prior course assignments."}


class AccountCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=5, max_length=320)
    role: str = Field(default="student")
    display_name: Optional[str] = Field(None, max_length=120)
    course_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().casefold()
        if not EMAIL_PATTERN.match(value):
            raise ValueError("Enter a valid email address, for example name@example.edu.")
        return value


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate,
    user: Profile = Depends(admin_user),
    db: Session = Depends(get_db),
):
    if payload.role not in {role.value for role in PROVISIONABLE_ROLES}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_role", "field": "role", "message": "Choose student, instructor or administrator."},
        )
    if payload.email == (user.email or "").casefold():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "self_elevation", "field": "email", "message": "You cannot provision another role for your own account."},
        )
    existing = db.query(Profile).filter(func.lower(Profile.email) == payload.email).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "duplicate_email", "field": "email", "message": "An account with this email already exists."},
        )
    known_email = account_emails_for_email(db, payload.email)
    if known_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "duplicate_email", "field": "email", "message": "An account with this email already exists."},
        )

    courses: list[Course] = []
    for course_id in payload.course_ids:
        course = db.query(Course).filter(Course.id == course_id, Course.status == "active").first()
        if course is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "invalid_course", "field": "course_ids", "message": "One selected course is not available."},
            )
        courses.append(course)

    try:
        account_id = await invite_auth_user(payload.email, payload.role, payload.display_name)
    except DuplicateAccount as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "duplicate_email", "field": "email", "message": str(exc)},
        ) from exc
    except ProvisioningUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "provisioning_unavailable",
                "message": f"{exc} No account was created and your form values are unchanged.",
            },
        ) from exc

    try:
        profile = build_profile(account_id, payload.email, UserRole(payload.role), payload.display_name)
        db.add(profile)
        db.flush()
        for course in courses:
            db.add(
                CourseMember(
                    course_id=course.id,
                    profile_id=account_id,
                    member_role="instructor" if payload.role != "student" else "student",
                    status="active",
                    assigned_by=user.id,
                )
            )
        record_audit(
            db,
            actor=user,
            action="account.created",
            entity_type="account",
            entity_id=account_id,
            summary=f"Provisioned {payload.role} account {payload.email}",
            metadata={"course_ids": [str(course.id) for course in courses]},
        )
        db.commit()
    except Exception:
        db.rollback()
        await delete_auth_user(account_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "provisioning_failed", "message": "The account could not be saved. Nothing was created; try again."},
        ) from None

    return {
        "account": {
            "account_id": str(profile.id),
            "email": payload.email,
            "role": payload.role,
            "account_status": "active",
            "courses": [{"course_id": str(course.id), "title": course.title} for course in courses],
        },
        "message": f"Account created for {payload.email}. An invitation email was sent to set a password.",
    }


def account_emails_for_email(db: Session, email: str) -> bool:
    from sqlalchemy import text

    row = db.execute(
        text("SELECT 1 FROM auth.users WHERE lower(email) = :email LIMIT 1"),
        {"email": email},
    ).first()
    return row is not None


# ---------------------------------------------------------------------------
# Courses and assignments
# ---------------------------------------------------------------------------
@router.get("/courses")
def list_course_operations(user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    courses = courses_for_user(db, user, include_archived=True)
    counts = membership_map(db, [course.id for course in courses])
    activities = scoped_activities(db, [course.id for course in courses])
    materials = scoped_materials(db, [course.id for course in courses])
    return {
        "courses": [
            {
                "id": str(course.id),
                "code": course.code,
                "title": course.title,
                "description": course.description,
                "status": course.status,
                "created_at": iso(course.created_at),
                "student_count": counts.get((course.id, "student"), 0),
                "instructor_count": counts.get((course.id, "instructor"), 0),
                "activity_count": len([item for item in activities if item.course_id == course.id]),
                "material_count": len([item for item in materials if item.course_id == course.id]),
            }
            for course in courses
        ]
    }


class CourseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=2, max_length=24)
    title: str = Field(min_length=3, max_length=255)
    description: Optional[str] = Field(None, max_length=1_000)


@router.post("/courses", status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    code = re.sub(r"[^A-Z0-9-]", "-", payload.code.strip().upper())[:24]
    if db.query(Course).filter(Course.code == code).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "duplicate_course", "field": "code", "message": "A course with that code already exists."},
        )
    course = Course(
        code=code,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        created_by=user.id,
    )
    db.add(course)
    record_audit(
        db,
        actor=user,
        action="course.created",
        entity_type="course",
        entity_id=course.id,
        course_id=course.id,
        summary=f"Created course {code} · {course.title}",
    )
    db.commit()
    db.refresh(course)
    return {"course": {"id": str(course.id), "code": course.code, "title": course.title}, "message": "Course created."}


def _assignment_rows(db: Session, *, course_id: uuid.UUID | None, role: str | None, state: str | None, search: str | None) -> list[dict]:
    query = db.query(CourseMember, Profile, Course).join(Profile, Profile.id == CourseMember.profile_id).join(
        Course, Course.id == CourseMember.course_id
    )
    if course_id is not None:
        query = query.filter(CourseMember.course_id == course_id)
    if role and role != "all":
        query = query.filter(CourseMember.member_role == role)
    if state and state != "all":
        query = query.filter(CourseMember.status == state)
    else:
        query = query.filter(CourseMember.status != "removed")
    rows = query.order_by(CourseMember.assigned_at.desc()).limit(1000).all()
    emails = account_emails(db, [profile.id for _membership, profile, _course in rows])
    needle = (search or "").strip().casefold()
    result = []
    for membership, profile, course in rows:
        if needle:
            haystack = f"{profile.email or emails.get(profile.id) or ''} {profile.display_name or ''} {profile.pseudonym_id or ''} {course.code} {course.title}".casefold()
            if needle not in haystack:
                continue
        result.append(
            {
                "membership_id": str(membership.id),
                "profile_id": str(profile.id),
                "email": profile.email or emails.get(profile.id),
                "display_name": profile.display_name,
                "pseudonym": profile.pseudonym_id,
                "account_role": _role_value(profile),
                "account_status": profile.account_status,
                "member_role": membership.member_role,
                "status": membership.status,
                "assigned_at": iso(membership.assigned_at),
                "course": {"id": str(course.id), "code": course.code, "title": course.title},
            }
        )
    return result


@router.get("/assignments")
def list_assignments(
    course_id: Optional[uuid.UUID] = None,
    role: Optional[str] = None,
    state: str = Query("all", alias="status"),
    search: Optional[str] = None,
    user: Profile = Depends(admin_user),
    db: Session = Depends(get_db),
):
    rows = _assignment_rows(db, course_id=course_id, role=role, state=state, search=search)
    all_rows = _assignment_rows(db, course_id=course_id, role=None, state="all", search=None)
    return {
        "items": rows,
        "total": len(rows),
        "counts": {
            "all": len(all_rows),
            "active": len([row for row in all_rows if row["status"] == "active"]),
            "pending": len([row for row in all_rows if row["status"] == "pending"]),
        },
    }


class AssignmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profile_id: uuid.UUID
    course_id: uuid.UUID
    member_role: str = Field(pattern="^(instructor|student)$")


@router.post("/assignments", status_code=status.HTTP_201_CREATED)
def create_assignment(payload: AssignmentCreate, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == payload.profile_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That account no longer exists."})
    if profile.account_status != "active":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "inactive_account", "field": "profile_id", "message": "Reactivate the account before assigning a course."},
        )
    course = db.query(Course).filter(Course.id == payload.course_id, Course.status == "active").first()
    if course is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That course is not available."})
    account_role = _role_value(profile)
    if payload.member_role == "instructor" and account_role == "student":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "role_mismatch",
                "field": "member_role",
                "message": "A student account cannot be assigned as an instructor. Provision an instructor account instead.",
            },
        )
    if payload.member_role == "student" and account_role != "student":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "role_mismatch",
                "field": "member_role",
                "message": "Only a student account can be enrolled as a student.",
            },
        )
    existing = (
        db.query(CourseMember)
        .filter(
            CourseMember.course_id == course.id,
            CourseMember.profile_id == profile.id,
            CourseMember.member_role == payload.member_role,
        )
        .first()
    )
    if existing is not None and existing.status == "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "duplicate_assignment",
                "field": "profile_id",
                "message": f"{profile.display_name or profile.pseudonym_id} already has active {payload.member_role} access to {course.title}.",
            },
        )
    if existing is not None and existing.status == "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "pending_assignment",
                "field": "profile_id",
                "message": "This assignment is already pending. Confirm it instead of creating another.",
            },
        )
    if existing is not None:
        existing.status = "active"
        existing.assigned_by = user.id
        existing.assigned_at = datetime.now(timezone.utc)
        existing.updated_at = datetime.now(timezone.utc)
        membership = existing
    else:
        membership = CourseMember(
            course_id=course.id,
            profile_id=profile.id,
            member_role=payload.member_role,
            status="active",
            assigned_by=user.id,
        )
        db.add(membership)
    record_audit(
        db,
        actor=user,
        action="assignment.created",
        entity_type="course_member",
        entity_id=membership.id if membership.id else None,
        course_id=course.id,
        summary=f"Assigned {profile.display_name or profile.pseudonym_id} as {payload.member_role} in {course.title}",
    )
    db.commit()
    db.refresh(membership)
    return {
        "assignment": {
            "membership_id": str(membership.id),
            "profile_id": str(profile.id),
            "course_id": str(course.id),
            "member_role": membership.member_role,
            "status": membership.status,
        },
        "message": f"{profile.display_name or profile.pseudonym_id} now has {payload.member_role} access to {course.title}.",
    }


@router.post("/assignments/{membership_id}/confirm")
def confirm_assignment(membership_id: uuid.UUID, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    membership = db.query(CourseMember).filter(CourseMember.id == membership_id).first()
    if membership is None or membership.status == "removed":
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That assignment no longer exists."})
    if membership.status == "active":
        raise HTTPException(status_code=409, detail={"code": "already_active", "message": "That assignment is already active."})
    membership.status = "active"
    membership.assigned_by = user.id
    membership.updated_at = datetime.now(timezone.utc)
    record_audit(
        db,
        actor=user,
        action="assignment.confirmed",
        entity_type="course_member",
        entity_id=membership.id,
        course_id=membership.course_id,
        summary="Confirmed a pending course assignment",
    )
    db.commit()
    return {"membership_id": str(membership.id), "status": "active", "message": "Course assignment confirmed."}


@router.post("/assignments/{membership_id}/remove")
def remove_assignment(membership_id: uuid.UUID, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    membership = db.query(CourseMember).filter(CourseMember.id == membership_id).first()
    if membership is None or membership.status == "removed":
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That assignment no longer exists."})
    course = db.query(Course).filter(Course.id == membership.course_id).first()
    membership.status = "removed"
    membership.updated_at = datetime.now(timezone.utc)
    record_audit(
        db,
        actor=user,
        action="assignment.removed",
        entity_type="course_member",
        entity_id=membership.id,
        course_id=membership.course_id,
        summary=f"Removed {membership.member_role} access to {course.title if course else 'a course'}",
    )
    db.commit()
    return {"membership_id": str(membership.id), "status": "removed", "message": "Course access removed. Historical records are preserved."}


# ---------------------------------------------------------------------------
# Materials (operational, no academic review)
# ---------------------------------------------------------------------------
def _admin_material_items(db: Session) -> list[dict]:
    courses = {course.id: course for course in db.query(Course).all()}
    documents = scoped_materials(db, list(courses.keys()))
    current = [document for document in documents if document.is_current]
    uploaders = {
        profile.id: profile
        for profile in db.query(Profile)
        .filter(Profile.id.in_([document.uploaded_by for document in current] or [uuid.uuid4()]))
        .all()
    }
    items = []
    for document in current:
        serialized = serialize_material(document)
        course = courses.get(document.course_id)
        uploader = uploaders.get(document.uploaded_by)
        serialized.update(
            {
                "course": {"id": str(course.id), "code": course.code, "title": course.title} if course else None,
                "uploaded_by": (uploader.display_name or uploader.pseudonym_id) if uploader else "Deleted account",
                "draft_count": material_draft_count(db, document.id),
                "downloadable": bool(document.storage_path),
            }
        )
        items.append(serialized)
    return items


@router.get("/materials")
def admin_materials(
    course_id: Optional[uuid.UUID] = None,
    status_filter: str = Query("all", alias="status"),
    search: Optional[str] = None,
    user: Profile = Depends(admin_user),
    db: Session = Depends(get_db),
):
    items = _admin_material_items(db)
    if course_id is not None:
        items = [item for item in items if item["course"] and item["course"]["id"] == str(course_id)]
    documents = scoped_materials(db, list({uuid.UUID(item["course"]["id"]) for item in items}) or [uuid.uuid4()])
    current = [document for document in documents if document.is_current]
    filtered = filter_materials(current, status=status_filter, search=search, current_only=True)
    visible_ids = {str(document.id) for document in filtered}
    visible = [item for item in items if item["document_id"] in visible_ids]
    return {
        "items": visible,
        "total": len(visible),
        "counts": material_status_counts(current),
        "courses": [
            {"id": str(course.id), "code": course.code, "title": course.title}
            for course in db.query(Course).filter(Course.status == "active").order_by(Course.title).all()
        ],
    }


@router.post("/materials", status_code=status.HTTP_201_CREATED)
async def admin_upload_material(
    course_id: uuid.UUID = Form(...),
    title: str = Form(..., min_length=2, max_length=255),
    language_tag: ProgrammingLang = Form(...),
    description: Optional[str] = Form(None, max_length=4_000),
    topic_concept: Optional[str] = Form(None, max_length=100),
    file: UploadFile = File(...),
    user: Profile = Depends(admin_user),
    db: Session = Depends(get_db),
):
    course = require_course_access(db, user, course_id)
    document, job = await upload_material(
        db,
        actor=user,
        course_id=course.id,
        file=file,
        title=title,
        description=description,
        language_tag=language_tag,
        topic_concept=topic_concept,
    )
    return {
        "material": serialize_material(document),
        "job": {"id": str(job.id), "status": job.status, "cause": job.cause, "trace_id": job.trace_id, "retryable": job.retryable},
        "message": (
            f"“{document.title}” is indexed and ready."
            if material_state(document) == "ready"
            else f"“{document.title}” was saved but needs attention: {document.processing_error}"
        ),
    }


class AdminMaterialMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=4_000)
    topic_concept: Optional[str] = Field(None, max_length=100)


@router.patch("/materials/{document_id}")
def admin_update_material(
    document_id: uuid.UUID,
    payload: AdminMaterialMetadata,
    user: Profile = Depends(admin_user),
    db: Session = Depends(get_db),
):
    document = db.query(InstructionalDocument).filter(InstructionalDocument.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That material no longer exists."})
    document.title = payload.title.strip()
    document.description = payload.description.strip() if payload.description else None
    document.topic_concept = payload.topic_concept.strip() if payload.topic_concept else None
    record_audit(
        db,
        actor=user,
        action="material.metadata_updated",
        entity_type="material",
        entity_id=document.id,
        course_id=document.course_id,
        summary=f"Updated operational metadata for “{document.title}” v{document.version_number}",
    )
    db.commit()
    return {"material": serialize_material(document, draft_count=material_draft_count(db, document.id)), "message": "Material metadata saved."}


@router.post("/materials/{document_id}/archive")
def admin_archive_material(document_id: uuid.UUID, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    document = db.query(InstructionalDocument).filter(InstructionalDocument.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That material no longer exists."})
    if document.archived_at is not None:
        raise HTTPException(status_code=409, detail={"code": "already_archived", "message": "That material is already archived."})
    document.archived_at = datetime.now(timezone.utc)
    document.status = "archived"
    record_audit(
        db,
        actor=user,
        action="material.archived",
        entity_type="material",
        entity_id=document.id,
        course_id=document.course_id,
        summary=f"Archived material “{document.title}” v{document.version_number}",
    )
    db.commit()
    return {"material": serialize_material(document), "message": "Material archived. Historical citations remain available."}


@router.post("/materials/{document_id}/restore")
def admin_restore_material(document_id: uuid.UUID, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    document = db.query(InstructionalDocument).filter(InstructionalDocument.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That material no longer exists."})
    document.archived_at = None
    document.status = "ready" if document.processing_status == "completed" else document.processing_status
    record_audit(
        db,
        actor=user,
        action="material.restored",
        entity_type="material",
        entity_id=document.id,
        course_id=document.course_id,
        summary=f"Restored material “{document.title}” v{document.version_number}",
    )
    db.commit()
    return {"material": serialize_material(document), "message": "Material restored."}


@router.post("/materials/{document_id}/retry")
async def admin_retry_material(document_id: uuid.UUID, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    document = db.query(InstructionalDocument).filter(InstructionalDocument.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That material no longer exists."})
    updated, job = await retry_material(db, actor=user, document=document, admin=True)
    return {
        "material": serialize_material(updated),
        "job": serialize_job(job),
        "message": (
            f"Retry completed. “{updated.title}” is ready."
            if updated.processing_status == "completed"
            else f"Retry failed again: {updated.processing_error}"
        ),
    }


@router.get("/materials/{document_id}/download")
async def admin_download_material(document_id: uuid.UUID, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    document = db.query(InstructionalDocument).filter(InstructionalDocument.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That material no longer exists."})
    try:
        url = await pdf_storage.create_download_url(document.storage_path, expires_in=60)
    except StorageError as exc:
        raise HTTPException(status_code=502, detail={"code": "storage_unavailable", "message": str(exc)}) from exc
    return {"download_url": url, "expires_in": 60}


# ---------------------------------------------------------------------------
# Activities (availability and archival only)
# ---------------------------------------------------------------------------
def _admin_activity_item(activity: LearningActivity, course: Course | None, attempts: int) -> dict:
    return {
        "activity_id": str(activity.id),
        "title": activity.title,
        "activity_type": getattr(activity.activity_type, "value", activity.activity_type),
        "topic_concept": activity.topic_concept,
        "state": activity_state(activity),
        "review_status": getattr(activity.review_status, "value", activity.review_status),
        "opens_at": iso(activity.opens_at),
        "closes_at": iso(activity.closes_at),
        "closed_at": iso(activity.closed_at),
        "archived_at": iso(activity.archived_at),
        "published_at": iso(activity.published_at),
        "version_number": activity.version_number or 1,
        "attempt_count": attempts,
        "enrolled_students": None,
        "course": {"id": str(course.id), "code": course.code, "title": course.title} if course else None,
    }


@router.get("/activities")
def admin_activities(
    course_id: Optional[uuid.UUID] = None,
    status_filter: str = Query("all", alias="status"),
    type_filter: Optional[str] = Query(None, alias="type"),
    search: Optional[str] = None,
    user: Profile = Depends(admin_user),
    db: Session = Depends(get_db),
):
    courses = {course.id: course for course in db.query(Course).all()}
    course_ids = [course_id] if course_id else list(courses.keys())
    activities = scoped_activities(db, course_ids)
    if status_filter == "attention":
        rows = [item for item in filter_activities(activities, status="all") if activity_state(item) in {"scheduled", "closed"}]
    else:
        rows = filter_activities(activities, status=status_filter, activity_type=type_filter, search=search)
    attempts = activity_attempt_counts(db, [item.id for item in rows])
    enrollment = membership_map(db, list(courses.keys()))
    items = []
    for item in rows:
        serialized = _admin_activity_item(item, courses.get(item.course_id), attempts.get(item.id, 0))
        if item.course_id is not None:
            serialized["enrolled_students"] = enrollment.get((item.course_id, "student"), 0)
        items.append(serialized)
    return {
        "items": items,
        "total": len(items),
        "counts": activity_status_counts(activities),
        "courses": [
            {"id": str(course.id), "code": course.code, "title": course.title}
            for course in courses.values()
            if course.status == "active"
        ],
        "filters": {"statuses": ["all", "draft", "scheduled", "open", "closed", "archived"]},
    }


def _admin_activity(db: Session, activity_id: uuid.UUID) -> LearningActivity:
    activity = db.query(LearningActivity).filter(LearningActivity.id == activity_id).first()
    if activity is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That activity no longer exists."})
    return activity


@router.get("/activities/{activity_id}/impact")
def activity_impact(activity_id: uuid.UUID, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    activity = _admin_activity(db, activity_id)
    course = db.query(Course).filter(Course.id == activity.course_id).first() if activity.course_id else None
    attempts = db.query(func.count(ActivityAttempt.id)).filter(ActivityAttempt.activity_id == activity.id).scalar() or 0
    enrolled = (
        db.query(func.count(CourseMember.id))
        .filter(
            CourseMember.course_id == activity.course_id,
            CourseMember.member_role == "student",
            CourseMember.status == "active",
        )
        .scalar()
        or 0
    )
    return {
        "activity": _admin_activity_item(activity, course, int(attempts)),
        "effect": {
            "enrolled_students": int(enrolled),
            "attempts_recorded": int(attempts),
            "note": "Existing attempts, scores and progress are preserved. Only future student access changes.",
        },
    }


class AvailabilityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    opens_at: Optional[datetime] = None
    closes_at: Optional[datetime] = None
    closed: Optional[bool] = None
    confirm: bool = False


@router.post("/activities/{activity_id}/availability")
def update_availability(
    activity_id: uuid.UUID,
    payload: AvailabilityUpdate,
    user: Profile = Depends(admin_user),
    db: Session = Depends(get_db),
):
    activity = _admin_activity(db, activity_id)
    if not payload.confirm:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "confirmation_required", "message": "Review the availability impact and confirm the change."},
        )
    opens_at = as_aware(payload.opens_at)
    closes_at = as_aware(payload.closes_at)
    if opens_at and closes_at and closes_at <= opens_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_schedule", "field": "closes_at", "message": "The closing time must be after the opening time."},
        )
    activity.opens_at = opens_at
    activity.closes_at = closes_at
    if payload.closed is not None:
        activity.closed_at = datetime.now(timezone.utc) if payload.closed else None
    record_audit(
        db,
        actor=user,
        action="activity.availability_changed",
        entity_type="activity",
        entity_id=activity.id,
        course_id=activity.course_id,
        summary=f"Changed availability for “{activity.title or activity.topic_concept}” to {activity_state(activity)}",
        metadata={"opens_at": iso(activity.opens_at), "closes_at": iso(activity.closes_at), "closed": payload.closed},
    )
    db.commit()
    db.refresh(activity)
    return {
        "activity_id": str(activity.id),
        "state": activity_state(activity),
        "opens_at": iso(activity.opens_at),
        "closes_at": iso(activity.closes_at),
        "message": f"Availability updated. The activity is now {activity_state(activity)}.",
    }


@router.post("/activities/{activity_id}/archive")
def admin_archive_activity(activity_id: uuid.UUID, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    activity = _admin_activity(db, activity_id)
    if activity.archived_at is not None:
        raise HTTPException(status_code=409, detail={"code": "already_archived", "message": "That activity is already archived."})
    activity.archived_at = datetime.now(timezone.utc)
    record_audit(
        db,
        actor=user,
        action="activity.archived",
        entity_type="activity",
        entity_id=activity.id,
        course_id=activity.course_id,
        summary=f"Archived “{activity.title or activity.topic_concept}”",
    )
    db.commit()
    return {
        "activity_id": str(activity.id),
        "state": activity_state(activity),
        "message": "Activity archived. Existing attempts and scores remain available.",
    }


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
@router.get("/settings")
def get_settings(user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    settings = list_settings(db)
    groups: dict[str, dict] = {}
    for setting in settings:
        group = groups.setdefault(
            setting["service"],
            {"service": setting["service"], "label": setting["service_label"], "settings": []},
        )
        group["settings"].append(setting)
    return {"groups": list(groups.values()), "total": len(settings)}


class SettingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: int | float | str | bool
    expected_version: int = Field(ge=1)


@router.patch("/settings/{key}")
def patch_setting(
    key: str,
    payload: SettingUpdate,
    user: Profile = Depends(admin_user),
    db: Session = Depends(get_db),
):
    setting = update_setting(db, actor=user, key=key, value=payload.value, expected_version=payload.expected_version)
    return {"setting": setting, "message": f"{setting['label']} saved as version {setting['version']} and recorded in the audit trail."}


# ---------------------------------------------------------------------------
# Monitoring
# ---------------------------------------------------------------------------
@router.get("/monitoring")
def monitoring(
    request: Request,
    service: Optional[str] = None,
    job_status: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    audit_search: Optional[str] = None,
    user: Profile = Depends(admin_user),
    db: Session = Depends(get_db),
):
    services = service_health(db, request.app.state)
    jobs = job_query(db, service=service, status=job_status, search=search).all()
    documents = {
        document.id: document
        for document in db.query(InstructionalDocument)
        .filter(InstructionalDocument.id.in_([job.document_id for job in jobs if job.document_id] or [uuid.uuid4()]))
        .all()
    }
    job_items = []
    for job in jobs:
        item = serialize_job(job)
        document = documents.get(job.document_id)
        item["document_title"] = document.title if document else None
        item["material_id"] = str(document.id) if document else None
        job_items.append(item)
    audits = audit_query(db, search=audit_search, limit=50).all()
    actors = {
        profile.id: profile
        for profile in db.query(Profile)
        .filter(Profile.id.in_([event.actor_id for event in audits if event.actor_id] or [uuid.uuid4()]))
        .all()
    }
    return {
        "services": services,
        "overall": overall_health(services),
        "checked_at": iso(datetime.now(timezone.utc)),
        "jobs": job_items,
        "job_counts": {
            "all": len(job_items),
            "failed": len([job for job in job_items if job["status"] == "failed"]),
            "retryable": len([job for job in job_items if job["status"] == "failed" and job["retryable"]]),
            "running": len([job for job in job_items if job["status"] in {"queued", "running"}]),
        },
        "audit": [
            {
                "id": str(event.id),
                "action": event.action,
                "entity_type": event.entity_type,
                "entity_id": event.entity_id,
                "summary": event.summary,
                "actor": (actors.get(event.actor_id).display_name or actors.get(event.actor_id).pseudonym_id)
                if event.actor_id in actors
                else "System",
                "created_at": iso(event.created_at),
            }
            for event in audits
        ],
        "filter_options": {"services": ["api", "rag_index", "code_runner", "prediction"]},
    }


@router.post("/jobs/{job_id}/retry")
async def retry_job(job_id: uuid.UUID, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That job no longer exists."})
    if job.status != "failed":
        raise HTTPException(status_code=409, detail={"code": "not_failed", "message": "Only a failed job can be retried."})
    if not job.retryable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "not_retryable",
                "message": "This failure is not retryable. It needs a corrected or searchable PDF instead.",
                "cause": job.cause,
                "trace_id": job.trace_id,
            },
        )
    if job.document_id is None:
        raise HTTPException(status_code=409, detail={"code": "not_retryable", "message": "This job has no material record to retry."})
    document = db.query(InstructionalDocument).filter(InstructionalDocument.id == job.document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "The material for this job no longer exists."})
    updated, new_job = await retry_material(db, actor=user, document=document, admin=True)
    return {
        "material": serialize_material(updated),
        "job": serialize_job(new_job),
        "message": (
            f"Retry completed. “{updated.title}” is ready."
            if material_state(updated) == "ready"
            else f"Retry finished with a failure: {updated.processing_error}"
        ),
    }


@router.get("/audit")
def audit_events(search: Optional[str] = None, user: Profile = Depends(admin_user), db: Session = Depends(get_db)):
    events = audit_query(db, search=search, limit=200).all()
    return {
        "items": [
            {
                "id": str(event.id),
                "action": event.action,
                "entity_type": event.entity_type,
                "entity_id": event.entity_id,
                "summary": event.summary,
                "actor_role": event.actor_role,
                "created_at": iso(event.created_at),
            }
            for event in events
        ]
    }

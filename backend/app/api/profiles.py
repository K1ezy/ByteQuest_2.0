"""Authenticated profile and student onboarding endpoints."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.services.storage.supabase_storage import StorageError, avatar_storage
from app.models.entities import (
    ActivityAttempt,
    AuditEvent,
    Badge,
    Course,
    CourseMember,
    Exam,
    ExamAttempt,
    InstructionalDocument,
    LearningActivity,
    Profile,
    ProgrammingLang,
    StudentBadge,
    UserRole,
)

router = APIRouter(prefix="/api/v1/profile", tags=["Profile"])


class OnboardingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    enrolled_language: ProgrammingLang
    year_level: int = Field(default=1, ge=1, le=4)
    semester: int = Field(default=1, ge=1, le=2)


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pseudonym_id: str
    role: UserRole
    enrolled_language: ProgrammingLang
    year_level: int
    semester: int
    xp_points: int
    current_level: int
    display_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    email: str | None = None
    created_at: datetime | None = None


class ProfileUpdateRequest(BaseModel):
    """Presentation fields any authenticated user may edit on their own profile."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    display_name: str | None = Field(default=None, max_length=120)
    bio: str | None = Field(default=None, max_length=500)


def _require_student(profile: Profile) -> None:
    if profile.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student onboarding is only available to student accounts.",
        )


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    current_user: Profile = Depends(get_current_user),
) -> ProfileResponse:
    """Return the authenticated user's application profile."""
    return current_user


@router.patch("/me", response_model=ProfileResponse)
def update_my_profile(
    payload: ProfileUpdateRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """Update presentation fields (display name, bio) on the caller's own profile.

    Available to every role. Only fields present in the request are changed; an
    empty string clears the field back to null.
    """
    fields = payload.model_dump(exclude_unset=True)
    if "display_name" in fields:
        display_name = (fields["display_name"] or "").strip()
        current_user.display_name = display_name or None
    if "bio" in fields:
        bio = (fields["bio"] or "").strip()
        current_user.bio = bio or None

    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/onboarding", response_model=ProfileResponse)
def complete_student_onboarding(
    payload: OnboardingRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """Save the student's curriculum track and academic context."""
    _require_student(current_user)
    current_user.enrolled_language = payload.enrolled_language
    current_user.year_level = payload.year_level
    current_user.semester = payload.semester

    db.commit()
    db.refresh(current_user)
    return current_user


# ---------------------------------------------------------------------------
# Avatar upload (all roles)
# ---------------------------------------------------------------------------

_AVATAR_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
_AVATAR_MAX_BYTES = 1_048_576  # 1 MiB; matches the storage bucket limit.


@router.post("/me/avatar", response_model=ProfileResponse)
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """Upload (or replace) the caller's avatar image."""
    content_type = (file.content_type or "").lower()
    if content_type not in _AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Avatar must be a PNG, JPEG or WebP image.",
        )
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The image file is empty.")
    if len(content) > _AVATAR_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Avatar images must be 1 MB or smaller.",
        )

    # Fixed per-user object path (overwritten on re-upload); a cache-busting
    # query param on the stored URL keeps browsers from showing a stale image.
    object_path = str(current_user.id)
    try:
        url = await avatar_storage.upload(object_path, content, content_type)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    current_user.avatar_url = f"{url}?v={int(datetime.utcnow().timestamp())}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=ProfileResponse)
async def delete_my_avatar(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """Remove the caller's avatar image, falling back to the monogram."""
    if current_user.avatar_url:
        try:
            await avatar_storage.delete(str(current_user.id))
        except StorageError:
            # The object may already be gone; clear the profile reference regardless.
            pass
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user


# ---------------------------------------------------------------------------
# Self-service analytics
#
# Every section only ever reads the caller's own records; no other user's data
# is queried or returned.
# ---------------------------------------------------------------------------


class TypeBreakdown(BaseModel):
    activity_type: str
    attempts: int
    average_score: float
    pass_rate: float


class TopicBreakdown(BaseModel):
    topic: str
    attempts: int
    average_score: float


class TrendPoint(BaseModel):
    created_at: datetime
    score_percentage: float
    title: str | None = None


class ExamHistoryEntry(BaseModel):
    exam_id: uuid.UUID
    title: str
    status: str
    score: float | None = None
    max_score: float | None = None
    submitted_at: datetime | None = None


class BadgeEntry(BaseModel):
    code: str
    name: str
    description: str | None = None
    xp_bonus: int
    awarded_at: datetime | None = None


class StudentAnalytics(BaseModel):
    total_attempts: int
    successful_attempts: int
    pass_rate: float
    average_score: float
    best_score: float
    total_time_seconds: int
    xp_points: int
    current_level: int
    badge_count: int
    by_type: list[TypeBreakdown]
    by_topic: list[TopicBreakdown]
    score_trend: list[TrendPoint]
    exam_history: list[ExamHistoryEntry]
    badges: list[BadgeEntry]


class InstructorAnalytics(BaseModel):
    courses: int
    activities_created: int
    activities_published: int
    drafts_reviewed: int
    materials_uploaded: int
    learners_taught: int


class AuditEntry(BaseModel):
    action: str
    entity_type: str
    summary: str
    created_at: datetime


class AdminAnalytics(BaseModel):
    total_accounts: int
    accounts_by_role: dict[str, int]
    total_courses: int
    total_activities: int
    total_materials: int
    recent_audit: list[AuditEntry]


class AnalyticsResponse(BaseModel):
    role: UserRole
    student: StudentAnalytics | None = None
    instructor: InstructorAnalytics | None = None
    admin: AdminAnalytics | None = None


def _enum_value(value: object) -> str:
    return getattr(value, "value", None) or str(value)


def _student_analytics(db: Session, user: Profile) -> StudentAnalytics:
    student_filter = ActivityAttempt.student_id == user.id

    total_attempts = db.query(func.count(ActivityAttempt.id)).filter(student_filter).scalar() or 0
    successful = (
        db.query(func.count(ActivityAttempt.id))
        .filter(student_filter, ActivityAttempt.is_successful.is_(True))
        .scalar()
        or 0
    )
    avg_score, best_score, total_time = db.query(
        func.coalesce(func.avg(ActivityAttempt.score_percentage), 0.0),
        func.coalesce(func.max(ActivityAttempt.score_percentage), 0.0),
        func.coalesce(func.sum(ActivityAttempt.time_spent_seconds), 0),
    ).filter(student_filter).one()

    type_rows = (
        db.query(
            LearningActivity.activity_type,
            func.count(ActivityAttempt.id),
            func.coalesce(func.avg(ActivityAttempt.score_percentage), 0.0),
            func.coalesce(func.sum(case((ActivityAttempt.is_successful, 1), else_=0)), 0),
        )
        .join(LearningActivity, LearningActivity.id == ActivityAttempt.activity_id)
        .filter(student_filter)
        .group_by(LearningActivity.activity_type)
        .all()
    )
    by_type = [
        TypeBreakdown(
            activity_type=_enum_value(atype),
            attempts=int(count),
            average_score=round(float(avg), 1),
            pass_rate=round(100.0 * int(passed) / int(count), 1) if count else 0.0,
        )
        for atype, count, avg, passed in type_rows
    ]

    topic_rows = (
        db.query(
            LearningActivity.topic_concept,
            func.count(ActivityAttempt.id),
            func.coalesce(func.avg(ActivityAttempt.score_percentage), 0.0),
        )
        .join(LearningActivity, LearningActivity.id == ActivityAttempt.activity_id)
        .filter(student_filter)
        .group_by(LearningActivity.topic_concept)
        .order_by(func.count(ActivityAttempt.id).desc())
        .limit(8)
        .all()
    )
    by_topic = [
        TopicBreakdown(topic=topic or "General", attempts=int(count), average_score=round(float(avg), 1))
        for topic, count, avg in topic_rows
    ]

    trend_rows = (
        db.query(ActivityAttempt.created_at, ActivityAttempt.score_percentage, LearningActivity.title)
        .join(LearningActivity, LearningActivity.id == ActivityAttempt.activity_id)
        .filter(student_filter)
        .order_by(ActivityAttempt.created_at.desc(), ActivityAttempt.id.desc())
        .limit(15)
        .all()
    )
    score_trend = [
        TrendPoint(created_at=created_at, score_percentage=float(score or 0.0), title=title)
        for created_at, score, title in reversed(trend_rows)
    ]

    exam_rows = (
        db.query(ExamAttempt, Exam.title)
        .join(Exam, Exam.id == ExamAttempt.exam_id)
        .filter(ExamAttempt.student_id == user.id)
        .order_by(ExamAttempt.started_at.desc())
        .limit(25)
        .all()
    )
    exam_history = [
        ExamHistoryEntry(
            exam_id=attempt.exam_id,
            title=title,
            status=attempt.status,
            score=attempt.score,
            max_score=attempt.max_score,
            submitted_at=attempt.submitted_at,
        )
        for attempt, title in exam_rows
    ]

    badge_rows = (
        db.query(Badge, StudentBadge.awarded_at)
        .join(StudentBadge, StudentBadge.badge_id == Badge.id)
        .filter(StudentBadge.student_id == user.id)
        .order_by(StudentBadge.awarded_at.desc(), Badge.name.asc())
        .all()
    )
    badges = [
        BadgeEntry(
            code=badge.code,
            name=badge.name,
            description=badge.description,
            xp_bonus=badge.xp_bonus,
            awarded_at=awarded_at,
        )
        for badge, awarded_at in badge_rows
    ]

    return StudentAnalytics(
        total_attempts=int(total_attempts),
        successful_attempts=int(successful),
        pass_rate=round(100.0 * int(successful) / int(total_attempts), 1) if total_attempts else 0.0,
        average_score=round(float(avg_score), 1),
        best_score=round(float(best_score), 1),
        total_time_seconds=int(total_time),
        xp_points=user.xp_points,
        current_level=user.current_level,
        badge_count=len(badges),
        by_type=by_type,
        by_topic=by_topic,
        score_trend=score_trend,
        exam_history=exam_history,
        badges=badges,
    )


def _instructor_analytics(db: Session, user: Profile) -> InstructorAnalytics:
    course_ids = [
        row[0]
        for row in db.query(CourseMember.course_id)
        .filter(
            CourseMember.profile_id == user.id,
            CourseMember.member_role == "instructor",
            CourseMember.status == "active",
        )
        .distinct()
        .all()
    ]

    activities_created = (
        db.query(func.count(LearningActivity.id)).filter(LearningActivity.created_by == user.id).scalar() or 0
    )
    activities_published = (
        db.query(func.count(LearningActivity.id))
        .filter(LearningActivity.created_by == user.id, LearningActivity.published_at.isnot(None))
        .scalar()
        or 0
    )
    drafts_reviewed = (
        db.query(func.count(LearningActivity.id)).filter(LearningActivity.reviewed_by == user.id).scalar() or 0
    )
    materials_uploaded = (
        db.query(func.count(InstructionalDocument.id))
        .filter(InstructionalDocument.uploaded_by == user.id)
        .scalar()
        or 0
    )
    learners_taught = 0
    if course_ids:
        learners_taught = (
            db.query(func.count(func.distinct(CourseMember.profile_id)))
            .filter(
                CourseMember.course_id.in_(course_ids),
                CourseMember.member_role == "student",
                CourseMember.status == "active",
            )
            .scalar()
            or 0
        )

    return InstructorAnalytics(
        courses=len(course_ids),
        activities_created=int(activities_created),
        activities_published=int(activities_published),
        drafts_reviewed=int(drafts_reviewed),
        materials_uploaded=int(materials_uploaded),
        learners_taught=int(learners_taught),
    )


def _admin_analytics(db: Session, user: Profile) -> AdminAnalytics:
    total_accounts = db.query(func.count(Profile.id)).scalar() or 0
    role_rows = db.query(Profile.role, func.count(Profile.id)).group_by(Profile.role).all()
    accounts_by_role = {_enum_value(role): int(count) for role, count in role_rows}

    total_courses = db.query(func.count(Course.id)).scalar() or 0
    total_activities = db.query(func.count(LearningActivity.id)).scalar() or 0
    total_materials = (
        db.query(func.count(InstructionalDocument.id))
        .filter(InstructionalDocument.is_current.is_(True))
        .scalar()
        or 0
    )
    audit_rows = (
        db.query(AuditEvent)
        .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
        .limit(10)
        .all()
    )
    recent_audit = [
        AuditEntry(
            action=event.action,
            entity_type=event.entity_type,
            summary=event.summary,
            created_at=event.created_at,
        )
        for event in audit_rows
    ]

    return AdminAnalytics(
        total_accounts=int(total_accounts),
        accounts_by_role=accounts_by_role,
        total_courses=int(total_courses),
        total_activities=int(total_activities),
        total_materials=int(total_materials),
        recent_audit=recent_audit,
    )


@router.get("/me/analytics", response_model=AnalyticsResponse)
def get_my_analytics(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalyticsResponse:
    """Return role-appropriate analytics for the authenticated user's own activity."""
    if current_user.role == UserRole.student:
        return AnalyticsResponse(role=current_user.role, student=_student_analytics(db, current_user))
    if current_user.role == UserRole.instructor:
        return AnalyticsResponse(role=current_user.role, instructor=_instructor_analytics(db, current_user))
    return AnalyticsResponse(role=current_user.role, admin=_admin_analytics(db, current_user))

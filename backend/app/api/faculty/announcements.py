"""Course announcements managed by assigned instructors."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import AwareDatetime, BaseModel, ConfigDict, StrictBool, StringConstraints, field_validator, model_validator
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.faculty.common import faculty_user, version_conflict
from app.core.database import get_db
from app.models.entities import Course, CourseAnnouncement, Profile, _utcnow
from app.services.audit import record_audit
from app.services.course_access import resolve_workspace_course

router = APIRouter()
MAX_ANNOUNCEMENTS = 50
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120, pattern=r"^[^\x00]*$")]
Body = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000, pattern=r"^[^\x00]*$")]


class AnnouncementExpiry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expires_at: AwareDatetime | None = None

    @field_validator("expires_at")
    @classmethod
    def future_expiry(cls, value: datetime | None) -> datetime | None:
        if value is not None and value <= _utcnow():
            raise ValueError("Choose an expiration in the future.")
        return value


class AnnouncementCreate(AnnouncementExpiry):
    course_id: uuid.UUID
    title: Title
    body: Body
    pinned: StrictBool = False


class AnnouncementPatch(AnnouncementExpiry):
    expected_updated_at: AwareDatetime
    title: Title | None = None
    body: Body | None = None
    pinned: StrictBool | None = None

    @field_validator("title", "body", "pinned")
    @classmethod
    def reject_explicit_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null.")
        return value

    @model_validator(mode="after")
    def require_changes(self) -> AnnouncementPatch:
        if not (self.model_fields_set - {"expected_updated_at"}):
            raise ValueError("Supply at least one field to update.")
        return self


def _summary(item: CourseAnnouncement, now: datetime) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "body": item.body,
        "pinned": item.pinned,
        "expires_at": item.expires_at,
        "expired": item.expires_at is not None and item.expires_at <= now,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _authorize_announcement(db: Session, user: Profile, announcement_id: uuid.UUID) -> None:
    course_id = db.scalar(select(CourseAnnouncement.course_id).where(CourseAnnouncement.id == announcement_id))
    if course_id is None:
        raise HTTPException(404, detail={"code": "not_found", "message": "That announcement could not be found."})
    resolve_workspace_course(db, user, course_id, allow_admin=False)


def _audit_change(db: Session, user: Profile, item: CourseAnnouncement, action: str) -> None:
    record_audit(
        db, actor=user, action=f"announcement.{action}", entity_type="course_announcement",
        entity_id=item.id, course_id=item.course_id, summary=f"Course announcement {action}.",
    )


@router.get("/announcements")
def list_announcements(
    course_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    now = _utcnow()
    items = db.scalars(
        select(CourseAnnouncement).where(CourseAnnouncement.course_id == course.id)
        .order_by(CourseAnnouncement.pinned.desc(), CourseAnnouncement.created_at.desc(), CourseAnnouncement.id.desc())
        .limit(MAX_ANNOUNCEMENTS)
    )
    return {"items": [_summary(item, now) for item in items], "limit": MAX_ANNOUNCEMENTS}


@router.post("/announcements", status_code=201)
def create_announcement(
    payload: AnnouncementCreate,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, payload.course_id, allow_admin=False)
    # Serialize posts for the same course so simultaneous creates cannot exceed the cap.
    if db.scalar(select(Course.id).where(Course.id == course.id).with_for_update(key_share=True)) is None:
        raise HTTPException(404, detail={"code": "course_not_found", "message": "That course is not available."})
    count = db.scalar(select(func.count()).select_from(CourseAnnouncement).where(CourseAnnouncement.course_id == course.id))
    if count >= MAX_ANNOUNCEMENTS:
        raise HTTPException(409, detail={
            "code": "announcement_limit", "message": "This course has 50 announcements. Delete one before posting another.",
        })
    item = CourseAnnouncement(**payload.model_dump(), author_id=user.id)
    db.add(item)
    db.flush()
    _audit_change(db, user, item, "created")
    result = _summary(item, _utcnow())
    db.commit()
    return result


@router.patch("/announcements/{announcement_id}")
def update_announcement(
    announcement_id: uuid.UUID,
    payload: AnnouncementPatch,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    _authorize_announcement(db, user, announcement_id)
    changes = payload.model_dump(exclude={"expected_updated_at"}, exclude_unset=True)
    item = db.scalar(
        update(CourseAnnouncement)
        .where(CourseAnnouncement.id == announcement_id, CourseAnnouncement.updated_at == payload.expected_updated_at)
        .values(**changes, updated_at=_utcnow())
        .returning(CourseAnnouncement)
    )
    if item is None:
        raise version_conflict()
    _audit_change(db, user, item, "updated")
    result = _summary(item, item.updated_at)
    db.commit()
    return result


@router.delete("/announcements/{announcement_id}", status_code=204)
def delete_announcement(
    announcement_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
) -> Response:
    _authorize_announcement(db, user, announcement_id)
    item = db.get(CourseAnnouncement, announcement_id, with_for_update=True)
    if item is None:
        raise HTTPException(404, detail={"code": "not_found", "message": "That announcement could not be found."})
    _audit_change(db, user, item, "deleted")
    db.delete(item)
    db.commit()
    return Response(status_code=204)

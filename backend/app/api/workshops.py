"""Create and join workshops using short invite codes."""

import secrets
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.quotas import reserve
from app.services.attempt_visibility import workshop_shareable_activity_clause
from app.core.security import get_current_user
from app.models.entities import (
    LearningActivity,
    Profile,
    ProgrammingLang,
    Workshop,
    WorkshopActivity,
    WorkshopMember,
    ReviewState,
    UserRole,
)

router = APIRouter(prefix="/api/v1/workshops", tags=["Workshops"])
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class CreateWorkshop(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=3, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    language: ProgrammingLang
    activity_ids: list[uuid.UUID] = Field(default_factory=list, max_length=40)


class JoinWorkshop(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str = Field(min_length=8, max_length=12)


class AddWorkshopActivities(BaseModel):
    model_config = ConfigDict(extra="forbid")

    activity_ids: list[uuid.UUID] = Field(min_length=1, max_length=40)


class WorkshopView(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    language: ProgrammingLang
    is_owner: bool
    join_code: Optional[str]
    member_count: int
    activity_ids: list[uuid.UUID]


def _published_activities(
    db: Session, activity_ids: list[uuid.UUID], language: ProgrammingLang, owner_id: uuid.UUID,
) -> list[LearningActivity]:
    unique_ids = set(activity_ids)
    if not unique_ids:
        return []
    activities = (
        db.query(LearningActivity)
        .filter(
            LearningActivity.id.in_(unique_ids),
            LearningActivity.language == language,
            LearningActivity.review_status == ReviewState.published,
            LearningActivity.archived_at.is_(None),
            workshop_shareable_activity_clause(owner_id),
        )
        .all()
    )
    if len(activities) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Choose published activities you can share in the group's language.",
        )
    return activities


def _group_views(db: Session, groups: list[Workshop], current_user: Profile) -> list[WorkshopView]:
    """Build views for many workshops with two queries in total."""
    workshop_ids = [group.id for group in groups]
    if not workshop_ids:
        return []
    member_counts = dict(
        db.query(WorkshopMember.workshop_id, func.count(WorkshopMember.profile_id))
        .filter(WorkshopMember.workshop_id.in_(workshop_ids))
        .group_by(WorkshopMember.workshop_id)
        .all()
    )
    activity_ids: dict[uuid.UUID, list[uuid.UUID]] = {workshop_id: [] for workshop_id in workshop_ids}
    for workshop_id, activity_id in (
        db.query(WorkshopActivity.workshop_id, WorkshopActivity.activity_id)
        .join(LearningActivity, LearningActivity.id == WorkshopActivity.activity_id)
        .join(Workshop, Workshop.id == WorkshopActivity.workshop_id)
        .filter(
            WorkshopActivity.workshop_id.in_(workshop_ids),
            LearningActivity.review_status == ReviewState.published,
            LearningActivity.archived_at.is_(None),
            workshop_shareable_activity_clause(Workshop.created_by),
        )
        .order_by(LearningActivity.sequence_order, LearningActivity.id)
    ):
        activity_ids[workshop_id].append(activity_id)
    views = []
    for group in groups:
        is_owner = current_user.role == UserRole.admin or (
            current_user.role == UserRole.instructor and group.created_by == current_user.id
        )
        views.append(WorkshopView(
            id=group.id,
            name=group.name,
            description=group.description,
            language=group.language,
            is_owner=is_owner,
            join_code=group.join_code if is_owner else None,
            member_count=member_counts.get(group.id, 0),
            activity_ids=activity_ids[group.id],
        ))
    return views


def _group_view(db: Session, group: Workshop, current_user: Profile) -> WorkshopView:
    return _group_views(db, [group], current_user)[0]


@router.get("", response_model=list[WorkshopView])
def list_workshops(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkshopView]:
    groups = (
        db.query(Workshop)
        .join(WorkshopMember, WorkshopMember.workshop_id == Workshop.id)
        .filter(WorkshopMember.profile_id == current_user.id)
        .order_by(Workshop.created_at.desc(), Workshop.id.desc())
        .limit(100)
        .all()
    )
    return _group_views(db, groups, current_user)


@router.post("", response_model=WorkshopView, status_code=status.HTTP_201_CREATED)
def create_workshop(
    payload: CreateWorkshop,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    if current_user.role not in (UserRole.instructor, UserRole.admin):
        raise HTTPException(status_code=403, detail="Faculty or admin access is required to create a workshop.")
    activity_ids = [activity.id for activity in _published_activities(db, payload.activity_ids, payload.language, current_user.id)]
    reserve("workshop_create", current_user.id, session=db, commit=True)
    for _ in range(3):
        group = Workshop(
            name=payload.name,
            description=payload.description or None,
            language=payload.language,
            join_code="".join(secrets.choice(CODE_ALPHABET) for _ in range(8)),
            created_by=current_user.id,
        )
        try:
            db.add(group)
            db.flush()
            db.add(WorkshopMember(workshop_id=group.id, profile_id=current_user.id))
            db.add_all(WorkshopActivity(workshop_id=group.id, activity_id=activity_id) for activity_id in activity_ids)
            db.commit()
            db.refresh(group)
            return _group_view(db, group, current_user)
        except IntegrityError:
            db.rollback()
    raise HTTPException(status_code=503, detail="Could not make a unique workshop code. Try again.")


@router.post("/join", response_model=WorkshopView)
def join_workshop(
    payload: JoinWorkshop,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    code = payload.code.strip().replace("-", "").upper()
    if len(code) != 8 or any(char not in CODE_ALPHABET for char in code):
        raise HTTPException(status_code=422, detail="Enter the eight-character workshop code.")
    # Charge a valid-format guess before lookup using the request's own connection.
    # A second connection per request can exhaust the pool when a class joins together.
    reserve("workshop_join", current_user.id, session=db, commit=True)
    group = db.query(Workshop).filter(Workshop.join_code == code).first()
    if group is None:
        raise HTTPException(status_code=404, detail="No workshop matches that code.")
    if current_user.role == UserRole.student and group.language != current_user.enrolled_language:
        raise HTTPException(status_code=409, detail="This workshop uses a different language track. Change your track before joining.")
    existing = (
        db.query(WorkshopMember)
        .filter(WorkshopMember.workshop_id == group.id, WorkshopMember.profile_id == current_user.id)
        .first()
    )
    if existing is None:
        db.add(WorkshopMember(workshop_id=group.id, profile_id=current_user.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return _group_view(db, group, current_user)


@router.post("/{workshop_id}/activities", response_model=WorkshopView)
def add_workshop_activities(
    workshop_id: uuid.UUID,
    payload: AddWorkshopActivities,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    if current_user.role not in (UserRole.instructor, UserRole.admin):
        raise HTTPException(status_code=403, detail="Instructor or admin access is required.")
    group = db.query(Workshop).filter(Workshop.id == workshop_id).first()
    if group is None:
        raise HTTPException(status_code=404, detail="Workshop not found.")
    if group.created_by != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=404, detail="Workshop not found.")
    activities = _published_activities(db, payload.activity_ids, group.language, group.created_by)
    existing_ids = {
        activity_id
        for (activity_id,) in db.query(WorkshopActivity.activity_id).filter(WorkshopActivity.workshop_id == group.id).all()
    }
    db.add_all(
        WorkshopActivity(workshop_id=group.id, activity_id=activity.id)
        for activity in activities
        if activity.id not in existing_ids
    )
    db.commit()
    return _group_view(db, group, current_user)

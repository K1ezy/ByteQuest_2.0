"""Create and join shared quest groups using short invite codes."""

import secrets
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.quotas import reserve
from app.core.security import get_current_user
from app.models.entities import (
    LearningActivity,
    Profile,
    ProgrammingLang,
    QuestGroup,
    QuestGroupActivity,
    QuestGroupMember,
    ReviewState,
    UserRole,
)

router = APIRouter(prefix="/api/v1/quest-groups", tags=["Quest Groups"])
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class CreateQuestGroup(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=3, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    language: ProgrammingLang
    activity_ids: list[uuid.UUID] = Field(default_factory=list, max_length=40)


class JoinQuestGroup(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str = Field(min_length=8, max_length=12)


class AddGroupActivities(BaseModel):
    model_config = ConfigDict(extra="forbid")

    activity_ids: list[uuid.UUID] = Field(min_length=1, max_length=40)


class QuestGroupView(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    language: ProgrammingLang
    is_owner: bool
    join_code: Optional[str]
    member_count: int
    activity_ids: list[uuid.UUID]


def _published_activities(
    db: Session, activity_ids: list[uuid.UUID], language: ProgrammingLang
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
        )
        .all()
    )
    if len(activities) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Choose published activities in the group's language.",
        )
    return activities


def _group_view(db: Session, group: QuestGroup, current_user: Profile) -> QuestGroupView:
    is_owner = current_user.role == UserRole.admin or (
        current_user.role == UserRole.instructor and group.created_by == current_user.id
    )
    member_count = db.query(QuestGroupMember).filter(QuestGroupMember.group_id == group.id).count()
    activity_ids = [
        activity_id
        for (activity_id,) in (
            db.query(QuestGroupActivity.activity_id)
            .join(LearningActivity, LearningActivity.id == QuestGroupActivity.activity_id)
            .filter(
                QuestGroupActivity.group_id == group.id,
                LearningActivity.review_status == ReviewState.published,
            )
            .order_by(LearningActivity.sequence_order, LearningActivity.id)
            .all()
        )
    ]
    return QuestGroupView(
        id=group.id,
        name=group.name,
        description=group.description,
        language=group.language,
        is_owner=is_owner,
        join_code=group.join_code if is_owner else None,
        member_count=member_count,
        activity_ids=activity_ids,
    )


@router.get("", response_model=list[QuestGroupView])
def list_quest_groups(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[QuestGroupView]:
    groups = (
        db.query(QuestGroup)
        .join(QuestGroupMember, QuestGroupMember.group_id == QuestGroup.id)
        .filter(QuestGroupMember.profile_id == current_user.id)
        .order_by(QuestGroup.created_at.desc(), QuestGroup.id.desc())
        .limit(100)
        .all()
    )
    return [_group_view(db, group, current_user) for group in groups]


@router.post("", response_model=QuestGroupView, status_code=status.HTTP_201_CREATED)
def create_quest_group(
    payload: CreateQuestGroup,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuestGroupView:
    if current_user.role not in (UserRole.instructor, UserRole.admin):
        raise HTTPException(status_code=403, detail="Faculty or admin access is required to create a quest.")
    activities = _published_activities(db, payload.activity_ids, payload.language)
    reserve("group_create", current_user.id)
    for _ in range(3):
        group = QuestGroup(
            name=payload.name,
            description=payload.description or None,
            language=payload.language,
            join_code="".join(secrets.choice(CODE_ALPHABET) for _ in range(8)),
            created_by=current_user.id,
        )
        try:
            db.add(group)
            db.flush()
            db.add(QuestGroupMember(group_id=group.id, profile_id=current_user.id))
            db.add_all(QuestGroupActivity(group_id=group.id, activity_id=activity.id) for activity in activities)
            db.commit()
            db.refresh(group)
            return _group_view(db, group, current_user)
        except IntegrityError:
            db.rollback()
    raise HTTPException(status_code=503, detail="Could not make a unique quest code. Try again.")


@router.post("/join", response_model=QuestGroupView)
def join_quest_group(
    payload: JoinQuestGroup,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuestGroupView:
    code = payload.code.strip().replace("-", "").upper()
    if len(code) != 8 or any(char not in CODE_ALPHABET for char in code):
        raise HTTPException(status_code=422, detail="Enter the eight-character quest code.")
    reserve("group_join", current_user.id)
    group = db.query(QuestGroup).filter(QuestGroup.join_code == code).first()
    if group is None:
        raise HTTPException(status_code=404, detail="No quest matches that code.")
    if current_user.role == UserRole.student and group.language != current_user.enrolled_language:
        raise HTTPException(status_code=409, detail="This quest uses a different language track. Change your track before joining.")
    existing = (
        db.query(QuestGroupMember)
        .filter(QuestGroupMember.group_id == group.id, QuestGroupMember.profile_id == current_user.id)
        .first()
    )
    if existing is None:
        db.add(QuestGroupMember(group_id=group.id, profile_id=current_user.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return _group_view(db, group, current_user)


@router.post("/{group_id}/activities", response_model=QuestGroupView)
def add_group_activities(
    group_id: uuid.UUID,
    payload: AddGroupActivities,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuestGroupView:
    if current_user.role not in (UserRole.instructor, UserRole.admin):
        raise HTTPException(status_code=403, detail="Instructor or admin access is required.")
    group = db.query(QuestGroup).filter(QuestGroup.id == group_id).first()
    if group is None:
        raise HTTPException(status_code=404, detail="Quest not found.")
    if group.created_by != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=404, detail="Quest not found.")
    activities = _published_activities(db, payload.activity_ids, group.language)
    existing_ids = {
        activity_id
        for (activity_id,) in db.query(QuestGroupActivity.activity_id).filter(QuestGroupActivity.group_id == group.id).all()
    }
    db.add_all(
        QuestGroupActivity(group_id=group.id, activity_id=activity.id)
        for activity in activities
        if activity.id not in existing_ids
    )
    db.commit()
    return _group_view(db, group, current_user)

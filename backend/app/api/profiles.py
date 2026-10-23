"""Authenticated profile and student onboarding endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import Profile, ProgrammingLang, UserRole

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

"""Server-side authorization for the faculty and administrator workspace.

Every protected read and write resolves a course through this module. Client
side hiding is a usability aid only: an instructor without an active assignment
on a course receives a 403 even if they type the course id directly.
"""

from __future__ import annotations

import uuid
from typing import Iterable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import Course, CourseMember, Profile, UserRole


def is_admin(user: Profile) -> bool:
    return user.role == UserRole.admin or getattr(user.role, "value", user.role) == "admin"


def is_instructor(user: Profile) -> bool:
    role = getattr(user.role, "value", user.role)
    return role in {"instructor", "admin"}


def require_faculty(user: Profile) -> Profile:
    """Instructor or administrator; used for shared read-only helper routes."""
    if not is_instructor(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "faculty_required",
                "message": "Faculty workspace access requires an instructor or administrator account.",
            },
        )
    return user


def require_administrator(user: Profile) -> Profile:
    if not is_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "administrator_required",
                "message": "This operation is limited to administrators. Academic review stays with assigned faculty.",
            },
        )
    return user


def active_membership_course_ids(db: Session, profile_id: uuid.UUID, member_role: str) -> list[uuid.UUID]:
    rows = (
        db.query(CourseMember.course_id)
        .filter(
            CourseMember.profile_id == profile_id,
            CourseMember.member_role == member_role,
            CourseMember.status == "active",
        )
        .all()
    )
    return [row[0] for row in rows]


def default_instructor_course_id(db: Session, profile_id: uuid.UUID) -> uuid.UUID | None:
    """First active teaching assignment, used when a legacy route omits a course."""
    ids = active_membership_course_ids(db, profile_id, "instructor")
    return ids[0] if ids else None


def has_course_role(db: Session, user: Profile, course_id: uuid.UUID | None, member_role: str) -> bool:
    """True when the caller actively holds the course role (admin always does)."""
    if is_admin(user):
        return True
    if course_id is None:
        return False
    return (
        db.query(CourseMember.id)
        .filter(
            CourseMember.course_id == course_id,
            CourseMember.profile_id == user.id,
            CourseMember.member_role == member_role,
            CourseMember.status == "active",
        )
        .first()
        is not None
    )


def may_manage_course(db: Session, user: Profile, course_id: uuid.UUID | None) -> bool:
    """Authorization for the shared instructor generation and publish pipeline."""
    return has_course_role(db, user, course_id, "instructor")


def require_course_instructor(user: Profile) -> Profile:
    """Strict faculty role: administrator accounts use the administrative routes."""
    role = getattr(user.role, "value", user.role)
    if role != "instructor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "faculty_instructor_required",
                "message": "Academic review is limited to assigned faculty (instructor) accounts.",
            },
        )
    return user


def courses_for_user(db: Session, user: Profile, *, include_archived: bool = False) -> list[Course]:
    query = db.query(Course)
    if not is_admin(user):
        query = query.join(CourseMember, CourseMember.course_id == Course.id).filter(
            CourseMember.profile_id == user.id,
            CourseMember.member_role == "instructor",
            CourseMember.status == "active",
        )
    if not include_archived:
        query = query.filter(Course.status == "active")
    return query.order_by(Course.title.asc()).all()


def require_course_access(
    db: Session,
    user: Profile,
    course_id: uuid.UUID | None,
    *,
    member_role: str = "instructor",
    allow_admin: bool = True,
) -> Course:
    """Resolve a course the caller may act on, or raise a coded 403/404."""
    if course_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "course_required", "message": "Choose a course to continue."},
        )
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "course_not_found", "message": "That course is not available."},
        )
    if allow_admin and is_admin(user):
        return course
    membership = (
        db.query(CourseMember)
        .filter(
            CourseMember.course_id == course.id,
            CourseMember.profile_id == user.id,
            CourseMember.member_role == member_role,
            CourseMember.status == "active",
        )
        .first()
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "course_forbidden",
                "message": "You are not assigned to this course. Ask an administrator for course access.",
            },
        )
    return course


def resolve_workspace_course(
    db: Session,
    user: Profile,
    course_id: uuid.UUID | None,
    *,
    allow_admin: bool = True,
) -> Course:
    """Course context for a faculty page: requested, or the first assignment."""
    if course_id is not None:
        return require_course_access(db, user, course_id, allow_admin=allow_admin)
    assigned = courses_for_user(db, user)
    if not assigned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "no_course_assignment",
                "message": "No course is assigned to this account yet. An administrator must assign one.",
            },
        )
    return assigned[0]


def scoped_course_ids(db: Session, user: Profile, requested: uuid.UUID | None = None) -> list[uuid.UUID]:
    """Course ids an administrator may filter by, or an instructor's assignments."""
    if is_admin(user):
        if requested is not None:
            require_course_access(db, user, requested)
            return [requested]
        return [course.id for course in courses_for_user(db, user, include_archived=True)]
    if requested is not None:
        return [require_course_access(db, user, requested).id]
    return active_membership_course_ids(db, user.id, "instructor")


def ensure_owned_or_admin(user: Profile, owner_id: uuid.UUID | None) -> None:
    """Legacy rows created before courses existed remain reachable by their author."""
    if is_admin(user):
        return
    if owner_id is not None and owner_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "not_found", "message": "That item was not found in your courses."},
    )


def membership_map(
    db: Session,
    course_ids: Iterable[uuid.UUID],
) -> dict[tuple[uuid.UUID, str], int]:
    """Active member counts per (course, role) for assignment summaries."""
    ids = list(course_ids)
    if not ids:
        return {}
    rows = (
        db.query(CourseMember.course_id, CourseMember.member_role, CourseMember.status)
        .filter(CourseMember.course_id.in_(ids))
        .all()
    )
    counts: dict[tuple[uuid.UUID, str], int] = {}
    for course_id, role, state in rows:
        if state != "active":
            continue
        key = (course_id, role)
        counts[key] = counts.get(key, 0) + 1
    return counts

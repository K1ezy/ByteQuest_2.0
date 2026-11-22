"""Workshop membership, invitations and shared practice activities."""

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.quotas import reserve
from app.core.security import get_current_user
from app.models.entities import (
    ActivityKind,
    ActivityAttempt,
    Exam,
    ExamAssignment,
    ExamAttempt,
    LearningActivity,
    Profile,
    ProgrammingLang,
    ReviewState,
    UserRole,
    Workshop,
    WorkshopActivity,
    WorkshopAnnouncement,
    WorkshopMember,
)
from app.services.attempt_visibility import (
    activity_has_opened, activity_is_closed, practice_attempt_clause, workshop_shareable_activity_clause,
)
from app.services.course_access import student_exam_course_clause
from app.services.gamification.mastery_map import first_visible_completions
from app.services.gamification.solve_quality import best_challenge_stars

router = APIRouter(prefix="/api/v1/workshops", tags=["Workshops"])
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
JOIN_CODE_CONSTRAINTS = {"workshops_join_code_key", "workshop_join_codes_pkey"}
ARCHIVED_MESSAGE = "Restore this workshop before making changes."
CLOSED_JOIN_MESSAGE = "This workshop isn't accepting new members."


class WorkshopMutation(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class WorkshopClassroomDetails(WorkshopMutation):
    block: str | None = Field(default=None, max_length=24)
    year_level: int | None = Field(default=None, ge=1, le=4, strict=True)
    subject: str | None = Field(default=None, max_length=80)
    room: str | None = Field(default=None, max_length=40)

    @field_validator("block", "subject", "room")
    @classmethod
    def blank_detail_as_none(cls, value: str | None) -> str | None:
        return value or None


class CreateWorkshop(WorkshopClassroomDetails):
    name: str = Field(min_length=3, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    language: ProgrammingLang
    activity_ids: list[uuid.UUID] = Field(default_factory=list, max_length=40)


class JoinWorkshop(WorkshopMutation):
    code: str = Field(min_length=8, max_length=12)


class UpdateWorkshop(WorkshopClassroomDetails):
    name: str = Field(default="", min_length=3, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    joining_enabled: bool = Field(default=True, strict=True)


class AddWorkshopActivities(WorkshopMutation):
    activity_ids: list[uuid.UUID] = Field(min_length=1, max_length=40)
    topic: str | None = Field(default=None, max_length=80)


class UpdateWorkshopActivity(WorkshopMutation):
    topic: str | None = Field(default=None, max_length=80)
    position: int = Field(default=0, ge=0, le=2_147_483_647, strict=True)


class WorkshopActivityView(BaseModel):
    activity_id: uuid.UUID
    topic: str | None
    position: int
    added_at: datetime


class WorkshopActivityOption(BaseModel):
    id: uuid.UUID
    title: str
    activity_type: ActivityKind


class WorkshopQuest(BaseModel):
    id: uuid.UUID
    title: str | None
    activity_type: ActivityKind
    language: ProgrammingLang
    topic_concept: str
    difficulty_level: int
    sequence_order: int
    added_at: datetime
    added_at_estimated: bool = False
    xp_reward: int
    problem_statement: str | None
    starter_code: None = None
    is_completed: bool
    stars: int | None
    is_closed: bool
    can_open: bool
    opens_at: datetime | None


class WorkshopView(WorkshopClassroomDetails):
    id: uuid.UUID
    name: str
    description: str | None
    language: ProgrammingLang
    is_owner: bool
    owned_by_me: bool
    join_code: str | None
    joining_enabled: bool
    archived: bool
    owner_name: str
    member_count: int
    activity_ids: list[uuid.UUID]
    activities: list[WorkshopActivityView]
    next_closes_at: datetime | None


class CreateAnnouncement(WorkshopMutation):
    body: str = Field(min_length=1, max_length=2000)
    pinned: bool = Field(default=False, strict=True)


class UpdateAnnouncement(WorkshopMutation):
    body: str = Field(default="", min_length=1, max_length=2000)
    pinned: bool = Field(default=False, strict=True)


class AnnouncementView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    body: str
    pinned: bool
    created_at: datetime
    updated_at: datetime


class UpcomingItem(BaseModel):
    id: uuid.UUID
    title: str
    kind: Literal["quiz", "challenge", "exam"]
    opens_at: datetime | None
    closes_at: datetime


class WorkshopStudent(BaseModel):
    username: str


class ManagedWorkshopStudent(WorkshopStudent):
    id: uuid.UUID
    display_name: str | None
    school_id: str | None
    year_level: int
    block_section: str | None


class WorkshopPeople(BaseModel):
    instructor: WorkshopStudent
    students: list[ManagedWorkshopStudent | WorkshopStudent]


class WorkshopProgressRow(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str | None
    completion_percent: int
    states: dict[uuid.UUID, Literal["solved", "attempted", "not_started"]]


class WorkshopProgress(BaseModel):
    activities: list[WorkshopActivityOption]
    students: list[WorkshopProgressRow]


def can_manage(workshop: Workshop, user: Profile) -> bool:
    return user.role == UserRole.admin or (
        user.role == UserRole.instructor and workshop.created_by == user.id
    )


def get_workshop(
    db: Session, workshop_id: uuid.UUID, user: Profile, *, manage: bool = False, lock: bool = False,
) -> Workshop:
    query = db.query(Workshop).filter(Workshop.id == workshop_id)
    workshop = (query.with_for_update() if lock else query).one_or_none()
    if workshop is not None:
        if can_manage(workshop, user):
            return workshop
        if not manage and db.query(WorkshopMember.id).filter_by(
            workshop_id=workshop_id, profile_id=user.id,
        ).first():
            return workshop
    raise HTTPException(404, "Workshop not found.")


def require_open(workshop: Workshop) -> None:
    if workshop.archived_at is not None:
        raise HTTPException(409, ARCHIVED_MESSAGE)


def _published_activities(
    db: Session, activity_ids: list[uuid.UUID], language: ProgrammingLang, owner_id: uuid.UUID,
) -> list[uuid.UUID]:
    unique_ids = list(dict.fromkeys(activity_ids))
    if not unique_ids:
        return []
    available_ids = db.query(LearningActivity.id).filter(
        LearningActivity.id.in_(unique_ids),
        LearningActivity.language == language,
        *_shareable_activity_filters(owner_id),
    ).all()
    if len(available_ids) != len(unique_ids):
        raise HTTPException(422, "Choose published activities you can share in the workshop's language.")
    return unique_ids


def _shareable_activity_filters(owner_id):
    return (
        LearningActivity.review_status == ReviewState.published,
        LearningActivity.archived_at.is_(None),
        LearningActivity.exam_only.is_(False),
        workshop_shareable_activity_clause(owner_id),
    )


def _activity_links(db: Session, workshop_ids: list[uuid.UUID], *, visible_only: bool = True):
    query = db.query(WorkshopActivity).join(LearningActivity, LearningActivity.id == WorkshopActivity.activity_id)
    if visible_only:
        query = query.join(Workshop, Workshop.id == WorkshopActivity.workshop_id).filter(
            *_shareable_activity_filters(Workshop.created_by),
        )
    return query.filter(WorkshopActivity.workshop_id.in_(workshop_ids)).order_by(
        WorkshopActivity.position, LearningActivity.sequence_order, LearningActivity.id,
    )


def _published_exam_dates(db: Session, workshop_ids: list[uuid.UUID], user: Profile):
    query = db.query(Exam).select_from(Exam).join(ExamAssignment, ExamAssignment.exam_id == Exam.id).filter(
        ExamAssignment.workshop_id.in_(workshop_ids),
        Exam.published_at.is_not(None),
    )
    if user.role == UserRole.student:
        return query.filter(student_exam_course_clause(user.id))
    if user.role == UserRole.instructor:
        return query.join(Workshop, Workshop.id == ExamAssignment.workshop_id).filter(Workshop.created_by == user.id)
    return query


def _workshop_views(db: Session, rows: list[Workshop], user: Profile) -> list[WorkshopView]:
    ids = [workshop.id for workshop in rows]
    if not ids:
        return []
    owners = dict(db.query(Profile.id, func.coalesce(func.nullif(Profile.display_name, ""), Profile.username))
                  .filter(Profile.id.in_({workshop.created_by for workshop in rows})).all())
    counts = dict(db.query(WorkshopMember.workshop_id, func.count(WorkshopMember.profile_id))
                  .filter(WorkshopMember.workshop_id.in_(ids))
                  .group_by(WorkshopMember.workshop_id).all())
    activities: dict[uuid.UUID, list[WorkshopActivityView]] = {workshop_id: [] for workshop_id in ids}
    now = datetime.now(timezone.utc)
    next_closes = dict(_published_exam_dates(db, ids, user).with_entities(
        ExamAssignment.workshop_id, func.min(Exam.closes_at),
    ).filter(Exam.closes_at > now).group_by(ExamAssignment.workshop_id).all())
    for link, closes_at, closed_at in _activity_links(db, ids).add_columns(
        LearningActivity.closes_at, LearningActivity.closed_at,
    ):
        activities[link.workshop_id].append(WorkshopActivityView(
            activity_id=link.activity_id, topic=link.topic, position=link.position, added_at=link.added_at,
        ))
        current = next_closes.get(link.workshop_id)
        if closed_at is None and closes_at and closes_at > now and (current is None or closes_at < current):
            next_closes[link.workshop_id] = closes_at
    return [
        WorkshopView(
            id=workshop.id,
            name=workshop.name,
            description=workshop.description,
            language=workshop.language,
            block=workshop.block,
            year_level=workshop.year_level,
            subject=workshop.subject,
            room=workshop.room,
            is_owner=can_manage(workshop, user),
            owned_by_me=workshop.created_by == user.id,
            join_code=workshop.join_code if can_manage(workshop, user) else None,
            joining_enabled=workshop.joining_enabled,
            archived=workshop.archived_at is not None,
            owner_name=owners[workshop.created_by],
            member_count=counts.get(workshop.id, 0),
            activity_ids=[link.activity_id for link in activities[workshop.id]],
            activities=activities[workshop.id],
            next_closes_at=next_closes.get(workshop.id),
        )
        for workshop in rows
    ]


def _view(db: Session, workshop: Workshop, user: Profile) -> WorkshopView:
    return _workshop_views(db, [workshop], user)[0]


def _new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))


def _save_with_new_code(db: Session, workshop: Workshop) -> None:
    for _ in range(3):
        code = _new_code()
        if code == workshop.join_code:
            continue
        try:
            with db.begin_nested():
                workshop.join_code = code
                db.add(workshop)
                db.flush()
            return
        except IntegrityError as exc:
            constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
            if constraint not in JOIN_CODE_CONSTRAINTS:
                raise
    raise HTTPException(503, "Could not make a unique workshop code. Try again.")


@router.get("", response_model=list[WorkshopView])
def list_workshops(
    archived: bool = False,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkshopView]:
    query = db.query(Workshop)
    if current_user.role != UserRole.admin:
        query = query.join(WorkshopMember, WorkshopMember.workshop_id == Workshop.id).filter(
            WorkshopMember.profile_id == current_user.id,
        )
    archived_filter = Workshop.archived_at.is_not(None) if archived else Workshop.archived_at.is_(None)
    rows = query.filter(archived_filter).order_by(Workshop.created_at.desc(), Workshop.id.desc()).limit(100).all()
    return _workshop_views(db, rows, current_user)


@router.post("", response_model=WorkshopView, status_code=status.HTTP_201_CREATED)
def create_workshop(
    payload: CreateWorkshop,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    if current_user.role not in (UserRole.instructor, UserRole.admin):
        raise HTTPException(403, "Faculty or admin access is required to create a workshop.")
    activity_ids = _published_activities(db, payload.activity_ids, payload.language, current_user.id)
    reserve("workshop_create", current_user.id, session=db, commit=True)
    workshop = Workshop(
        name=payload.name, description=payload.description or None,
        language=payload.language, created_by=current_user.id,
        block=payload.block, year_level=payload.year_level, subject=payload.subject, room=payload.room,
    )
    _save_with_new_code(db, workshop)
    db.add(WorkshopMember(workshop_id=workshop.id, profile_id=current_user.id))
    db.add_all(WorkshopActivity(workshop_id=workshop.id, activity_id=activity_id, position=position)
               for position, activity_id in enumerate(activity_ids))
    db.commit()
    return _view(db, workshop, current_user)


@router.post("/join", response_model=WorkshopView)
def join_workshop(
    payload: JoinWorkshop,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    code = payload.code.replace("-", "").upper()
    if len(code) != 8 or any(char not in CODE_ALPHABET for char in code):
        raise HTTPException(422, "Enter the eight-character workshop code.")
    # Charge a valid-format guess before lookup, without requiring a second connection.
    reserve("workshop_join", current_user.id, session=db, commit=True)
    workshop = db.query(Workshop).filter(Workshop.join_code == code).with_for_update().one_or_none()
    if workshop is None:
        raise HTTPException(404, "No workshop matches that code.")
    if workshop.archived_at is not None or not workshop.joining_enabled:
        raise HTTPException(409, CLOSED_JOIN_MESSAGE)
    if current_user.role == UserRole.student and workshop.language != current_user.enrolled_language:
        raise HTTPException(409, "This workshop uses a different language track. Change your track before joining.")
    if not db.query(WorkshopMember.id).filter_by(workshop_id=workshop.id, profile_id=current_user.id).first():
        db.add(WorkshopMember(workshop_id=workshop.id, profile_id=current_user.id))
    db.commit()
    return _view(db, workshop, current_user)


@router.get("/{workshop_id}", response_model=WorkshopView)
def workshop_detail(
    workshop_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    return _view(db, get_workshop(db, workshop_id, current_user), current_user)


@router.patch("/{workshop_id}", response_model=WorkshopView)
def update_workshop(
    workshop_id: uuid.UUID,
    payload: UpdateWorkshop,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    workshop = get_workshop(db, workshop_id, current_user, manage=True, lock=True)
    require_open(workshop)
    changes = payload.model_dump(exclude_unset=True)
    if "description" in changes:
        changes["description"] = changes["description"] or None
    for key, value in changes.items():
        setattr(workshop, key, value)
    db.commit()
    return _view(db, workshop, current_user)


@router.post("/{workshop_id}/code", response_model=WorkshopView)
def reset_workshop_code(
    workshop_id: uuid.UUID,
    payload: WorkshopMutation | None = None,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    workshop = get_workshop(db, workshop_id, current_user, manage=True, lock=True)
    require_open(workshop)
    reserve("workshop_code", current_user.id, session=db)
    _save_with_new_code(db, workshop)
    db.commit()
    return _view(db, workshop, current_user)


@router.post("/{workshop_id}/archive", response_model=WorkshopView)
def archive_workshop(
    workshop_id: uuid.UUID,
    payload: WorkshopMutation | None = None,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    workshop = get_workshop(db, workshop_id, current_user, manage=True, lock=True)
    require_open(workshop)
    workshop.archived_at = datetime.now(timezone.utc)
    db.commit()
    return _view(db, workshop, current_user)


@router.post("/{workshop_id}/restore", response_model=WorkshopView)
def restore_workshop(
    workshop_id: uuid.UUID,
    payload: WorkshopMutation | None = None,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    workshop = get_workshop(db, workshop_id, current_user, manage=True, lock=True)
    workshop.archived_at = None
    db.commit()
    return _view(db, workshop, current_user)


@router.get("/{workshop_id}/people", response_model=WorkshopPeople)
def workshop_people(
    workshop_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopPeople:
    workshop = get_workshop(db, workshop_id, current_user)
    instructor = db.get(Profile, workshop.created_by)
    students = _workshop_students(db, workshop.id).all()
    if can_manage(workshop, current_user):
        members = [
            ManagedWorkshopStudent(id=p.id, username=p.username, display_name=p.display_name,
                                   school_id=p.school_id, year_level=p.year_level, block_section=p.block_section)
            for p in students
        ]
    else:
        members = [WorkshopStudent(username=p.username) for p in students]
    return WorkshopPeople(instructor=WorkshopStudent(username=instructor.username), students=members)


def _workshop_students(db: Session, workshop_id: uuid.UUID):
    return db.query(Profile).join(WorkshopMember, WorkshopMember.profile_id == Profile.id).filter(
        WorkshopMember.workshop_id == workshop_id, Profile.role == UserRole.student,
    ).order_by(Profile.username, Profile.id)


@router.get("/{workshop_id}/progress", response_model=WorkshopProgress)
def workshop_progress(
    workshop_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopProgress:
    workshop = get_workshop(db, workshop_id, current_user, manage=True)
    activities = [WorkshopActivityOption(id=activity.id, title=activity.title or activity.topic_concept,
                                         activity_type=activity.activity_type)
                  for _, activity in _activity_links(db, [workshop.id]).add_entity(LearningActivity)]
    students = _workshop_students(db, workshop.id).all()
    attempts = {}
    if students and activities:
        facts = db.query(ActivityAttempt.student_id, ActivityAttempt.activity_id, func.bool_or(ActivityAttempt.is_successful))
        for student_id, activity_id, solved in facts.filter(
            ActivityAttempt.student_id.in_([student.id for student in students]),
            ActivityAttempt.activity_id.in_([activity.id for activity in activities]),
            practice_attempt_clause(),
        ).group_by(ActivityAttempt.student_id, ActivityAttempt.activity_id):
            attempts[student_id, activity_id] = "solved" if solved else "attempted"

    progress = []
    for student in students:
        states = {activity.id: attempts.get((student.id, activity.id), "not_started") for activity in activities}
        solved_count = sum(state == "solved" for state in states.values())
        progress.append(WorkshopProgressRow(
            id=student.id, username=student.username, display_name=student.display_name, states=states,
            completion_percent=round(100 * solved_count / len(activities)) if activities else 0,
        ))
    return WorkshopProgress(activities=activities, students=progress)


def _remove_student(db: Session, workshop: Workshop, profile_id: uuid.UUID) -> Response:
    require_open(workshop)
    # Exam start also locks this profile before checking assignment.
    student = db.query(Profile.id).filter(
        Profile.id == profile_id, Profile.role == UserRole.student,
    ).with_for_update().one_or_none()
    membership = db.query(WorkshopMember).filter_by(
        workshop_id=workshop.id, profile_id=profile_id,
    ).one_or_none()
    if student is None or membership is None:
        raise HTTPException(404, "Workshop student not found.")
    active_exam = db.query(ExamAttempt.id).join(ExamAssignment, ExamAssignment.exam_id == ExamAttempt.exam_id).filter(
        ExamAssignment.workshop_id == workshop.id,
        ExamAttempt.student_id == profile_id,
        ExamAttempt.status == "active",
        ExamAttempt.submitted_at.is_(None),
    ).first()
    if active_exam:
        raise HTTPException(409, "This student has an exam in progress for this workshop.")
    db.delete(membership)
    db.commit()
    return Response(status_code=204)


@router.delete("/{workshop_id}/members/{profile_id}", status_code=204)
def remove_workshop_student(
    workshop_id: uuid.UUID,
    profile_id: uuid.UUID,
    payload: WorkshopMutation | None = None,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    workshop = get_workshop(db, workshop_id, current_user, manage=True, lock=True)
    return _remove_student(db, workshop, profile_id)


@router.delete("/{workshop_id}/membership", status_code=204)
def leave_workshop(
    workshop_id: uuid.UUID,
    payload: WorkshopMutation | None = None,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    if current_user.role != UserRole.student:
        raise HTTPException(403, "Only students can leave a workshop.")
    workshop = get_workshop(db, workshop_id, current_user, lock=True)
    return _remove_student(db, workshop, current_user.id)


@router.get("/{workshop_id}/activities", response_model=list[WorkshopQuest])
def workshop_activity_details(
    workshop_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkshopQuest]:
    workshop = get_workshop(db, workshop_id, current_user)
    rows = _activity_links(db, [workshop.id]).add_entity(LearningActivity).all()
    is_student = current_user.role == UserRole.student
    on_track = current_user.enrolled_language == workshop.language
    completed = set()
    stars = {}
    if is_student and on_track and rows:
        completed = first_visible_completions(db, current_user.id, [activity.id for _, activity in rows])
        stars = best_challenge_stars(db, current_user.id, [
            activity.id for _, activity in rows if activity.activity_type == ActivityKind.challenge
        ])
    now = datetime.now(timezone.utc)
    items = []
    for link, activity in rows:
        can_open = is_student and on_track and activity_has_opened(activity, now)
        items.append(WorkshopQuest(
            id=activity.id, title=activity.title, activity_type=activity.activity_type, language=activity.language,
            topic_concept=activity.topic_concept, difficulty_level=activity.difficulty_level,
            sequence_order=activity.sequence_order, added_at=link.added_at, xp_reward=activity.xp_reward,
            problem_statement=activity.problem_statement if not is_student or can_open else None,
            is_completed=activity.id in completed, stars=stars.get(activity.id), is_closed=activity_is_closed(activity, now),
            can_open=can_open, opens_at=activity.opens_at,
        ))
    return items


@router.get("/{workshop_id}/activities/catalog", response_model=list[WorkshopActivityOption])
def workshop_activity_catalog(
    workshop_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkshopActivityOption]:
    workshop = get_workshop(db, workshop_id, current_user, manage=True)
    shared = db.query(WorkshopActivity.activity_id).filter(WorkshopActivity.workshop_id == workshop.id)
    rows = db.query(LearningActivity.id, LearningActivity.title, LearningActivity.topic_concept,
                    LearningActivity.activity_type).filter(
        LearningActivity.language == workshop.language,
        LearningActivity.id.not_in(shared),
        *_shareable_activity_filters(workshop.created_by),
    ).order_by(LearningActivity.sequence_order, LearningActivity.id).all()
    return [WorkshopActivityOption(id=row.id, title=row.title or row.topic_concept, activity_type=row.activity_type)
            for row in rows]


@router.post("/{workshop_id}/activities", response_model=WorkshopView)
def add_workshop_activities(
    workshop_id: uuid.UUID,
    payload: AddWorkshopActivities,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    if current_user.role not in (UserRole.instructor, UserRole.admin):
        raise HTTPException(403, "Instructor or admin access is required.")
    workshop = get_workshop(db, workshop_id, current_user, manage=True, lock=True)
    require_open(workshop)
    activity_ids = _published_activities(db, payload.activity_ids, workshop.language, workshop.created_by)
    existing = _activity_links(db, [workshop.id], visible_only=False).all()
    existing_ids = {link.activity_id for link in existing}
    new_ids = [activity_id for activity_id in activity_ids if activity_id not in existing_ids]
    start = max((link.position for link in existing), default=-1) + 1
    db.add_all(WorkshopActivity(workshop_id=workshop.id, activity_id=activity_id,
                               topic=payload.topic or None, position=position)
               for position, activity_id in enumerate(new_ids, start))
    db.commit()
    return _view(db, workshop, current_user)


@router.patch("/{workshop_id}/activities/{activity_id}", response_model=WorkshopView)
def update_workshop_activity(
    workshop_id: uuid.UUID,
    activity_id: uuid.UUID,
    payload: UpdateWorkshopActivity,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    workshop = get_workshop(db, workshop_id, current_user, manage=True, lock=True)
    require_open(workshop)
    links = _activity_links(db, [workshop.id]).all()
    link = next((row for row in links if row.activity_id == activity_id), None)
    if link is None:
        raise HTTPException(404, "Workshop activity not found.")
    if "topic" in payload.model_fields_set:
        link.topic = payload.topic or None
    if "position" in payload.model_fields_set:
        links.remove(link)
        links.insert(payload.position, link)
        for position, row in enumerate(links):
            row.position = position
    db.commit()
    return _view(db, workshop, current_user)


@router.delete("/{workshop_id}/activities/{activity_id}", response_model=WorkshopView)
def remove_workshop_activity(
    workshop_id: uuid.UUID,
    activity_id: uuid.UUID,
    payload: WorkshopMutation | None = None,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkshopView:
    workshop = get_workshop(db, workshop_id, current_user, manage=True, lock=True)
    require_open(workshop)
    link = db.query(WorkshopActivity).filter_by(workshop_id=workshop.id, activity_id=activity_id).one_or_none()
    if link is None:
        raise HTTPException(404, "Workshop activity not found.")
    db.delete(link)
    db.commit()
    return _view(db, workshop, current_user)


@router.get("/{workshop_id}/announcements", response_model=list[AnnouncementView])
def list_workshop_announcements(
    workshop_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workshop = get_workshop(db, workshop_id, current_user)
    return db.query(WorkshopAnnouncement).filter_by(workshop_id=workshop.id).order_by(
        WorkshopAnnouncement.pinned.desc(), WorkshopAnnouncement.created_at.desc(), WorkshopAnnouncement.id.desc(),
    ).all()


@router.post("/{workshop_id}/announcements", response_model=AnnouncementView, status_code=201)
def post_workshop_announcement(
    workshop_id: uuid.UUID,
    payload: CreateAnnouncement,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workshop = get_workshop(db, workshop_id, current_user, manage=True, lock=True)
    if workshop.created_by != current_user.id:
        raise HTTPException(403, "Only the workshop owner can post announcements.")
    require_open(workshop)
    reserve("workshop_announcement", current_user.id, session=db)
    announcement = WorkshopAnnouncement(workshop_id=workshop.id, author_id=current_user.id, **payload.model_dump())
    db.add(announcement)
    db.commit()
    return announcement


def _announcement_for_update(
    db: Session, workshop_id: uuid.UUID, announcement_id: uuid.UUID, user: Profile,
) -> WorkshopAnnouncement:
    workshop = get_workshop(db, workshop_id, user, manage=True, lock=True)
    require_open(workshop)
    announcement = db.query(WorkshopAnnouncement).filter_by(id=announcement_id, workshop_id=workshop.id).one_or_none()
    if announcement is None:
        raise HTTPException(404, "Announcement not found.")
    return announcement


@router.patch("/{workshop_id}/announcements/{announcement_id}", response_model=AnnouncementView)
def update_workshop_announcement(
    workshop_id: uuid.UUID,
    announcement_id: uuid.UUID,
    payload: UpdateAnnouncement,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    announcement = _announcement_for_update(db, workshop_id, announcement_id, current_user)
    reserve("workshop_announcement", current_user.id, session=db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(announcement, key, value)
    db.commit()
    return announcement


@router.delete("/{workshop_id}/announcements/{announcement_id}", status_code=204)
def delete_workshop_announcement(
    workshop_id: uuid.UUID,
    announcement_id: uuid.UUID,
    payload: WorkshopMutation | None = None,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    announcement = _announcement_for_update(db, workshop_id, announcement_id, current_user)
    db.delete(announcement)
    db.commit()
    return Response(status_code=204)


@router.get("/{workshop_id}/upcoming", response_model=list[UpcomingItem])
def workshop_upcoming(
    workshop_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UpcomingItem]:
    workshop = get_workshop(db, workshop_id, current_user)
    now = datetime.now(timezone.utc)
    through = now + timedelta(days=7)
    activities = _activity_links(db, [workshop.id]).add_entity(LearningActivity).filter(
        LearningActivity.closed_at.is_(None),
        LearningActivity.closes_at > now,
        LearningActivity.closes_at <= through,
    ).all()
    exams = _published_exam_dates(db, [workshop.id], current_user).filter(
        Exam.closes_at > now, Exam.opens_at <= through,
    ).all()
    items = [UpcomingItem(
        id=activity.id, title=activity.title or activity.topic_concept, kind=activity.activity_type.value,
        opens_at=activity.opens_at, closes_at=activity.closes_at,
    ) for _, activity in activities]
    items.extend(UpcomingItem(
        id=exam.id, title=exam.title, kind="exam", opens_at=exam.opens_at, closes_at=exam.closes_at,
    ) for exam in exams)
    return sorted(items, key=lambda item: (item.closes_at, item.id))

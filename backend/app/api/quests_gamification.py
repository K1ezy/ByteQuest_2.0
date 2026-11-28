"""Quest map, quiz grading, and language-track leaderboard endpoints."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.quotas import reserve
from app.core.security import get_current_user
from app.models.entities import (
    ActivityAttempt,
    ActivityKind,
    Badge,
    LearningActivity,
    Profile,
    ProgrammingLang,
    ReviewState,
    StudentBadge,
    TestCase,
    UserRole,
)
from app.services.activity_preview import ActivityPreview, practice_preview
from app.services.gamification.badges import award_badges
from app.services.gamification.completion_rewards import completed_activity_ids
from app.services.gamification.codex import CodexResponse, codex_summary
from app.services.gamification.mastery_map import MasteryMapResponse, first_visible_completions, mastery_map
from app.services.gamification.progression import grant_xp
from app.services.gamification.rollout import MechanicState, mechanic_state
from app.services.gamification.solve_quality import best_challenge_stars
from app.services.gamification.progress_recap import RECAP_PERIODS, ProgressRecap, progress_recap
from app.services.workspace_common import as_aware
from app.services.gamification.quiz_content import (
    PublicQuizQuestion,
    StoredQuizQuestion,
    parse_quiz_questions,
    public_question,
)
from app.services.gamification.sequencer import (
    QUIZ_MASTERY_SCORE,
    determine_recommendation,
    determine_next_task_rule_based,
)
from app.services.attempt_visibility import (
    activity_is_closed,
    learner_visible_attempt_clause,
    published_student_clause,
)
from app.services.ml_predictor.audit import record_prediction_outcome
from app.services.ml_predictor.shadow import record_shadow_prediction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/quests", tags=["Quests & Gamification"])
gamification_router = APIRouter(prefix="/api/v1/gamification", tags=["Quests & Gamification"])


class QuizSubmissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    activity_id: uuid.UUID
    answers: dict[str, str] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Map of question IDs to selected answer keys.",
    )
    time_spent_seconds: int = Field(default=0, ge=0, le=86_400)


class SampleCase(BaseModel):
    stdin: str
    expected_stdout: str


class QuestCard(BaseModel):
    id: uuid.UUID
    title: Optional[str] = None
    activity_type: ActivityKind
    language: ProgrammingLang
    topic_concept: str
    difficulty_level: int
    sequence_order: int
    # 1-based place in this learner's own list. sequence_order is global across every
    # course on the track, so it would number a new class's first quest #10.
    position: int = 0
    added_at: datetime
    added_at_estimated: bool
    closes_at: Optional[datetime] = None
    xp_reward: int
    problem_statement: Optional[str] = None
    starter_code: Optional[str] = None
    is_completed: bool
    # The one recommended "Next up" activity; the Dashboard recommends the same one.
    next_up: bool = False
    completed_at: datetime | None = None
    # Best solve-quality stars (1-3) on a solved code challenge; None otherwise.
    stars: Optional[int] = None
    is_closed: bool = False
    pass_mark_percent: int | None = None
    quiz_questions: Optional[list[PublicQuizQuestion]] = None
    # Visible grading cases only; hidden cases never leave the server.
    sample_cases: Optional[list[SampleCase]] = None


class NextStepRecommendation(BaseModel):
    sequencer_mode: str
    recommended_action: str
    target_activity_id: Optional[uuid.UUID] = None
    rationale: str


class QuizSubmissionResponse(BaseModel):
    attempt_id: uuid.UUID
    attempt_number: int
    score_percentage: float
    correct_answers: int
    total_questions: int
    is_successful: bool
    xp_awarded: int
    new_total_xp: int
    new_level: int
    level_up: bool = False
    new_badges_unlocked: list[str]
    badge_xp_awarded: int = 0
    next_step_recommendation: NextStepRecommendation


class LeaderboardEntry(BaseModel):
    """One ranked learner. Only the chosen public handle is shared with classmates:
    pseudonym ids and generated starter handles both encode the account id."""

    rank: int
    handle: Optional[str]
    xp_points: int
    current_level: int
    is_me: bool


class LeaderboardStanding(BaseModel):
    """The caller's own position, present even when outside the top entries."""

    rank: Optional[int]  # None until the caller has earned XP on this track
    handle: Optional[str]
    xp_points: int
    current_level: int


class LeaderboardResponse(BaseModel):
    track: ProgrammingLang | None
    entries: list[LeaderboardEntry]
    you: Optional[LeaderboardStanding]  # None for staff, who are never ranked
    total_ranked: int


class ProgressAttempt(BaseModel):
    attempt_id: uuid.UUID
    activity_id: uuid.UUID
    title: Optional[str]
    activity_type: ActivityKind
    attempt_number: int
    score_percentage: float
    is_successful: bool
    xp_awarded: int
    time_spent_seconds: int
    created_at: datetime


class ProgressBadge(BaseModel):
    code: Optional[str]
    name: str
    description: str
    xp_bonus: int
    awarded_at: datetime


class StudentProgress(BaseModel):
    total_attempts: int
    attempts: list[ProgressAttempt]
    badges: list[ProgressBadge]
    next_recommendation: Optional[NextStepRecommendation]


def _ensure_student(student: Profile) -> None:
    if student.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student quest access is required.",
        )


def _load_quiz_questions(activity: LearningActivity) -> list[StoredQuizQuestion]:
    return parse_quiz_questions(activity.quiz_questions_json)


@router.get("/codex", response_model=CodexResponse)
def get_codex(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CodexResponse:
    _ensure_student(current_user)
    state = mechanic_state(db, current_user)
    if not state.codex.unlocked:
        return CodexResponse(locked=True, day=state.day, unlock=state.codex)
    summary = codex_summary(db, current_user.id)
    return CodexResponse(day=state.day, unlock=state.codex, **summary.model_dump())


@router.get("/progress-recap", response_model=ProgressRecap)
def get_progress_recap(
    days: int = 7,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProgressRecap:
    """The learner against their own recent past: never compared with classmates."""
    _ensure_student(current_user)
    if days not in RECAP_PERIODS:
        raise HTTPException(422, "Choose a period of 3, 7 or 30 days.")
    return progress_recap(db, current_user, days)


@gamification_router.get("/state", response_model=MechanicState)
def get_gamification_state(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MechanicState:
    _ensure_student(current_user)
    return mechanic_state(db, current_user)


@router.get("/mastery-map", response_model=MasteryMapResponse)
def get_mastery_map(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MasteryMapResponse:
    _ensure_student(current_user)
    return mastery_map(db, current_user)


@router.get("/{activity_id}/performance-preview", response_model=ActivityPreview)
def quest_performance_preview(
    activity_id: uuid.UUID, current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db),
) -> ActivityPreview:
    _ensure_student(current_user)
    activity = db.query(LearningActivity).filter(
        LearningActivity.id == activity_id, published_student_clause(current_user),
        LearningActivity.activity_type.in_((ActivityKind.challenge, ActivityKind.quiz)),
        LearningActivity.exam_only.is_(False),
    ).first()
    if activity is None:
        raise HTTPException(404, "Quest not found.")
    return practice_preview(db, current_user, activity)


@router.get("", response_model=list[QuestCard])
def list_published_quests(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
    details_for: uuid.UUID | None = None,
) -> list[QuestCard]:
    """List visible quests with detail for every quest or just the requested one."""
    now = datetime.now(timezone.utc)
    visibility = (
        published_student_clause(current_user, now) if current_user.role == UserRole.student
        else LearningActivity.review_status == ReviewState.published
    )
    query = db.query(LearningActivity).filter(visibility)
    activities = (
        query
        .order_by(
            LearningActivity.sequence_order.asc(),
            LearningActivity.difficulty_level.asc(),
            LearningActivity.id.asc(),
        )
        .all()
    )
    activity_ids = [activity.id for activity in activities]
    if activity_ids and current_user.role == UserRole.student:
        completions = first_visible_completions(db, current_user.id, activity_ids)
        challenge_stars = best_challenge_stars(db, current_user.id, [
            activity.id for activity in activities if activity.activity_type == ActivityKind.challenge
        ])
    else:
        completions = {}
        challenge_stars = {}

    # A single-card detail request needs no recommendation.
    next_up_id = (determine_recommendation(db, current_user)["target_activity_id"]
                  if current_user.role == UserRole.student and details_for is None else None)
    detail_challenge_ids = [
        activity.id for activity in activities
        if activity.activity_type == ActivityKind.challenge and (details_for is None or activity.id == details_for)
    ]
    samples: dict[uuid.UUID, list[SampleCase]] = {}
    if detail_challenge_ids:
        for case in (
            db.query(TestCase)
            .filter(TestCase.activity_id.in_(detail_challenge_ids), TestCase.is_hidden.is_(False))
            .order_by(TestCase.order_index.asc())
        ):
            samples.setdefault(case.activity_id, []).append(
                SampleCase(stdin=case.stdin, expected_stdout=case.expected_stdout)
            )

    quests: list[QuestCard] = []
    for activity in activities:
        include_detail = details_for is None or activity.id == details_for
        public_questions = None
        if activity.activity_type == ActivityKind.quiz:
            try:
                questions = _load_quiz_questions(activity)
                if include_detail:
                    public_questions = [public_question(question) for question in questions]
            except ValueError:
                logger.warning(
                    "Skipping published quiz with invalid content (activity_id=%s)",
                    activity.id,
                )
                continue

        published_at = as_aware(activity.published_at)
        added_at = published_at or as_aware(activity.created_at)
        opens_at = as_aware(activity.opens_at)
        if opens_at is not None and opens_at > added_at:
            added_at = opens_at
        quests.append(
            QuestCard(
                id=activity.id,
                title=activity.title,
                activity_type=activity.activity_type,
                language=activity.language,
                topic_concept=activity.topic_concept,
                difficulty_level=activity.difficulty_level,
                sequence_order=activity.sequence_order,
                added_at=added_at,
                added_at_estimated=published_at is None,
                closes_at=as_aware(activity.closes_at),
                xp_reward=activity.xp_reward,
                problem_statement=activity.problem_statement if include_detail else None,
                starter_code=activity.starter_code if include_detail else None,
                is_completed=activity.id in completions,
                next_up=activity.id == next_up_id,
                completed_at=as_aware(completions.get(activity.id)),
                stars=challenge_stars.get(activity.id),
                is_closed=activity_is_closed(activity, now),
                pass_mark_percent=(activity.pass_mark_percent or 100) if activity.activity_type == ActivityKind.challenge else None,
                quiz_questions=public_questions,
                sample_cases=samples.get(activity.id, []) if activity.id in detail_challenge_ids else None,
            )
        )
    for position, quest in enumerate(quests, start=1):
        quest.position = position
    return quests


@router.post("/submit-quiz", response_model=QuizSubmissionResponse)
def submit_conceptual_quiz(
    request: Request,
    payload: QuizSubmissionRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizSubmissionResponse:
    """Grade an enrolled student's quiz and record the result atomically."""
    _ensure_student(current_user)
    accepted_at = datetime.now(timezone.utc)
    activity = (
        db.query(LearningActivity)
        .filter(
            LearningActivity.id == payload.activity_id,
            LearningActivity.activity_type == ActivityKind.quiz,
            published_student_clause(current_user, accepted_at),
        )
        .first()
    )
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Published quiz activity not found.",
        )
    if activity_is_closed(activity, accepted_at):
        raise HTTPException(status_code=409, detail="This quiz is closed for submissions.")

    try:
        questions = _load_quiz_questions(activity)
    except ValueError as exc:
        logger.error("Published quiz %s has invalid question data.", activity.id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Quiz content is unavailable. Please contact an instructor.",
        ) from exc

    question_ids = {question.id for question in questions}
    unknown_answers = set(payload.answers) - question_ids
    if unknown_answers:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Answers contain an unknown question ID.",
        )

    valid_options = {
        question.id: {option.key.casefold() for option in question.options}
        for question in questions
    }
    for question_id, answer in payload.answers.items():
        if answer.casefold() not in valid_options[question_id]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="An answer contains an invalid option key.",
            )

    # The authenticated request already holds a connection. Reserve quota and
    # persist the grade together so simultaneous submissions need only one.
    reserve("quiz_submit", current_user.id, session=db)

    correct_count = sum(
        1
        for question in questions
        if payload.answers.get(question.id, "").casefold()
        == question.correct_answer.casefold()
    )
    total_questions = len(questions)
    score_pct = round(correct_count / total_questions * 100.0, 2)
    is_successful = score_pct >= QUIZ_MASTERY_SCORE

    # Serialize this student's XP and attempt-number updates across simultaneous
    # quiz and code submissions. The lock is held through the final commit.
    student = (
        db.query(Profile)
        .filter(Profile.id == current_user.id)
        .with_for_update()
        .populate_existing()
        .one()
    )
    attempt_count = (
        db.query(func.count(ActivityAttempt.id))
        .filter(
            ActivityAttempt.student_id == student.id,
            ActivityAttempt.activity_id == activity.id,
        )
        .scalar()
        or 0
    )
    xp_earned = (
        max(0, int(activity.xp_reward or 0))
        if is_successful and not completed_activity_ids(db, student.id, {activity.id})
        else 0
    )

    new_attempt = ActivityAttempt(
        student_id=student.id,
        activity_id=activity.id,
        attempt_number=attempt_count + 1,
        quiz_answers_json=payload.answers,
        passed_test_cases=correct_count,
        total_test_cases=total_questions,
        score_percentage=score_pct,
        is_successful=is_successful,
        time_spent_seconds=payload.time_spent_seconds,
        xp_awarded=xp_earned,
    )
    db.add(new_attempt)
    level_before = student.current_level
    grant_xp(student, xp_earned)
    db.flush()
    record_prediction_outcome(
        db,
        student_id=student.id,
        activity_id=activity.id,
        attempt_created_at=new_attempt.created_at,
        is_successful=new_attempt.is_successful,
    )

    new_badges, badge_xp = award_badges(db, student)
    recommendation = determine_next_task_rule_based(
        db, student, activity, new_attempt
    )
    db.commit()
    db.refresh(new_attempt)
    db.refresh(student)
    response_payload = QuizSubmissionResponse(
        attempt_id=new_attempt.id,
        attempt_number=new_attempt.attempt_number,
        score_percentage=score_pct,
        correct_answers=correct_count,
        total_questions=total_questions,
        is_successful=is_successful,
        xp_awarded=xp_earned,
        new_total_xp=student.xp_points,
        new_level=student.current_level,
        level_up=student.current_level > level_before,
        new_badges_unlocked=new_badges,
        badge_xp_awarded=badge_xp,
        next_step_recommendation=NextStepRecommendation(**recommendation),
    )
    record_shadow_prediction(
        db,
        student=student,
        target_activity_id=recommendation.get("target_activity_id"),
        source_attempt=new_attempt,
        shadow_ready=getattr(request.app.state, "ml_shadow_status", "disabled") == "ready",
    )

    return response_payload


LEADERBOARD_SIZE = 10


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_gamification_leaderboard(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LeaderboardResponse:
    """Rank active students on the caller's track who have earned XP.

    Ties share a rank (1, 2, 2, 4). The caller's own standing is always returned,
    so a learner outside the top entries still sees where they are.
    """
    track = current_user.enrolled_language
    if track is None:
        return LeaderboardResponse(track=None, entries=[], you=None, total_ranked=0)
    ranked = (
        Profile.role == UserRole.student,
        Profile.enrolled_language == track,
        Profile.account_status == "active",
        Profile.xp_points > 0,
    )
    rank = func.rank().over(order_by=Profile.xp_points.desc()).label("rank")
    top = (
        db.query(Profile, rank)
        .filter(*ranked)
        .order_by(Profile.xp_points.desc(), Profile.id.asc())
        .limit(LEADERBOARD_SIZE)
        .all()
    )
    total_ranked = db.query(func.count(Profile.id)).filter(*ranked).scalar() or 0

    def public_handle(profile: Profile) -> Optional[str]:
        return profile.username if profile.handle_chosen else None

    you = None
    if current_user.role == UserRole.student:
        own_rank = None
        if current_user.xp_points > 0 and current_user.account_status == "active":
            own_rank = next((int(r) for student, r in top if student.id == current_user.id), None)
            if own_rank is None:
                ahead = db.query(func.count(Profile.id)).filter(
                    *ranked, Profile.xp_points > current_user.xp_points).scalar() or 0
                own_rank = ahead + 1
        you = LeaderboardStanding(
            rank=own_rank,
            handle=public_handle(current_user),
            xp_points=current_user.xp_points,
            current_level=current_user.current_level,
        )

    return LeaderboardResponse(
        track=track,
        entries=[
            LeaderboardEntry(
                rank=int(r),
                handle=public_handle(student),
                xp_points=student.xp_points,
                current_level=student.current_level,
                is_me=student.id == current_user.id,
            )
            for student, r in top
        ],
        you=you,
        total_ranked=total_ranked,
    )


@router.get("/progress", response_model=StudentProgress)
def get_student_progress(
    limit: int = 50,
    offset: int = 0,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudentProgress:
    """Return a bounded, private attempt history and earned badges for this student."""
    _ensure_student(current_user)
    if limit < 1 or limit > 100 or offset < 0 or offset > 100_000:
        raise HTTPException(status_code=422, detail="Progress pagination is outside the supported range.")

    total_attempts = (
        db.query(func.count(ActivityAttempt.id))
        .filter(ActivityAttempt.student_id == current_user.id, learner_visible_attempt_clause())
        .scalar()
        or 0
    )
    rows = (
        db.query(ActivityAttempt, LearningActivity)
        .join(LearningActivity, LearningActivity.id == ActivityAttempt.activity_id)
        .filter(ActivityAttempt.student_id == current_user.id, learner_visible_attempt_clause())
        .order_by(ActivityAttempt.created_at.desc(), ActivityAttempt.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    attempts = [
        ProgressAttempt(
            attempt_id=attempt.id,
            activity_id=activity.id,
            title=activity.title,
            activity_type=activity.activity_type,
            attempt_number=attempt.attempt_number,
            score_percentage=attempt.score_percentage,
            is_successful=attempt.is_successful,
            xp_awarded=attempt.xp_awarded,
            time_spent_seconds=attempt.time_spent_seconds,
            created_at=attempt.created_at,
        )
        for attempt, activity in rows
    ]
    badge_rows = (
        db.query(Badge, StudentBadge.awarded_at)
        .join(StudentBadge, StudentBadge.badge_id == Badge.id)
        .filter(StudentBadge.student_id == current_user.id)
        .order_by(StudentBadge.awarded_at.desc(), Badge.name.asc())
        .all()
    )
    badges = [
        ProgressBadge(
            code=badge.code,
            name=badge.name,
            description=badge.description,
            xp_bonus=badge.xp_bonus,
            awarded_at=awarded_at,
        )
        for badge, awarded_at in badge_rows
    ]

    recommendation = NextStepRecommendation(
        **determine_recommendation(db, current_user)
    )
    return StudentProgress(total_attempts=total_attempts, attempts=attempts, badges=badges, next_recommendation=recommendation)

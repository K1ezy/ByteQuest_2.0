"""Quest map, quiz grading, and language-track leaderboard endpoints."""

import logging
import uuid
from datetime import datetime
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
    UserRole,
)
from app.services.gamification.badges import evaluate_and_award_badges
from app.services.gamification.progression import grant_xp
from app.services.gamification.quiz_content import (
    QuizOption,
    StoredQuizQuestion,
    parse_quiz_questions,
)
from app.services.gamification.sequencer import (
    QUIZ_MASTERY_SCORE,
    determine_track_recommendation,
    determine_next_task_rule_based,
)
from app.services.ml_predictor.audit import record_prediction_outcome
from app.services.ml_predictor.shadow import record_shadow_prediction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/quests", tags=["Quests & Gamification"])


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


class PublicQuizQuestion(BaseModel):
    id: str
    prompt: str
    options: list[QuizOption]


class QuestCard(BaseModel):
    id: uuid.UUID
    title: Optional[str] = None
    activity_type: ActivityKind
    language: ProgrammingLang
    topic_concept: str
    difficulty_level: int
    sequence_order: int
    xp_reward: int
    problem_statement: Optional[str] = None
    starter_code: Optional[str] = None
    is_completed: bool
    is_closed: bool = False
    quiz_questions: Optional[list[PublicQuizQuestion]] = None


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
    new_badges_unlocked: list[str]
    next_step_recommendation: NextStepRecommendation


class LeaderboardEntry(BaseModel):
    pseudonym_id: str
    xp_points: int
    current_level: int
    is_me: bool


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


def _public_question(question: StoredQuizQuestion) -> PublicQuizQuestion:
    return PublicQuizQuestion(
        id=question.id,
        prompt=question.prompt,
        options=question.options,
    )


@router.get("", response_model=list[QuestCard])
def list_published_quests(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[QuestCard]:
    """List safe published quest details for every signed-in role."""
    query = db.query(LearningActivity).filter(
        LearningActivity.review_status == ReviewState.published,
    )
    if current_user.role == UserRole.student:
        query = query.filter(LearningActivity.language == current_user.enrolled_language)
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
        completed_activity_ids = {
            activity_id
            for (activity_id,) in db.query(ActivityAttempt.activity_id)
            .filter(
                ActivityAttempt.student_id == current_user.id,
                ActivityAttempt.activity_id.in_(activity_ids),
                ActivityAttempt.is_successful.is_(True),
            )
            .distinct()
            .all()
        }
    else:
        completed_activity_ids = set()

    quests: list[QuestCard] = []
    for activity in activities:
        public_questions = None
        if activity.activity_type == ActivityKind.quiz:
            try:
                public_questions = [
                    _public_question(question)
                    for question in _load_quiz_questions(activity)
                ]
            except ValueError:
                logger.warning(
                    "Skipping published quiz with invalid content (activity_id=%s)",
                    activity.id,
                )
                continue

        quests.append(
            QuestCard(
                id=activity.id,
                title=activity.title,
                activity_type=activity.activity_type,
                language=activity.language,
                topic_concept=activity.topic_concept,
                difficulty_level=activity.difficulty_level,
                sequence_order=activity.sequence_order,
                xp_reward=activity.xp_reward,
                problem_statement=activity.problem_statement,
                starter_code=activity.starter_code,
                is_completed=activity.id in completed_activity_ids,
                is_closed=activity.closed_at is not None,
                quiz_questions=public_questions,
            )
        )
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
    activity = (
        db.query(LearningActivity)
        .filter(
            LearningActivity.id == payload.activity_id,
            LearningActivity.language == current_user.enrolled_language,
            LearningActivity.activity_type == ActivityKind.quiz,
            LearningActivity.review_status == ReviewState.published,
        )
        .first()
    )
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Published quiz activity not found.",
        )

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

    reserve("quiz_submit", current_user.id)

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
    prior_success = (
        db.query(ActivityAttempt.id)
        .filter(
            ActivityAttempt.student_id == student.id,
            ActivityAttempt.activity_id == activity.id,
            ActivityAttempt.is_successful.is_(True),
        )
        .first()
        is not None
    )
    xp_earned = (
        max(0, int(activity.xp_reward or 0))
        if is_successful and not prior_success
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
    grant_xp(student, xp_earned)
    db.flush()
    record_prediction_outcome(
        db,
        student_id=student.id,
        activity_id=activity.id,
        attempt_created_at=new_attempt.created_at,
        is_successful=new_attempt.is_successful,
    )

    new_badges = evaluate_and_award_badges(db, student)
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
        new_badges_unlocked=new_badges,
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


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def get_gamification_leaderboard(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LeaderboardEntry]:
    """Return the top ten students by XP in the current language track."""
    top_students = (
        db.query(Profile)
        .filter(
            Profile.role == UserRole.student,
            Profile.enrolled_language == current_user.enrolled_language,
        )
        .order_by(
            Profile.xp_points.desc(),
            Profile.current_level.desc(),
            Profile.pseudonym_id.asc(),
            Profile.id.asc(),
        )
        .limit(10)
        .all()
    )
    return [
        LeaderboardEntry(
            pseudonym_id=student.pseudonym_id,
            xp_points=student.xp_points,
            current_level=student.current_level,
            is_me=student.id == current_user.id,
        )
        for student in top_students
    ]


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
        .filter(ActivityAttempt.student_id == current_user.id)
        .scalar()
        or 0
    )
    rows = (
        db.query(ActivityAttempt, LearningActivity)
        .join(LearningActivity, LearningActivity.id == ActivityAttempt.activity_id)
        .filter(ActivityAttempt.student_id == current_user.id)
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
        **determine_track_recommendation(db, current_user)
    )
    return StudentProgress(total_attempts=total_attempts, attempts=attempts, badges=badges, next_recommendation=recommendation)

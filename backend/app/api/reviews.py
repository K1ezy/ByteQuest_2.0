"""Private recall quests and idempotent grading."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.quests_gamification import _ensure_student
from app.core.database import get_db
from app.core.quotas import MANILA
from app.core.security import get_current_user
from app.models.entities import ConceptReview, Profile, ProgrammingLang, _utcnow
from app.services.gamification.badges import award_badges
from app.services.gamification.mastery_map import first_visible_completions, visible_concept_activities
from app.services.gamification.memory import (
    MIN_REVIEW_SIZE, REVIEW_SIZE, REVIEW_XP, ReviewHistory, ReviewOverview, eligible_concepts, memory_schedule,
    resolve_questions, review_histories, review_is_due, review_overview, review_passed, review_size, select_question_refs,
)
from app.services.gamification.progression import grant_xp
from app.services.gamification.quiz_content import PublicQuizQuestion, StoredQuizQuestion, public_question
from app.services.gamification.rollout import MechanicState, MechanicUnlock, mechanic_state

router = APIRouter(prefix="/api/v1/reviews", tags=["Mastery Memory"])


class StartReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    language: ProgrammingLang  # the same concept is reviewed separately per language (ADR 0001)
    concept: str = Field(min_length=1, max_length=100)


class SubmitReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: dict[str, str] = Field(min_length=MIN_REVIEW_SIZE, max_length=REVIEW_SIZE)


class ReviewResult(BaseModel):
    correct: int
    total: int
    passed: bool
    xp_awarded: int
    new_total_xp: int
    new_level: int
    level_up: bool
    new_badges_unlocked: list[str]
    badge_xp_awarded: int = 0
    next_due_at: datetime
    next_check_days: int
    stage: int


class ReviewResponse(BaseModel):
    id: uuid.UUID
    language: ProgrammingLang
    concept: str
    stage: int
    questions: list[PublicQuizQuestion]
    result: ReviewResult | None = None


class ReviewOverviewResponse(ReviewOverview):
    locked: bool
    day: int
    unlock: MechanicUnlock


def _require_memory(state: MechanicState) -> None:
    if not state.memory.unlocked:
        raise HTTPException(409, f"Mastery Memory unlocks on day {state.memory.unlock_day}.")


def _locked_student(db: Session, current_user: Profile) -> Profile:
    _ensure_student(current_user)
    student = db.query(Profile).filter(Profile.id == current_user.id).with_for_update().populate_existing().one_or_none()
    if student is None or student.account_status != "active":
        raise HTTPException(403, "This account is unavailable.")
    _ensure_student(student)
    return student


def _student_review_query(db: Session, student: Profile, review_id: uuid.UUID):
    return db.query(ConceptReview).filter(
        ConceptReview.id == review_id,
        ConceptReview.student_id == student.id,
    )


def _question_id(index: int) -> str:
    # Source quiz IDs can repeat across quizzes in the same review.
    return f"q{index + 1}"


def _public_review(review: ConceptReview, questions: list[StoredQuizQuestion]) -> ReviewResponse:
    if review.status == "open" and len(questions) != review.total:
        raise HTTPException(409, "The quiz content changed. Return to the dashboard to start a new review.")
    return ReviewResponse(
        id=review.id, language=review.language, concept=review.concept, stage=review.stage,
        questions=[public_question(question, question_id=_question_id(index)) for index, question in enumerate(questions)],
        result=ReviewResult.model_validate(review.answers_json["result"]) if review.status != "open" else None,
    )


@router.get("", response_model=ReviewOverviewResponse)
def get_reviews(
    current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db),
) -> ReviewOverviewResponse:
    _ensure_student(current_user)
    now = _utcnow()
    rollout = mechanic_state(db, current_user, now)
    if not rollout.memory.unlocked:
        return ReviewOverviewResponse(locked=True, day=rollout.day, unlock=rollout.memory, concepts=[], due_count=0)
    activities, quizzes = visible_concept_activities(db, current_user, now)
    completions = first_visible_completions(db, current_user.id, [activity.id for activity in activities])
    overview = review_overview(db, current_user, activities, quizzes, completions, now)
    return ReviewOverviewResponse(locked=False, day=rollout.day, unlock=rollout.memory, **overview.model_dump())


@router.post("/start", response_model=ReviewResponse)
def start_review(
    payload: StartReviewRequest, current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db),
) -> ReviewResponse:
    student = _locked_student(db, current_user)
    now = _utcnow()
    _require_memory(mechanic_state(db, student, now))
    concept_key = (payload.language, payload.concept)
    activities, quizzes = visible_concept_activities(db, student, now, key=concept_key)
    completions = first_visible_completions(db, student.id, [activity.id for activity in activities])
    first_success = eligible_concepts(activities, quizzes, completions).get(concept_key)
    if first_success is None:
        raise HTTPException(404, "This concept is not available for review yet.")
    history = review_histories(db, student, key=concept_key).get(concept_key) or ReviewHistory()
    item = memory_schedule(concept_key, first_success, history, now)
    if history.open:
        questions = resolve_questions(history.open.question_refs, quizzes)
        if len(questions) == history.open.total:
            return _public_review(history.open, questions)
        # A newly published quiz version may have retired an open review's source.
        db.delete(history.open)
        db.flush()
    elif not review_is_due(item):
        next_check = item.due_at.astimezone(MANILA).strftime("%b %d, %Y")
        raise HTTPException(409, f"Not due yet, next check on {next_check}.")

    review_id = uuid.uuid4()
    size = review_size(sum(len(questions) for questions in quizzes.values()))
    refs = select_question_refs(review_id, quizzes, history.latest.question_refs if history.latest else None, size)
    review = ConceptReview(
        id=review_id, student_id=student.id, language=payload.language, concept=payload.concept,
        stage=item.stage, status="open", total=size, question_refs=refs,
    )
    db.add(review)
    response = _public_review(review, resolve_questions(refs, quizzes))
    db.commit()
    return response


@router.get("/{review_id}", response_model=ReviewResponse)
def get_review(
    review_id: uuid.UUID, current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db),
) -> ReviewResponse:
    _ensure_student(current_user)
    review = _student_review_query(db, current_user, review_id).first()
    if review is None:
        raise HTTPException(404, "This review is unavailable.")
    questions = []
    if review.status == "open":
        _require_memory(mechanic_state(db, current_user))
        _, quizzes = visible_concept_activities(db, current_user, key=(review.language, review.concept))
        questions = resolve_questions(review.question_refs, quizzes)
    return _public_review(review, questions)


@router.post("/{review_id}/submit", response_model=ReviewResult)
def submit_review(
    review_id: uuid.UUID, payload: SubmitReviewRequest,
    current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db),
) -> ReviewResult:
    student = _locked_student(db, current_user)
    review = _student_review_query(db, student, review_id).with_for_update().first()
    if review is None:
        raise HTTPException(404, "This review is unavailable.")
    if review.status != "open":
        return ReviewResult.model_validate(review.answers_json["result"])

    now = _utcnow()
    _require_memory(mechanic_state(db, student, now))
    concept_key = (review.language, review.concept)
    activities, quizzes = visible_concept_activities(db, student, now, key=concept_key)
    questions = resolve_questions(review.question_refs, quizzes)
    if len(questions) != review.total:
        raise HTTPException(409, "The quiz content changed. Return to the dashboard to start a new review.")
    completions = first_visible_completions(db, student.id, [activity.id for activity in activities])
    first_success = eligible_concepts(activities, quizzes, completions).get(concept_key)
    if first_success is None:
        raise HTTPException(409, "This concept is no longer available for review.")
    question_ids = [_question_id(index) for index in range(review.total)]
    if payload.answers.keys() != set(question_ids) or any(
        payload.answers[key].casefold() not in {option.key.casefold() for option in question.options}
        for key, question in zip(question_ids, questions)
    ):
        raise HTTPException(422, "Choose one available answer for every question.")

    correct = sum(
        payload.answers[key].casefold() == question.correct_answer.casefold()
        for key, question in zip(question_ids, questions)
    )
    history = review_histories(db, student, key=concept_key)[concept_key]
    passed = review_passed(correct, review.total)
    level_before = student.current_level
    xp = REVIEW_XP if passed and review.stage not in history.earned_stages else 0
    review.status = "passed" if passed else "not_passed"
    review.submitted_at = now
    review.correct = correct
    review.xp_awarded = xp
    history.open = None
    history.record(review)
    next_check = memory_schedule(concept_key, first_success, history, now)

    # Flush the unique stage claim and profile XP before evaluating badges.
    # The result is completed in the same transaction, including on a retry.
    review.answers_json = {"answers": payload.answers}
    grant_xp(student, xp)
    db.flush()
    badges, badge_xp = award_badges(db, student)
    response = ReviewResult(
        correct=correct, total=review.total, passed=passed, xp_awarded=xp,
        new_total_xp=student.xp_points, new_level=student.current_level, level_up=student.current_level > level_before,
        new_badges_unlocked=badges, badge_xp_awarded=badge_xp, next_due_at=next_check.due_at,
        next_check_days=(next_check.due_at.astimezone(MANILA).date() - now.astimezone(MANILA).date()).days,
        stage=next_check.stage,
    )
    review.answers_json = {"answers": payload.answers, "result": response.model_dump(mode="json")}
    db.commit()
    return response

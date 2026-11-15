"""Schedule and select spaced recall from visible course quizzes."""

import random
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Literal

from pydantic import BaseModel
from sqlalchemy.orm import Session, load_only

from app.models.entities import ConceptReview, LearningActivity, Profile
from app.services.gamification.quiz_content import StoredQuizQuestion

REVIEW_INTERVAL_DAYS = (2, 7, 21, 45)
REVIEW_SIZE = 4
# Seeded course quizzes hold three questions per concept, so a concept with three is enough to recall.
MIN_REVIEW_SIZE = 3
REVIEW_XP = 10
RETRY_INTERVAL_DAYS = 1
MAX_STAGE = len(REVIEW_INTERVAL_DAYS) - 1
MemoryState = Literal["fresh", "due", "fading", "long_term"]


class MemoryConcept(BaseModel):
    concept: str
    stage: int
    state: MemoryState
    due_at: datetime
    open_review_id: uuid.UUID | None


class ReviewOverview(BaseModel):
    concepts: list[MemoryConcept]
    due_count: int


@dataclass
class ReviewHistory:
    latest: ConceptReview | None = None
    open: ConceptReview | None = None
    earned_stages: set[int] = field(default_factory=set)

    def record(self, review: ConceptReview) -> None:
        if review.status == "open":
            self.open = review
            return
        if self.latest is None or review.submitted_at > self.latest.submitted_at:
            self.latest = review
        if review.status == "passed" and review.xp_awarded > 0:
            self.earned_stages.add(review.stage)


def review_histories(db: Session, student: Profile, *, concept: str | None = None) -> dict[str, ReviewHistory]:
    query = db.query(ConceptReview).filter(
        ConceptReview.student_id == student.id, ConceptReview.language == student.enrolled_language
    )
    if concept is None:
        query = query.options(load_only(
            ConceptReview.id, ConceptReview.concept, ConceptReview.stage, ConceptReview.status,
            ConceptReview.xp_awarded, ConceptReview.submitted_at,
        ))
    else:
        query = query.filter(ConceptReview.concept == concept).options(load_only(
            ConceptReview.id, ConceptReview.concept, ConceptReview.stage, ConceptReview.status,
            ConceptReview.xp_awarded, ConceptReview.submitted_at, ConceptReview.question_refs, ConceptReview.total,
        ))
    histories = defaultdict(ReviewHistory)
    for review in query.order_by(ConceptReview.submitted_at.desc(), ConceptReview.id.desc()):
        histories[review.concept].record(review)
    return histories


def memory_schedule(concept: str, first_success: datetime, history: ReviewHistory, now: datetime) -> MemoryConcept:
    latest = history.latest
    stage = min(len(history.earned_stages), MAX_STAGE)
    anchor = max(first_success, latest.submitted_at) if latest else first_success
    next_check_days = REVIEW_INTERVAL_DAYS[stage]
    if latest and latest.status == "not_passed":
        stage = max(0, stage - 1)
        anchor = latest.submitted_at
        next_check_days = RETRY_INTERVAL_DAYS

    due_at = anchor + timedelta(days=next_check_days)
    if now < due_at:
        state = "long_term" if MAX_STAGE in history.earned_stages and stage == MAX_STAGE else "fresh"
    elif now < due_at + timedelta(days=REVIEW_INTERVAL_DAYS[stage]):
        state = "due"
    else:
        state = "fading"
    return MemoryConcept(
        concept=concept, stage=stage, state=state, due_at=due_at,
        open_review_id=history.open.id if history.open else None,
    )


def eligible_concepts(
    activities: list[LearningActivity],
    quizzes: dict[uuid.UUID, list[StoredQuizQuestion]],
    completions: dict[uuid.UUID, datetime],
) -> dict[str, datetime]:
    first_success = {}
    question_count = defaultdict(int)
    for activity in activities:
        topic = activity.topic_concept
        question_count[topic] += len(quizzes.get(activity.id, ()))
        if completed_at := completions.get(activity.id):
            first_success[topic] = min(first_success.get(topic, completed_at), completed_at)
    return {topic: completed_at for topic, completed_at in first_success.items() if question_count[topic] >= MIN_REVIEW_SIZE}


def review_size(question_pool: int) -> int:
    """Questions in one recall: up to REVIEW_SIZE, never below MIN_REVIEW_SIZE (eligibility guarantees it)."""
    return min(REVIEW_SIZE, question_pool)


def review_passed(correct: int, total: int) -> bool:
    """Recalled at least two-thirds: 3 of 4 (the quiz mastery bar) or 2 of 3. Integer maths avoids float edges."""
    return 3 * correct >= 2 * total


def review_is_due(item: MemoryConcept) -> bool:
    return item.state in {"due", "fading"}


def review_overview(
    db: Session, student: Profile, activities: list[LearningActivity], quizzes: dict[uuid.UUID, list[StoredQuizQuestion]],
    completions: dict[uuid.UUID, datetime], now: datetime,
) -> ReviewOverview:
    eligible = eligible_concepts(activities, quizzes, completions)
    histories = review_histories(db, student) if eligible else {}
    concepts = [
        memory_schedule(concept, completed_at, histories.get(concept) or ReviewHistory(), now)
        for concept, completed_at in eligible.items()
    ]
    concepts.sort(key=lambda item: (item.due_at, item.concept))
    return ReviewOverview(concepts=concepts, due_count=sum(review_is_due(item) for item in concepts))


def select_question_refs(
    review_id: uuid.UUID,
    quizzes: dict[uuid.UUID, list[StoredQuizQuestion]],
    previous_refs: list[dict] | None,
    size: int = REVIEW_SIZE,
) -> list[dict]:
    previous = {(ref["activity_id"], ref["question_index"]) for ref in previous_refs or ()}
    rng = random.Random(review_id.int)
    activity_ids = sorted(quizzes)
    rng.shuffle(activity_ids)
    unused_count = sum(len(questions) for questions in quizzes.values()) - sum(
        (str(activity_id), index) in previous
        for activity_id, questions in quizzes.items() for index in range(len(questions))
    )
    pools = []
    for activity_id in activity_ids:
        key = str(activity_id)
        indices = list(range(len(quizzes[activity_id])))
        rng.shuffle(indices)
        # A fully fresh pool takes priority. If reuse is necessary, favor
        # diversity on each pass and take each quiz's fresh questions first.
        indices.sort(key=lambda index: (key, index) in previous)
        if unused_count >= size:
            indices = [index for index in indices if (key, index) not in previous]
        pools.append((key, deque(indices)))

    refs = []
    while pools and len(refs) < size:
        next_round = []
        for activity_id, indices in pools:
            if indices:
                refs.append({"activity_id": activity_id, "question_index": indices.popleft()})
                if len(refs) == size:
                    break
                if indices:
                    next_round.append((activity_id, indices))
        pools = next_round
    return refs


def resolve_questions(refs: list[dict], quizzes: dict[uuid.UUID, list[StoredQuizQuestion]]) -> list[StoredQuizQuestion]:
    try:
        return [quizzes[uuid.UUID(ref["activity_id"])][ref["question_index"]] for ref in refs]
    except (KeyError, IndexError):
        return []

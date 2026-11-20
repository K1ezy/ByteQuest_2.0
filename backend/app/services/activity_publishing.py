"""The one set of rules for publishing an activity to students.

Every publish path (instructor workspace, Instructor Studio, admin review)
calls this, so a rule added here applies everywhere.
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.models.entities import ActivityKind, LearningActivity, Profile, ReviewState
from app.services.challenge_verification import challenge_is_verified
from app.services.gamification.quiz_content import parse_quiz_questions
from app.services.workspace_common import as_aware


def lock_activity_for_publication(db: Session, activity: LearningActivity) -> None:
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key)::bigint)"),
        {"lock_key": f"bytequest:activity-sequence:{getattr(activity.language, 'value', activity.language)}"},
    )
    # Refresh both the flag and the cases after acquiring the lock used by writers.
    db.refresh(activity, with_for_update=True)
    db.expire(activity, ["test_cases"])


def apply_publish_rules(db: Session, activity: LearningActivity, actor: Profile, *, require_review: bool = False) -> None:
    lock_activity_for_publication(db, activity)
    if activity.review_status != ReviewState.draft:
        raise HTTPException(409, "Only unpublished drafts can be published.")
    if activity.exam_only:
        raise HTTPException(409, detail={"code": "exam_only", "message": "Add this exam-only activity to a restricted exam."})
    if require_review and activity.reviewed_by is None:
        raise HTTPException(409, "Review the saved activity and confirm review before publishing.")
    if activity.activity_type == ActivityKind.challenge:
        if not activity.test_cases:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "missing_tests", "field": "test_cases", "message": "Add at least one grading case before publishing."},
            )
        if not any(not case.is_hidden for case in activity.test_cases):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "missing_sample", "field": "test_cases",
                        "message": "Make at least one grading case visible so students can run a sample."},
            )
        if not challenge_is_verified(activity):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "not_verified",
                    "message": "Verify the saved reference solution and test cases with Judge0 before publishing.",
                },
            )
    if activity.activity_type == ActivityKind.quiz:
        try:
            questions = parse_quiz_questions(activity.quiz_questions_json)
            if not 3 <= len(questions) <= 10:
                raise ValueError("A published quiz must contain between 3 and 10 questions.")
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "invalid_quiz", "message": f"Cannot publish this quiz: {exc}"},
            ) from exc
    opens_at = as_aware(activity.opens_at)
    closes_at = as_aware(activity.closes_at)
    if opens_at and closes_at and closes_at <= opens_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_schedule", "field": "closes_at", "message": "The closing time must be after the opening time."},
        )
    highest = (
        db.query(func.max(LearningActivity.sequence_order))
        .filter(
            LearningActivity.language == activity.language,
            LearningActivity.review_status == ReviewState.published,
        )
        .scalar()
        or 0
    )
    activity.sequence_order = highest + 1
    activity.review_status = ReviewState.published
    activity.reviewed_by = actor.id
    activity.published_at = datetime.now(timezone.utc)
    activity.rejection_reason = None
    # Archive every other live member of this version family, not only the original.
    # Archiving the root alone left v2 published beside v3, so students saw and could
    # submit two copies of the same challenge.
    root_id = activity.version_of or activity.id
    superseded = (
        db.query(LearningActivity)
        .filter(
            or_(LearningActivity.id == root_id, LearningActivity.version_of == root_id),
            LearningActivity.id != activity.id,
            LearningActivity.archived_at.is_(None),
            LearningActivity.review_status == ReviewState.published,
        )
        .all()
    )
    for previous in superseded:
        previous.archived_at = datetime.now(timezone.utc)

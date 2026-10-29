"""Shared serializers and derived states for the faculty/admin workspace.

The dashboard and its destination lists call the same predicates in this module
so a card count always equals the number of rows the destination shows.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import Course, InstructionalDocument, LearningActivity, ReviewState, TestCase


def as_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def iso(value: datetime | None) -> str | None:
    aware = as_aware(value)
    return aware.isoformat().replace("+00:00", "Z") if aware else None


def activity_state(activity: LearningActivity, now: datetime | None = None) -> str:
    """Draft, Scheduled, Open, Closed or Archived — the vocabulary faculty see."""
    now = now or datetime.now(timezone.utc)
    if activity.archived_at is not None:
        return "archived"
    review_status = getattr(activity.review_status, "value", activity.review_status)
    if review_status != ReviewState.published.value:
        return "draft"
    if activity.closed_at is not None:
        return "closed"
    closes_at = as_aware(activity.closes_at)
    if closes_at is not None and closes_at <= now:
        return "closed"
    opens_at = as_aware(activity.opens_at)
    if opens_at is not None and opens_at > now:
        return "scheduled"
    return "open"


def draft_state(activity: LearningActivity) -> str:
    review_status = getattr(activity.review_status, "value", activity.review_status)
    if review_status == ReviewState.published.value:
        return "published"
    if activity.rejection_reason:
        return "rejected"
    if activity.reviewed_by is not None:
        return "ready"
    return "pending"


def material_state(document: InstructionalDocument) -> str:
    if document.archived_at is not None:
        return "archived"
    status = (document.processing_status or "").lower()
    if status == "completed":
        return "ready"
    if status == "failed":
        return "failed"
    if status in {"needs_review", "needs_attention"}:
        return "needs_review"
    if status == "processing":
        return "processing"
    return status or "processing"


MATERIAL_ATTENTION_STATES = {"failed", "needs_review"}
ACTIVITY_ATTENTION_STATES = {"scheduled", "closed"}


def activity_states(activities: Iterable[LearningActivity], now: datetime | None = None) -> dict[uuid.UUID, str]:
    now = now or datetime.now(timezone.utc)
    return {activity.id: activity_state(activity, now) for activity in activities}


def attempt_counts(db: Session, activity_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, int]:
    ids = list(activity_ids)
    if not ids:
        return {}
    rows = (
        db.query(LearningActivity.id, func.count())
        .select_from(LearningActivity)
        .join(LearningActivity.attempts)
        .filter(LearningActivity.id.in_(ids))
        .group_by(LearningActivity.id)
        .all()
    )
    return {row[0]: int(row[1]) for row in rows}


def course_reference(course: Course | None) -> dict | None:
    if course is None:
        return None
    return {
        "id": str(course.id),
        "code": course.code,
        "title": course.title,
        "status": course.status,
    }


def citation_list(activity: LearningActivity) -> list[dict]:
    generation = activity.generation_json or {}
    citations = generation.get("citations") or []
    normalized: list[dict] = []
    for index, item in enumerate(citations):
        if not isinstance(item, dict):
            continue
        excerpt = (item.get("excerpt") or "").strip()
        normalized.append(
            {
                "id": item.get("chunk_id") or f"citation-{index + 1}",
                "chunk_id": item.get("chunk_id"),
                "document_id": item.get("document_id"),
                "document_title": item.get("document_title") or "Course material",
                "version_number": item.get("version_number"),
                "page_number": item.get("page_number"),
                "excerpt": excerpt,
                "available": bool(excerpt),
            }
        )
    return normalized


def generation_metadata(activity: LearningActivity) -> dict:
    generation = activity.generation_json or {}
    return {
        "model_version": generation.get("model_version"),
        "prompt_version": generation.get("prompt_version"),
        "generated_at": generation.get("generated_at"),
        "citation_count": len(generation.get("citations") or []),
    }


def student_preview(activity: LearningActivity) -> dict:
    """The student-visible view: never answer keys, hidden inputs or expected outputs."""
    review_status = getattr(activity.review_status, "value", activity.review_status)
    activity_type = getattr(activity.activity_type, "value", activity.activity_type)
    preview: dict = {
        "activity_id": str(activity.id),
        "activity_type": activity_type,
        "title": activity.title,
        "topic_concept": activity.topic_concept,
        "problem_statement": activity.problem_statement,
        "difficulty_level": activity.difficulty_level,
        "xp_reward": activity.xp_reward,
        "state": activity_state(activity),
        "opens_at": iso(activity.opens_at),
        "closes_at": iso(activity.closes_at),
        "review_status": review_status,
    }
    if activity_type == "challenge":
        preview["starter_code"] = activity.starter_code
        preview["sample_cases"] = [
            {
                "order_index": case.order_index,
                "stdin": case.stdin,
                "expected_stdout": case.expected_stdout,
            }
            for case in sorted(activity.test_cases, key=lambda item: item.order_index)
            if not case.is_hidden
        ]
        preview["hidden_case_count"] = len([case for case in activity.test_cases if case.is_hidden])
    else:
        questions = (activity.quiz_questions_json or {}).get("questions") or []
        preview["questions"] = [
            {
                "id": question.get("id"),
                "prompt": question.get("prompt"),
                "options": [
                    {"key": option.get("key"), "text": option.get("text")}
                    for option in question.get("options") or []
                ],
            }
            for question in questions
        ]
    return preview


def document_course_id(document: InstructionalDocument) -> uuid.UUID | None:
    return document.course_id


def upcoming_window(now: datetime | None = None) -> tuple[datetime, datetime]:
    now = now or datetime.now(timezone.utc)
    return now, now + timedelta(days=14)


def _test_case_payload(case: TestCase) -> dict:
    return {
        "order_index": case.order_index,
        "stdin": case.stdin,
        "expected_stdout": case.expected_stdout,
        "time_limit_ms": case.time_limit_ms,
        "memory_limit_kb": case.memory_limit_kb,
        "is_hidden": case.is_hidden,
        "weight": case.weight,
    }


def activity_detail(activity: LearningActivity, *, include_grading: bool, attempt_count: int | None = None) -> dict:
    """Full editor payload for faculty; grading content is excluded for administrators."""
    review_status = getattr(activity.review_status, "value", activity.review_status)
    activity_type = getattr(activity.activity_type, "value", activity.activity_type)
    payload = {
        "activity_id": str(activity.id),
        "activity_type": activity_type,
        "course_id": str(activity.course_id) if activity.course_id else None,
        "title": activity.title,
        "topic_concept": activity.topic_concept,
        "problem_statement": activity.problem_statement,
        "difficulty_level": activity.difficulty_level,
        "xp_reward": activity.xp_reward,
        "review_status": review_status,
        "draft_state": draft_state(activity),
        "state": activity_state(activity),
        "judge0_verified": bool(activity.judge0_verified),
        "reviewed_by": str(activity.reviewed_by) if activity.reviewed_by else None,
        "rejection_reason": activity.rejection_reason,
        "content_version": activity.content_version or 1,
        "version_number": activity.version_number or 1,
        "version_of": str(activity.version_of) if activity.version_of else None,
        "opens_at": iso(activity.opens_at),
        "closes_at": iso(activity.closes_at),
        "published_at": iso(activity.published_at),
        "archived_at": iso(activity.archived_at),
        "created_at": iso(activity.created_at),
        "source_document_id": str(activity.source_document_id) if activity.source_document_id else None,
        "generation": generation_metadata(activity),
        "citations": citation_list(activity),
        "student_preview": student_preview(activity),
    }
    if attempt_count is not None:
        payload["attempt_count"] = attempt_count
        payload["grading_locked"] = attempt_count > 0
    if include_grading:
        payload["starter_code"] = activity.starter_code
        payload["reference_solution_code"] = activity.reference_solution_code
        payload["test_cases"] = [
            _test_case_payload(case) for case in sorted(activity.test_cases, key=lambda item: item.order_index)
        ]
        payload["quiz_questions"] = activity.quiz_questions_json
        payload["verification_log"] = activity.judge0_verification_log or {}
    else:
        payload["hidden_case_count"] = len([case for case in activity.test_cases if case.is_hidden])
        payload["test_case_count"] = len(activity.test_cases)
    return payload

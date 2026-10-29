import asyncio
import hashlib
import json
import logging
import math
import uuid
from datetime import datetime, timezone
from pathlib import PurePath
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, text
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.config import settings
from app.core.quotas import reserve
from app.core.security import require_instructor
from app.models.entities import (
    ActivityKind,
    DocumentChunk,
    InstructionalDocument,
    LearningActivity,
    PlatformSetting,
    Profile,
    ProgrammingLang,
    ReviewState,
    TestCase,
)
from app.services.ai_rag.embeddings import embed_chunks_bounded, generate_embedding
from app.services.ai_rag.gemini_client import GeminiConfigurationError
from app.services.ai_rag.llm import GeminiLLMService
from app.services.ai_rag.pdf_processor import extract_chunks_from_pdf
from app.services.gamification.quiz_content import parse_quiz_questions
from app.services.judge0.client import TestCaseInput, judge0_client
from app.services.course_access import default_instructor_course_id, may_manage_course
from app.services.settings_service import get_setting_int
from app.services.storage.supabase_storage import StorageError, pdf_storage

logger = logging.getLogger(__name__)
MAX_PDF_BYTES = 10 * 1024 * 1024
EMBEDDING_BATCH_CONCURRENCY = 3
EMBEDDING_DIMENSIONS = 768
GEMINI_UNAVAILABLE_DETAIL = (
    "Gemini is not configured. Set GEMINI_API_KEY to enable document search, PDF indexing, "
    "and AI content generation."
)

router = APIRouter(prefix="/api/v1/instructor", tags=["Instructor RAG & Content Generation"])


async def _validate_form_keys(request: Request, allowed: set[str]) -> None:
    form = await request.form()
    keys = [key for key, _ in form.multi_items()]
    if len(keys) != len(set(keys)) or set(keys) - allowed:
        raise HTTPException(status_code=422, detail="The form contains unknown or repeated fields.")


async def validate_document_form(request: Request) -> None:
    await _validate_form_keys(request, {"file", "title", "description", "language_tag", "topic_concept"})


async def validate_generation_form(request: Request) -> None:
    await _validate_form_keys(request, {"topic_query", "language", "difficulty"})


def _gemini_unavailable_http_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=GEMINI_UNAVAILABLE_DETAIL,
    )


class TestCaseSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_index: int = Field(ge=0)
    stdin: str = Field(default="", max_length=20_000)
    expected_stdout: str = Field(max_length=20_000)
    time_limit_ms: int = Field(default=2000, ge=250, le=15_000)
    memory_limit_kb: int = Field(default=256_000, ge=32_000, le=1_048_576)
    is_hidden: bool = False
    # Gemini's structured-output schema does not support JSON Schema's
    # ``exclusiveMinimum``; use an inclusive positive floor it can represent.
    weight: float = Field(default=1.0, ge=0.01, le=100)


class GeneratedChallengeSchema(BaseModel):
    title: str = Field(..., min_length=3, max_length=255, description="Clear title for the programming challenge.")
    problem_statement: str = Field(
        ..., min_length=20, max_length=20_000,
        description="Detailed description with input/output format and constraints."
    )
    starter_code: str = Field(..., max_length=50_000, description="Boilerplate starter code template for the student.")
    reference_solution_code: str = Field(
        ..., min_length=1, max_length=50_000,
        description="Fully working reference solution in the target language."
    )
    difficulty_level: int = Field(..., ge=1, le=5)
    xp_reward: int = Field(50, ge=10, le=10_000)
    test_cases: List[TestCaseSchema] = Field(
        ..., min_length=3, max_length=20,
        description="At least 3 test cases including sample and hidden cases."
    )

    @field_validator("title", "problem_statement", "reference_solution_code")
    @classmethod
    def reject_blank_generated_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field must contain non-whitespace text.")
        return value

    @field_validator("test_cases")
    @classmethod
    def validate_test_case_order(cls, value: List[TestCaseSchema]) -> List[TestCaseSchema]:
        indexes = [case.order_index for case in value]
        if len(indexes) != len(set(indexes)):
            raise ValueError("Test case order_index values must be unique.")
        return value


class GeneratedQuizOptionSchema(BaseModel):
    key: str = Field(min_length=1, max_length=32)
    text: str = Field(min_length=1, max_length=500)


class GeneratedQuizQuestionSchema(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    prompt: str = Field(min_length=1, max_length=2_000)
    options: List[GeneratedQuizOptionSchema] = Field(min_length=2, max_length=6)
    correct_answer: str = Field(min_length=1, max_length=32)

    @model_validator(mode="after")
    def validate_answer_key(self):
        keys = [option.key.casefold() for option in self.options]
        if len(keys) != len(set(keys)):
            raise ValueError("Quiz option keys must be unique.")
        if self.correct_answer.casefold() not in keys:
            raise ValueError("The correct answer must match an option key.")
        return self


class GeneratedQuizSchema(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    problem_statement: str = Field(min_length=1, max_length=2_000)
    questions: List[GeneratedQuizQuestionSchema] = Field(min_length=3, max_length=10)

    @field_validator("title", "problem_statement")
    @classmethod
    def reject_blank_quiz_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field must contain non-whitespace text.")
        return value

    @field_validator("questions")
    @classmethod
    def validate_question_ids(cls, value: List[GeneratedQuizQuestionSchema]):
        ids = [question.id.casefold() for question in value]
        if len(ids) != len(set(ids)):
            raise ValueError("Quiz question IDs must be unique.")
        return value


class DraftQuizUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=3, max_length=255)
    topic_concept: str = Field(min_length=2, max_length=100)
    problem_statement: str = Field(min_length=1, max_length=2_000)
    difficulty_level: int = Field(ge=1, le=5)
    xp_reward: int = Field(ge=10, le=10_000)
    quiz_questions_json: dict = Field(...)

    @field_validator("title", "topic_concept", "problem_statement")
    @classmethod
    def reject_blank_quiz_draft_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field must contain non-whitespace text.")
        return value

    @field_validator("quiz_questions_json")
    @classmethod
    def validate_quiz_payload(cls, value: dict) -> dict:
        try:
            questions = parse_quiz_questions(value)
        except ValueError as exc:
            raise ValueError("Quiz questions are incomplete or invalid.") from exc
        if len(questions) < 3 or len(questions) > 10:
            raise ValueError("A reviewed quiz must contain between 3 and 10 questions.")
        return {"questions": [question.model_dump() for question in questions]}


class ActivityReviewUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reviewed: bool


class DocumentMetadataUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=4_000)
    language_tag: ProgrammingLang
    topic_concept: Optional[str] = Field(None, max_length=100)


async def _retrieve_document_sources(
    db: Session,
    document: InstructionalDocument,
    topic_query: str,
    language: ProgrammingLang,
) -> list[dict]:
    """Retrieve cited, page-preserving chunks for a document.

    The returned list carries chunk id, page and excerpt so a generated draft
    keeps verifiable provenance instead of an unattributed text blob.
    """
    try:
        query_vector = await asyncio.to_thread(generate_embedding, topic_query, True)
    except GeminiConfigurationError as exc:
        raise _gemini_unavailable_http_exception() from exc
    except Exception as exc:
        logger.exception("Failed to generate a search embedding for document %s.", document.id)
        raise HTTPException(status_code=502, detail="The course search service is temporarily unavailable.") from exc
    if not isinstance(query_vector, list) or len(query_vector) != 768:
        raise HTTPException(status_code=502, detail="The search service returned an invalid query embedding.")
    vector_str = "[" + ",".join(map(str, query_vector)) + "]"
    top_k = get_setting_int(db, "rag_top_k", 5)
    try:
        threshold = float(db.query(PlatformSetting).filter(PlatformSetting.key == "rag_similarity_threshold").first().value)
    except Exception:
        threshold = 0.35
    sources: list[dict] = []
    try:
        rows = db.execute(
            text(
                """
                SELECT chunk.id, chunk.content_text, chunk.page_number
                FROM public.document_chunks AS chunk
                WHERE chunk.document_id = CAST(:doc_id AS uuid)
                  AND 1 - (chunk.embedding OPERATOR(extensions.<=>) CAST(:q_vec AS extensions.vector)) >= :match_threshold
                ORDER BY chunk.embedding OPERATOR(extensions.<=>) CAST(:q_vec AS extensions.vector)
                LIMIT :match_count
                """
            ),
            {
                "q_vec": vector_str,
                "match_threshold": threshold,
                "match_count": max(int(top_k), 1),
                "doc_id": str(document.id),
            },
        ).fetchall()
        sources = [
            {"chunk_id": str(row[0]), "content_text": row[1], "page_number": row[2]}
            for row in rows
            if row and row[1]
        ]
    except Exception:
        db.rollback()
        logger.warning("Vector retrieval failed; using bounded direct retrieval for document %s.", document.id)
        sources = [
            {"chunk_id": str(chunk.id), "content_text": chunk.content_text, "page_number": chunk.page_number}
            for chunk in db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document.id)
            .order_by(DocumentChunk.chunk_index.asc())
            .limit(max(int(top_k), 1))
            .all()
        ]
    if not sources:
        raise HTTPException(status_code=422, detail="This document has no searchable text. Reprocess or replace the PDF first.")
    for source in sources:
        source.update(
            {
                "document_id": str(document.id),
                "document_title": document.title,
                "version_number": document.version_number,
            }
        )
        source["excerpt"] = source["content_text"][:1_500]
    return sources


async def _retrieve_document_context(
    db: Session,
    document_id: uuid.UUID,
    topic_query: str,
    language: ProgrammingLang,
) -> str:
    """Backward-compatible text-only retrieval used by existing call sites."""
    document = db.query(InstructionalDocument).filter(InstructionalDocument.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Course document not found.")
    sources = await _retrieve_document_sources(db, document, topic_query, language)
    return "\n\n---\n\n".join(source["content_text"] for source in sources)


def _generation_payload(sources: list[dict], prompt_version: str) -> dict:
    return {
        "model_version": settings.GEMINI_MODEL_ID,
        "prompt_version": prompt_version,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "citations": [
            {
                "chunk_id": source["chunk_id"],
                "document_id": source["document_id"],
                "document_title": source["document_title"],
                "version_number": source["version_number"],
                "page_number": source["page_number"],
                "excerpt": source["excerpt"],
            }
            for source in sources
        ],
    }


def _serialize_quiz(activity: LearningActivity) -> dict:
    return {
        "activity_id": activity.id,
        "activity_type": activity.activity_type,
        "source_document_id": activity.source_document_id,
        "title": activity.title,
        "language": activity.language,
        "topic_concept": activity.topic_concept,
        "problem_statement": activity.problem_statement,
        "difficulty_level": activity.difficulty_level,
        "xp_reward": activity.xp_reward,
        "quiz_questions_json": activity.quiz_questions_json,
        "review_status": activity.review_status,
        "reviewed_by": activity.reviewed_by,
        "created_at": activity.created_at,
    }


def _serialize_document(document: InstructionalDocument) -> dict:
    return {
        "document_id": document.id,
        "document_family_id": document.document_family_id,
        "version_number": document.version_number,
        "supersedes_document_id": document.supersedes_document_id,
        "is_current": document.is_current,
        "archived_at": document.archived_at,
        "title": document.title,
        "description": document.description,
        "language": document.language_tag,
        "topic_concept": document.topic_concept,
        "processing_status": document.processing_status,
        "total_chunks": document.total_chunks,
        "file_size_bytes": document.file_size_bytes,
        "sha256": document.sha256,
        "created_at": document.created_at,
    }

class DraftChallengeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=3, max_length=255)
    topic_concept: str = Field(min_length=2, max_length=100)
    problem_statement: str = Field(min_length=20, max_length=20_000)
    starter_code: str = Field(max_length=50_000)
    reference_solution_code: str = Field(min_length=1, max_length=50_000)
    difficulty_level: int = Field(ge=1, le=5)
    xp_reward: int = Field(ge=10, le=10_000)
    test_cases: List[TestCaseSchema] = Field(min_length=3, max_length=20)

    @field_validator("title", "topic_concept", "problem_statement", "reference_solution_code")
    @classmethod
    def reject_blank_draft_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field must contain non-whitespace text.")
        return value

    @field_validator("test_cases")
    @classmethod
    def validate_test_case_order(cls, value: List[TestCaseSchema]) -> List[TestCaseSchema]:
        indexes = [case.order_index for case in value]
        if len(indexes) != len(set(indexes)):
            raise ValueError("Test case order_index values must be unique.")
        return value


def _serialize_challenge(activity: LearningActivity) -> dict:
    """Return instructor-only challenge details, including private grading content."""
    return {
        "activity_id": activity.id,
        "activity_type": activity.activity_type,
        "source_document_id": activity.source_document_id,
        "title": activity.title,
        "language": activity.language,
        "topic_concept": activity.topic_concept,
        "problem_statement": activity.problem_statement,
        "starter_code": activity.starter_code,
        "reference_solution_code": activity.reference_solution_code,
        "difficulty_level": activity.difficulty_level,
        "xp_reward": activity.xp_reward,
        "test_cases": [
            {
                "order_index": case.order_index,
                "stdin": case.stdin,
                "expected_stdout": case.expected_stdout,
                "time_limit_ms": case.time_limit_ms,
                "memory_limit_kb": case.memory_limit_kb,
                "is_hidden": case.is_hidden,
                "weight": case.weight,
            }
            for case in activity.test_cases
        ],
        "judge0_verified": activity.judge0_verified,
        "verification_log": activity.judge0_verification_log or {},
        "review_status": activity.review_status,
        "reviewed_by": activity.reviewed_by,
        "created_at": activity.created_at,
    }


def _get_owned_activity(
    db: Session, activity_id: uuid.UUID, current_user: Profile
) -> LearningActivity:
    activity = (
        db.query(LearningActivity)
        .options(selectinload(LearningActivity.test_cases))
        .filter(LearningActivity.id == activity_id)
        .first()
    )
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found.")
    if not _may_manage_activity(db, current_user, activity):
        raise HTTPException(status_code=404, detail="Activity not found.")
    return activity


def _challenge_validation_fingerprint(activity: LearningActivity) -> str:
    """Identify the exact saved challenge content checked by Judge0."""
    payload = {
        "title": activity.title,
        "topic_concept": activity.topic_concept,
        "problem_statement": activity.problem_statement,
        "starter_code": activity.starter_code,
        "reference_solution_code": activity.reference_solution_code,
        "difficulty_level": activity.difficulty_level,
        "xp_reward": activity.xp_reward,
        "test_cases": [
            {
                "order_index": case.order_index,
                "stdin": case.stdin,
                "expected_stdout": case.expected_stdout,
                "time_limit_ms": case.time_limit_ms,
                "memory_limit_kb": case.memory_limit_kb,
                "is_hidden": case.is_hidden,
                "weight": case.weight,
            }
            for case in sorted(activity.test_cases, key=lambda item: item.order_index)
        ],
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _may_manage_activity(db: Session, user: Profile, activity: LearningActivity) -> bool:
    """Assigned faculty may manage a course activity; authors keep legacy access."""
    role = getattr(user.role, "value", user.role)
    if role == "admin":
        return True
    if activity.created_by == user.id:
        return True
    return may_manage_course(db, user, activity.course_id)


def _may_manage_document(db: Session, user: Profile, document: InstructionalDocument) -> bool:
    role = getattr(user.role, "value", user.role)
    if role == "admin":
        return True
    if document.uploaded_by == user.id:
        return True
    return may_manage_course(db, user, document.course_id)


def _get_owned_document(db: Session, document_id: uuid.UUID, current_user: Profile) -> InstructionalDocument:
    document = db.query(InstructionalDocument).filter(InstructionalDocument.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Course document not found.")
    if not _may_manage_document(db, current_user, document):
        raise HTTPException(status_code=404, detail="Course document not found.")
    return document


async def _read_and_prepare_pdf(file: UploadFile, account_id: uuid.UUID) -> tuple[bytes, list[dict], list[list[float]]]:
    filename = file.filename or ""
    if PurePath(filename).suffix.casefold() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    content = await file.read(MAX_PDF_BYTES + 1)
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="PDF files must be 10 MiB or smaller.",
        )
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The selected file is not a valid PDF document.")
    try:
        chunks = await asyncio.to_thread(extract_chunks_from_pdf, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not chunks:
        raise HTTPException(status_code=422, detail="The PDF contains no extractable instructional text.")

    reserve("pdf_index", account_id)
    try:
        embeddings = await _embed_chunks(chunks)
    except HTTPException:
        raise
    except GeminiConfigurationError as exc:
        raise _gemini_unavailable_http_exception() from exc
    except Exception as exc:
        logger.exception("Embedding generation failed for an instructional PDF.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="PDF text was extracted, but its search index could not be created. No document was saved.",
        ) from exc
    return content, chunks, embeddings


async def _embed_chunks(chunks: list[dict]) -> list[list[float]]:
    """Embed a document in small bounded batches while preserving chunk order."""
    return await embed_chunks_bounded(
        chunks,
        on_chunk=(lambda: reserve("embedding_chunk")) if settings.GEMINI_API_KEY else None,
    )


def _embed_document_chunk(content: str) -> list[float]:
    if settings.GEMINI_API_KEY:
        reserve("embedding_chunk")
    return generate_embedding(content, False)


async def _save_pdf_document(
    *,
    db: Session,
    uploaded_by: uuid.UUID,
    title: str,
    description: Optional[str],
    language_tag: ProgrammingLang,
    topic_concept: Optional[str],
    content: bytes,
    chunks: list[dict],
    embeddings: list[list[float]],
    supersedes_document_id: Optional[uuid.UUID] = None,
) -> InstructionalDocument:
    document_id = uuid.uuid4()
    family_id = uuid.uuid4()
    storage_path = f"instructor_uploads/{uploaded_by}/{document_id}.pdf"
    await pdf_storage.upload(storage_path, content)
    try:
        supersedes = None
        if supersedes_document_id is not None:
            supersedes = (
                db.query(InstructionalDocument)
                .filter(InstructionalDocument.id == supersedes_document_id)
                .with_for_update()
                .populate_existing()
                .first()
            )
            if supersedes is None:
                raise HTTPException(status_code=404, detail="Course document version not found.")
            family_id = supersedes.document_family_id
            latest = (
                db.query(InstructionalDocument)
                .filter(InstructionalDocument.document_family_id == family_id)
                .order_by(InstructionalDocument.version_number.desc())
                .with_for_update()
                .populate_existing()
                .first()
            )
            if latest is None or latest.id != supersedes_document_id or not supersedes.is_current or supersedes.archived_at:
                raise HTTPException(status_code=409, detail="This document changed while the new version was being prepared. Refresh and try again.")
            version_number = latest.version_number + 1
            supersedes.is_current = False
        else:
            version_number = 1

        document = InstructionalDocument(
            id=document_id,
            document_family_id=family_id,
            version_number=version_number,
            is_current=True,
            supersedes_document_id=supersedes_document_id,
            uploaded_by=uploaded_by,
            title=title.strip(),
            description=description.strip() if description and description.strip() else None,
            language_tag=language_tag,
            topic_concept=topic_concept.strip() if topic_concept and topic_concept.strip() else None,
            storage_path=storage_path,
            sha256=hashlib.sha256(content).hexdigest(),
            file_size_bytes=len(content),
            processing_status="completed",
            status="ready",
            total_chunks=len(chunks),
            course_id=supersedes.course_id if supersedes is not None else default_instructor_course_id(db, uploaded_by),
        )
        db.add(document)
        db.flush()
        db.add_all([
            DocumentChunk(
                document_id=document.id,
                chunk_index=item["chunk_index"],
                page_number=item["page_number"],
                content_text=item["content_text"],
                token_count=item["token_count"],
                embedding=embedding,
            )
            for item, embedding in zip(chunks, embeddings, strict=True)
        ])
        db.commit()
        db.refresh(document)
        return document
    except Exception:
        db.rollback()
        try:
            await pdf_storage.delete(storage_path)
        except StorageError:
            logger.exception("Failed to clean up an unreferenced PDF after database save failed.")
        raise


async def _verify_challenge_snapshot(
    *,
    activity_id: uuid.UUID,
    language: ProgrammingLang,
    reference_solution_code: str,
    test_cases: list[TestCaseInput],
) -> tuple[bool, dict]:
    """Verify immutable values after releasing the request's DB transaction."""
    try:
        return await judge0_client.verify_reference_solution(
            language=language,
            reference_solution_code=reference_solution_code,
            test_cases=test_cases,
        )
    except Exception as exc:
        logger.warning("Judge0 challenge verification failed for activity %s: %s", activity_id, exc)
        return False, {"verified": False, "error": "Judge0 verification could not be completed."}


@router.get("/workspace")
def get_instructor_workspace(
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """List a bounded set of saved documents and challenges for the current instructor."""
    is_admin = current_user.role.value == "admin"
    documents_query = db.query(InstructionalDocument)
    activities_query = db.query(LearningActivity)
    if not is_admin:
        documents_query = documents_query.filter(InstructionalDocument.uploaded_by == current_user.id)
        activities_query = activities_query.filter(LearningActivity.created_by == current_user.id)

    documents = documents_query.order_by(
        InstructionalDocument.document_family_id.asc(),
        InstructionalDocument.version_number.desc(),
    ).limit(200).all()
    activities = (
        activities_query.options(selectinload(LearningActivity.test_cases))
        .order_by(LearningActivity.created_at.desc())
        .limit(100)
        .all()
    )
    document_titles = {document.id: document.title for document in documents}

    return {
        "documents": [
            _serialize_document(document)
            for document in documents
        ],
        "activities": [
            {
                "activity_id": activity.id,
                "source_document_id": activity.source_document_id,
                "source_document_title": document_titles.get(activity.source_document_id),
                "activity_type": activity.activity_type,
                "title": activity.title,
                "language": activity.language,
                "topic_concept": activity.topic_concept,
                "difficulty_level": activity.difficulty_level,
                "xp_reward": activity.xp_reward,
                "test_case_count": len(activity.test_cases),
                "quiz_question_count": len((activity.quiz_questions_json or {}).get("questions", [])),
                "judge0_verified": activity.judge0_verified,
                "review_status": activity.review_status,
                "created_at": activity.created_at,
            }
            for activity in activities
        ],
    }


@router.get("/activities/{activity_id}")
def get_instructor_challenge(
    activity_id: uuid.UUID,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Load a saved challenge for its owner to review or resume editing."""
    activity = _get_owned_activity(db, activity_id, current_user)
    if activity.activity_type == ActivityKind.quiz:
        return _serialize_quiz(activity)
    return _serialize_challenge(activity)


@router.patch("/activities/{activity_id}/quiz")
def update_instructor_quiz_draft(
    activity_id: uuid.UUID,
    payload: DraftQuizUpdate,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Save instructor-reviewed quiz content without exposing its key to students."""
    activity = (
        db.query(LearningActivity)
        .filter(LearningActivity.id == activity_id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found.")
    if not _may_manage_activity(db, current_user, activity):
        raise HTTPException(status_code=404, detail="Activity not found.")
    if activity.activity_type != ActivityKind.quiz:
        raise HTTPException(status_code=400, detail="This activity is not a conceptual quiz.")
    if activity.review_status != ReviewState.draft:
        raise HTTPException(status_code=409, detail="Published activities are immutable; create a new draft to revise it.")
    activity.title = payload.title.strip()
    activity.topic_concept = payload.topic_concept.strip()
    activity.problem_statement = payload.problem_statement.strip()
    activity.difficulty_level = payload.difficulty_level
    activity.xp_reward = payload.xp_reward
    activity.quiz_questions_json = payload.quiz_questions_json
    activity.reviewed_by = None
    db.commit()
    return _serialize_quiz(_get_owned_activity(db, activity_id, current_user))


@router.patch("/activities/{activity_id}")
async def update_instructor_draft(
    activity_id: uuid.UUID,
    payload: DraftChallengeUpdate,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Save edits to an unpublished challenge and verify the revised reference solution."""
    activity = (
        db.query(LearningActivity)
        .options(selectinload(LearningActivity.test_cases))
        .filter(LearningActivity.id == activity_id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found.")
    if not _may_manage_activity(db, current_user, activity):
        raise HTTPException(status_code=404, detail="Activity not found.")
    if activity.activity_type != ActivityKind.challenge:
        raise HTTPException(status_code=400, detail="Use the quiz review endpoint for conceptual quizzes.")
    if activity.review_status != ReviewState.draft:
        raise HTTPException(status_code=409, detail="Published challenges cannot be edited.")

    reserve("instructor_verify", current_user.id)
    activity.title = payload.title.strip()
    activity.topic_concept = payload.topic_concept.strip()
    activity.problem_statement = payload.problem_statement.strip()
    activity.starter_code = payload.starter_code
    activity.reference_solution_code = payload.reference_solution_code
    activity.difficulty_level = payload.difficulty_level
    activity.xp_reward = payload.xp_reward
    activity.reviewed_by = None
    activity.judge0_verified = False
    activity.judge0_verification_log = {"verified": False, "reason": "Content changed; revalidation required."}
    activity.test_cases = [
        TestCase(
            order_index=case.order_index,
            stdin=case.stdin,
            expected_stdout=case.expected_stdout,
            time_limit_ms=case.time_limit_ms,
            memory_limit_kb=case.memory_limit_kb,
            is_hidden=case.is_hidden,
            weight=case.weight,
        )
        for case in sorted(payload.test_cases, key=lambda item: item.order_index)
    ]
    actor_id = current_user.id
    is_admin = current_user.role.value == "admin"
    db.commit()

    activity = (
        db.query(LearningActivity)
        .options(selectinload(LearningActivity.test_cases))
        .filter(LearningActivity.id == activity_id)
        .populate_existing()
        .first()
    )
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found.")
    if activity.created_by != actor_id and not is_admin:
        raise HTTPException(status_code=404, detail="Activity not found.")
    fingerprint = _challenge_validation_fingerprint(activity)
    language = activity.language
    reference_solution_code = activity.reference_solution_code or ""
    test_case_inputs = [
        TestCaseInput(
            test_case_id=str(case.id),
            order_index=case.order_index,
            stdin=case.stdin,
            expected_stdout=case.expected_stdout,
            time_limit_ms=case.time_limit_ms,
            memory_limit_kb=case.memory_limit_kb,
            is_hidden=case.is_hidden,
            weight=case.weight,
        )
        for case in activity.test_cases
    ]
    db.rollback()
    verified, verification_log = await _verify_challenge_snapshot(
        activity_id=activity_id,
        language=language,
        reference_solution_code=reference_solution_code,
        test_cases=test_case_inputs,
    )

    activity = (
        db.query(LearningActivity)
        .options(selectinload(LearningActivity.test_cases))
        .filter(LearningActivity.id == activity_id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found.")
    if activity.created_by != actor_id and not is_admin:
        raise HTTPException(status_code=404, detail="Activity not found.")
    if activity.review_status != ReviewState.draft or _challenge_validation_fingerprint(activity) != fingerprint:
        raise HTTPException(
            status_code=409,
            detail="The saved challenge changed while Judge0 was checking it. Verify the latest draft again.",
        )
    activity.judge0_verified = verified
    activity.judge0_verification_log = verification_log
    db.commit()
    db.refresh(activity)
    return _serialize_challenge(activity)


@router.patch("/activities/{activity_id}/review")
def update_activity_review(
    activity_id: uuid.UUID,
    payload: ActivityReviewUpdate,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Persist instructor review for the exact saved draft before it can be published."""
    activity = (
        db.query(LearningActivity)
        .options(selectinload(LearningActivity.test_cases))
        .filter(LearningActivity.id == activity_id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found.")
    if not _may_manage_activity(db, current_user, activity):
        raise HTTPException(status_code=404, detail="Activity not found.")
    if activity.review_status != ReviewState.draft:
        raise HTTPException(status_code=409, detail="Only unpublished drafts can be reviewed.")

    if payload.reviewed:
        if activity.activity_type == ActivityKind.challenge:
            if not activity.judge0_verified:
                raise HTTPException(status_code=409, detail="Validate the saved reference solution with Judge0 before confirming review.")
            if len(activity.test_cases) < 3:
                raise HTTPException(status_code=409, detail="A challenge must have at least three grading cases before review.")
        else:
            try:
                questions = parse_quiz_questions(activity.quiz_questions_json)
                if not 3 <= len(questions) <= 10:
                    raise ValueError("A reviewed quiz must contain between 3 and 10 questions.")
            except ValueError as exc:
                raise HTTPException(status_code=409, detail="The saved quiz content must be valid before review.") from exc
        activity.reviewed_by = current_user.id
    elif activity.reviewed_by == current_user.id or current_user.role.value == "admin":
        activity.reviewed_by = None

    db.commit()
    activity = _get_owned_activity(db, activity_id, current_user)
    return _serialize_quiz(activity) if activity.activity_type == ActivityKind.quiz else _serialize_challenge(activity)


@router.post("/activities/{activity_id}/verify")
async def reverify_instructor_draft(
    activity_id: uuid.UUID,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Retry Judge0 verification for an unchanged draft after a temporary service failure."""
    actor_id = current_user.id
    is_admin = current_user.role.value == "admin"
    activity = _get_owned_activity(db, activity_id, current_user)
    if activity.activity_type != ActivityKind.challenge:
        raise HTTPException(status_code=400, detail="Conceptual quizzes do not require Judge0 verification.")
    if activity.review_status != ReviewState.draft:
        raise HTTPException(status_code=409, detail="Only unpublished drafts can be revalidated.")
    reserve("instructor_verify", current_user.id)
    fingerprint = _challenge_validation_fingerprint(activity)
    language = activity.language
    reference_solution_code = activity.reference_solution_code or ""
    test_case_inputs = [
        TestCaseInput(
            test_case_id=str(case.id),
            order_index=case.order_index,
            stdin=case.stdin,
            expected_stdout=case.expected_stdout,
            time_limit_ms=case.time_limit_ms,
            memory_limit_kb=case.memory_limit_kb,
            is_hidden=case.is_hidden,
            weight=case.weight,
        )
        for case in activity.test_cases
    ]
    db.rollback()
    verified, verification_log = await _verify_challenge_snapshot(
        activity_id=activity_id,
        language=language,
        reference_solution_code=reference_solution_code,
        test_cases=test_case_inputs,
    )

    activity = (
        db.query(LearningActivity)
        .options(selectinload(LearningActivity.test_cases))
        .filter(LearningActivity.id == activity_id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found.")
    if activity.created_by != actor_id and not is_admin:
        raise HTTPException(status_code=404, detail="Activity not found.")
    if activity.review_status != ReviewState.draft or _challenge_validation_fingerprint(activity) != fingerprint:
        raise HTTPException(
            status_code=409,
            detail="The saved challenge changed while Judge0 was checking it. Verify the latest draft again.",
        )
    activity.judge0_verified = verified
    activity.judge0_verification_log = verification_log
    db.commit()
    db.refresh(activity)
    return _serialize_challenge(activity)


@router.post("/documents/upload")
async def upload_and_process_pdf(
    file: UploadFile = File(...),
    title: str = Form(..., min_length=2, max_length=255),
    description: Optional[str] = Form(None, max_length=4_000),
    language_tag: ProgrammingLang = Form(...),
    topic_concept: Optional[str] = Form(None, max_length=100),
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
    _: None = Depends(validate_document_form),
):
    """
    Uploads an instructional PDF, processes it with PyMuPDF, computes 768-dim embeddings
    via gemini-embedding-2, and saves chunks into Supabase pgvector.
    """
    if len(title.strip()) < 2:
        raise HTTPException(status_code=422, detail="Document title must contain at least 2 non-space characters.")
    uploaded_by = current_user.id
    # The instructor dependency has completed its authorization query. Release
    # that read transaction before PDF parsing and remote embedding calls.
    db.rollback()
    try:
        content, chunks, embeddings = await _read_and_prepare_pdf(file, uploaded_by)
        doc_record = await _save_pdf_document(
            db=db,
            uploaded_by=uploaded_by,
            title=title,
            description=description,
            language_tag=language_tag,
            topic_concept=topic_concept,
            content=content,
            chunks=chunks,
            embeddings=embeddings,
        )
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        await file.close()
    return {
        "document_id": doc_record.id,
        "document_family_id": doc_record.document_family_id,
        "version_number": doc_record.version_number,
        "title": doc_record.title,
        "total_chunks": doc_record.total_chunks,
        "status": "completed",
    }


@router.patch("/documents/{doc_id}")
def update_document_metadata(
    doc_id: uuid.UUID,
    payload: DocumentMetadataUpdate,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Update descriptive metadata on the active version without changing its file or history."""
    document = _get_owned_document(db, doc_id, current_user)
    if not document.is_current or document.archived_at:
        raise HTTPException(status_code=409, detail="Only the active document version can be edited.")
    document.title = payload.title.strip()
    document.description = payload.description.strip() if payload.description and payload.description.strip() else None
    document.language_tag = payload.language_tag
    document.topic_concept = payload.topic_concept.strip() if payload.topic_concept and payload.topic_concept.strip() else None
    db.commit()
    return _serialize_document(document)


@router.post("/documents/{doc_id}/versions")
async def create_document_version(
    doc_id: uuid.UUID,
    file: UploadFile = File(...),
    title: str = Form(..., min_length=2, max_length=255),
    description: Optional[str] = Form(None, max_length=4_000),
    language_tag: ProgrammingLang = Form(...),
    topic_concept: Optional[str] = Form(None, max_length=100),
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
    _: None = Depends(validate_document_form),
):
    """Create an immutable replacement version while keeping prior source files and activities."""
    previous = _get_owned_document(db, doc_id, current_user)
    if not previous.is_current or previous.archived_at:
        raise HTTPException(status_code=409, detail="Only the active document version can be replaced.")
    if len(title.strip()) < 2:
        raise HTTPException(status_code=422, detail="Document title must contain at least 2 non-space characters.")
    supersedes_document_id = previous.id
    uploaded_by = current_user.id
    # Do not occupy a DB connection while extracting PDF text or indexing it.
    db.rollback()
    try:
        content, chunks, embeddings = await _read_and_prepare_pdf(file, uploaded_by)
        document = await _save_pdf_document(
            db=db,
            uploaded_by=uploaded_by,
            title=title,
            description=description,
            language_tag=language_tag,
            topic_concept=topic_concept,
            content=content,
            chunks=chunks,
            embeddings=embeddings,
            supersedes_document_id=supersedes_document_id,
        )
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        await file.close()
    return {"document_id": document.id, "document_family_id": document.document_family_id,
            "version_number": document.version_number, "title": document.title,
            "total_chunks": document.total_chunks, "status": "completed"}


@router.get("/documents/{doc_id}/download")
async def get_document_download_url(
    doc_id: uuid.UUID,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    document = _get_owned_document(db, doc_id, current_user)
    if not document.file_size_bytes or not document.sha256:
        raise HTTPException(status_code=404, detail="This older document was not retained as a downloadable PDF.")
    try:
        return {"download_url": await pdf_storage.create_download_url(document.storage_path), "expires_in_seconds": 60}
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/documents/{doc_id}/archive")
def archive_document(
    doc_id: uuid.UUID,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Soft archive a document; source files, versions, chunks, and linked activities remain intact."""
    document = _get_owned_document(db, doc_id, current_user)
    if not document.is_current or document.archived_at:
        raise HTTPException(status_code=409, detail="Only an active current version can be archived.")
    document.archived_at = datetime.now(timezone.utc)
    db.commit()
    return {"document_id": document.id, "archived_at": document.archived_at, "preserved_linked_activities": True}


@router.post("/documents/{doc_id}/restore")
def restore_document(
    doc_id: uuid.UUID,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Promote a retained historic version while preserving every other version."""
    selected = _get_owned_document(db, doc_id, current_user)
    versions = (
        db.query(InstructionalDocument)
        .filter(InstructionalDocument.document_family_id == selected.document_family_id)
        .order_by(InstructionalDocument.id.asc())
        .with_for_update()
        .all()
    )
    document = next((version for version in versions if version.id == selected.id), None)
    if document is None:
        raise HTTPException(status_code=404, detail="Course document version not found.")
    if document.is_current and document.archived_at is None:
        raise HTTPException(status_code=409, detail="This document version is already active.")
    for version in versions:
        if version.id != document.id and version.is_current:
            version.is_current = False
    db.flush()
    document.is_current = True
    document.archived_at = None
    db.commit()
    return _serialize_document(document)


@router.post("/documents/{doc_id}/reprocess")
async def reprocess_document(
    doc_id: uuid.UUID,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Rebuild the current document's chunks from its retained original PDF atomically."""
    document = _get_owned_document(db, doc_id, current_user)
    if not document.is_current or document.archived_at:
        raise HTTPException(status_code=409, detail="Only an active current document can be reprocessed.")
    expected_sha256 = document.sha256
    storage_path = document.storage_path
    actor_id = current_user.id
    is_admin = current_user.role.value == "admin"
    db.rollback()
    try:
        content = await pdf_storage.download(storage_path)
    except StorageError as exc:
        raise HTTPException(status_code=404, detail="The retained PDF is unavailable; upload it as a new version instead.") from exc
    if len(content) > MAX_PDF_BYTES or not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=422, detail="The stored file is not a valid supported PDF.")
    try:
        raw_chunks = await asyncio.to_thread(extract_chunks_from_pdf, content)
        if not raw_chunks:
            raise HTTPException(status_code=422, detail="The PDF contains no extractable instructional text.")
        reserve("pdf_index", actor_id)
        embeddings = await _embed_chunks(raw_chunks)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except GeminiConfigurationError as exc:
        raise _gemini_unavailable_http_exception() from exc
    except Exception as exc:
        logger.exception("Failed to reprocess retained instructional PDF %s.", doc_id)
        raise HTTPException(status_code=502, detail="PDF text indexing failed; the previous index is unchanged.") from exc
    try:
        document = (
            db.query(InstructionalDocument)
            .filter(InstructionalDocument.id == doc_id)
            .with_for_update()
            .populate_existing()
            .first()
        )
        if document is None:
            raise HTTPException(status_code=404, detail="Course document not found.")
        if not _may_manage_document(db, current_user, document):
            raise HTTPException(status_code=404, detail="Course document not found.")
        if (
            not document.is_current
            or document.archived_at
            or document.storage_path != storage_path
            or document.sha256 != expected_sha256
        ):
            raise HTTPException(
                status_code=409,
                detail="This document changed while it was being reprocessed. Refresh and try again.",
            )
        db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete(synchronize_session=False)
        db.add_all([
            DocumentChunk(document_id=document.id, chunk_index=item["chunk_index"], page_number=item["page_number"],
                          content_text=item["content_text"], token_count=item["token_count"], embedding=embedding)
            for item, embedding in zip(raw_chunks, embeddings, strict=True)
        ])
        document.total_chunks = len(raw_chunks)
        document.sha256 = hashlib.sha256(content).hexdigest()
        document.file_size_bytes = len(content)
        document.processing_status = "completed"
        document.status = "ready"
        db.commit()
    except HTTPException:
        # Preserve expected authorization, not-found, and concurrent-update
        # responses raised after the row is locked. Only unexpected persistence
        # errors should be reported as an internal failure.
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to save reprocessed chunks for document %s.", doc_id)
        raise HTTPException(status_code=500, detail="The refreshed search index could not be saved; the old index was restored.") from exc
    return {"document_id": document.id, "total_chunks": document.total_chunks, "status": "completed"}


@router.post("/documents/{doc_id}/generate-challenge")
async def generate_ai_coding_challenge(
    doc_id: uuid.UUID,
    topic_query: str = Form(..., min_length=2, max_length=100),
    language: ProgrammingLang = Form(...),
    difficulty: int = Form(2, ge=1, le=5),
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
    _: None = Depends(validate_generation_form),
):
    """
    Retrieves relevant PDF chunks via RAG cosine similarity, prompts Gemini LLM
    to generate a programming challenge, and enforces Rule 6 (Judge0 automated pre-validation).
    """
    doc = _get_owned_document(db, doc_id, current_user)
    if not doc.is_current or doc.archived_at:
        raise HTTPException(status_code=409, detail="Generate new activities from the active, unarchived document version.")
    if doc.processing_status != "completed":
        raise HTTPException(status_code=409, detail="Wait for document processing to complete before generating an activity.")
    actor_id = current_user.id
    is_admin = current_user.role.value == "admin"
    db.rollback()
    sources = await _retrieve_document_sources(db, doc, topic_query, language)
    context_corpus = "\n\n---\n\n".join(source["content_text"] for source in sources)
    # The retrieval query has completed; release its connection during Gemini
    # generation and Judge0 execution.
    db.rollback()

    prompt = f"""
    Based on the following instructional course material excerpt, create a high-quality coding challenge for Computer Science students.
    
    Programming Language: {language.value.upper()}
    Target Difficulty Level (1 to 5): {difficulty}
    Topic Focus: {topic_query}
    
    Instructional Excerpt:
    {context_corpus}
    
    Requirements:
    - Provide a clear problem statement with sample input/output.
    - Provide starter code template.
    - Provide a fully working reference solution in {language.value}.
    - Provide at least 3 test cases (including hidden grading test cases).
    """

    try:
        if settings.GEMINI_API_KEY:
            reserve("instructor_ai", actor_id)
        ai_challenge = await asyncio.to_thread(
            GeminiLLMService.generate_structured,
            prompt=prompt,
            response_schema=GeneratedChallengeSchema,
            system_instruction="You are an expert automated instructional designer for university Computer Science labs.",
        )
    except GeminiConfigurationError as exc:
        raise _gemini_unavailable_http_exception() from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Coding challenge generation failed for document %s.", doc_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Challenge generation failed. The source document was not changed.",
        ) from exc

    # Rule 6: Automated Judge0 Pre-validation of Reference Solution
    test_case_inputs = [
        TestCaseInput(
            test_case_id=str(uuid.uuid4()),
            order_index=tc.order_index,
            stdin=tc.stdin,
            expected_stdout=tc.expected_stdout,
            time_limit_ms=tc.time_limit_ms,
            memory_limit_kb=tc.memory_limit_kb,
            is_hidden=tc.is_hidden,
            weight=tc.weight,
        )
        for tc in ai_challenge.test_cases
    ]

    is_verified = False
    verification_log = {"verified": False, "error": "Judge0 validation could not be completed."}
    try:
        is_verified, verification_log = await judge0_client.verify_reference_solution(
            language=language,
            reference_solution_code=ai_challenge.reference_solution_code,
            test_cases=test_case_inputs,
        )
    except Exception:
        logger.warning("Judge0 pre-validation could not be completed for generated activity from document %s.", doc_id)

    source_document = (
        db.query(InstructionalDocument)
        .filter(InstructionalDocument.id == doc_id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if source_document is None:
        raise HTTPException(status_code=404, detail="Course document not found.")
    if not _may_manage_document(db, current_user, source_document):
        raise HTTPException(status_code=404, detail="Course document not found.")
    if not source_document.is_current or source_document.archived_at or source_document.processing_status != "completed":
        raise HTTPException(status_code=409, detail="The source document changed while the challenge was being generated. Refresh and try again.")

    new_activity = LearningActivity(
        source_document_id=source_document.id,
        created_by=actor_id,
        activity_type=ActivityKind.challenge,
        language=language,
        topic_concept=topic_query,
        title=ai_challenge.title,
        problem_statement=ai_challenge.problem_statement,
        starter_code=ai_challenge.starter_code,
        reference_solution_code=ai_challenge.reference_solution_code,
        difficulty_level=ai_challenge.difficulty_level,
        xp_reward=ai_challenge.xp_reward,
        judge0_verified=is_verified,
        judge0_verification_log=verification_log,
        review_status=ReviewState.draft,
        course_id=source_document.course_id,
        generation_json=_generation_payload(sources, "rag-challenge-v1"),
    )
    db.add(new_activity)
    db.flush()
    for tc in ai_challenge.test_cases:
        tc_row = TestCase(
            activity_id=new_activity.id,
            order_index=tc.order_index,
            stdin=tc.stdin,
            expected_stdout=tc.expected_stdout,
            time_limit_ms=tc.time_limit_ms,
            memory_limit_kb=tc.memory_limit_kb,
            is_hidden=tc.is_hidden,
            weight=tc.weight,
        )
        db.add(tc_row)
    db.commit()
    return _serialize_challenge(_get_owned_activity(db, new_activity.id, current_user))


@router.post("/documents/{doc_id}/generate-quiz")
async def generate_ai_conceptual_quiz(
    doc_id: uuid.UUID,
    topic_query: str = Form(..., min_length=2, max_length=100),
    language: ProgrammingLang = Form(...),
    difficulty: int = Form(2, ge=1, le=5),
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
    _: None = Depends(validate_generation_form),
):
    """Generate a private, editable conceptual quiz draft from retained course text."""
    document = _get_owned_document(db, doc_id, current_user)
    if not document.is_current or document.archived_at:
        raise HTTPException(status_code=409, detail="Generate new activities from the active, unarchived document version.")
    if document.processing_status != "completed":
        raise HTTPException(status_code=409, detail="Wait for document processing to complete before generating an activity.")
    actor_id = current_user.id
    is_admin = current_user.role.value == "admin"
    db.rollback()
    sources = await _retrieve_document_sources(db, document, topic_query, language)
    context = "\n\n---\n\n".join(source["content_text"] for source in sources)
    db.rollback()
    prompt = f"""
Create a concise conceptual assessment grounded only in the course excerpt below.
Language/track: {language.value.upper()}
Difficulty: {difficulty} of 5
Topic: {topic_query}
Create 5 distinct questions. Each needs a stable unique id, prompt, 4 answer options with unique short keys, and exactly one correct_answer equal to an option key. Avoid facts not supported by the excerpt. Do not include trick questions.

Course excerpt:
{context}
"""
    try:
        if settings.GEMINI_API_KEY:
            reserve("instructor_ai", actor_id)
        generated = await asyncio.to_thread(
            GeminiLLMService.generate_structured,
            prompt=prompt,
            response_schema=GeneratedQuizSchema,
            system_instruction="You are a careful instructor creating accurate, source-grounded introductory programming assessments.",
        )
    except GeminiConfigurationError as exc:
        raise _gemini_unavailable_http_exception() from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Conceptual quiz generation failed for document %s.", doc_id)
        raise HTTPException(status_code=502, detail="Quiz generation failed. The source document was not changed.") from exc

    question_data = {"questions": [question.model_dump() for question in generated.questions]}
    try:
        parse_quiz_questions(question_data)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Generated quiz content failed validation and was not saved.") from exc
    source_document = (
        db.query(InstructionalDocument)
        .filter(InstructionalDocument.id == doc_id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if source_document is None:
        raise HTTPException(status_code=404, detail="Course document not found.")
    if not _may_manage_document(db, current_user, source_document):
        raise HTTPException(status_code=404, detail="Course document not found.")
    if not source_document.is_current or source_document.archived_at or source_document.processing_status != "completed":
        raise HTTPException(status_code=409, detail="The source document changed while the quiz was being generated. Refresh and try again.")

    activity = LearningActivity(
        source_document_id=source_document.id,
        created_by=actor_id,
        activity_type=ActivityKind.quiz,
        language=language,
        topic_concept=topic_query.strip(),
        title=generated.title.strip(),
        problem_statement=generated.problem_statement.strip(),
        difficulty_level=difficulty,
        xp_reward=25,
        quiz_questions_json=question_data,
        review_status=ReviewState.draft,
        course_id=source_document.course_id,
        generation_json=_generation_payload(sources, "rag-quiz-v1"),
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return _serialize_quiz(activity)


@router.patch("/activities/{activity_id}/publish")
async def publish_learning_activity(
    activity_id: uuid.UUID,
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """
    Instructor review gate: approves a verified draft challenge and sets it to published
    so students can access it in the Coding Arena.
    """
    activity = (
        db.query(LearningActivity)
        .filter(LearningActivity.id == activity_id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found.")
    if not _may_manage_activity(db, current_user, activity):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only publish activities you created.",
        )
    if activity.review_status != ReviewState.draft:
        raise HTTPException(status_code=409, detail="Only unpublished drafts can be published.")
    if activity.reviewed_by is None:
        raise HTTPException(status_code=409, detail="Review the saved activity and confirm review before publishing.")

    if (
        activity.activity_type == ActivityKind.challenge
        and not activity.judge0_verified
    ):
        raise HTTPException(
            status_code=400,
            detail="Cannot publish challenge: reference solution failed Judge0 automated pre-validation.",
        )

    if activity.activity_type == ActivityKind.quiz:
        try:
            questions = parse_quiz_questions(activity.quiz_questions_json)
            if not 3 <= len(questions) <= 10:
                raise ValueError("A published quiz must contain between 3 and 10 questions.")
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="Cannot publish quiz: question content is incomplete or invalid.",
            ) from exc

    # Serialize track sequence allocation so concurrently published activities
    # cannot claim the same next position.
    sequence_lock_key = f"bytequest:activity-sequence:{activity.language.value}"
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key)::bigint)"),
        {"lock_key": sequence_lock_key},
    )
    highest_sequence = (
        db.query(func.max(LearningActivity.sequence_order))
        .filter(
            LearningActivity.language == activity.language,
            LearningActivity.review_status == ReviewState.published,
        )
        .scalar()
        or 0
    )
    activity.sequence_order = highest_sequence + 1
    activity.review_status = ReviewState.published
    activity.reviewed_by = current_user.id
    activity.published_at = datetime.now(timezone.utc)
    db.commit()
    activity = _get_owned_activity(db, activity_id, current_user)
    serialized = _serialize_quiz(activity) if activity.activity_type == ActivityKind.quiz else _serialize_challenge(activity)
    serialized["message"] = "Activity successfully published to student quest maps."
    return serialized

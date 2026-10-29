"""Course material lifecycle shared by faculty and administrator routes.

A material record exists before indexing starts, so a failed or unsearchable
PDF is still visible with its cause. Historical chunks/citations are never
deleted; only the active version changes.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from pathlib import PurePath
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.quotas import reserve
from app.models.entities import DocumentChunk, InstructionalDocument, LearningActivity, ProcessingJob, Profile
from app.services.ai_rag.embeddings import embed_chunks_bounded
from app.services.ai_rag.gemini_client import GeminiConfigurationError
from app.services.ai_rag.pdf_processor import extract_chunks_from_pdf
from app.services.audit import record_audit
from app.services.settings_service import get_setting_int
from app.services.storage.supabase_storage import StorageError, pdf_storage
from app.services.workspace_common import iso, material_state

logger = logging.getLogger(__name__)
DEFAULT_MAX_PDF_MB = 10


def _max_upload_bytes(db: Session) -> int:
    return get_setting_int(db, "pdf_upload_max_mb", DEFAULT_MAX_PDF_MB) * 1024 * 1024


def _trace_id(prefix: str = "RAG") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def serialize_material(document: InstructionalDocument, *, draft_count: int = 0) -> dict:
    return {
        "document_id": str(document.id),
        "document_family_id": str(document.document_family_id),
        "title": document.title,
        "filename": document.uploaded_original_name,
        "description": document.description,
        "topic_concept": document.topic_concept,
        "language": getattr(document.language_tag, "value", document.language_tag),
        "version_number": document.version_number,
        "is_current": bool(document.is_current),
        "archived_at": iso(document.archived_at),
        "processing_status": document.processing_status,
        "state": material_state(document),
        "processing_error": document.processing_error,
        "total_chunks": document.total_chunks,
        "file_size_bytes": document.file_size_bytes,
        "indexed_at": iso(document.indexed_at),
        "created_at": iso(document.created_at),
        "course_id": str(document.course_id) if document.course_id else None,
        "draft_count": draft_count,
        "can_retry": material_state(document) == "failed",
    }


def serialize_job(job: ProcessingJob) -> dict:
    return {
        "id": str(job.id),
        "service": job.service,
        "job_type": job.job_type,
        "status": job.status,
        "attempts": job.attempts,
        "max_attempts": job.max_attempts,
        "retryable": bool(job.retryable),
        "cause": job.cause,
        "trace_id": job.trace_id,
        "document_id": str(job.document_id) if job.document_id else None,
        "created_at": iso(job.created_at),
        "updated_at": iso(job.updated_at),
        "last_checked_at": iso(job.last_checked_at),
    }


async def _store_chunks(
    db: Session,
    *,
    document: InstructionalDocument,
    chunks: list[dict],
    embeddings: list[list[float]],
) -> None:
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()
    db.add_all(
        [
            DocumentChunk(
                document_id=document.id,
                chunk_index=item["chunk_index"],
                page_number=item["page_number"],
                content_text=item["content_text"],
                token_count=item["token_count"],
                embedding=embedding,
            )
            for item, embedding in zip(chunks, embeddings, strict=True)
        ]
    )
    document.total_chunks = len(chunks)
    document.processing_status = "completed"
    document.status = "ready"
    document.processing_error = None
    document.indexed_at = datetime.now(timezone.utc)


async def _index_stored_pdf(
    db: Session,
    *,
    document: InstructionalDocument,
    content: bytes,
    actor_id: uuid.UUID | None,
) -> tuple[bool, str | None, bool]:
    """Extract and embed a stored PDF. Returns (ready, cause, retryable)."""
    try:
        chunks = extract_chunks_from_pdf(content)
    except ValueError as exc:
        return False, str(exc), False
    if not chunks:
        return (
            False,
            "This PDF has no usable searchable text. Replace it with a searchable copy; OCR is not part of this baseline.",
            False,
        )
    try:
        if actor_id is not None:
            reserve("pdf_index", actor_id)
        embeddings = await embed_chunks_bounded(chunks)
    except GeminiConfigurationError:
        return False, "The embedding service is not configured, so the PDF could not be indexed.", True
    except HTTPException:
        raise
    except Exception:
        logger.exception("Material indexing failed for document %s.", document.id)
        return False, "The search index could not be created. The PDF was kept and can be retried.", True
    await _store_chunks(db, document=document, chunks=chunks, embeddings=embeddings)
    return True, None, False


async def upload_material(
    db: Session,
    *,
    actor: Profile,
    course_id: uuid.UUID,
    file: UploadFile,
    title: str,
    description: Optional[str],
    language_tag,
    topic_concept: Optional[str],
    replaces_document_id: Optional[uuid.UUID] = None,
) -> tuple[InstructionalDocument, ProcessingJob]:
    filename = file.filename or ""
    if PurePath(filename).suffix.casefold() != ".pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_file", "field": "file", "message": "Choose a PDF file."},
        )
    limit = _max_upload_bytes(db)
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "file_too_large",
                "field": "file",
                "message": f"The PDF must be {limit // (1024 * 1024)} MiB or smaller.",
            },
        )
    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_file", "field": "file", "message": "That file is not a valid PDF."},
        )

    family_id = uuid.uuid4()
    version_number = 1
    supersedes: InstructionalDocument | None = None
    if replaces_document_id is not None:
        supersedes = (
            db.query(InstructionalDocument)
            .filter(InstructionalDocument.id == replaces_document_id)
            .with_for_update()
            .populate_existing()
            .first()
        )
        if supersedes is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That material no longer exists."})
        if supersedes.course_id is not None and supersedes.course_id != course_id:
            raise HTTPException(
                status_code=409,
                detail={"code": "course_mismatch", "message": "A replacement PDF must belong to the same course."},
            )
        if not supersedes.is_current or supersedes.archived_at:
            raise HTTPException(
                status_code=409,
                detail={"code": "stale_version", "message": "That version is no longer active. Reload and try again."},
            )
        family_id = supersedes.document_family_id
        version_number = supersedes.version_number + 1

    document_id = uuid.uuid4()
    storage_path = f"course_materials/{course_id}/{document_id}.pdf"
    try:
        await pdf_storage.upload(storage_path, content)
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "storage_unavailable", "message": str(exc)},
        ) from exc

    try:
        document = InstructionalDocument(
            id=document_id,
            document_family_id=family_id,
            version_number=version_number,
            is_current=True,
            supersedes_document_id=supersedes.id if supersedes else None,
            uploaded_by=actor.id,
            title=title.strip(),
            description=description.strip() if description and description.strip() else None,
            language_tag=language_tag,
            topic_concept=topic_concept.strip() if topic_concept and topic_concept.strip() else None,
            storage_path=storage_path,
            sha256=hashlib.sha256(content).hexdigest(),
            file_size_bytes=len(content),
            uploaded_original_name=PurePath(filename).name[:255],
            processing_status="processing",
            status="processing",
            total_chunks=0,
            course_id=course_id,
        )
        if supersedes is not None:
            supersedes.is_current = False
        db.add(document)
        db.flush()

        job = ProcessingJob(
            service="rag_index",
            job_type="pdf_extraction",
            status="running",
            document_id=document.id,
            requested_by=actor.id,
            attempts=1,
            max_attempts=max(get_setting_int(db, "job_retry_limit", 3), 1),
            retryable=False,
            trace_id=_trace_id(),
        )
        db.add(job)
        db.commit()

        ready, cause, retryable = await _index_stored_pdf(db, document=document, content=content, actor_id=actor.id)
        if ready:
            job.status = "completed"
            job.retryable = False
            job.cause = None
            record_audit(
                db,
                actor=actor,
                action="material.uploaded",
                entity_type="material",
                entity_id=document.id,
                course_id=course_id,
                summary=f"Indexed “{document.title}” v{document.version_number} ({document.total_chunks} passages)",
            )
        else:
            document.processing_status = "needs_review" if not retryable else "failed"
            document.status = document.processing_status
            document.processing_error = cause
            job.status = "failed"
            job.retryable = retryable
            job.cause = cause
            record_audit(
                db,
                actor=actor,
                action="material.processing_failed",
                entity_type="material",
                entity_id=document.id,
                course_id=course_id,
                summary=f"“{document.title}” needs attention: {cause}",
                metadata={"trace_id": job.trace_id, "retryable": retryable},
            )
        job.last_checked_at = datetime.now(timezone.utc)
        job.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(document)
        db.refresh(job)
        return document, job
    except HTTPException:
        db.rollback()
        try:
            await pdf_storage.delete(storage_path)
        except StorageError:
            logger.warning("Could not remove an unreferenced PDF after a rejected upload.")
        raise
    except Exception:
        db.rollback()
        logger.exception("Material upload failed for course %s.", course_id)
        try:
            await pdf_storage.delete(storage_path)
        except StorageError:
            pass
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "upload_failed", "message": "The material could not be saved. Try again."},
        ) from None


async def retry_material(
    db: Session,
    *,
    actor: Profile,
    document: InstructionalDocument,
    admin: bool = False,
) -> tuple[InstructionalDocument, ProcessingJob]:
    """Re-run indexing for the same material record.

    Only transient failures are retryable. An unsearchable PDF needs a
    replacement, so retrying it would repeat the same predictable failure.
    """
    latest_job = (
        db.query(ProcessingJob)
        .filter(ProcessingJob.document_id == document.id)
        .order_by(ProcessingJob.created_at.desc())
        .first()
    )
    if material_state(document) != "failed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "not_retryable",
                "message": "Only a failed processing job can be retried. This material does not need a retry.",
            },
        )
    if latest_job is None or not latest_job.retryable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "not_retryable",
                "message": "This failure needs a searchable replacement PDF, not a retry.",
                "cause": (latest_job.cause if latest_job else document.processing_error),
                "trace_id": latest_job.trace_id if latest_job else None,
            },
        )
    retry_limit = max(get_setting_int(db, "job_retry_limit", 3), 0)
    if latest_job.attempts >= retry_limit + 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "retry_exhausted",
                "message": "The retry limit for this job has been reached. Replace the PDF instead.",
                "trace_id": latest_job.trace_id,
            },
        )
    try:
        content = await pdf_storage.download(document.storage_path)
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "storage_unavailable", "message": str(exc)},
        ) from exc

    job = ProcessingJob(
        service="rag_index",
        job_type="pdf_extraction",
        status="running",
        document_id=document.id,
        requested_by=actor.id,
        attempts=latest_job.attempts + 1,
        max_attempts=latest_job.max_attempts,
        retryable=False,
        cause=None,
        trace_id=_trace_id(),
    )
    document.processing_status = "processing"
    document.processing_error = None
    db.add(job)
    db.commit()

    ready, cause, retryable = await _index_stored_pdf(db, document=document, content=content, actor_id=None)
    if ready:
        job.status = "completed"
        job.cause = None
        job.retryable = False
        record_audit(
            db,
            actor=actor,
            action="material.reprocessed",
            entity_type="material",
            entity_id=document.id,
            course_id=document.course_id,
            summary=f"Reindexed “{document.title}” after a processing failure",
            metadata={"trace_id": job.trace_id},
        )
    else:
        document.processing_status = "needs_review" if not retryable else "failed"
        document.status = document.processing_status
        document.processing_error = cause
        job.status = "failed"
        job.retryable = retryable
        job.cause = cause
        record_audit(
            db,
            actor=actor,
            action="material.retry_failed",
            entity_type="material",
            entity_id=document.id,
            course_id=document.course_id,
            summary=f"Retry for “{document.title}” failed: {cause}",
            metadata={"trace_id": job.trace_id, "retryable": retryable},
        )
    job.updated_at = datetime.now(timezone.utc)
    job.last_checked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)
    db.refresh(job)
    return document, job


def material_version_rows(db: Session, document: InstructionalDocument) -> list[InstructionalDocument]:
    return (
        db.query(InstructionalDocument)
        .filter(InstructionalDocument.document_family_id == document.document_family_id)
        .order_by(InstructionalDocument.version_number.desc())
        .all()
    )


def material_draft_count(db: Session, document_id: uuid.UUID) -> int:
    return (
        db.query(LearningActivity)
        .filter(LearningActivity.source_document_id == document_id)
        .count()
    )

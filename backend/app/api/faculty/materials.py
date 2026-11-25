"""Course materials (PDFs): upload, versions, metadata, archive."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Course, InstructionalDocument, Profile, ProgrammingLang
from app.services.audit import record_audit
from app.services.course_access import resolve_workspace_course
from app.services.materials import material_draft_count, max_upload_bytes, retry_material, serialize_material, upload_material
from app.services.storage.supabase_storage import StorageError, pdf_storage
from app.services.workspace_common import iso
from app.services.workspace_queries import draft_counts_by_material, filter_materials, material_status_counts, scoped_materials
from app.api.faculty.common import faculty_user, _course_brief, _material_for_user

router = APIRouter()

# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
def _material_rows(db: Session, course: Course) -> tuple[list[dict], list[InstructionalDocument]]:
    documents = scoped_materials(db, [course.id])
    current = [document for document in documents if document.is_current]
    draft_counts = draft_counts_by_material(db, [document.id for document in current])
    families: dict[uuid.UUID, list[InstructionalDocument]] = {}
    for document in documents:
        families.setdefault(document.document_family_id, []).append(document)
    items: list[dict] = []
    for document in current:
        versions = sorted(families.get(document.document_family_id, []), key=lambda item: item.version_number, reverse=True)
        serialized = serialize_material(document, draft_count=draft_counts.get(document.id, 0))
        serialized["versions"] = [
            {
                "document_id": str(version.id),
                "version_number": version.version_number,
                "state": version.processing_status,
                "created_at": iso(version.created_at),
                "is_current": bool(version.is_current),
            }
            for version in versions
        ]
        items.append(serialized)
    return items, current


@router.get("/materials")
def list_materials(
    course_id: Optional[uuid.UUID] = None,
    status_filter: str = Query("all", alias="status"),
    search: Optional[str] = None,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    items, current = _material_rows(db, course)
    filtered_ids = {
        str(document.id) for document in filter_materials(current, status=status_filter, search=search, current_only=True)
    }
    visible = [item for item in items if item["document_id"] in filtered_ids]
    return {
        "course": _course_brief(course),
        "items": visible,
        "total": len(visible),
        "counts": material_status_counts(current),
        "max_upload_bytes": max_upload_bytes(db),
        "filters": {"statuses": ["all", "attention", "ready", "processing", "needs_review", "failed", "archived"]},
    }


@router.post("/materials", status_code=status.HTTP_201_CREATED)
async def create_material(
    course_id: uuid.UUID = Form(...),
    title: str = Form(..., min_length=2, max_length=255),
    language_tag: ProgrammingLang = Form(...),
    description: Optional[str] = Form(None, max_length=4_000),
    topic_concept: Optional[str] = Form(None, max_length=100),
    replaces_document_id: Optional[uuid.UUID] = Form(None),
    workshop_id: Optional[uuid.UUID] = Form(None),
    file: UploadFile = File(...),
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    course = resolve_workspace_course(db, user, course_id, allow_admin=False)
    document, job = await upload_material(
        db,
        actor=user,
        course_id=course.id,
        file=file,
        title=title,
        description=description,
        language_tag=language_tag,
        topic_concept=topic_concept,
        replaces_document_id=replaces_document_id,
        workshop_id=workshop_id,
    )
    serialized = serialize_material(document, draft_count=material_draft_count(db, document.id))
    return {
        "material": serialized,
        "job": {
            "id": str(job.id),
            "status": job.status,
            "cause": job.cause,
            "retryable": bool(job.retryable),
            "trace_id": job.trace_id,
        },
        "message": (
            f"“{document.title}” is indexed and ready."
            if document.processing_status == "completed"
            else f"“{document.title}” was saved but needs attention: {document.processing_error}"
        ),
    }


@router.post("/materials/{document_id}/versions", status_code=status.HTTP_201_CREATED)
async def replace_material_version(
    document_id: uuid.UUID,
    title: str = Form(..., min_length=2, max_length=255),
    language_tag: ProgrammingLang = Form(...),
    description: Optional[str] = Form(None, max_length=4_000),
    topic_concept: Optional[str] = Form(None, max_length=100),
    file: UploadFile = File(...),
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, course = _material_for_user(db, user, document_id)
    new_document, job = await upload_material(
        db,
        actor=user,
        course_id=course.id,
        file=file,
        title=title,
        description=description,
        language_tag=language_tag,
        topic_concept=topic_concept,
        replaces_document_id=document.id,
    )
    return {
        "material": serialize_material(new_document, draft_count=material_draft_count(db, new_document.id)),
        "job": {"id": str(job.id), "status": job.status, "cause": job.cause, "trace_id": job.trace_id},
        "message": f"Saved version {new_document.version_number} of “{new_document.title}”. Historical citations are preserved.",
    }


@router.get("/materials/{document_id}/download")
async def download_material(
    document_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, _course = _material_for_user(db, user, document_id)
    try:
        url = await pdf_storage.create_download_url(document.storage_path, expires_in=60)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail={"code": "storage_unavailable", "message": str(exc)}) from exc
    return {"download_url": url, "expires_in": 60}


class MaterialMetadataUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=4_000)
    language_tag: ProgrammingLang
    topic_concept: Optional[str] = Field(None, max_length=100)


@router.patch("/materials/{document_id}")
def update_material(
    document_id: uuid.UUID,
    payload: MaterialMetadataUpdate,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, course = _material_for_user(db, user, document_id)
    if document.workshop_id is not None and payload.language_tag != document.language_tag:
        raise HTTPException(422, "A workshop lesson keeps its programming language.")
    document.title = payload.title.strip()
    document.description = payload.description.strip() if payload.description and payload.description.strip() else None
    document.language_tag = payload.language_tag
    document.topic_concept = payload.topic_concept.strip() if payload.topic_concept and payload.topic_concept.strip() else None
    record_audit(
        db,
        actor=user,
        action="material.metadata_updated",
        entity_type="material",
        entity_id=document.id,
        course_id=course.id,
        summary=f"Updated details for “{document.title}” v{document.version_number}",
    )
    db.commit()
    db.refresh(document)
    return {
        "material": serialize_material(document, draft_count=material_draft_count(db, document.id)),
        "message": "Material details saved. The stored PDF and its version history are unchanged.",
    }


@router.post("/materials/{document_id}/archive")
def archive_material(
    document_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, course = _material_for_user(db, user, document_id)
    if document.archived_at is not None:
        raise HTTPException(status_code=409, detail={"code": "already_archived", "message": "This material is already archived."})
    document.archived_at = datetime.now(timezone.utc)
    document.status = "archived"
    cited = material_draft_count(db, document.id)
    record_audit(
        db,
        actor=user,
        action="material.archived",
        entity_type="material",
        entity_id=document.id,
        course_id=course.id,
        summary=f"Archived “{document.title}” v{document.version_number}; {cited} linked draft(s) keep their citations",
    )
    db.commit()
    return {
        "material": serialize_material(document, draft_count=cited),
        "message": f"Archived “{document.title}”. New drafts cannot cite it, and {cited} existing draft(s) keep their citations.",
    }


@router.post("/materials/{document_id}/restore")
def restore_material(
    document_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, course = _material_for_user(db, user, document_id)
    document.archived_at = None
    if document.processing_status == "completed":
        document.status = "ready"
    record_audit(
        db,
        actor=user,
        action="material.restored",
        entity_type="material",
        entity_id=document.id,
        course_id=course.id,
        summary=f"Restored “{document.title}” v{document.version_number} for new drafts",
    )
    db.commit()
    return {"material": serialize_material(document), "message": "Material restored for new generation."}


@router.post("/materials/{document_id}/retry")
async def retry_material_processing(
    document_id: uuid.UUID,
    user: Profile = Depends(faculty_user),
    db: Session = Depends(get_db),
):
    document, _course = _material_for_user(db, user, document_id)
    updated, job = await retry_material(db, actor=user, document=document)
    return {
        "material": serialize_material(updated),
        "job": {"id": str(job.id), "status": job.status, "cause": job.cause, "retryable": bool(job.retryable), "trace_id": job.trace_id},
        "message": (
            f"Processing retried. “{updated.title}” is ready."
            if updated.processing_status == "completed"
            else f"Retry finished with a failure: {updated.processing_error}"
        ),
    }

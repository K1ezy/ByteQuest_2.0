import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_instructor
from app.models.entities import (
    ActivityKind,
    DocumentChunk,
    InstructionalDocument,
    LearningActivity,
    Profile,
    ProgrammingLang,
    ReviewState,
    TestCase,
)
from app.services.ai_rag.embeddings import generate_embedding
from app.services.ai_rag.llm import GeminiLLMService
from app.services.ai_rag.pdf_processor import extract_chunks_from_pdf
from app.services.judge0.client import Judge0Client, TestCaseInput

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/instructor", tags=["Instructor RAG & Content Generation"])
judge0_client = Judge0Client()


class TestCaseSchema(BaseModel):
    order_index: int
    stdin: str = ""
    expected_stdout: str
    time_limit_ms: int = 2000
    memory_limit_kb: int = 256000
    is_hidden: bool = False
    weight: float = 1.0


class GeneratedChallengeSchema(BaseModel):
    title: str = Field(..., description="Clear title for the programming challenge.")
    problem_statement: str = Field(
        ..., description="Detailed description with input/output format and constraints."
    )
    starter_code: str = Field(..., description="Boilerplate starter code template for the student.")
    reference_solution_code: str = Field(
        ..., description="Fully working reference solution in the target language."
    )
    difficulty_level: int = Field(..., ge=1, le=5)
    xp_reward: int = Field(50, ge=10)
    test_cases: List[TestCaseSchema] = Field(
        ..., description="At least 3 test cases including sample and hidden cases."
    )


@router.post("/documents/upload")
async def upload_and_process_pdf(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    language_tag: ProgrammingLang = Form(...),
    topic_concept: str = Form(...),
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """
    Uploads an instructional PDF, processes it with PyMuPDF, computes 768-dim embeddings
    via gemini-embedding-2, and saves chunks into Supabase pgvector.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()

    doc_record = InstructionalDocument(
        uploaded_by=current_user.id,
        title=title,
        description=description,
        language_tag=language_tag,
        topic_concept=topic_concept,
        storage_path=f"instructor_uploads/{uuid.uuid4()}_{file.filename}",
        processing_status="processing",
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)

    try:
        raw_chunks = extract_chunks_from_pdf(pdf_bytes)

        for item in raw_chunks:
            embedding_vector = generate_embedding(item["content_text"], is_query=False)

            chunk_row = DocumentChunk(
                document_id=doc_record.id,
                chunk_index=item["chunk_index"],
                page_number=item["page_number"],
                content_text=item["content_text"],
                token_count=item["token_count"],
                embedding=embedding_vector,
            )
            db.add(chunk_row)

        doc_record.total_chunks = len(raw_chunks)
        doc_record.processing_status = "completed"
        db.commit()

    except Exception as exc:
        doc_record.processing_status = "failed"
        db.commit()
        raise HTTPException(
            status_code=500, detail=f"PDF embedding pipeline failed: {str(exc)}"
        )

    return {
        "document_id": doc_record.id,
        "title": doc_record.title,
        "total_chunks": doc_record.total_chunks,
        "status": "completed",
    }


@router.post("/documents/{doc_id}/generate-challenge")
async def generate_ai_coding_challenge(
    doc_id: uuid.UUID,
    topic_query: str = Form(...),
    language: ProgrammingLang = Form(...),
    difficulty: int = Form(2),
    current_user: Profile = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """
    Retrieves relevant PDF chunks via RAG cosine similarity, prompts Gemini LLM
    to generate a programming challenge, and enforces Rule 6 (Judge0 automated pre-validation).
    """
    doc = db.query(InstructionalDocument).filter(InstructionalDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Instructional document not found.")

    query_vector = generate_embedding(topic_query, is_query=True)
    vector_str = "[" + ",".join(map(str, query_vector)) + "]"

    retrieved_texts: List[str] = []
    try:
        result = db.execute(
            text(
                """
                SELECT content_text 
                FROM public.match_document_chunks(:q_vec::vector, 0.35, 5, :lang, :doc_id)
                """
            ),
            {
                "q_vec": vector_str,
                "lang": language.value,
                "doc_id": str(doc.id),
            },
        ).fetchall()
        retrieved_texts = [row[0] for row in result]
    except Exception as exc:
        logger.warning(f"pgvector RPC search fallback (match_document_chunks): {exc}")
        # Direct fallback from document chunks if RPC function is not yet installed in Supabase
        chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == doc.id)
            .order_by(DocumentChunk.chunk_index.asc())
            .limit(5)
            .all()
        )
        retrieved_texts = [c.content_text for c in chunks]

    context_corpus = (
        "\n\n---\n\n".join(retrieved_texts) if retrieved_texts else doc.description or topic_query
    )

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

    ai_challenge = GeminiLLMService.generate_structured(
        prompt=prompt,
        response_schema=GeneratedChallengeSchema,
        system_instruction="You are an expert automated instructional designer for university Computer Science labs.",
    )

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
    verification_log = {}
    try:
        is_verified, verification_log = await judge0_client.verify_reference_solution(
            language=language,
            reference_solution_code=ai_challenge.reference_solution_code,
            test_cases=test_case_inputs,
        )
    except Exception as exc:
        logger.warning(f"Judge0 pre-validation unreachable or skipped: {exc}")
        verification_log = {"verified": False, "error": str(exc)}

    new_activity = LearningActivity(
        source_document_id=doc.id,
        created_by=current_user.id,
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
    )
    db.add(new_activity)
    db.commit()
    db.refresh(new_activity)

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

    return {
        "activity_id": new_activity.id,
        "title": new_activity.title,
        "judge0_verified": is_verified,
        "verification_log": verification_log,
        "review_status": new_activity.review_status,
        "message": "Challenge generated and pre-validated via Judge0. Pending instructor review.",
    }


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
    activity = db.query(LearningActivity).filter(LearningActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found.")

    if not activity.judge0_verified:
        raise HTTPException(
            status_code=400,
            detail="Cannot publish challenge: reference solution failed Judge0 automated pre-validation.",
        )

    activity.review_status = ReviewState.published
    activity.reviewed_by = current_user.id
    db.commit()

    return {
        "activity_id": activity.id,
        "review_status": activity.review_status,
        "message": "Activity successfully published to student quest maps.",
    }

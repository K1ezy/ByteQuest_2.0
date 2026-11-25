"""Course-PDF passage retrieval shared by instructor drafting and student tutoring.

Instructor drafting searches one chosen document and must fail loudly. Student
tutoring searches only material from the student's own courses and degrades to
"no passages" on any failure, so the tutor still answers.
"""

from __future__ import annotations

import logging
import re
import uuid

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.entities import DocumentChunk, InstructionalDocument, LearningActivity, PlatformSetting
from app.services.ai_rag.embeddings import generate_embedding
from app.services.course_access import active_membership_course_ids
from app.services.settings_service import get_setting_int

logger = logging.getLogger(__name__)

EMBEDDING_DIMENSIONS = 768
STUDENT_PASSAGE_LIMIT = 4
PASSAGE_CHARS = 1_500
CHAT_PASSAGE_LIMIT = 2
CHAT_PASSAGE_CHARS = 900
CHAT_MIN_SIMILARITY = 0.60

_WORDS = re.compile(r"[^\W\d_]\w{2,}")
_QUESTION_WORDS = set(
    ("about according can could does explain from give how lesson please python should that the "
     "their them this what when where which who why with would you your").split()
)
_PAGE_REFERENCE = re.compile(r"\b(?:pages?\s+|p\.\s*)(\d{1,3})(?:\s*(?:[-–]|to)\s*(\d{1,3}))?", re.IGNORECASE)

_NEAREST = text(
    """
    SELECT chunk.id, chunk.content_text, chunk.page_number, chunk.document_id
    FROM public.document_chunks AS chunk
    WHERE chunk.document_id = ANY(CAST(:doc_ids AS uuid[]))
      AND 1 - (chunk.embedding OPERATOR(extensions.<=>) CAST(:q_vec AS extensions.vector)) >= :match_threshold
    ORDER BY chunk.embedding OPERATOR(extensions.<=>) CAST(:q_vec AS extensions.vector)
    LIMIT :match_count
    """
)


def search_settings(db: Session) -> tuple[int, float]:
    """Top-k and similarity threshold from platform settings."""
    top_k = max(int(get_setting_int(db, "rag_top_k", 5)), 1)
    try:
        threshold = float(db.query(PlatformSetting).filter(PlatformSetting.key == "rag_similarity_threshold").first().value)
    except Exception:
        threshold = 0.35
    return top_k, threshold


def is_query_vector(vector: object) -> bool:
    return isinstance(vector, list) and len(vector) == EMBEDDING_DIMENSIONS


def nearest_chunks(
    db: Session, query_vector: list[float], document_ids: list[uuid.UUID], top_k: int, threshold: float,
) -> list[dict]:
    """Closest chunks across the given documents; raises if the vector search fails."""
    if not document_ids:
        return []
    rows = db.execute(
        _NEAREST,
        {
            "q_vec": "[" + ",".join(map(str, query_vector)) + "]",
            "match_threshold": threshold,
            "match_count": top_k,
            "doc_ids": [str(document_id) for document_id in document_ids],
        },
    ).fetchall()
    return [
        {"chunk_id": str(row[0]), "content_text": row[1], "page_number": row[2], "document_id": str(row[3])}
        for row in rows
        if row and row[1]
    ]


def leading_chunks(db: Session, document_id: uuid.UUID, limit: int) -> list[dict]:
    """Opening chunks of one document: the instructor fallback when vector search fails."""
    return [
        {"chunk_id": str(chunk.id), "content_text": chunk.content_text,
         "page_number": chunk.page_number, "document_id": str(document_id)}
        for chunk in db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index.asc())
        .limit(limit)
        .all()
    ]


def requested_pages(question: str) -> tuple[int, int] | None:
    match = _PAGE_REFERENCE.search(question)
    return (int(match[1]), int(match[2] or match[1])) if match else None


def lesson_practice_passages(
    db: Session, document: InstructionalDocument, pages: tuple[int, int] | None = None,
) -> list[dict]:
    query = db.query(DocumentChunk.page_number, func.left(DocumentChunk.content_text, PASSAGE_CHARS)).filter(
        DocumentChunk.document_id == document.id,
    ).order_by(DocumentChunk.chunk_index)
    if pages is None:
        count = min(document.total_chunks, 6)
        indices = [round(i * (document.total_chunks - 1) / max(1, count - 1)) for i in range(count)]
        query = query.filter(DocumentChunk.chunk_index.in_(indices))
    else:
        query = query.filter(DocumentChunk.page_number.between(*pages)).limit(4)
    return [
        {"document_title": document.title, "page_number": page_number, "excerpt": excerpt}
        for page_number, excerpt in query
        if excerpt.strip()
    ]


def _searchable(query):
    return query.filter(
        InstructionalDocument.is_current.is_(True),
        InstructionalDocument.archived_at.is_(None),
        InstructionalDocument.processing_status == "completed",
    )


def activity_document_ids(db: Session, activity: LearningActivity) -> list[uuid.UUID]:
    """The current version of the PDF an activity was generated from, if any."""
    if activity.source_document_id is None:
        return []
    source = db.get(InstructionalDocument, activity.source_document_id)
    if source is None:
        return []
    current = _searchable(db.query(InstructionalDocument.id)).filter(
        InstructionalDocument.document_family_id == source.document_family_id,
        InstructionalDocument.workshop_id.is_(None),
    ).first()
    return [current[0]] if current is not None else []


def course_document_ids(db: Session, course_ids: list[uuid.UUID]) -> list[uuid.UUID]:
    """Current, searchable PDFs of the given courses."""
    if not course_ids:
        return []
    rows = _searchable(db.query(InstructionalDocument.id)).filter(
        InstructionalDocument.course_id.in_(course_ids),
        InstructionalDocument.workshop_id.is_(None),
    ).all()
    return [row[0] for row in rows]


def tutoring_document_ids(
    db: Session, profile_id: uuid.UUID, member_role: str, activity: LearningActivity | None,
) -> list[uuid.UUID]:
    """Documents a learner's tutor may quote.

    With an activity: the PDF it was generated from (the caller has already checked the
    learner may see that activity). Otherwise, or when the activity was written by hand:
    current PDFs of the learner's own active courses only.
    """
    memberships = active_membership_course_ids(db, profile_id, member_role)
    if activity is not None:
        document_ids = activity_document_ids(db, activity)
        if document_ids:
            allowed = db.query(InstructionalDocument.id).filter(
                InstructionalDocument.id.in_(document_ids),
                InstructionalDocument.course_id.is_(None) | InstructionalDocument.course_id.in_(memberships),
            ).all()
            if allowed:
                return [row[0] for row in allowed]
    return course_document_ids(db, memberships)


def _chat_excerpt(content: str, question: str) -> str:
    """Keep a short window near the terms that matched the question."""
    if len(content) <= CHAT_PASSAGE_CHARS:
        return content
    terms = set(_WORDS.findall(question.casefold())) - _QUESTION_WORDS
    step = CHAT_PASSAGE_CHARS // 2
    windows = (content[start:start + CHAT_PASSAGE_CHARS] for start in range(0, len(content), step))
    return max(
        windows, key=lambda window: (len(terms.intersection(_WORDS.findall(window.casefold()))), len(window)),
    ).strip()


def keyword_chat_passages(db: Session, document_ids: list[uuid.UUID], question: str) -> list[dict]:
    terms = sorted(set(_WORDS.findall(question[:2_000].casefold())) - _QUESTION_WORDS - {
        "according", "document", "lesson", "reader", "say",
    })
    if not document_ids or not terms:
        return []
    config = text("'simple'::regconfig")
    words = func.to_tsvector(config, DocumentChunk.content_text)
    match = func.to_tsquery(config, " | ".join(terms[:20]))
    rows = (
        db.query(DocumentChunk.id, DocumentChunk.document_id, InstructionalDocument.title,
                 DocumentChunk.page_number, DocumentChunk.content_text)
        .join(InstructionalDocument, InstructionalDocument.id == DocumentChunk.document_id)
        .filter(DocumentChunk.document_id.in_(document_ids), words.bool_op("@@")(match))
        .order_by(func.ts_rank_cd(words, match).desc(), DocumentChunk.chunk_index, DocumentChunk.id)
        .limit(4)
    )
    return [
        {"chunk_id": str(chunk_id), "document_id": str(document_id), "document_title": title,
         "page_number": page, "excerpt": _chat_excerpt(content, question)}
        for chunk_id, document_id, title, page, content in rows
    ]


def tutoring_passages(
    db: Session, document_ids: list[uuid.UUID], question: str, *, for_chat: bool = False,
) -> list[dict]:
    """Best passages for a learner's question, or [] when nothing relevant or anything fails.

    Blocking (it waits on the embedding provider); async callers run it in a thread.
    """
    if not document_ids or not question.strip():
        return []
    try:
        query_vector = generate_embedding(question[:2_000], True)
    except Exception as exc:
        logger.warning("Tutor retrieval skipped: embedding failed (%s).", type(exc).__name__)
        return []
    if not is_query_vector(query_vector):
        return []
    top_k, threshold = search_settings(db)
    passage_limit = CHAT_PASSAGE_LIMIT if for_chat else STUDENT_PASSAGE_LIMIT
    if for_chat:
        threshold = max(threshold, CHAT_MIN_SIMILARITY)
    try:
        passages = nearest_chunks(db, query_vector, document_ids, min(top_k, passage_limit), threshold)
    except Exception as exc:
        db.rollback()
        logger.warning("Tutor retrieval skipped: vector search failed (%s).", type(exc).__name__)
        return []
    if not passages:
        return []
    titles = dict(
        db.query(InstructionalDocument.id, InstructionalDocument.title)
        .filter(InstructionalDocument.id.in_([uuid.UUID(p["document_id"]) for p in passages]))
        .all()
    )
    for passage in passages:
        passage["document_title"] = titles.get(uuid.UUID(passage["document_id"]), "Course material")
        content = passage["content_text"]
        passage["excerpt"] = _chat_excerpt(content, question[:2_000]) if for_chat else content[:PASSAGE_CHARS]
    return passages


def passages_block(passages: list[dict], *, label_prefix: str = "") -> str:
    """Passages as untrusted reference text for a system instruction."""
    return "\n\n".join(
        f"[{label_prefix}{index}] {passage['document_title']}, page {passage['page_number']}:\n{passage['excerpt']}"
        for index, passage in enumerate(passages, start=1)
    )


def cited_sources(passages: list[dict]) -> list[dict]:
    """Unique (title, page) pairs, in retrieval order, for the learner to see."""
    seen: set[tuple[str, int]] = set()
    sources = []
    for passage in passages:
        key = (passage["document_title"], int(passage["page_number"]))
        if key not in seen:
            seen.add(key)
            sources.append({"document_title": key[0], "page_number": key[1]})
    return sources


def validate_tutor_citations(reply: str, passages: list[dict]) -> tuple[str, list[dict]]:
    """Keep only inline citations whose title and page were supplied to the tutor."""
    available = {
        (source["document_title"].casefold(), source["page_number"]): source
        for source in cited_sources(passages)
    }
    titles = [re.escape(source["document_title"]) for source in available.values()]
    title_pattern = "|".join([*titles, r"[^()\n]+?"])
    pattern = re.compile(
        rf"(?P<space>[ \t]*)(?:\[source\s*:\s*(?P<marker>[^\]\n]*)\]|"
        rf"\(\s*(?:\[\d+\]\s*)?(?P<title>{title_pattern})\s*,\s*"
        r"(?:p\.|pp\.|pages?)\s*(?P<page>\d{1,7})(?P<extra>(?:\s*(?:,|[-–—]|and)\s*\d{1,7})*)\s*\))",
        re.IGNORECASE,
    )
    selected = {}

    def validate(match: re.Match) -> str:
        marker = match["marker"]
        if marker is not None:
            if not re.fullmatch(r"[1-9][0-9]{0,2}", marker.strip()) or int(marker) > len(passages):
                return ""
            passage = passages[int(marker) - 1]
            key = (passage["document_title"].casefold(), int(passage["page_number"]))
        elif match["extra"]:
            return ""
        else:
            key = (match["title"].strip().casefold(), int(match["page"]))
        source = available.get(key)
        if source is None:
            return ""
        selected[key] = source
        return f"{match['space']}({source['document_title']}, p. {source['page_number']})"

    return pattern.sub(validate, reply).strip(), list(selected.values())

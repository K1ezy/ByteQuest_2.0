"""PDF text extraction and bounded, overlapping chunking for RAG."""

import logging
import math
from typing import Any

import pymupdf

logger = logging.getLogger(__name__)

CHARS_PER_TOKEN_ESTIMATE = 4
MAX_PDF_PAGES = 100
MAX_EXTRACTED_CHARACTERS = 200_000


def extract_chunks_from_pdf(
    pdf_bytes: bytes,
    target_chunk_tokens: int = 750,
    overlap_ratio: float = 0.15,
) -> list[dict[str, Any]]:
    """Extract readable text and split each page into overlapping chunks.

    The token count is an estimate based on four characters per token. At most
    one page is held in memory at a time, and a final fragment that contains
    only text already covered by the previous chunk is skipped.
    """
    if not isinstance(pdf_bytes, bytes) or not pdf_bytes:
        raise ValueError("The uploaded PDF is empty or invalid.")
    if (
        isinstance(target_chunk_tokens, bool)
        or not isinstance(target_chunk_tokens, int)
        or target_chunk_tokens <= 0
    ):
        raise ValueError("target_chunk_tokens must be a positive integer.")
    if not isinstance(overlap_ratio, (int, float)) or not math.isfinite(overlap_ratio):
        raise ValueError("overlap_ratio must be a finite number between 0 and 1.")
    if not 0 <= overlap_ratio < 1:
        raise ValueError("overlap_ratio must be between 0 (inclusive) and 1 (exclusive).")

    target_chars = target_chunk_tokens * CHARS_PER_TOKEN_ESTIMATE
    overlap_chars = int(target_chars * overlap_ratio)
    step_chars = max(1, target_chars - overlap_chars)
    chunks: list[dict[str, Any]] = []
    pages_with_text = 0

    try:
        document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError("The uploaded file is not a readable PDF.") from exc

    with document:
        if document.page_count > MAX_PDF_PAGES:
            raise ValueError(f"PDFs may contain at most {MAX_PDF_PAGES} pages.")
        extracted_chars = 0
        for page_index in range(document.page_count):
            page_text = document.load_page(page_index).get_text("text").strip()
            extracted_chars += len(page_text)
            if extracted_chars > MAX_EXTRACTED_CHARACTERS:
                raise ValueError(f"PDFs may contain at most {MAX_EXTRACTED_CHARACTERS:,} extracted characters.")
            if not page_text:
                continue
            pages_with_text += 1

            start = 0
            while start < len(page_text):
                end = min(start + target_chars, len(page_text))
                content = page_text[start:end].strip()
                contains_new_content = start == 0 or len(content) > overlap_chars
                if content and contains_new_content:
                    chunks.append(
                        {
                            "chunk_index": len(chunks),
                            "page_number": page_index + 1,
                            "content_text": content,
                            "token_count": max(
                                1,
                                math.ceil(len(content) / CHARS_PER_TOKEN_ESTIMATE),
                            ),
                        }
                    )

                if end >= len(page_text):
                    break
                start += step_chars

    logger.info(
        "Extracted %d chunks across %d text pages.", len(chunks), pages_with_text
    )
    return chunks

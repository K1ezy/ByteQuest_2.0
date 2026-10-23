import logging
from typing import Any, Dict, List
import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


def extract_chunks_from_pdf(
    pdf_bytes: bytes, target_chunk_tokens: int = 750, overlap_ratio: float = 0.15
) -> List[Dict[str, Any]]:
    """
    Extracts text from PDF bytes using PyMuPDF and splits into sliding-window chunks
    targeting 500-1000 tokens (approx 4 chars per token -> 2000-4000 characters) with 15% overlap.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    full_text_pages = []

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        if text.strip():
            full_text_pages.append({"page": page_num + 1, "text": text})

    target_chars = target_chunk_tokens * 4
    overlap_chars = int(target_chars * overlap_ratio)
    step_chars = target_chars - overlap_chars

    chunks = []
    chunk_index = 0

    for page_info in full_text_pages:
        page_num = page_info["page"]
        page_text = page_info["text"]

        start_idx = 0
        while start_idx < len(page_text):
            end_idx = min(start_idx + target_chars, len(page_text))
            chunk_content = page_text[start_idx:end_idx].strip()

            if len(chunk_content) > 100:  # Ignore tiny trailing fragments
                token_count = len(chunk_content) // 4
                chunks.append(
                    {
                        "chunk_index": chunk_index,
                        "page_number": page_num,
                        "content_text": chunk_content,
                        "token_count": token_count,
                    }
                )
                chunk_index += 1

            if end_idx >= len(page_text):
                break
            start_idx += step_chars

    logger.info(f"Extracted {len(chunks)} chunks across {len(full_text_pages)} pages.")
    return chunks

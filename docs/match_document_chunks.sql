-- Supabase RPC Function for Vector Similarity Search (Rule 2)
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/nohusennowfuzppvooeu/sql/new

CREATE OR REPLACE FUNCTION public.match_document_chunks(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.35,
    match_count int DEFAULT 5,
    filter_language text DEFAULT NULL,
    filter_document_id uuid DEFAULT NULL
)
RETURNS TABLE (
    content_text text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.content_text,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM public.document_chunks dc
    JOIN public.instructional_documents doc ON doc.id = dc.document_id
    WHERE (filter_document_id IS NULL OR dc.document_id = filter_document_id)
      AND (filter_language IS NULL OR doc.language_tag = filter_language)
      AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

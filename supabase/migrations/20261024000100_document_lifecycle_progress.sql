-- Preserve uploaded source PDFs and track immutable document versions.
ALTER TABLE public.instructional_documents
    ADD COLUMN IF NOT EXISTS document_family_id uuid,
    ADD COLUMN IF NOT EXISTS version_number integer,
    ADD COLUMN IF NOT EXISTS is_current boolean,
    ADD COLUMN IF NOT EXISTS supersedes_document_id uuid,
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS sha256 varchar(64),
    ADD COLUMN IF NOT EXISTS file_size_bytes integer;

UPDATE public.instructional_documents
SET document_family_id = id,
    version_number = 1,
    is_current = true
WHERE document_family_id IS NULL OR version_number IS NULL OR is_current IS NULL;

ALTER TABLE public.instructional_documents
    ALTER COLUMN document_family_id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN document_family_id SET NOT NULL,
    ALTER COLUMN version_number SET DEFAULT 1,
    ALTER COLUMN version_number SET NOT NULL,
    ALTER COLUMN is_current SET DEFAULT true,
    ALTER COLUMN is_current SET NOT NULL,
    ADD CONSTRAINT ck_instructional_documents_version_positive CHECK (version_number > 0),
    ADD CONSTRAINT ck_instructional_documents_file_size_nonnegative CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    ADD CONSTRAINT fk_instructional_documents_supersedes
        FOREIGN KEY (supersedes_document_id) REFERENCES public.instructional_documents(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_instructional_documents_family_version
    ON public.instructional_documents(document_family_id, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_instructional_documents_current_family
    ON public.instructional_documents(document_family_id)
    WHERE is_current IS TRUE AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_instructional_documents_uploaded_current
    ON public.instructional_documents(uploaded_by, is_current, created_at DESC);

-- Only the API service key may access this bucket; browsers receive short-lived signed links.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bytequest-instructional-pdfs', 'bytequest-instructional-pdfs', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

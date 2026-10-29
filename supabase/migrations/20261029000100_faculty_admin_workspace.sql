-- Faculty and administrator workspace: course scoping, account lifecycle,
-- operational settings, processing jobs, and an audit trail.
--
-- The student quest map keeps its existing language-track behaviour. Courses are
-- introduced as the authorization and organization boundary for instructors and
-- administrators, backfilled from the language tracks already in use.

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS account_status varchar(20),
    ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
    ADD COLUMN IF NOT EXISTS display_name varchar(120),
    ADD COLUMN IF NOT EXISTS email varchar(320);

UPDATE public.profiles SET account_status = 'active' WHERE account_status IS NULL;

ALTER TABLE public.profiles
    ALTER COLUMN account_status SET DEFAULT 'active',
    ALTER COLUMN account_status SET NOT NULL,
    ADD CONSTRAINT ck_profiles_account_status CHECK (account_status IN ('active', 'deactivated'));

CREATE INDEX IF NOT EXISTS ix_profiles_account_status ON public.profiles (account_status, role);

-- ---------------------------------------------------------------------------
-- Courses and course membership (instructor assignment + student enrollment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(24) NOT NULL,
    title varchar(255) NOT NULL,
    description text,
    status varchar(20) NOT NULL DEFAULT 'active',
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_courses_code UNIQUE (code),
    CONSTRAINT ck_courses_status CHECK (status IN ('active', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.course_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    member_role varchar(20) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'active',
    assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_course_member UNIQUE (course_id, profile_id, member_role),
    CONSTRAINT ck_course_member_role CHECK (member_role IN ('instructor', 'student')),
    CONSTRAINT ck_course_member_status CHECK (status IN ('active', 'pending', 'removed'))
);

CREATE INDEX IF NOT EXISTS ix_course_members_profile
    ON public.course_members (profile_id, member_role, status);
CREATE INDEX IF NOT EXISTS ix_course_members_course
    ON public.course_members (course_id, member_role, status);

-- ---------------------------------------------------------------------------
-- Materials and activities gain a course, availability, version and provenance
-- ---------------------------------------------------------------------------
ALTER TABLE public.instructional_documents
    ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS processing_error text,
    ADD COLUMN IF NOT EXISTS uploaded_original_name varchar(255),
    ADD COLUMN IF NOT EXISTS indexed_at timestamptz;

CREATE INDEX IF NOT EXISTS ix_instructional_documents_course
    ON public.instructional_documents (course_id, created_at DESC);

ALTER TABLE public.learning_activities
    ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS generation_json jsonb,
    ADD COLUMN IF NOT EXISTS content_version integer,
    ADD COLUMN IF NOT EXISTS opens_at timestamptz,
    ADD COLUMN IF NOT EXISTS closes_at timestamptz,
    ADD COLUMN IF NOT EXISTS published_at timestamptz,
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS version_number integer,
    ADD COLUMN IF NOT EXISTS version_of uuid REFERENCES public.learning_activities(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rejection_reason text;

UPDATE public.learning_activities SET content_version = 1 WHERE content_version IS NULL;
UPDATE public.learning_activities SET version_number = 1 WHERE version_number IS NULL;

ALTER TABLE public.learning_activities
    ALTER COLUMN content_version SET DEFAULT 1,
    ALTER COLUMN content_version SET NOT NULL,
    ALTER COLUMN version_number SET DEFAULT 1,
    ALTER COLUMN version_number SET NOT NULL,
    ADD CONSTRAINT ck_learning_activities_content_version CHECK (content_version > 0),
    ADD CONSTRAINT ck_learning_activities_version_positive CHECK (version_number > 0);

CREATE INDEX IF NOT EXISTS ix_learning_activities_course
    ON public.learning_activities (course_id, review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_learning_activities_schedule
    ON public.learning_activities (opens_at, closes_at);

-- ---------------------------------------------------------------------------
-- Operational settings, processing jobs and audit events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key varchar(64) PRIMARY KEY,
    service varchar(32) NOT NULL,
    label varchar(160) NOT NULL,
    description text NOT NULL,
    value jsonb NOT NULL,
    value_type varchar(16) NOT NULL,
    min_value numeric,
    max_value numeric,
    version integer NOT NULL DEFAULT 1,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_platform_settings_value_type CHECK (value_type IN ('integer', 'boolean', 'string')),
    CONSTRAINT ck_platform_settings_version CHECK (version > 0)
);

CREATE TABLE IF NOT EXISTS public.processing_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service varchar(32) NOT NULL,
    job_type varchar(64) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'queued',
    document_id uuid REFERENCES public.instructional_documents(id) ON DELETE SET NULL,
    activity_id uuid REFERENCES public.learning_activities(id) ON DELETE SET NULL,
    requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    retryable boolean NOT NULL DEFAULT false,
    cause text,
    trace_id varchar(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_checked_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_processing_jobs_status CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    CONSTRAINT ck_processing_jobs_attempts CHECK (attempts >= 0 AND max_attempts >= 0)
);

CREATE INDEX IF NOT EXISTS ix_processing_jobs_status
    ON public.processing_jobs (status, service, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_processing_jobs_document
    ON public.processing_jobs (document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_role varchar(20),
    action varchar(64) NOT NULL,
    entity_type varchar(32) NOT NULL,
    entity_id text,
    course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
    summary text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_audit_events_created ON public.audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_events_course ON public.audit_events (course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_events_entity ON public.audit_events (entity_type, entity_id);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Backfill: one course per language track already in use, then scope existing
-- materials and activities, assign their authors, and enroll existing students.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    lang record;
    new_course_id uuid;
    author record;
BEGIN
    FOR lang IN
        SELECT DISTINCT language_tag::text AS code
        FROM public.instructional_documents
        UNION
        SELECT DISTINCT language::text FROM public.learning_activities
    LOOP
        SELECT id INTO new_course_id FROM public.courses WHERE code = upper(lang.code) || '-TRACK';
        IF new_course_id IS NULL THEN
            INSERT INTO public.courses (code, title, description)
            VALUES (
                upper(lang.code) || '-TRACK',
                initcap(lang.code) || ' Programming Track',
                'Backfilled from the existing ' || upper(lang.code) || ' language track.'
            )
            RETURNING id INTO new_course_id;
        END IF;

        UPDATE public.instructional_documents
        SET course_id = new_course_id
        WHERE course_id IS NULL AND language_tag::text = lang.code;

        UPDATE public.learning_activities
        SET course_id = new_course_id
        WHERE course_id IS NULL AND language::text = lang.code;

        FOR author IN
            SELECT DISTINCT author_id FROM (
                SELECT uploaded_by AS author_id FROM public.instructional_documents
                WHERE course_id = new_course_id
                UNION
                SELECT created_by FROM public.learning_activities
                WHERE course_id = new_course_id AND created_by IS NOT NULL
            ) candidates
            JOIN public.profiles p ON p.id = candidates.author_id
            WHERE p.role IN ('instructor', 'admin')
        LOOP
            INSERT INTO public.course_members (course_id, profile_id, member_role, status)
            VALUES (new_course_id, author.author_id, 'instructor', 'active')
            ON CONFLICT (course_id, profile_id, member_role) DO NOTHING;
        END LOOP;
    END LOOP;

    -- Enroll existing students in the course that matches their chosen track so
    -- class performance has an authorized population. New registrations are
    -- enrolled by the API when an administrator assigns them.
    INSERT INTO public.course_members (course_id, profile_id, member_role, status)
    SELECT c.id, p.id, 'student', 'active'
    FROM public.profiles p
    JOIN public.courses c ON c.code = upper(p.enrolled_language::text) || '-TRACK'
    WHERE p.role = 'student'
    ON CONFLICT (course_id, profile_id, member_role) DO NOTHING;
END $$;

-- ---------------------------------------------------------------------------
-- Seed operational settings. These are functional values read by the API.
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, service, label, description, value, value_type, min_value, max_value)
VALUES
    ('job_retry_limit', 'processing', 'Job retry limit',
     'Maximum retries for a transient PDF processing failure. It does not change student grades.', '3'::jsonb, 'integer', 0, 5),
    ('pdf_upload_max_mb', 'processing', 'PDF upload size limit (MB)',
     'Largest PDF a faculty or administrator upload may accept. Applies to new uploads only.', '10'::jsonb, 'integer', 1, 50),
    ('rag_top_k', 'rag', 'Retrieved source passages',
     'Number of PDF passages retrieved as evidence when a draft is generated.', '5'::jsonb, 'integer', 1, 20),
    ('rag_similarity_threshold', 'rag', 'Source match threshold',
     'Minimum similarity for a passage to count as cited evidence. Higher values are stricter.', '0.35'::jsonb, 'string', 0, 1),
    ('prediction_min_history', 'prediction', 'Minimum prior graded tasks',
     'Prior graded tasks required before a saved next-task prediction is shown. Predictions stay advisory.', '3'::jsonb, 'integer', 1, 10)
ON CONFLICT (key) DO NOTHING;

-- Local Supabase baseline schema. Keep this migration aligned with
-- backend/app/models/entities.py; later migrations add phase-specific fields.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

DO $$ BEGIN
    CREATE TYPE public.userrole AS ENUM ('student', 'instructor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.programminglang AS ENUM ('cpp', 'python', 'java');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.activitykind AS ENUM ('quiz', 'challenge');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.reviewstate AS ENUM ('draft', 'reviewed', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    pseudonym_id VARCHAR(64) NOT NULL,
    role public.userrole NOT NULL DEFAULT 'student',
    year_level INTEGER NOT NULL DEFAULT 1 CHECK (year_level BETWEEN 1 AND 4),
    semester INTEGER NOT NULL DEFAULT 1 CHECK (semester BETWEEN 1 AND 2),
    enrolled_language public.programminglang NOT NULL DEFAULT 'cpp',
    xp_points INTEGER NOT NULL DEFAULT 0 CHECK (xp_points >= 0),
    current_level INTEGER NOT NULL DEFAULT 1 CHECK (current_level >= 1),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE TABLE IF NOT EXISTS public.instructional_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    language_tag public.programminglang NOT NULL,
    topic_concept VARCHAR(100),
    storage_path TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    processing_status VARCHAR(20) NOT NULL DEFAULT 'processing',
    total_chunks INTEGER NOT NULL DEFAULT 0 CHECK (total_chunks >= 0),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.instructional_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    page_number INTEGER NOT NULL DEFAULT 1 CHECK (page_number >= 1),
    content_text TEXT NOT NULL,
    token_count INTEGER NOT NULL CHECK (token_count >= 0),
    embedding extensions.vector(768) NOT NULL,
    embedding_model VARCHAR(50) NOT NULL DEFAULT 'gemini-embedding-2',
    embedding_dim INTEGER NOT NULL DEFAULT 768 CHECK (embedding_dim = 768),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT uq_document_chunks_document_index UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS public.learning_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_document_id UUID REFERENCES public.instructional_documents(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id),
    activity_type public.activitykind NOT NULL,
    language public.programminglang NOT NULL,
    topic_concept VARCHAR(100) NOT NULL,
    title VARCHAR(255),
    problem_statement TEXT,
    starter_code TEXT,
    difficulty_level INTEGER NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    sequence_order INTEGER NOT NULL DEFAULT 1 CHECK (sequence_order >= 1),
    review_status public.reviewstate NOT NULL DEFAULT 'draft',
    reference_solution_code TEXT,
    quiz_questions_json JSONB,
    judge0_verified BOOLEAN NOT NULL DEFAULT FALSE,
    judge0_verification_log JSONB,
    reviewed_by UUID REFERENCES public.profiles(id),
    xp_reward INTEGER NOT NULL DEFAULT 50 CHECK (xp_reward >= 0),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE TABLE IF NOT EXISTS public.test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.learning_activities(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
    stdin TEXT NOT NULL DEFAULT '',
    expected_stdout TEXT NOT NULL,
    time_limit_ms INTEGER NOT NULL DEFAULT 2000 CHECK (time_limit_ms > 0),
    memory_limit_kb INTEGER NOT NULL DEFAULT 256000 CHECK (memory_limit_kb > 0),
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    weight DOUBLE PRECISION NOT NULL DEFAULT 1.0 CHECK (weight > 0),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE TABLE IF NOT EXISTS public.activity_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES public.learning_activities(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
    submitted_code TEXT,
    quiz_answers_json JSONB,
    passed_test_cases INTEGER NOT NULL DEFAULT 0 CHECK (passed_test_cases >= 0),
    total_test_cases INTEGER NOT NULL DEFAULT 0 CHECK (total_test_cases >= 0),
    score_percentage DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (score_percentage BETWEEN 0 AND 100),
    is_successful BOOLEAN NOT NULL,
    execution_time_ms DOUBLE PRECISION CHECK (execution_time_ms >= 0),
    memory_used_kb DOUBLE PRECISION CHECK (memory_used_kb >= 0),
    compiler_status_id INTEGER,
    error_category VARCHAR(50) NOT NULL DEFAULT 'none',
    time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
    xp_awarded INTEGER NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT uq_activity_attempts_student_activity_number
        UNIQUE (student_id, activity_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.ml_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_attempt_id UUID REFERENCES public.activity_attempts(id) ON DELETE SET NULL,
    target_activity_id UUID NOT NULL REFERENCES public.learning_activities(id) ON DELETE CASCADE,
    features_snapshot_json JSONB NOT NULL,
    logreg_prob DOUBLE PRECISION NOT NULL CHECK (logreg_prob BETWEEN 0 AND 1),
    logreg_pred BOOLEAN NOT NULL,
    rf_prob DOUBLE PRECISION NOT NULL CHECK (rf_prob BETWEEN 0 AND 1),
    rf_pred BOOLEAN NOT NULL,
    actual_outcome BOOLEAN,
    active_sequencer_mode VARCHAR(50),
    recommended_action VARCHAR(50),
    model_version VARCHAR(50) NOT NULL DEFAULT 'v1.0.0',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE TABLE IF NOT EXISTS public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon_url TEXT NOT NULL,
    xp_bonus INTEGER NOT NULL DEFAULT 50 CHECK (xp_bonus >= 0),
    criteria_json JSONB NOT NULL,
    CONSTRAINT uq_badges_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS public.student_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT uq_student_badges_student_badge UNIQUE (student_id, badge_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_profiles_pseudonym_id
    ON public.profiles (pseudonym_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
    ON public.document_chunks USING hnsw (embedding extensions.vector_cosine_ops);
CREATE INDEX IF NOT EXISTS ix_learning_activities_source_document_id
    ON public.learning_activities (source_document_id);
CREATE INDEX IF NOT EXISTS ix_learning_activities_created_by
    ON public.learning_activities (created_by);
CREATE INDEX IF NOT EXISTS ix_learning_activities_reviewed_by
    ON public.learning_activities (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_learning_activities_track_sequence
    ON public.learning_activities (language, review_status, sequence_order, difficulty_level);
CREATE INDEX IF NOT EXISTS ix_test_cases_activity_id
    ON public.test_cases (activity_id);
CREATE INDEX IF NOT EXISTS ix_activity_attempts_student_activity
    ON public.activity_attempts (student_id, activity_id, created_at);
CREATE INDEX IF NOT EXISTS ix_ml_predictions_student_id
    ON public.ml_predictions (student_id);
CREATE INDEX IF NOT EXISTS ix_ml_predictions_target_activity_id
    ON public.ml_predictions (target_activity_id);
CREATE INDEX IF NOT EXISTS ix_ml_predictions_source_attempt_id
    ON public.ml_predictions (source_attempt_id);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_student_target_created
    ON public.ml_predictions (student_id, target_activity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_actual_outcome
    ON public.ml_predictions (actual_outcome) WHERE actual_outcome IS NOT NULL;
CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at := NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_profile_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_activity_attempt_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'activity_attempts is append-only; % is not allowed', TG_OP
        USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_attempts_append_only ON public.activity_attempts;
CREATE TRIGGER trg_activity_attempts_append_only
    BEFORE UPDATE OR DELETE ON public.activity_attempts
    FOR EACH ROW EXECUTE FUNCTION public.prevent_activity_attempt_mutation();

CREATE OR REPLACE FUNCTION public.match_document_chunks(
    query_embedding extensions.vector(768),
    match_threshold DOUBLE PRECISION,
    match_count INTEGER,
    filter_language TEXT,
    filter_document_id UUID
)
RETURNS TABLE (content_text TEXT)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
    SELECT chunk.content_text
    FROM public.document_chunks AS chunk
    JOIN public.instructional_documents AS document
      ON document.id = chunk.document_id
    WHERE document.language_tag::TEXT = filter_language
      AND document.id = filter_document_id
      AND 1 - (chunk.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
    ORDER BY chunk.embedding OPERATOR(extensions.<=>) query_embedding
    LIMIT GREATEST(match_count, 0);
$$;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'profiles',
        'instructional_documents',
        'document_chunks',
        'learning_activities',
        'test_cases',
        'activity_attempts',
        'ml_predictions',
        'badges',
        'student_badges'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
    END LOOP;
END;
$$;

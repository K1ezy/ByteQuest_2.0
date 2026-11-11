-- Timestamp and state integrity alignment.
--
-- WHY THIS MIGRATION EXISTS
--
-- 1. Timestamp split-brain. The baseline schema (20261022000000_core_schema) and
--    20261027000100_quest_groups declared 11 columns as TIMESTAMP WITHOUT TIME ZONE,
--    while every migration from 20261024 onward uses TIMESTAMPTZ. Several tables
--    therefore mix both kinds in the SAME row: profiles.created_at is naive while
--    profiles.deactivated_at is aware; learning_activities.created_at is naive while
--    opens_at/closes_at/published_at/archived_at are aware. Comparing them in Python
--    raises "can't compare offset-naive and offset-aware datetimes", which is why the
--    backend carries an as_aware() shim (backend/app/api/faculty.py) that re-tags naive
--    values as UTC at the API boundary.
--
--    The naive values are provably UTC: the column defaults were
--    (NOW() AT TIME ZONE 'UTC'), the ORM defaulted to datetime.utcnow(), and as_aware()
--    re-tags them with timezone.utc. Converting with "AT TIME ZONE 'UTC'" therefore
--    preserves the exact same instant; no value is shifted.
--
-- 2. badges.code is the ON CONFLICT target used by supabase/seed.sql but was nullable.
--    PostgreSQL permits unlimited NULLs in a UNIQUE column, so a NULL-coded badge would
--    silently insert a duplicate on every seed run instead of upserting.
--
-- 3. instructional_documents.processing_status is an unconstrained VARCHAR driving
--    material_state() and the faculty/admin material filters. A typo becomes permanent
--    invalid data.
--
-- SAFETY
--   * ALTER COLUMN ... TYPE performs a storage-level rewrite and does NOT fire row
--     triggers, so the append-only guard on activity_attempts
--     (trg_activity_attempts_append_only) is not tripped by this migration.
--   * Each step is guarded, so this migration is safe on a fresh database and on an
--     existing populated one, and is safe to re-run.
--   * The CHECK constraint is added NOT VALID and only validated when existing rows
--     already satisfy it, so legacy values can never block deployment.

-- ---------------------------------------------------------------------------
-- 1. Convert the 11 naive timestamp columns to timestamptz, preserving instants.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    target RECORD;
BEGIN
    FOR target IN
        SELECT *
        FROM (
            VALUES
                ('profiles',             'created_at'),
                ('profiles',             'updated_at'),
                ('instructional_documents', 'created_at'),
                ('document_chunks',      'created_at'),
                ('learning_activities',  'created_at'),
                ('test_cases',           'created_at'),
                ('activity_attempts',    'created_at'),
                ('ml_predictions',       'created_at'),
                ('student_badges',       'awarded_at'),
                ('quest_groups',         'created_at'),
                ('quest_group_members',  'joined_at')
        ) AS t(table_name, column_name)
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = target.table_name
              AND column_name = target.column_name
              AND data_type = 'timestamp without time zone'
        ) THEN
            -- Re-interpret the stored wall-clock value as UTC. Same instant, new type.
            EXECUTE format(
                'ALTER TABLE public.%I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
                target.table_name, target.column_name, target.column_name
            );
            -- Replace the (NOW() AT TIME ZONE 'UTC') default with a plain now().
            EXECUTE format(
                'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT now()',
                target.table_name, target.column_name
            );
        END IF;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The profiles updated_at trigger must emit an aware value.
--    Assigning a naive timestamp to a timestamptz column would be read in the
--    session TimeZone rather than UTC, silently shifting the value.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. badges.code: backfill then enforce NOT NULL so the seed upsert is correct.
--    The backfill derives a stable, unique code from the row's own id.
-- ---------------------------------------------------------------------------
UPDATE public.badges
SET code = 'legacy_' || left(replace(id::text, '-', ''), 12)
WHERE code IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'badges'
          AND column_name = 'code'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.badges ALTER COLUMN code SET NOT NULL;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Constrain instructional_documents.processing_status to its real domain.
--    Values are taken from the writers in backend/app/services/materials.py and
--    backend/app/api/rag_instructor.py, plus the readers in
--    backend/app/services/workspace_common.py::material_state.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_instructional_documents_processing_status'
          AND conrelid = 'public.instructional_documents'::regclass
    ) THEN
        ALTER TABLE public.instructional_documents
            ADD CONSTRAINT ck_instructional_documents_processing_status
            CHECK (processing_status IN (
                'processing', 'completed', 'needs_review', 'needs_attention', 'failed'
            )) NOT VALID;
    END IF;

    -- Only validate when every existing row already complies, so a legacy value
    -- can never block the migration. Otherwise the constraint stays NOT VALID and
    -- still governs all new writes.
    IF NOT EXISTS (
        SELECT 1 FROM public.instructional_documents
        WHERE processing_status NOT IN (
            'processing', 'completed', 'needs_review', 'needs_attention', 'failed'
        )
    ) THEN
        ALTER TABLE public.instructional_documents
            VALIDATE CONSTRAINT ck_instructional_documents_processing_status;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Document the real meaning of the two document state columns.
--    processing_status is the ingestion pipeline's progress and is authoritative:
--    material_state() in backend/app/services/workspace_common.py derives the
--    user-visible state from archived_at + processing_status and never reads status.
--    status is a legacy mirror that is still written but no longer read. It is left
--    in place deliberately; dropping it is a separate, explicitly authorized step.
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.instructional_documents.processing_status IS
    'Ingestion pipeline progress. Authoritative input to material_state(). One of: processing, completed, needs_review, needs_attention, failed.';

COMMENT ON COLUMN public.instructional_documents.status IS
    'DEPRECATED legacy mirror of processing_status (with completed mapped to ready, plus archived). Written by the API but no longer read: material_state() derives state from archived_at + processing_status. Do not add new readers; scheduled for removal in a later, separately authorized migration.';

COMMENT ON COLUMN public.instructional_documents.archived_at IS
    'Archival instant. Authoritative archived marker for material_state(); preferred over status = ''archived''.';

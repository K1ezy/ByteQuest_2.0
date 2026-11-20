CREATE TABLE IF NOT EXISTS public.concept_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    language programminglang NOT NULL,
    concept varchar(100) NOT NULL,
    stage integer NOT NULL,
    status text NOT NULL,
    question_refs jsonb NOT NULL,
    answers_json jsonb,
    correct integer,
    total integer NOT NULL,
    xp_awarded integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    submitted_at timestamptz,
    CONSTRAINT ck_concept_reviews_stage CHECK (stage BETWEEN 0 AND 3),
    CONSTRAINT ck_concept_reviews_status CHECK (status IN ('open', 'passed', 'not_passed')),
    CONSTRAINT ck_concept_reviews_scores CHECK (total > 0 AND correct BETWEEN 0 AND total),
    CONSTRAINT ck_concept_reviews_xp CHECK (xp_awarded >= 0 AND (xp_awarded = 0 OR status = 'passed')),
    CONSTRAINT ck_concept_reviews_submission CHECK (
        (status = 'open' AND submitted_at IS NULL AND correct IS NULL AND answers_json IS NULL)
        OR (status IN ('passed', 'not_passed') AND submitted_at IS NOT NULL AND correct IS NOT NULL AND answers_json IS NOT NULL)
    ),
    CONSTRAINT ck_concept_reviews_questions CHECK (
        jsonb_typeof(question_refs) = 'array' AND jsonb_array_length(question_refs) = total
    )
);

CREATE INDEX IF NOT EXISTS ix_concept_reviews_history
    ON public.concept_reviews (student_id, language, concept, submitted_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_concept_reviews_open
    ON public.concept_reviews (student_id, language, concept)
    WHERE status = 'open';
-- A recall at an already-earned stage can still pass and refresh its due date.
CREATE UNIQUE INDEX IF NOT EXISTS uq_concept_reviews_passed_stage
    ON public.concept_reviews (student_id, language, concept, stage)
    WHERE status = 'passed' AND xp_awarded > 0;

ALTER TABLE public.concept_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.concept_reviews FROM anon, authenticated;

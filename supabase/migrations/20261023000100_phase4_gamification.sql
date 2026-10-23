-- Phase 4 additions required by the gamification API.
-- Apply this migration to the Supabase/PostgreSQL database before deploying the API.

BEGIN;

ALTER TABLE public.learning_activities
    ADD COLUMN IF NOT EXISTS quiz_questions_json JSONB;

ALTER TABLE public.badges
    ADD COLUMN IF NOT EXISTS code VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_badges_code
    ON public.badges (code)
    WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_badges_student_badge
    ON public.student_badges (student_id, badge_id);

COMMENT ON COLUMN public.learning_activities.quiz_questions_json IS
    'Quiz payload: {"questions":[{"id":"q1","prompt":"...","options":[{"key":"A","text":"..."},{"key":"B","text":"..."}],"correct_answer":"A"}]}';

COMMENT ON COLUMN public.badges.code IS
    'Stable unique achievement identifier, for example FIRST_BLOOD or XP_MASTER.';

COMMIT;

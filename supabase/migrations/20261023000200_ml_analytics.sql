-- Phase 5/6 model audit fields and live analytics support.
-- Apply after the core schema and phase 4 migration.

BEGIN;

ALTER TABLE public.ml_predictions
    ADD COLUMN IF NOT EXISTS source_attempt_id UUID
        REFERENCES public.activity_attempts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS active_sequencer_mode VARCHAR(50),
    ADD COLUMN IF NOT EXISTS recommended_action VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_student_target_created
    ON public.ml_predictions (student_id, target_activity_id, created_at);

CREATE INDEX IF NOT EXISTS ix_ml_predictions_source_attempt_id
    ON public.ml_predictions (source_attempt_id);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_actual_outcome
    ON public.ml_predictions (actual_outcome)
    WHERE actual_outcome IS NOT NULL;

COMMENT ON COLUMN public.ml_predictions.source_attempt_id IS
    'Optional attempt that triggered the prediction; null after that attempt is deleted.';
COMMENT ON COLUMN public.ml_predictions.active_sequencer_mode IS
    'Model or rule mode used to select the recommendation.';
COMMENT ON COLUMN public.ml_predictions.recommended_action IS
    'Sequencing action returned to the student for this prediction.';

COMMIT;

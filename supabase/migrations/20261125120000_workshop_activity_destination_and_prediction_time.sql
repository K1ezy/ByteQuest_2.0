ALTER TABLE public.learning_activities
    ADD COLUMN destination_workshop_id uuid REFERENCES public.workshops(id) ON DELETE RESTRICT;

ALTER TABLE public.ml_predictions ADD COLUMN assigned_at timestamptz;

CREATE UNIQUE INDEX uq_ml_prediction_assignment
    ON public.ml_predictions (student_id, target_activity_id)
    WHERE assigned_at IS NOT NULL;

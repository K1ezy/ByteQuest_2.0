BEGIN;

ALTER TABLE public.profiles ADD COLUMN username varchar(44);

-- The hex-to-letter mapping is one-to-one, so even equal display names cannot
-- collide. Existing users may replace the starter handle in their profile.
UPDATE public.profiles
SET username =
    coalesce(nullif(left(regexp_replace(lower(coalesce(display_name, '')), '[^a-z]', '', 'g'), 12), ''), 'member')
    || translate(replace(id::text, '-', ''), '0123456789abcdef', 'abcdefghijklmnop');

ALTER TABLE public.profiles
    ALTER COLUMN username SET NOT NULL,
    ADD CONSTRAINT profiles_username_letters CHECK (username ~ '^[a-z]{3,44}$');
CREATE UNIQUE INDEX profiles_username_lower_unique ON public.profiles (lower(username));

ALTER TABLE public.ml_predictions
    ADD COLUMN selected_model varchar(20),
    ADD COLUMN source_exam_attempt_id uuid REFERENCES public.exam_attempts(id) ON DELETE SET NULL,
    ADD CONSTRAINT ml_predictions_selected_model_check
        CHECK (selected_model IS NULL OR selected_model IN ('logreg', 'random_forest'));
CREATE UNIQUE INDEX ml_predictions_source_exam_target_unique
    ON public.ml_predictions (source_exam_attempt_id, target_activity_id)
    WHERE source_exam_attempt_id IS NOT NULL;

COMMIT;

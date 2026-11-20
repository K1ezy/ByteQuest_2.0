-- Carry the student's working time from the Arena to the recorded attempt.
-- The grading worker is a separate process, so the submission job row is the only
-- place the value can travel. Without it every activity_attempts.time_spent_seconds
-- for a coding challenge was stored as 0, which left the ML pipeline's
-- avg_time_spent_seconds feature constant.
ALTER TABLE public.submission_jobs
    ADD COLUMN IF NOT EXISTS time_spent_seconds integer NOT NULL DEFAULT 0;

ALTER TABLE public.submission_jobs
    DROP CONSTRAINT IF EXISTS submission_jobs_time_spent_seconds_range,
    ADD CONSTRAINT submission_jobs_time_spent_seconds_range
    CHECK (time_spent_seconds >= 0 AND time_spent_seconds <= 86400);

-- Exam grading claim lease.
-- The grading worker stamps an attempt when it starts grading it. Another worker
-- skips a fresh stamp, and an expired stamp (the worker crashed, or grading
-- raised) is claimed again, so a failing attempt is retried after a pause
-- instead of in a tight loop. Additive and nullable: no backfill is needed.
-- Rollback: ALTER TABLE public.exam_attempts DROP COLUMN grading_claimed_at;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS grading_claimed_at timestamptz;

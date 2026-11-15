-- Cover the two practice signals read across visible activities.
CREATE INDEX IF NOT EXISTS ix_activity_attempts_student_success
    ON public.activity_attempts (student_id, activity_id, created_at)
    WHERE is_successful;

CREATE INDEX IF NOT EXISTS ix_submission_jobs_student_sample_activity
    ON public.submission_jobs (student_id, activity_id, created_at)
    WHERE dry_run_only AND status = 'completed';

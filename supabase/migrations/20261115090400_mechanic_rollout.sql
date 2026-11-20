INSERT INTO public.platform_settings (key, service, label, description, value, value_type, min_value, max_value)
VALUES
    ('gamification_codex_unlock_day', 'gamification', 'Debugger''s Codex unlock day',
     'Manila calendar days from a learner''s first practice activity to unlock the Codex. Set to 0 to unlock immediately.', '21'::jsonb, 'integer', 0, 60),
    ('gamification_memory_unlock_day', 'gamification', 'Mastery Memory unlock day',
     'Manila calendar days from a learner''s first practice activity to unlock Recall quests. Set to 0 to unlock immediately.', '35'::jsonb, 'integer', 0, 60)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS ix_activity_attempts_student_first_practice
    ON public.activity_attempts (student_id, created_at)
    WHERE exam_attempt_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_submission_jobs_student_first_sample
    ON public.submission_jobs (student_id, created_at)
    WHERE dry_run_only AND status = 'completed';

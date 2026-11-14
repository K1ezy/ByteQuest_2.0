-- Close grants left on workspace tables created after the API-only security
-- migration. RLS already denies browser roles because these tables have no
-- policies; explicit revocation keeps that boundary clear.
REVOKE ALL PRIVILEGES ON TABLE
    public.courses,
    public.course_members,
    public.platform_settings,
    public.processing_jobs,
    public.audit_events
FROM anon, authenticated;

-- Personal audit timeline: actor equality, then newest events first.
CREATE INDEX IF NOT EXISTS ix_audit_events_actor_created_id
    ON public.audit_events (actor_id, created_at DESC, id DESC);

-- Student home notices: recipient equality, due-time range and latest five.
CREATE INDEX IF NOT EXISTS ix_notification_outbox_recipient_next_attempt
    ON public.notification_outbox (recipient_id, next_attempt_at DESC);

-- Student home pending-job lookup: student and state, then newest job.
CREATE INDEX IF NOT EXISTS ix_submission_jobs_student_status_created
    ON public.submission_jobs (student_id, status, created_at DESC);

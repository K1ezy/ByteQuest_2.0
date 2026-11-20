alter table public.submission_jobs add column claim_token uuid;

alter table public.exam_attempts
    add column grading_token uuid,
    add column grading_attempts integer not null default 0,
    add column grading_retry_at timestamptz,
    add constraint exam_grading_attempts_nonnegative check (grading_attempts >= 0);

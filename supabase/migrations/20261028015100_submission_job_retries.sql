alter table public.submission_jobs
  add column attempts integer not null default 0 check (attempts >= 0),
  add column next_attempt_at timestamptz not null default now();
create index ix_submission_jobs_ready on public.submission_jobs(status, next_attempt_at, created_at);

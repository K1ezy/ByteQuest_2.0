alter table public.learning_activities add column closed_at timestamptz;
create table public.activity_drafts (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  source_code text not null check (length(source_code) <= 50000), updated_at timestamptz not null default now(),
  constraint uq_activity_draft_student_activity unique(student_id, activity_id)
);
create table public.submission_jobs (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  idempotency_key varchar(100) not null, source_code text not null check (length(source_code) between 1 and 50000),
  dry_run_only boolean not null default false, status varchar(20) not null default 'queued', result_json jsonb,
  error_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint uq_submission_job_student_key unique(student_id,idempotency_key),
  constraint ck_submission_job_status check (status in ('queued','running','completed','failed'))
);
create index ix_submission_jobs_status_created on public.submission_jobs(status,created_at);
alter table public.activity_attempts add column submission_job_id uuid unique references public.submission_jobs(id) on delete set null;
alter table public.activity_attempts add column result_json jsonb;
create table public.challenge_hints (
  id uuid primary key default gen_random_uuid(), activity_id uuid not null references public.learning_activities(id) on delete cascade,
  slot integer not null check(slot between 1 and 5), body text not null check(length(body) between 1 and 2000),
  constraint uq_challenge_hint_slot unique(activity_id,slot)
);
create table public.hint_uses (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  request_key varchar(100) not null, hint_id uuid references public.challenge_hints(id) on delete set null,
  source varchar(16) not null check(source in ('reviewed','ai')), body text not null,
  created_at timestamptz not null default now(), constraint uq_hint_use_request unique(student_id,activity_id,request_key)
);
create index ix_hint_uses_student_activity on public.hint_uses(student_id,activity_id);
create table public.research_consents (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  document_version varchar(100) not null, choice varchar(16) not null check(choice in ('accepted','declined','withdrawn')),
  created_at timestamptz not null default now()
);
create index ix_research_consents_student_created on public.research_consents(student_id,created_at desc);
alter table public.activity_drafts enable row level security;
alter table public.submission_jobs enable row level security;
alter table public.challenge_hints enable row level security;
alter table public.hint_uses enable row level security;
alter table public.research_consents enable row level security;

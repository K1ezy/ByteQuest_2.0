create table public.exams (
  id uuid primary key default gen_random_uuid(), created_by uuid not null references public.profiles(id),
  title varchar(255) not null, opens_at timestamptz not null, closes_at timestamptz not null,
  duration_minutes integer not null check(duration_minutes between 1 and 240),
  published_at timestamptz, results_released_at timestamptz,
  created_at timestamptz not null default now(), check(closes_at > opens_at)
);
create table public.exam_items (
  id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id) on delete cascade,
  activity_id uuid not null references public.learning_activities(id), position integer not null,
  points integer not null check(points between 1 and 1000), snapshot_json jsonb not null,
  constraint uq_exam_item_position unique(exam_id,position)
);
create table public.exam_assignments (
  id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id) on delete cascade,
  group_id uuid not null references public.quest_groups(id) on delete cascade,
  constraint uq_exam_assignment_group unique(exam_id,group_id)
);
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade, attempt_number integer not null,
  status varchar(20) not null default 'active' check(status in ('active','grading','submitted','failed')),
  started_at timestamptz not null, due_at timestamptz not null, submitted_at timestamptz,
  last_saved_at timestamptz, answers_json jsonb not null default '{}'::jsonb, revision integer not null default 0,
  score double precision, max_score double precision, result_json jsonb,
  constraint uq_exam_attempt_number unique(exam_id,student_id,attempt_number)
);
create index ix_exam_attempts_status_due on public.exam_attempts(status,due_at);
create table public.exam_retake_grants (
  id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  allowed_attempts integer not null default 2 check(allowed_attempts between 2 and 5),
  opens_at timestamptz not null, closes_at timestamptz not null,
  duration_minutes integer not null check(duration_minutes between 1 and 240),
  constraint uq_exam_retake_student unique(exam_id,student_id)
);
create table public.exam_sample_runs (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  exam_attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ix_exam_sample_runs_student_created on public.exam_sample_runs(student_id,created_at);
alter table public.activity_attempts add column exam_attempt_id uuid references public.exam_attempts(id) on delete set null;
alter table public.activity_attempts add column exam_item_id uuid references public.exam_items(id) on delete set null;
create unique index uq_activity_attempt_exam_item on public.activity_attempts(exam_attempt_id,exam_item_id) where exam_attempt_id is not null;
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete cascade,
  dedupe_key varchar(200) not null unique, subject varchar(255) not null, body text not null,
  status varchar(20) not null default 'pending', attempts integer not null default 0,
  next_attempt_at timestamptz not null default now()
);
alter table public.exams enable row level security;
alter table public.exam_items enable row level security;
alter table public.exam_assignments enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_retake_grants enable row level security;
alter table public.exam_sample_runs enable row level security;
alter table public.notification_outbox enable row level security;

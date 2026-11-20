create table public.grading_worker_heartbeat (
    id integer primary key check (id = 1),
    seen_at timestamptz not null
);

alter table public.grading_worker_heartbeat enable row level security;
revoke all privileges on public.grading_worker_heartbeat from public, anon, authenticated, service_role;

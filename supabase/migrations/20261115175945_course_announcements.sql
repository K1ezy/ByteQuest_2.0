create table public.course_announcements (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    author_id uuid references public.profiles(id) on delete set null,
    title text not null check (char_length(title) between 1 and 120),
    body text not null check (char_length(body) between 1 and 2000),
    pinned boolean not null default false,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index ix_course_announcements_course_created
    on public.course_announcements (course_id, created_at desc);

alter table public.course_announcements enable row level security;
revoke all privileges on table public.course_announcements from public, anon, authenticated;

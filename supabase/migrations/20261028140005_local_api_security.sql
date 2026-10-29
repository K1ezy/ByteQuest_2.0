-- FastAPI is the only application-data API. Supabase Auth and Storage retain
-- their own schema privileges; browser roles have no access to ByteQuest data.
create table if not exists public.api_rate_counters (
    scope_kind text not null check (scope_kind in ('account', 'global')),
    scope_id text not null,
    action text not null,
    window_kind text not null check (window_kind in ('minute', 'hour', 'day')),
    window_start timestamptz not null,
    used integer not null check (used >= 0),
    expires_at timestamptz not null,
    primary key (scope_kind, scope_id, action, window_kind, window_start)
);
create index if not exists ix_api_rate_counters_expires_at
    on public.api_rate_counters (expires_at);
alter table public.api_rate_counters enable row level security;
grant all on table public.api_rate_counters to service_role;

do $$
declare
    object_name text;
begin
    foreach object_name in array array[
        'profiles', 'instructional_documents', 'document_chunks',
        'learning_activities', 'quest_groups', 'quest_group_members',
        'quest_group_activities', 'test_cases', 'activity_attempts',
        'activity_drafts', 'submission_jobs', 'challenge_hints', 'hint_uses',
        'research_consents', 'exams', 'exam_items', 'exam_assignments',
        'exam_attempts', 'exam_retake_grants', 'exam_sample_runs',
        'notification_outbox', 'ml_predictions', 'badges', 'student_badges',
        'api_rate_counters'
    ] loop
        execute format('alter table public.%I enable row level security', object_name);
        execute format('revoke all privileges on table public.%I from anon, authenticated', object_name);
    end loop;
end;
$$;

-- These functions are only used by the backend or by database triggers.
revoke execute on function public.match_document_chunks(extensions.vector, double precision, integer, text, uuid)
    from public, anon, authenticated;
revoke execute on function public.set_profile_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_activity_attempt_mutation() from public, anon, authenticated;

-- The identity sequence belongs to application data, not Supabase Auth.
revoke all privileges on sequence public.research_consents_event_order_seq from anon, authenticated;

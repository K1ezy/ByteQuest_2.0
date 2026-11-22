-- Random research codes for de-identified exports.
--
-- profiles.pseudonym_id encodes the account id, so it cannot be "unlinked" at the
-- end of the study. A research code is random, and this table is the only place
-- that ties it to a student. Deleting its rows when the study ends
-- (backend/scripts/destroy_research_link.py) leaves exported datasets unlinkable.
-- It lives in the private schema, which the API never exposes.
create table if not exists bytequest_private.research_codes (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique default ('rs_' || encode(extensions.gen_random_bytes(10), 'hex')),
  created_at timestamptz not null default now()
);

revoke all on bytequest_private.research_codes from public, anon, authenticated;

-- A student gets a code the first time they accept the research consent.
create or replace function bytequest_private.issue_research_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.choice = 'accepted' then
    insert into bytequest_private.research_codes (student_id)
    values (new.student_id)
    on conflict (student_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function bytequest_private.issue_research_code() from public, anon, authenticated;

drop trigger if exists issue_research_code on public.research_consents;
create trigger issue_research_code
  after insert on public.research_consents
  for each row execute function bytequest_private.issue_research_code();

-- Existing participants.
insert into bytequest_private.research_codes (student_id)
select distinct student_id from public.research_consents where choice = 'accepted'
on conflict (student_id) do nothing;

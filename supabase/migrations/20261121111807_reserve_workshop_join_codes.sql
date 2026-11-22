begin;

-- Hold workshop writes until every current code is recorded and the trigger is installed.
lock table public.workshops in share row exclusive mode;

create table bytequest_private.workshop_join_codes (
  join_code varchar(8) constraint workshop_join_codes_pkey primary key
);

alter table bytequest_private.workshop_join_codes enable row level security;
revoke all on bytequest_private.workshop_join_codes from public, anon, authenticated, service_role;

insert into bytequest_private.workshop_join_codes (join_code)
select upper(join_code) from public.workshops;

-- A claim lasts beyond the workshop's lifetime and rolls back if issuance fails.
create function bytequest_private.claim_workshop_join_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.join_code = old.join_code then
      return new;
    end if;
  end if;

  insert into bytequest_private.workshop_join_codes (join_code)
  values (upper(new.join_code));
  return new;
end;
$$;

revoke all on function bytequest_private.claim_workshop_join_code() from public, anon, authenticated, service_role;

create trigger claim_workshop_join_code
  after insert or update of join_code on public.workshops
  for each row execute function bytequest_private.claim_workshop_join_code();

commit;

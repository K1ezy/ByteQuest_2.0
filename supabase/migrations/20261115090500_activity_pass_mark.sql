-- Per-challenge pass mark (manuscript: a submission passes when its weighted score
-- meets the activity's pass mark). Additive and nullable: NULL keeps today's rules,
-- every test for practice and a weighted 80% for exams, so existing rows and
-- existing attempts are unchanged.
alter table public.learning_activities
  add column if not exists pass_mark_percent smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'learning_activities_pass_mark_percent_range'
  ) then
    alter table public.learning_activities
      add constraint learning_activities_pass_mark_percent_range
      check (pass_mark_percent is null or pass_mark_percent between 1 and 100);
  end if;
end $$;

comment on column public.learning_activities.pass_mark_percent is
  'Weighted score (percent) an official challenge submission needs to pass. NULL keeps the default: every test for practice, 80% for exams.';

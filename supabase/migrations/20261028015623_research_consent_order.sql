alter table public.research_consents
  add column event_order bigint generated always as identity unique;
create index ix_research_consents_student_order
  on public.research_consents(student_id, event_order desc);

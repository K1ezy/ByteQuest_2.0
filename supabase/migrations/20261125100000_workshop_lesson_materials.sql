alter table public.instructional_documents
  add column workshop_id uuid references public.workshops(id) on delete restrict;

create index ix_instructional_documents_workshop
  on public.instructional_documents (workshop_id)
  where workshop_id is not null;

alter table public.exams
    add column pass_mark_percent integer,
    add constraint exams_pass_mark_percent_range
        check (pass_mark_percent between 1 and 100);

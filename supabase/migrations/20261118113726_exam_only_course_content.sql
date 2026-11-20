alter table public.learning_activities
    add column exam_only boolean not null default false,
    add constraint exam_only_activity_stays_private check (not exam_only or review_status = 'draft');

alter table public.exams
    add column restricted_course_id uuid references public.courses(id);

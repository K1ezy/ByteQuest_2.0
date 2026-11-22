-- Rename the code-joined practice groups from quest_group to workshop (11/21/26).
-- ALTER ... RENAME keeps the rows, foreign keys, indexes and revoked browser grants.
-- Renaming a primary-key or unique constraint also renames its index.

ALTER TABLE public.quest_groups RENAME TO workshops;
ALTER TABLE public.quest_group_members RENAME TO workshop_members;
ALTER TABLE public.quest_group_activities RENAME TO workshop_activities;

ALTER TABLE public.workshop_members RENAME COLUMN group_id TO workshop_id;
ALTER TABLE public.workshop_activities RENAME COLUMN group_id TO workshop_id;
ALTER TABLE public.exam_assignments RENAME COLUMN group_id TO workshop_id;

ALTER TABLE public.workshops RENAME CONSTRAINT quest_groups_pkey TO workshops_pkey;
ALTER TABLE public.workshops RENAME CONSTRAINT quest_groups_created_by_fkey TO workshops_created_by_fkey;
ALTER TABLE public.workshops RENAME CONSTRAINT quest_groups_join_code_check TO workshops_join_code_check;
ALTER TABLE public.workshops RENAME CONSTRAINT quest_groups_join_code_key TO workshops_join_code_key;
ALTER TABLE public.workshops RENAME CONSTRAINT quest_groups_name_check TO workshops_name_check;

ALTER TABLE public.workshop_members RENAME CONSTRAINT quest_group_members_pkey TO workshop_members_pkey;
ALTER TABLE public.workshop_members RENAME CONSTRAINT quest_group_members_group_id_fkey TO workshop_members_workshop_id_fkey;
ALTER TABLE public.workshop_members RENAME CONSTRAINT quest_group_members_profile_id_fkey TO workshop_members_profile_id_fkey;
ALTER TABLE public.workshop_members RENAME CONSTRAINT uq_quest_group_member TO uq_workshop_member;

ALTER TABLE public.workshop_activities RENAME CONSTRAINT quest_group_activities_pkey TO workshop_activities_pkey;
ALTER TABLE public.workshop_activities RENAME CONSTRAINT quest_group_activities_activity_id_fkey TO workshop_activities_activity_id_fkey;
ALTER TABLE public.workshop_activities RENAME CONSTRAINT quest_group_activities_group_id_fkey TO workshop_activities_workshop_id_fkey;
ALTER TABLE public.workshop_activities RENAME CONSTRAINT uq_quest_group_activity TO uq_workshop_activity;

ALTER TABLE public.exam_assignments RENAME CONSTRAINT exam_assignments_group_id_fkey TO exam_assignments_workshop_id_fkey;
ALTER TABLE public.exam_assignments RENAME CONSTRAINT uq_exam_assignment_group TO uq_exam_assignment_workshop;

ALTER INDEX public.ix_quest_groups_created_by RENAME TO ix_workshops_created_by;
ALTER INDEX public.ix_quest_group_members_group_id RENAME TO ix_workshop_members_workshop_id;
ALTER INDEX public.ix_quest_group_members_profile_id RENAME TO ix_workshop_members_profile_id;
ALTER INDEX public.ix_quest_group_activities_group_id RENAME TO ix_workshop_activities_workshop_id;
ALTER INDEX public.ix_quest_group_activities_activity_id RENAME TO ix_workshop_activities_activity_id;

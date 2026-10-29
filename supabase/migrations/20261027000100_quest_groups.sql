-- Shared quest spaces. Membership and activity links are kept separate from
-- existing published activities so the current student quest map still works.
CREATE TABLE IF NOT EXISTS public.quest_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL CHECK (char_length(trim(name)) >= 3),
    description VARCHAR(500),
    language public.programminglang NOT NULL,
    join_code VARCHAR(8) NOT NULL UNIQUE CHECK (join_code ~ '^[A-Z0-9]{8}$'),
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS ix_quest_groups_created_by ON public.quest_groups(created_by);

CREATE TABLE IF NOT EXISTS public.quest_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.quest_groups(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT uq_quest_group_member UNIQUE (group_id, profile_id)
);

CREATE INDEX IF NOT EXISTS ix_quest_group_members_profile_id ON public.quest_group_members(profile_id);
CREATE INDEX IF NOT EXISTS ix_quest_group_members_group_id ON public.quest_group_members(group_id);

CREATE TABLE IF NOT EXISTS public.quest_group_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.quest_groups(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES public.learning_activities(id) ON DELETE CASCADE,
    CONSTRAINT uq_quest_group_activity UNIQUE (group_id, activity_id)
);

CREATE INDEX IF NOT EXISTS ix_quest_group_activities_group_id ON public.quest_group_activities(group_id);
CREATE INDEX IF NOT EXISTS ix_quest_group_activities_activity_id ON public.quest_group_activities(activity_id);

ALTER TABLE public.quest_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_group_activities ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.quest_groups, public.quest_group_members, public.quest_group_activities TO service_role;

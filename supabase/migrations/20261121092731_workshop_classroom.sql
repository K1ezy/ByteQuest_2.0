ALTER TABLE public.workshops
    ADD COLUMN joining_enabled boolean NOT NULL DEFAULT true,
    ADD COLUMN archived_at timestamptz,
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.workshop_activities
    ADD COLUMN topic varchar(80),
    ADD COLUMN position integer NOT NULL DEFAULT 0,
    ADD COLUMN added_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE public.workshop_announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
    author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    pinned boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_workshop_announcements_timeline
    ON public.workshop_announcements (workshop_id, created_at DESC);

ALTER TABLE public.workshop_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.workshop_announcements FROM PUBLIC, anon, authenticated;

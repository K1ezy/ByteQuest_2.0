-- Record when a student actually saved their learning track.
-- The signup trigger always writes a default enrolled_language ('cpp'), so the
-- app could not tell a student who chose C++ from one who had chosen nothing:
-- a refresh during setup sent them to the dashboard on a track they never picked.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'track_selected_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN track_selected_at timestamptz;
        UPDATE public.profiles SET track_selected_at = coalesce(created_at, now());
    END IF;
END;
$$;

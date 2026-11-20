CREATE TABLE bytequest_private.student_registration_roster (
    school_id text PRIMARY KEY CHECK (
        school_id ~ '^[0-9]{2}-[0-9]{5}$' AND right(school_id, 5) <> '00000'
    ),
    email text NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 5 AND 320),
    claimed_by uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE bytequest_private.student_registration_roster ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE bytequest_private.student_registration_roster FROM PUBLIC, anon, authenticated;

CREATE INDEX profiles_student_school_id_ix ON public.profiles (school_id)
WHERE role = 'student' AND school_id IS NOT NULL;

CREATE OR REPLACE FUNCTION bytequest_private.create_student_profile_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    chosen_username text;
    chosen_school_id text;
    chosen_year text;
    chosen_block text;
    chosen_role text;
BEGIN
    IF NEW.raw_user_meta_data ->> 'registration_role' = 'admin' THEN
        RAISE EXCEPTION 'Administrator accounts are granted, not registered' USING ERRCODE = '22023';
    END IF;
    IF NEW.raw_user_meta_data IS NULL OR NOT (NEW.raw_user_meta_data ? 'username') THEN
        RETURN NEW;
    END IF;

    chosen_username := lower(btrim(NEW.raw_user_meta_data ->> 'username'));
    chosen_school_id := regexp_replace(NEW.raw_user_meta_data ->> 'school_id', '^[[:space:]]+|[[:space:]]+$', '', 'g');
    chosen_year := NEW.raw_user_meta_data ->> 'year_level';
    chosen_block := NEW.raw_user_meta_data ->> 'block_section';
    chosen_role := coalesce(NEW.raw_user_meta_data ->> 'registration_role', 'student');
    IF chosen_role NOT IN ('student', 'instructor', 'admin') THEN
        RAISE EXCEPTION 'Invalid registration role' USING ERRCODE = '22023';
    END IF;
    IF chosen_role <> 'student' AND NOT EXISTS (
        SELECT 1 FROM bytequest_private.local_staff_registration WHERE enabled
    ) THEN
        RAISE EXCEPTION 'Staff self-registration is disabled' USING ERRCODE = '22023';
    END IF;

    IF chosen_username IS NULL OR chosen_username !~ '^[a-z]{3,44}$' THEN
        RAISE EXCEPTION 'Invalid signup username' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(NEW.raw_user_meta_data -> 'school_id') IS DISTINCT FROM 'string'
        OR chosen_school_id IS NULL OR char_length(chosen_school_id) NOT BETWEEN 1 AND 64
        OR (chosen_role = 'student' AND (
            chosen_year IS NULL OR chosen_year !~ '^[1-4]$'
            OR chosen_block IS NULL OR chosen_block !~ '^[A-F]$'
        )) THEN
        RAISE EXCEPTION 'Invalid student registration fields' USING ERRCODE = '22023';
    END IF;

    IF chosen_role = 'student' THEN
        IF chosen_school_id !~ '^[0-9]{2}-[0-9]{5}$' OR right(chosen_school_id, 5) = '00000' THEN
            RAISE EXCEPTION 'Invalid student School ID' USING ERRCODE = '22023';
        END IF;

        UPDATE bytequest_private.student_registration_roster AS roster
        SET claimed_by = NEW.id
        WHERE roster.school_id = chosen_school_id
          AND roster.email = lower(btrim(NEW.email))
          AND roster.claimed_by IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.profiles AS profile
              WHERE profile.role = 'student' AND profile.school_id = chosen_school_id
          );
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Student registration could not be verified' USING ERRCODE = '22023';
        END IF;
    END IF;

    INSERT INTO public.profiles (id, pseudonym_id, username, role, year_level,
                                 semester, enrolled_language, xp_points, current_level, email,
                                 school_id, block_section)
    VALUES (NEW.id, 'stu_' || replace(NEW.id::text, '-', ''), chosen_username,
            chosen_role::public.userrole, CASE WHEN chosen_role = 'student' THEN chosen_year::integer ELSE 1 END,
            1, 'cpp', 0, 1, NEW.email, chosen_school_id,
            CASE WHEN chosen_role = 'student' THEN chosen_block END);
    RETURN NEW;
END;
$$;

-- Auth sets invited_at after inserting a user's row, inside the invitation transaction.
-- Trusted SQL imports can still insert auth rows and their application profiles separately.
CREATE FUNCTION bytequest_private.require_profile_or_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF session_user = 'supabase_auth_admin'
        AND EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id AND invited_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id)
    THEN
        RAISE EXCEPTION 'Student registration fields are required' USING ERRCODE = '22023';
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION bytequest_private.require_profile_or_invitation() FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER require_profile_or_invitation
AFTER INSERT ON auth.users DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION bytequest_private.require_profile_or_invitation();

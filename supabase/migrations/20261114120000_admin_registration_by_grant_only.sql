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

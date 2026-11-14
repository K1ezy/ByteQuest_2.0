-- Reserve a chosen student handle in the same transaction as Supabase signup.
-- Invitations do not include username metadata and continue through admin provisioning.
CREATE SCHEMA IF NOT EXISTS bytequest_private;

CREATE FUNCTION bytequest_private.create_student_profile_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    chosen_username text;
BEGIN
    IF NEW.raw_user_meta_data IS NULL OR NOT (NEW.raw_user_meta_data ? 'username') THEN
        RETURN NEW;
    END IF;

    chosen_username := lower(btrim(NEW.raw_user_meta_data ->> 'username'));
    IF chosen_username IS NULL OR chosen_username !~ '^[a-z]{3,44}$' THEN
        RAISE EXCEPTION 'Invalid signup username' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.profiles (id, pseudonym_id, username, role, year_level,
                                 semester, enrolled_language, xp_points, current_level, email)
    VALUES (NEW.id, 'stu_' || replace(NEW.id::text, '-', ''), chosen_username,
            'student', 1, 1, 'cpp', 0, 1, NEW.email);
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION bytequest_private.create_student_profile_on_signup() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER bytequest_student_signup_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION bytequest_private.create_student_profile_on_signup();

-- Manually grant one verified Supabase Auth user instructor access.
-- Replace the UUID placeholder before running. An unchanged placeholder fails
-- UUID parsing rather than granting any account access.
-- See docs/PRODUCTION_INSTRUCTOR_ACCESS.md for the required verification steps.

BEGIN;

DO $grant_instructor$
DECLARE
    target_user_id UUID := 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
    target_role public.userrole;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM auth.users
        WHERE id = target_user_id
    ) THEN
        RAISE EXCEPTION 'No Supabase Auth user exists for the supplied UUID';
    END IF;

    SELECT role
    INTO target_role
    FROM public.profiles
    WHERE id = target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No ByteQuest profile exists; the account must sign in once before access is granted';
    ELSIF target_role = 'student' THEN
        UPDATE public.profiles
        SET role = 'instructor', updated_at = NOW() AT TIME ZONE 'UTC'
        WHERE id = target_user_id;
    ELSIF target_role IN ('instructor', 'admin') THEN
        RAISE NOTICE 'The verified account already has elevated ByteQuest access; no change made';
    ELSE
        RAISE EXCEPTION 'Unexpected role for the verified account; no change made';
    END IF;
END
$grant_instructor$;

SELECT u.id AS auth_user_id, u.email, p.role
FROM auth.users AS u
JOIN public.profiles AS p ON p.id = u.id
WHERE u.id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::UUID;

COMMIT;

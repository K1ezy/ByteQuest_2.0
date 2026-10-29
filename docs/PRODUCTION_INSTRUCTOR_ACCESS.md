# Production instructor access

This procedure is for an authorized ByteQuest administrator who needs to grant instructor access to one person in the production Supabase project. New sign-ups are students by default. The browser never grants roles, and the local PowerShell helper only updates the local Supabase container.

## Grant access to one account

1. In the production Supabase Dashboard, open **Authentication → Users** and verify the exact account email. Confirm that this is the instructor you intend to authorize.
2. Ask the account owner to sign in to the deployed ByteQuest app once. The API creates the matching `public.profiles` row on the first authenticated request. The account can remain a student while this step is completed.
3. In Authentication → Users, copy that verified user's UUID. Do not select a user by name or use an unverified email from a request.
4. Open the production project's **SQL Editor**. Review the UUID and email together in the Auth dashboard, then open [`supabase/snippets/instructor_sql.sql`](../supabase/snippets/instructor_sql.sql) and replace **both** `REPLACE_WITH_VERIFIED_AUTH_USER_UUID` placeholders with that exact UUID. Run the full script as a project administrator.
5. Confirm the query returns exactly that UUID, the expected email, and `instructor` (or `admin` if the user already held that role). If it fails because the ByteQuest profile is missing, have the owner sign in once and retry. Do not broaden the `UPDATE` predicate to email, role, or all users.
6. Tell the account owner the grant is complete. They should sign out, sign back in, open **Instructor studio**, and confirm the instructor workspace loads.

The SQL uses the Auth UUID as its only target, locks the matching profile row, promotes only `student` to `instructor`, leaves existing instructor/admin roles unchanged, and fails if the Auth user or ByteQuest profile is absent. An unchanged UUID placeholder is invalid and will stop before an update.

## Safety boundaries

- Run this only in the intended production project's SQL Editor and only for an individually verified account.
- Never place a Supabase `service_role` or `secret` key in browser code, a shell command, Git, a screenshot, or chat. This procedure needs the administrator's existing dashboard access, not an application key.
- The SQL script is not a self-service endpoint. Keep role changes behind an authorized project administrator and record who approved the grant through the institution's approved access-control process.
- The local-only helper `infra/grant-local-instructor.ps1` is deliberately pinned to `supabase_db_bytequest-local`; it does not grant access in production.

This procedure grants application access only. It does not authorize classroom research, participant recruitment, or collection/export of research data; those remain subject to institutional approval and consent requirements.

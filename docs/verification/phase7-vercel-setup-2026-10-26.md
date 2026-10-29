# Phase 7 Vercel setup verification — 2026-10-26

**Status:** Vercel project configured on the free Hobby plan; no deployment has been created.

## Verified state

- The connected Vercel account reports an active `hobby` plan. This is Vercel's free tier.
- A Next.js project named `bytequest` exists under the connected account's personal projects team.
- The project is configured for the repository's `frontend` app. Its Vercel-generated address, `bytequest-ebon.vercel.app`, is reported as verified.
- The project has no deployments and no latest deployment. The address therefore does not yet serve the ByteQuest application.
- No paid domain was purchased and no Vercel plan upgrade was made.
- No production environment variables, third-party paid integrations, or production services were configured as part of this setup.
- The user directed that ByteQuest use the free tier for now. Keep the project on Hobby; do not enable paid add-ons, purchase usage, register a domain, or upgrade the plan without a new explicit decision.

## Evidence and limits

State was checked through the authenticated Vercel integration on 2026-10-26: account billing plan, project listing/details, project-domain listing, and deployment listing. The project listing returned exactly one `bytequest` project; the domain listing returned the verified `bytequest-ebon.vercel.app` hostname; the deployment listing returned zero deployments.

A second read-only check on 2026-10-26 confirmed the project remains on the Hobby plan, still has no deployments, and still has the verified generated hostname. The project-details response returned an empty `domains` array even though the dedicated project-domain listing returned `bytequest-ebon.vercel.app`; use the dedicated domain listing as the domain evidence and treat the mismatch as an API read-back inconsistency. No domain or billing settings were changed during this check.

The Vercel project details endpoint did not return its root-directory field in the response. The setup flow selected `frontend`, and a project-settings update specifying `rootDirectory=frontend` was submitted, but the API response still omitted the field. Confirm it in Vercel project settings before the first preview deployment. No preview build, production build, authentication callback, API/CORS flow, or deployed browser workflow has been verified.

Vercel's current [Hobby plan documentation](https://vercel.com/docs/plans/hobby) describes Hobby as free and for personal projects, and says usage limits can pause access until the limit window resets. The [Vercel terms](https://vercel.com/legal/terms) restrict Hobby use to personal or non-commercial use. ByteQuest is being developed as a non-commercial academic project; confirm the institution's hosting requirements and Hobby eligibility before using the deployment for an institutional classroom pilot. No paid tier is authorized by the current instruction.

This record verifies only the Vercel frontend account and project setup. It does not imply that the FastAPI VPS, production Supabase project, Judge0 deployment, or any classroom study exists. Vercel remains on Hobby; any future paid service or plan change requires a separate explicit decision.

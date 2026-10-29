# Phase 7 database and file backup/restore runbook

**Status: prepared, not executed.** ByteQuest has no selected production Supabase project or backup policy, and no production backup or restore rehearsal has been performed. This document is a procedure for planning and safely rehearsing recovery; it is not evidence that a backup exists.

## Scope and recovery boundaries

ByteQuest stores related data in different places. A database-only dump is not a complete system backup.

| Data or service | Primary location | Recovery path and important limitation |
|---|---|---|
| Profiles, instructional document metadata/chunks, activities, test cases, attempts, badges, and ML predictions | Supabase PostgreSQL | Use a provider database backup/PITR for full database recovery. A Supabase CLI `db dump` is a logical application-schema export and excludes managed `auth` and `storage` schemas. |
| Account identity records | Supabase Auth tables in PostgreSQL | Recover through a full provider database backup/restore. The CLI logical dump does not include Auth records. Auth provider settings, API keys, URLs, and secrets are platform configuration and must be re-created and verified separately. |
| Uploaded instructional PDF bytes | Private Supabase Storage bucket `bytequest-instructional-pdfs` | Export the actual objects separately and keep an encrypted, offsite copy. A database backup can preserve Storage metadata, but does not contain the PDF bytes. |
| Schema changes and seed definitions | Git repository, principally `supabase/migrations/` and seed files | Preserve reviewed migrations and a known deployment revision. Migrations are not a substitute for a point-in-time data backup. |
| API, Auth, Storage, DNS, and provider settings/secrets | Supabase/Vercel/provider dashboards and protected secret storage | Keep an inventory of names and intended values, not secret values in this repository. Reconfigure and verify settings in a recovery project. |
| Judge0 execution service and its Postgres/Redis state | Separate private Ubuntu VM or future VPS | Supabase backups do not cover Judge0. Back up its configuration and any state that ByteQuest has decided to retain using a separate infrastructure procedure. |

The local Judge0 VM, local Supabase instance, and production services are separate environments. Do not use production student records or classroom/research data for a development restore rehearsal. Use synthetic data unless institutional authorization, participant consent, and the approved data-handling plan explicitly allow otherwise.

## Recovery design

Use complementary recovery layers rather than treating one export as sufficient:

1. **Full database recovery:** select a Supabase plan and provider backup/PITR option that meets the approved recovery-point and recovery-time objectives. Confirm the actual retention and restore capabilities when the production project is selected; plan features and limits can change.
2. **Independent logical export:** retain encrypted, offsite application-schema/role/data dumps for portability and an additional recovery path. Treat this as supplementary. It does not back up Auth records, Storage object bytes, platform configuration, or every provider-managed schema.
3. **Storage object recovery:** periodically export all required PDF objects from `bytequest-instructional-pdfs`, create a SHA-256 manifest, encrypt the export, and store it separately from the source project.
4. **Reconstruction record:** retain the repository revision, applied migration version, required dashboard configuration names, secret ownership/rotation instructions, and restore verification evidence. Never store production secret values in Git, this document, chat, terminal transcripts, or screenshots.

Define and approve these values before production launch:

| Decision | Required record |
|---|---|
| Recovery point objective (RPO) | Maximum acceptable data loss measured in time. |
| Recovery time objective (RTO) | Maximum acceptable time to restore service. |
| Backup type and retention | Provider plan and backup/PITR configuration, plus logical and Storage export schedule/retention. |
| Encrypted offsite location | Approved destination, access controls, encryption method, and key custody/rotation owner. Keep it outside the repository and outside the only machine hosting the service. |
| Owners and rehearsal cadence | Named backup owner, restore approver, notification path, and review schedule. |
| Data classification and authorization | Which data may be backed up/exported and who may access it, especially if classroom research data is ever collected. |

Do not invent these policy values during deployment. Record the approved decisions in the deployment evidence and update this runbook if they change.

## Backup procedure

### A. Provider database backup

1. Confirm that the target is the **production** Supabase project and record its project reference, region, plan, and current repository/migration revision in the protected operations record. Do not put credentials in that record.
2. In the Supabase dashboard, verify the selected database backup/PITR feature is enabled and that its retention covers the approved RPO. Record the last successful backup time and retention window. If the plan does not provide the required recovery, resolve that before production launch.
3. Confirm that a database backup contains the required PostgreSQL data, including Auth identity records, and understand which platform settings and Storage bytes it omits. Provider restore should be rehearsed into a separate project, not over the only source project.
4. Do not delete, pause, or replace the production project as a backup strategy. Project deletion can also remove its provider backups.

Official references: [Supabase database backups](https://supabase.com/docs/guides/platform/backups) and [clone a Supabase project](https://supabase.com/docs/guides/platform/clone-project).

### B. Supplementary logical database export

Run this only on a trusted, access-controlled operations host with adequate encrypted disk space. Obtain the connection string from an approved secret manager or secure operator input. Do not paste it into shell history, commit it, or include it in logs. Use a dedicated export directory with restrictive permissions and encrypt the final backup before offsite transfer.

The following Bash commands illustrate the Supabase CLI exports. They are not a substitute for provider backup/PITR; the CLI excludes Supabase-managed schemas such as `auth` and `storage`.

```bash
umask 077
mkdir -p "$BACKUP_DIR/database"
cd "$BACKUP_DIR/database"

supabase db dump --db-url "$SOURCE_DB_URL" --role-only -f roles.sql
supabase db dump --db-url "$SOURCE_DB_URL" -f schema.sql
supabase db dump --db-url "$SOURCE_DB_URL" --use-copy --data-only \
  -x storage.buckets_vectors -x storage.vector_indexes -f data.sql
```

Before using the example, set `BACKUP_DIR` to a protected directory and supply `SOURCE_DB_URL` through the approved secret-handling method. Verify each command exits successfully and produces non-empty files. Inspect file names, sizes, and error output without printing the connection string. Keep access to these files restricted because application data may be sensitive.

Then create and verify a checksum manifest before encryption and offsite transfer:

```bash
sha256sum roles.sql schema.sql data.sql > SHA256SUMS
sha256sum --check SHA256SUMS
```

Record the project reference, UTC export time, schema migration revision, filenames, sizes, checksums, encryption/key identifier (not the key), and transfer result. Do not attach the dump or manifest to a public issue or chat. A dump is only useful if it is readable and a restore has been rehearsed.

Official references: [Supabase backup and restore with the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) and [Supabase `db dump` reference](https://supabase.com/docs/reference/cli/v0/supabase-db-dump).

### C. Separate export of instructional PDF objects

1. Confirm the private bucket name is `bytequest-instructional-pdfs` and inventory required objects from the source project. Restrict export access to an authorized operator; PDFs may contain copyrighted, confidential, or research material.
2. Export the bucket's object bytes with the Supabase CLI into the protected backup directory. The CLI currently documents recursive Storage copy using `--experimental`; verify current CLI syntax/version when running because this interface is experimental.

```bash
mkdir -p "$BACKUP_DIR/storage/bytequest-instructional-pdfs"
supabase storage cp -r ss://bytequest-instructional-pdfs \
  "$BACKUP_DIR/storage/bytequest-instructional-pdfs" --experimental --linked
```

3. Compare the exported object listing/count and total bytes with the source inventory. Generate a SHA-256 manifest for exported files and verify it. Preserve object paths and metadata needed to associate each PDF with its `instructional_documents` record.
4. Encrypt the export and checksum manifest, transfer them to the approved offsite location, and verify the transferred copy against the manifest. Never delete the source objects after export.

The actual bytes are separate from PostgreSQL metadata. A project clone or database restore may leave metadata without the PDF bytes. Restoring to a new project may also require reconciling object metadata and bucket policies. Rehearse the provider-supported Storage restore/copy process against an isolated target; do not edit Supabase-managed `storage` tables directly or blindly bulk-upload over existing objects.

Official reference: [Supabase Storage CLI copy](https://supabase.com/docs/reference/cli/supabase-storage-cp).

## Restore rehearsal (isolated project only)

**Never rehearse by resetting or overwriting the source project.** Use a newly created, isolated Supabase project with restricted access, synthetic data, and no production frontend/API traffic. Confirm the restore target project reference before every operation. Keep the source services and backups unchanged.

### Provider-native recovery rehearsal

1. Create or select an isolated recovery project in the approved region. Record its project reference and restrict dashboard/API access to the recovery operators.
2. Use the provider's documented restore/clone workflow to restore a recent database backup to that project. Confirm source and target identifiers before starting. Review provider warnings about extensions, scheduled jobs, wrappers, and other database side effects before enabling or running them.
3. Re-create platform configuration deliberately: Auth providers and redirect URLs, API settings, Storage bucket privacy/policies, secrets, Edge Functions if used, frontend/backend environment variables, and any non-database integrations. Rotate credentials when required; do not reuse exposed credentials.
4. Restore the Storage object bytes using the provider-supported method after confirming bucket existence, privacy, object paths, and how existing metadata is handled. Compare object counts and SHA-256 hashes; test private access using a synthetic account and expected signed/download flow.
5. Verify schema migration history against the repository revision. Check row counts and relationships for `profiles`, `instructional_documents`, `document_chunks`, `learning_activities`, `test_cases`, `activity_attempts`, `badges`, `student_badges`, and `ml_predictions`, allowing for the chosen backup timestamp.
6. Verify Auth with a synthetic test account (sign-in, role/profile association, and sign-out); verify the API health/auth path, instructor document listing/download, student quest listing, and an approved synthetic submission against the intended Judge0 target. Never submit real code or classroom data during a recovery rehearsal.
7. Measure actual restore time and the latest recoverable timestamp. Record gaps against approved RTO/RPO, failures, owner, corrective actions, and date. A rehearsal is passed only when data, object bytes, access controls, and required application flows work—not merely when the dashboard says restore completed.

### Logical-export recovery limits

If restoring only the CLI logical dump into a newly provisioned project, apply reviewed migrations and follow Supabase's current restore instructions for roles, schema, and data. This route does **not** recreate Auth identity records, Storage object bytes, platform settings, or provider-managed schemas. Use it only when the recovery objective accepts those limitations or when the missing components have an independent, approved recovery path. Do not treat it as a full ByteQuest disaster recovery rehearsal.

Do not run a dump restore against production as an experiment. Test any target-specific `psql` sequence in the isolated recovery project first, verify extensions and role dependencies, and retain command output with secrets removed.

## Recovery incident checklist

1. Declare the incident, notify the approved operators, record the time, and stop automated deployments or migrations that could worsen the incident.
2. Preserve the source project, VM disks, logs, and all available backups. Do not delete/recreate the project, reset the database, remove Storage objects, revert a VM checkpoint, or merge/delete VM disks as an improvised recovery.
3. Identify the last known-good database and Storage backup times and compare them to the approved RPO. If corruption or unauthorized access is suspected, preserve evidence and follow the institution's/provider's incident procedures.
4. Restore into an isolated project first. Validate the full rehearsal checklist and obtain the named recovery approver's sign-off before planning application cutover.
5. Plan a controlled cutover: pause writes for the approved window, coordinate database and Storage state, update secrets/endpoints, verify auth and application health, then reopen writes. Keep the original source read-only and available until recovery is accepted.
6. Document the actual recovered timestamp, data loss window, elapsed recovery time, decisions, and follow-up actions. Rotate potentially exposed credentials.

## ByteQuest recovery acceptance checklist

- [ ] Selected database backup/PITR option meets the approved RPO and retention.
- [ ] Encrypted database backup exists offsite; checksum/transfer verification is recorded.
- [ ] Private instructional PDF object export exists offsite; object count and SHA-256 verification are recorded.
- [ ] Backup encryption key custody and restore access were verified without placing keys in this repository.
- [ ] Restore was completed in an isolated project, never by overwriting the only source.
- [ ] Required schema/migrations, synthetic authentication, application tables, private PDF retrieval, and synthetic app flows were checked.
- [ ] Actual recovery time and recoverable data timestamp meet the approved RTO/RPO, or remediation is assigned.
- [ ] Named owners, retention, rehearsal cadence, and authorization boundaries are documented.

Until these items are evidenced for the selected production setup, Phase 7 backup and restore verification remains **pending**. The runbook itself is preparation, not a completed backup or restore.

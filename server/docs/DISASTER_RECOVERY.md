# M.A.I.A. Disaster Recovery Runbook

Scope: the `server/` backend and its Postgres database, local/object storage,
and the two external integrations (GHL, AI provider). This is an operational
runbook, not a design document — each section is "what do I do right now."

## Backup strategy (spec sections 43-44)

- `scripts/backup.sh` runs `pg_dump --format=custom` against `DATABASE_URL`.
  Run it on a schedule (e.g. daily cron/managed-scheduler job) once a real
  Production database exists — none exists yet as of Phase 7.
- `scripts/restore.sh` restores a `.dump` file into `TARGET_DATABASE_URL`
  (never `DATABASE_URL` — this asymmetry is deliberate, so a backup
  invocation can never accidentally become a restore invocation).
- `scripts/verify-restore.sh` compares row counts across every
  business-critical table between a source and a freshly-restored database.
  A restore is not considered verified until this passes — matches spec
  section 45's "do not declare BACKUP READY without an actual, verified
  restore test."
- **Realistic RPO/RTO for the current setup**: RPO = the interval between
  scheduled `backup.sh` runs (recommend hourly in Production once live
  student data exists; not yet scheduled anywhere as of Phase 7). RTO =
  time to provision a fresh Postgres instance + run `restore.sh` + run
  `verify-restore.sh` + repoint `DATABASE_URL` + redeploy — realistically
  15-60 minutes depending on database size and hosting provider, not yet
  measured against a Production-sized dataset because none exists.

## Database failure

1. Confirm the failure: `GET /api/health` (Phase 7 extends this with a real
   DB sub-check — see `src/modules/health/`).
2. Provision a fresh Postgres instance (or fail over to a managed replica,
   if the hosting provider offers one).
3. Restore the most recent verified backup: `restore.sh <dump> --confirm`.
4. Run `verify-restore.sh` against the restored instance.
5. Update `DATABASE_URL` and restart the API process.
6. Manually re-check the most recent ImportBatch/PaymentTransaction rows
   against any known-good external record (e.g. a GHL contact, a bank
   statement) for the gap between the backup and the failure — this window
   of data is genuinely lost and must be manually reconciled, never guessed.

## Storage failure (documents/uploads)

- Phase 7 status: only `localDriver` (local disk) exists — see
  `src/storage/index.ts`. Local disk has NO independent backup/redundancy
  of its own; it is NOT production-ready storage (this is disclosed, not
  fixed, in Phase 7 — an S3-compatible driver is a prerequisite for
  Production).
- Until an object-storage driver with provider-side redundancy exists, a
  local-disk failure means uploaded documents (IDs, payment proofs,
  feedback videos) are unrecoverable except from whatever OS/host-level
  snapshot the hosting provider takes independently of this application.

## Bad deployment

1. Redeploy the last known-good commit/tag immediately (rollback is a
   deploy, not a database operation — the database schema is
   additive-migration-only, so an older server version stays compatible
   with a newer schema in the vast majority of cases).
2. If the bad deploy included a destructive migration (should never happen
   under this project's "always additive" migration discipline), restore
   from the most recent pre-deploy backup instead of attempting to migrate
   backward.
3. Check `ActivityLog`/audit log for any writes made during the bad
   deployment's window that may need manual review.

## Credential compromise (DB password, SESSION_SECRET, API keys)

1. Rotate the compromised credential at its source (Postgres role password,
   GHL API key, Anthropic/OpenAI key) immediately.
2. Update the corresponding environment variable and restart the API
   process — never hot-patch a secret into a running process.
3. If `SESSION_SECRET` was compromised: rotating it immediately invalidates
   every existing session (all users are logged out) and every previously
   issued signed document-download URL (`signedUrl.ts` uses the same
   secret) — this is the correct, safe outcome, not a bug to work around.
4. Review `ActivityLog` for the compromise window for any action that
   should not have been possible with legitimate access.

## GHL outage

- The integration is already outage-tolerant by design: the Outbox pattern
  (`src/modules/ghl/outbox.ts`) queues domain events and retries with
  backoff; a GHL outage delays sync, it does not lose data or block the
  core application (enrollment, payments, etc. all work with GHL fully
  down).
- Action: monitor the Outbox dead-letter count; once GHL recovers, the
  worker drains the backlog automatically. Manually retry any dead-lettered
  events via the admin GHL routes once confirmed safe.

## AI provider outage

- The provider abstraction (`src/ai/`) supports a configured fallback
  chain and kill switches (Phase 6). An outage on the primary provider
  either fails over automatically (if a fallback is configured) or returns
  a clear, honest error to the Student — it never silently falls back to
  fabricated/mock AI output (spec section 4's "no silent demo fallback").
- Action: use the AI Connections admin screen to check provider status; if
  needed, disable the failing provider (kill switch) so requests fail fast
  with a clear message rather than timing out.

## Application (API process) outage

1. Check the process manager/hosting platform's own logs first — this is
   almost always an infrastructure-level restart, not a data issue.
2. `GET /api/health` once the process is back to confirm DB/storage/GHL/AI
   sub-checks are all reporting real status, not just "process is up."
3. No data recovery action needed unless the outage coincided with a
   database or storage failure (see the sections above).

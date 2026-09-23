#!/usr/bin/env bash
# Real, non-interactive Postgres restore (spec sections 43-46) — companion
# to backup.sh. Requires --confirm so this can never fire by accident (e.g.
# from a copy-pasted command history), and restores into TARGET_DATABASE_URL
# rather than DATABASE_URL so a backup script can never be miscopied into
# accidentally overwriting the database it just read from.
#
# Usage:
#   TARGET_DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
#     ./restore.sh /path/to/backup.dump --confirm

set -euo pipefail

BACKUP_FILE="${1:-}"
CONFIRM_FLAG="${2:-}"

if [[ -z "$BACKUP_FILE" || "$CONFIRM_FLAG" != "--confirm" ]]; then
  echo "Usage: TARGET_DATABASE_URL=... ./restore.sh /path/to/backup.dump --confirm" >&2
  exit 1
fi

if [[ -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "ERROR: TARGET_DATABASE_URL is not set — refusing to guess a target database." >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

DB_NAME=$(basename "${TARGET_DATABASE_URL%%\?*}")
echo "Restoring ${BACKUP_FILE} into '${DB_NAME}' ..."
echo "(This target database's existing contents, if any, will be dropped and replaced.)"

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$TARGET_DATABASE_URL" "$BACKUP_FILE"

echo "Restore complete into '${DB_NAME}'."
echo "Run verify-restore.sh next to confirm row counts against the source database."

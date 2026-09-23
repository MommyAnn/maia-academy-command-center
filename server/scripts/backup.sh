#!/usr/bin/env bash
# Real, non-interactive Postgres backup (spec sections 43-44) — a pg_dump in
# the custom format (-Fc), which supports selective/parallel restore and is
# pg_restore's own recommended format for anything beyond a toy dump.
#
# Usage: DATABASE_URL="postgresql://user:pass@host:5432/dbname" ./backup.sh [output-dir]
# Writes <output-dir>/<dbname>-<UTC timestamp>.dump and prints its path.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Example:" >&2
  echo '  DATABASE_URL="postgresql://user:pass@host:5432/dbname" ./backup.sh' >&2
  exit 1
fi

OUTPUT_DIR="${1:-$(dirname "$0")/../backups}"
mkdir -p "$OUTPUT_DIR"

DB_NAME=$(basename "${DATABASE_URL%%\?*}")
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUTPUT_FILE="${OUTPUT_DIR}/${DB_NAME}-${TIMESTAMP}.dump"

echo "Backing up '${DB_NAME}' to ${OUTPUT_FILE} ..."
pg_dump --format=custom --no-owner --no-privileges --file="$OUTPUT_FILE" "$DATABASE_URL"

SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "Backup complete: ${OUTPUT_FILE} (${SIZE})"
echo "$OUTPUT_FILE"

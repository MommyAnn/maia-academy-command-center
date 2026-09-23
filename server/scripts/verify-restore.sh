#!/usr/bin/env bash
# Verifies a restore actually worked (spec section 45: "BACKUP READY must
# never be declared merely because backups exist — a restore test must
# actually be performed and verified"). Compares row counts for every
# business-critical table between the source and the restored database.
# A row-count match is not a byte-for-byte guarantee, but it is real
# evidence — not just "the restore command exited 0" — that the schema and
# data both came back.
#
# Usage:
#   SOURCE_DATABASE_URL=... RESTORED_DATABASE_URL=... ./verify-restore.sh

set -euo pipefail

if [[ -z "${SOURCE_DATABASE_URL:-}" || -z "${RESTORED_DATABASE_URL:-}" ]]; then
  echo "Usage: SOURCE_DATABASE_URL=... RESTORED_DATABASE_URL=... ./verify-restore.sh" >&2
  exit 1
fi

TABLES=(
  "Person" "User" "Student" "Batch" "Package" "Enrollment" "PaymentTransaction"
  "Document" "Lead" "WebinarSession" "WebinarRegistration" "TrainingSession"
  "Course" "Certificate" "FeedbackSubmission" "Business" "MasterBrainSubmission"
  "AiTool" "AiGeneration" "ImportBatch" "ImportRecord" "ActivityLog" "DomainEvent"
)

MISMATCH=0
printf "%-24s %12s %12s %s\n" "TABLE" "SOURCE" "RESTORED" "STATUS"
for table in "${TABLES[@]}"; do
  source_count=$(psql "$SOURCE_DATABASE_URL" -Atc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERR")
  restored_count=$(psql "$RESTORED_DATABASE_URL" -Atc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERR")
  status="OK"
  if [[ "$source_count" != "$restored_count" ]]; then
    status="MISMATCH"
    MISMATCH=1
  fi
  printf "%-24s %12s %12s %s\n" "$table" "$source_count" "$restored_count" "$status"
done

if [[ "$MISMATCH" -eq 1 ]]; then
  echo ""
  echo "RESTORE VERIFICATION FAILED: at least one table's row count did not match." >&2
  exit 1
fi

echo ""
echo "RESTORE VERIFICATION PASSED: every table's row count matches the source."

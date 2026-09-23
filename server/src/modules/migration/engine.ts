// The staged migration pipeline (spec section 6): UPLOAD -> PARSE ->
// PREVIEW -> FIELD MAPPING -> VALIDATION -> DUPLICATE ANALYSIS -> ERROR
// REVIEW -> DRY RUN -> APPROVAL -> IMPORT -> VERIFICATION -> REPORT.
// Nothing here ever writes a live table except executeImport(), and even
// that only touches rows an admin has explicitly approved after a dry run.

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { parseCsv } from "./csv.js";
import { validateLeadRow, validateWebinarRegistrationRow, validateStudentRow, validatePaymentRow, type ValidationOutcome } from "./validate.js";
import { classifyDuplicate } from "./duplicates.js";
import { generateLeadDisplayId, generateStudentDisplayId, generateLegacyPaymentDisplayId } from "../sequence.js";
import { recordDomainEvent } from "../events.js";
import { writeAuditLog } from "../../audit/log.js";

export const IMPORT_TYPES = ["LEADS", "STUDENTS", "WEBINAR_REGISTRATIONS", "PAYMENTS"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export async function stageBatch(input: { importType: ImportType; sourceFileName: string; csvContent: string; uploadedById: string }) {
  const parsed = parseCsv(input.csvContent);
  if (parsed.rows.length === 0) {
    throw new Error("The uploaded file contains no data rows.");
  }

  const batch = await db.importBatch.create({
    data: {
      importType: input.importType,
      sourceFileName: input.sourceFileName,
      uploadedById: input.uploadedById,
      recordCount: parsed.rows.length,
      status: "UPLOADED",
    },
  });

  await db.importRecord.createMany({
    data: parsed.rows.map((row, idx) => ({
      batchId: batch.id,
      rowNumber: idx + 1,
      rawDataJson: row as Prisma.InputJsonValue,
      status: "PENDING",
    })),
  });

  return db.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
}

async function validateRow(importType: ImportType, raw: Record<string, string>): Promise<ValidationOutcome<unknown>> {
  switch (importType) {
    case "LEADS":
      return validateLeadRow(raw);
    case "WEBINAR_REGISTRATIONS":
      return validateWebinarRegistrationRow(raw);
    case "STUDENTS":
      return validateStudentRow(raw);
    case "PAYMENTS":
      return validatePaymentRow(raw);
  }
}

/** Person-creating import types get duplicate-confidence classification; PAYMENTS attaches to an already-matched Student instead. */
function personSignalsFor(importType: ImportType, normalized: Record<string, unknown>): { email?: string | null; phone?: string | null } | null {
  if (importType === "PAYMENTS") return null;
  return { email: normalized.email as string | null, phone: normalized.contactNumber as string | null };
}

export async function validateBatch(batchId: string) {
  const batch = await db.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  const importType = batch.importType as ImportType;
  const records = await db.importRecord.findMany({ where: { batchId } });

  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const record of records) {
    const raw = record.rawDataJson as Record<string, string>;
    const { normalized, errors } = await validateRow(importType, raw);
    const signals = personSignalsFor(importType, normalized as Record<string, unknown>);

    let duplicateConfidence: string | null = null;
    let duplicateMatches: string[] = [];
    if (errors.length === 0 && signals) {
      const classification = await classifyDuplicate(signals.email, signals.phone);
      duplicateConfidence = classification.confidence;
      duplicateMatches = classification.personIds;
    }

    let status: string;
    if (errors.length > 0) {
      status = "INVALID";
      invalidCount++;
    } else if (duplicateConfidence === "HIGH_CONFIDENCE_MATCH") {
      status = "DUPLICATE_HIGH";
      duplicateCount++;
    } else if (duplicateConfidence === "POSSIBLE_MATCH") {
      status = "DUPLICATE_POSSIBLE";
      duplicateCount++;
      validCount++; // still importable, just flagged
    } else {
      status = "VALID";
      validCount++;
    }

    await db.importRecord.update({
      where: { id: record.id },
      data: {
        normalizedDataJson: normalized as Prisma.InputJsonValue,
        validationErrorsJson: errors as unknown as Prisma.InputJsonValue,
        duplicateConfidence,
        duplicateMatchesJson: duplicateMatches as unknown as Prisma.InputJsonValue,
        status,
      },
    });
  }

  const nextStatus = invalidCount > 0 ? "NEEDS_REVIEW" : "READY_FOR_DRY_RUN";
  return db.importBatch.update({
    where: { id: batchId },
    data: { status: nextStatus, validCount, invalidCount, duplicateCount },
  });
}

export async function runDryRun(batchId: string) {
  const batch = await db.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  const records = await db.importRecord.findMany({ where: { batchId } });

  const toCreate = records.filter((r) => r.status === "VALID" || r.status === "DUPLICATE_POSSIBLE");
  const toSkipDuplicateHigh = records.filter((r) => r.status === "DUPLICATE_HIGH");
  const toSkipInvalid = records.filter((r) => r.status === "INVALID");

  let financialImpact: Record<string, unknown> | null = null;
  if (batch.importType === "PAYMENTS") {
    const amounts = toCreate.map((r) => Number((r.normalizedDataJson as { amount?: number } | null)?.amount ?? 0));
    financialImpact = {
      recordCount: toCreate.length,
      totalAmount: amounts.reduce((sum, a) => sum + a, 0),
      note: "All imported payments land as LEGACY_UNVERIFIED — none are auto-verified.",
    };
  }

  const result = {
    recordsToCreate: toCreate.length,
    recordsToUpdate: 0, // this framework never blind-updates an existing record
    possibleDuplicatesHigh: toSkipDuplicateHigh.length,
    possibleDuplicatesFlaggedButImportable: toCreate.filter((r) => r.status === "DUPLICATE_POSSIBLE").length,
    recordsToSkip: toSkipInvalid.length + toSkipDuplicateHigh.length,
    validationErrorCount: toSkipInvalid.length,
    financialImpact,
  };

  return db.importBatch.update({
    where: { id: batchId },
    data: { status: "DRY_RUN_COMPLETE", dryRunResultJson: result as unknown as Prisma.InputJsonValue },
  });
}

export async function approveBatch(batchId: string, actorUserId: string) {
  const batch = await db.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  if (batch.status !== "DRY_RUN_COMPLETE") {
    throw new Error(`Cannot approve from status ${batch.status} — a completed dry run is required first.`);
  }
  return db.importBatch.update({ where: { id: batchId }, data: { status: "APPROVED", approvedById: actorUserId, approvedAt: new Date() } });
}

async function importLeadOrWebinarRow(importType: "LEADS" | "WEBINAR_REGISTRATIONS", record: { id: string; normalizedDataJson: unknown }, actorUserId: string) {
  const normalized = record.normalizedDataJson as {
    fullName: string;
    email: string | null;
    contactNumber: string | null;
    source?: string | null;
    campaign?: string | null;
    sessionId?: string | null;
  };

  const person = await db.person.create({ data: { fullName: normalized.fullName, email: normalized.email, contactNumber: normalized.contactNumber } });
  const lead = await db.lead.create({
    data: {
      leadDisplayId: await generateLeadDisplayId(),
      personId: person.id,
      source: normalized.source ?? "Legacy Import",
      campaign: normalized.campaign ?? null,
      firstRegistrationDate: new Date(),
    },
  });
  await recordDomainEvent("LEAD_CREATED", { leadId: lead.id });
  await writeAuditLog({ action: "Lead Created", summary: `Lead ${lead.leadDisplayId} created via migration import`, actorUserId, entityType: "Lead", entityId: lead.id });

  if (importType === "WEBINAR_REGISTRATIONS" && normalized.sessionId) {
    const registration = await db.webinarRegistration.create({
      data: { sessionId: normalized.sessionId, leadId: lead.id, source: normalized.source ?? "Legacy Import", recordedById: actorUserId, recordedAt: new Date() },
    });
    return { entityType: "WebinarRegistration", entityId: registration.id };
  }
  return { entityType: "Lead", entityId: lead.id };
}

async function importStudentRow(record: { normalizedDataJson: unknown }) {
  const normalized = record.normalizedDataJson as {
    fullName: string;
    email: string | null;
    contactNumber: string | null;
    packageId: string;
    batchId: string;
    enrollmentStatus: string;
  };
  const batch = await db.batch.findUniqueOrThrow({ where: { id: normalized.batchId } });

  const person = await db.person.create({ data: { fullName: normalized.fullName, email: normalized.email, contactNumber: normalized.contactNumber } });
  const student = await db.student.create({
    data: {
      studentDisplayId: await generateStudentDisplayId(batch.code),
      personId: person.id,
      batchId: normalized.batchId,
      packageId: normalized.packageId,
      enrollmentStatus: normalized.enrollmentStatus,
    },
  });
  await recordDomainEvent("STUDENT_CREATED", { studentId: student.id, studentDisplayId: student.studentDisplayId });
  return { entityType: "Student", entityId: student.id };
}

async function importPaymentRow(
  record: { normalizedDataJson: unknown },
  batchId: string,
  actorUserId: string,
): Promise<{ entityType: string; entityId: string } | { skipped: true; reason: string }> {
  const normalized = record.normalizedDataJson as {
    matchedStudentId: string;
    amount: number;
    method: string | null;
    paymentDate: string | null;
    referenceNumber: string | null;
  };
  const student = await db.student.findUniqueOrThrow({ where: { id: normalized.matchedStudentId }, include: { batch: true } });

  // Idempotency guard (spec section 19): the same reference number for the
  // same Student is treated as already-imported, never duplicated.
  if (normalized.referenceNumber) {
    const existing = await db.paymentTransaction.findFirst({ where: { studentId: student.id, referenceNumber: normalized.referenceNumber } });
    if (existing) return { skipped: true, reason: `Reference number "${normalized.referenceNumber}" already recorded for this student.` };
  }

  const payment = await db.paymentTransaction.create({
    data: {
      paymentDisplayId: await generateLegacyPaymentDisplayId(student.batch.code),
      studentId: student.id,
      batchId: student.batchId,
      packageId: student.packageId,
      paymentDate: normalized.paymentDate ? new Date(normalized.paymentDate) : null,
      type: "Legacy Import",
      amount: normalized.amount,
      method: normalized.method ?? "Unknown",
      referenceNumber: normalized.referenceNumber,
      status: "LEGACY_UNVERIFIED",
      recordedById: actorUserId,
      source: "LEGACY_IMPORT",
      importBatchId: batchId,
      originalRecordReference: normalized.referenceNumber,
    },
  });
  return { entityType: "PaymentTransaction", entityId: payment.id };
}

export async function executeImport(batchId: string, actorUserId: string) {
  const batch = await db.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  if (batch.status !== "APPROVED") {
    throw new Error(`Cannot import from status ${batch.status} — the batch must be APPROVED first.`);
  }
  await db.importBatch.update({ where: { id: batchId }, data: { status: "IMPORTING" } });

  const records = await db.importRecord.findMany({ where: { batchId, status: { in: ["VALID", "DUPLICATE_POSSIBLE"] } } });
  let importedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const record of records) {
    try {
      let result: { entityType: string; entityId: string } | { skipped: true; reason: string };
      if (batch.importType === "LEADS" || batch.importType === "WEBINAR_REGISTRATIONS") {
        result = await importLeadOrWebinarRow(batch.importType, record, actorUserId);
      } else if (batch.importType === "STUDENTS") {
        result = await importStudentRow(record);
      } else {
        result = await importPaymentRow(record, batchId, actorUserId);
      }

      if ("skipped" in result) {
        await db.importRecord.update({ where: { id: record.id }, data: { status: "SKIPPED", failureReason: result.reason } });
        skippedCount++;
      } else {
        await db.importRecord.update({ where: { id: record.id }, data: { status: "IMPORTED", createdEntityType: result.entityType, createdEntityId: result.entityId } });
        importedCount++;
      }
    } catch (err) {
      await db.importRecord.update({ where: { id: record.id }, data: { status: "FAILED", failureReason: err instanceof Error ? err.message : String(err) } });
      failedCount++;
    }
  }

  // Rows that never qualified for import (INVALID / DUPLICATE_HIGH) are
  // counted as skipped in the final report too — never silently dropped.
  const preSkipped = await db.importRecord.count({ where: { batchId, status: { in: ["INVALID", "DUPLICATE_HIGH"] } } });
  const finalStatus = failedCount > 0 && importedCount > 0 ? "PARTIALLY_COMPLETED" : failedCount > 0 ? "FAILED" : "COMPLETED";

  const updated = await db.importBatch.update({
    where: { id: batchId },
    data: { status: finalStatus, importedCount, skippedCount: skippedCount + preSkipped, failedCount, importedAt: new Date() },
  });
  await writeAuditLog({ action: "Migration Batch Imported", summary: `Import batch ${batchId} executed: ${importedCount} imported, ${skippedCount + preSkipped} skipped, ${failedCount} failed`, actorUserId, entityType: "ImportBatch", entityId: batchId });
  return updated;
}

export async function rollbackBatch(batchId: string, actorUserId: string) {
  const batch = await db.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  if (batch.status !== "COMPLETED" && batch.status !== "PARTIALLY_COMPLETED") {
    throw new Error(`Cannot roll back a batch with status ${batch.status}.`);
  }

  const imported = await db.importRecord.findMany({ where: { batchId, status: "IMPORTED" } });
  let rolledBack = 0;
  let blocked = 0;

  for (const record of imported) {
    try {
      if (record.createdEntityType === "PaymentTransaction") {
        await db.paymentTransaction.delete({ where: { id: record.createdEntityId! } });
      } else if (record.createdEntityType === "WebinarRegistration") {
        const registration = await db.webinarRegistration.findUniqueOrThrow({ where: { id: record.createdEntityId! } });
        await db.webinarRegistration.delete({ where: { id: registration.id } });
        await db.lead.delete({ where: { id: registration.leadId } }).catch(() => null);
      } else if (record.createdEntityType === "Lead") {
        const lead = await db.lead.findUniqueOrThrow({ where: { id: record.createdEntityId! } });
        const hasConversion = await db.leadStudentConversion.findUnique({ where: { leadId: lead.id } });
        if (hasConversion) {
          blocked++;
          continue;
        }
        await db.lead.delete({ where: { id: lead.id } });
        await db.person.delete({ where: { id: lead.personId } }).catch(() => null);
      } else if (record.createdEntityType === "Student") {
        const student = await db.student.findUniqueOrThrow({ where: { id: record.createdEntityId! } });
        const [enrollments, payments] = await Promise.all([
          db.enrollment.count({ where: { studentId: student.id } }),
          db.paymentTransaction.count({ where: { studentId: student.id } }),
        ]);
        if (enrollments > 0 || payments > 0) {
          blocked++;
          continue;
        }
        await db.student.delete({ where: { id: student.id } });
        await db.person.delete({ where: { id: student.personId } }).catch(() => null);
      }
      await db.importRecord.update({ where: { id: record.id }, data: { status: "SKIPPED", failureReason: "Rolled back." } });
      rolledBack++;
    } catch {
      blocked++;
    }
  }

  const updated = await db.importBatch.update({ where: { id: batchId }, data: { status: "ROLLED_BACK", rolledBackById: actorUserId, rolledBackAt: new Date() } });
  await writeAuditLog({ action: "Migration Batch Rolled Back", summary: `Import batch ${batchId} rolled back: ${rolledBack} reversed, ${blocked} blocked (dependent records exist)`, actorUserId, entityType: "ImportBatch", entityId: batchId });
  return { batch: updated, rolledBack, blocked };
}

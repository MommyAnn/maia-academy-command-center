// CSV import for ads-report data (spec sections 83-87). Every import is
// tracked as a real AdImportBatch for rollback/correction (spec 86), and
// commit never duplicates a performance snapshot already present from a
// prior sync or import for the same (campaign, date, source) — the same
// idempotent upsert pattern sync.ts uses (spec section 87).

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateAdCampaignDisplayId, generateAdImportBatchDisplayId } from "../sequence.js";

export interface CsvRow {
  date: string;
  campaignName: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  leads?: string;
  purchases?: string;
  purchaseValue?: string;
  currency?: string;
}

export interface RowIssue {
  row: number; // 1-indexed, header excluded
  issues: string[];
}

export interface ImportPreview {
  totalRows: number;
  validRowCount: number;
  invalidRows: RowIssue[];
  duplicateRowNumbers: number[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /^[A-Za-z]{3}$/;

function validateNumberField(value: string | undefined, label: string, issues: string[]) {
  if (value === undefined || value === "") return;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) issues.push(`${label} must be a non-negative number.`);
}

/** Validates rows in isolation (no DB writes) — used for both the preview call and re-validated again at commit time, never trusting a stale client-held preview. */
export function validateCsvRows(rows: CsvRow[]): ImportPreview {
  const invalidRows: RowIssue[] = [];
  const seen = new Map<string, number>(); // "campaignName|date" -> first row number
  const duplicateRowNumbers: number[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 1;
    const issues: string[] = [];
    if (!row.date || !DATE_RE.test(row.date)) issues.push("Date is missing or not in YYYY-MM-DD format.");
    if (!row.campaignName || row.campaignName.trim().length === 0) issues.push("Campaign name is required.");
    if (row.currency && !CURRENCY_RE.test(row.currency)) issues.push("Currency must be a 3-letter code.");
    validateNumberField(row.spend, "Spend", issues);
    validateNumberField(row.impressions, "Impressions", issues);
    validateNumberField(row.clicks, "Clicks", issues);
    validateNumberField(row.leads, "Leads", issues);
    validateNumberField(row.purchases, "Purchases", issues);
    validateNumberField(row.purchaseValue, "Purchase Value", issues);

    if (issues.length > 0) invalidRows.push({ row: rowNumber, issues });

    if (row.date && row.campaignName) {
      const key = `${row.campaignName.trim().toLowerCase()}|${row.date}`;
      if (seen.has(key)) duplicateRowNumbers.push(rowNumber);
      else seen.set(key, rowNumber);
    }
  });

  return { totalRows: rows.length, validRowCount: rows.length - invalidRows.length, invalidRows, duplicateRowNumbers };
}

export interface CommitOutcome {
  ok: boolean;
  httpStatus?: number;
  reason?: string;
  batchId?: string;
  committedCount?: number;
}

export async function commitCsvImport(input: { adAccountId: string; rows: CsvRow[]; fileNameOriginal?: string; actorUserId: string }): Promise<CommitOutcome> {
  const account = await db.adAccount.findUnique({ where: { id: input.adAccountId } });
  if (!account) return { ok: false, httpStatus: 404, reason: "Ad account not found." };

  const preview = validateCsvRows(input.rows);
  const duplicateSet = new Set(preview.duplicateRowNumbers);
  const invalidSet = new Set(preview.invalidRows.map((r) => r.row));

  const batch = await db.adImportBatch.create({
    data: {
      importDisplayId: await generateAdImportBatchDisplayId(),
      studentId: account.studentId,
      businessId: account.businessId,
      adAccountId: input.adAccountId,
      fileNameOriginal: input.fileNameOriginal ?? null,
      status: "VALIDATED",
      rowCountTotal: preview.totalRows,
      rowCountValid: preview.validRowCount,
      rowCountInvalid: preview.invalidRows.length,
      rowCountDuplicate: preview.duplicateRowNumbers.length,
      errorsJson: preview.invalidRows as unknown as Prisma.InputJsonValue,
      createdById: input.actorUserId,
    },
  });

  if (preview.validRowCount === preview.duplicateRowNumbers.length && preview.invalidRows.length === preview.totalRows) {
    await db.adImportBatch.update({ where: { id: batch.id }, data: { status: "FAILED" } });
    return { ok: false, httpStatus: 422, reason: "No valid, non-duplicate rows to commit.", batchId: batch.id };
  }

  let committedCount = 0;
  for (let i = 0; i < input.rows.length; i++) {
    const rowNumber = i + 1;
    if (invalidSet.has(rowNumber) || duplicateSet.has(rowNumber)) continue;
    const row = input.rows[i]!;

    let campaign = await db.adCampaign.findFirst({ where: { adAccountId: input.adAccountId, name: { equals: row.campaignName.trim(), mode: "insensitive" } } });
    if (!campaign) {
      campaign = await db.adCampaign.create({
        data: {
          campaignDisplayId: await generateAdCampaignDisplayId(),
          adAccountId: input.adAccountId,
          studentId: account.studentId,
          businessId: account.businessId,
          name: row.campaignName.trim(),
          status: "DRAFT",
          currency: row.currency ?? account.currency,
          source: "CSV_IMPORT",
          createdById: input.actorUserId,
        },
      });
    }

    const dateFrom = new Date(`${row.date}T00:00:00.000Z`);
    const dateTo = dateFrom;
    const existingSnapshot = await db.adPerformanceSnapshot.findFirst({ where: { adAccountId: input.adAccountId, campaignId: campaign.id, adSetId: null, adId: null, dateFrom, dateTo, source: "CSV_IMPORT" } });
    const data = {
      spend: row.spend !== undefined ? Number(row.spend) : undefined,
      impressions: row.impressions !== undefined ? Number(row.impressions) : undefined,
      clicks: row.clicks !== undefined ? Number(row.clicks) : undefined,
      leads: row.leads !== undefined ? Number(row.leads) : undefined,
      purchases: row.purchases !== undefined ? Number(row.purchases) : undefined,
      purchaseValue: row.purchaseValue !== undefined ? Number(row.purchaseValue) : undefined,
      currency: row.currency ?? account.currency,
      importBatchId: batch.id,
      retrievedAt: new Date(),
    };
    if (existingSnapshot) {
      await db.adPerformanceSnapshot.update({ where: { id: existingSnapshot.id }, data });
    } else {
      await db.adPerformanceSnapshot.create({ data: { adAccountId: input.adAccountId, campaignId: campaign.id, provider: "MANUAL", dateFrom, dateTo, source: "CSV_IMPORT", ...data } });
    }
    committedCount++;
  }

  await db.adImportBatch.update({ where: { id: batch.id }, data: { status: "COMMITTED" } });
  await writeAuditLog({ action: "Ad Import Committed", summary: `CSV import committed for ad account "${account.name}" (${committedCount} rows)`, actorUserId: input.actorUserId, entityType: "AdImportBatch", entityId: batch.id });

  return { ok: true, batchId: batch.id, committedCount };
}

export async function rollbackImportBatch(batchId: string, actorUserId: string): Promise<CommitOutcome> {
  const batch = await db.adImportBatch.findUnique({ where: { id: batchId } });
  if (!batch) return { ok: false, httpStatus: 404, reason: "Import batch not found." };
  if (batch.status !== "COMMITTED") return { ok: false, httpStatus: 422, reason: `Only a COMMITTED batch can be rolled back (current status: ${batch.status}).` };

  await db.adPerformanceSnapshot.deleteMany({ where: { importBatchId: batchId } });
  await db.adImportBatch.update({ where: { id: batchId }, data: { status: "ROLLED_BACK" } });
  await writeAuditLog({ action: "Ad Import Rolled Back", summary: `CSV import rolled back`, actorUserId, entityType: "AdImportBatch", entityId: batchId });
  return { ok: true, batchId };
}

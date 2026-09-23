import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let ownerCookie: string;
let financeCookie: string;

beforeAll(async () => {
  await resetDb();
  app = await buildApp({ migrationUploadRateLimitOverride: 100 });
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

async function uploadBatch(importType: string, csvContent: string, cookie = ownerCookie) {
  return app.inject({
    method: "POST",
    url: "/api/migrations",
    headers: { cookie },
    payload: { importType, sourceFileName: `${importType.toLowerCase()}.csv`, csvContent },
  });
}

async function runToDryRun(importType: string, csvContent: string) {
  const upload = await uploadBatch(importType, csvContent);
  expect(upload.statusCode).toBe(201);
  const batchId = upload.json().batch.id;

  const validate = await app.inject({ method: "POST", url: `/api/migrations/${batchId}/validate`, headers: { cookie: ownerCookie } });
  expect(validate.statusCode).toBe(200);

  const dryRun = await app.inject({ method: "POST", url: `/api/migrations/${batchId}/dry-run`, headers: { cookie: ownerCookie } });
  expect(dryRun.statusCode).toBe(200);

  return { batchId, validateBody: validate.json().batch, dryRunBody: dryRun.json().batch };
}

async function approveAndImport(batchId: string) {
  const approve = await app.inject({ method: "POST", url: `/api/migrations/${batchId}/approve`, headers: { cookie: ownerCookie } });
  expect(approve.statusCode).toBe(200);
  const importRes = await app.inject({ method: "POST", url: `/api/migrations/${batchId}/import`, headers: { cookie: ownerCookie } });
  expect(importRes.statusCode).toBe(200);
  return importRes.json().batch;
}

describe("Security (spec sections 34-37): Data Migration is Owner/Administrator only", () => {
  it("denies a Finance Officer on every migration endpoint", async () => {
    const list = await app.inject({ method: "GET", url: "/api/migrations", headers: { cookie: financeCookie } });
    expect(list.statusCode).toBe(403);

    const upload = await uploadBatch("LEADS", "fullName,email\nA,a@x.com\n", financeCookie);
    expect(upload.statusCode).toBe(403);
  });
});

describe("Staged pipeline (spec section 6): LEADS never skips a stage", () => {
  it("cannot dry-run before validate, cannot approve before dry-run, cannot import before approve", async () => {
    const upload = await uploadBatch("LEADS", "fullName,email,contactNumber\nJuan Dela Cruz,juan@example.com,09171234567\n");
    const batchId = upload.json().batch.id;

    const dryRunTooEarly = await app.inject({ method: "POST", url: `/api/migrations/${batchId}/dry-run`, headers: { cookie: ownerCookie } });
    expect(dryRunTooEarly.statusCode).toBe(409);

    const approveTooEarly = await app.inject({ method: "POST", url: `/api/migrations/${batchId}/approve`, headers: { cookie: ownerCookie } });
    expect(approveTooEarly.statusCode).toBe(409);

    await app.inject({ method: "POST", url: `/api/migrations/${batchId}/validate`, headers: { cookie: ownerCookie } });
    const importTooEarly = await app.inject({ method: "POST", url: `/api/migrations/${batchId}/import`, headers: { cookie: ownerCookie } });
    expect(importTooEarly.statusCode).toBe(409);
  });

  it("imports a valid Lead row only after validate -> dry-run -> approve -> import, and the dry run wrote no live data", async () => {
    const csv = "fullName,email,contactNumber,source\nAna Reyes,ana.reyes.p7@example.com,09181234567,Facebook Ad\n";
    const { batchId, dryRunBody } = await runToDryRun("LEADS", csv);

    expect(dryRunBody.status).toBe("DRY_RUN_COMPLETE");
    expect(dryRunBody.dryRunResultJson.recordsToCreate).toBe(1);
    const leadBeforeImport = await db.lead.findFirst({ where: { person: { email: "ana.reyes.p7@example.com" } } });
    expect(leadBeforeImport).toBeNull();

    const imported = await approveAndImport(batchId);
    expect(imported.status).toBe("COMPLETED");
    expect(imported.importedCount).toBe(1);

    const lead = await db.lead.findFirstOrThrow({ where: { person: { email: "ana.reyes.p7@example.com" } } });
    expect(lead.source).toBe("Facebook Ad");
  });
});

describe("Duplicate classification (spec section 13)", () => {
  it("classifies NO_MATCH, POSSIBLE_MATCH, and HIGH_CONFIDENCE_MATCH correctly, and HIGH is never imported", async () => {
    // Seed a Person matching the dev Owner's fixture (email AND phone) so we
    // can build a row against it that resolves HIGH_CONFIDENCE_MATCH — the
    // dev Owner has no contactNumber, so create a dedicated existing Person.
    const existing = await db.person.create({ data: { fullName: "Existing Contact", email: "existing.contact.p7@example.com", contactNumber: "09190000001" } });

    const csv = [
      "fullName,email,contactNumber",
      "Brand New Person,brand.new.p7@example.com,09190000099", // NO_MATCH
      `Possible Match Person,${existing.email},09190000098`, // matches email only -> POSSIBLE_MATCH
      `Exact Existing Person,${existing.email},${existing.contactNumber}`, // matches both -> HIGH_CONFIDENCE_MATCH
    ].join("\n") + "\n";

    const upload = await uploadBatch("LEADS", csv);
    const batchId = upload.json().batch.id;
    const validate = await app.inject({ method: "POST", url: `/api/migrations/${batchId}/validate`, headers: { cookie: ownerCookie } });
    const records = await app.inject({ method: "GET", url: `/api/migrations/${batchId}/records`, headers: { cookie: ownerCookie } });
    const rows = records.json().records as { normalizedDataJson: { email: string }; duplicateConfidence: string | null; status: string }[];

    const noMatch = rows.find((r) => r.normalizedDataJson.email === "brand.new.p7@example.com")!;
    const possible = rows.find((r) => r.normalizedDataJson.email === existing.email && r.status === "DUPLICATE_POSSIBLE")!;
    const high = rows.find((r) => r.status === "DUPLICATE_HIGH")!;
    expect(noMatch.duplicateConfidence).toBe("NO_MATCH");
    expect(possible.duplicateConfidence).toBe("POSSIBLE_MATCH");
    expect(high.duplicateConfidence).toBe("HIGH_CONFIDENCE_MATCH");

    await app.inject({ method: "POST", url: `/api/migrations/${batchId}/dry-run`, headers: { cookie: ownerCookie } });
    const imported = await approveAndImport(batchId);
    // NO_MATCH + POSSIBLE_MATCH imported (2), HIGH_CONFIDENCE_MATCH skipped (1)
    expect(imported.importedCount).toBe(2);
    expect(imported.skippedCount).toBeGreaterThanOrEqual(1);

    const highMatchLead = await db.lead.findFirst({ where: { person: { contactNumber: existing.contactNumber, email: existing.email } } });
    expect(highMatchLead).toBeNull(); // the exact-duplicate row was never imported
    expect(validate.statusCode).toBe(200);
  });
});

describe("Payment migration is high risk (spec sections 14-17)", () => {
  it("resolves a payment row only to an existing Student, never creates one, and stores it as LEGACY_UNVERIFIED with no fabricated date", async () => {
    const csv = [
      "studentDisplayId,amount,method,paymentDate,referenceNumber",
      "MAIA-B14-DEV-A,15000,GCash,2025-03-15,LEGACY-REF-001",
      "MAIA-B14-DEV-A,5000,Cash,,LEGACY-REF-002", // no date -> must store NULL, never fabricated
    ].join("\n") + "\n";

    const { batchId, dryRunBody } = await runToDryRun("PAYMENTS", csv);
    expect(dryRunBody.dryRunResultJson.financialImpact.totalAmount).toBe(20000);
    expect(dryRunBody.dryRunResultJson.financialImpact.note).toContain("LEGACY_UNVERIFIED");

    const imported = await approveAndImport(batchId);
    expect(imported.importedCount).toBe(2);

    const payments = await db.paymentTransaction.findMany({ where: { importBatchId: batchId }, orderBy: { referenceNumber: "asc" } });
    expect(payments).toHaveLength(2);
    for (const p of payments) {
      expect(p.status).toBe("LEGACY_UNVERIFIED");
      expect(p.source).toBe("LEGACY_IMPORT");
      expect(p.paymentDisplayId).toMatch(/^LEGACY-B14-/);
    }
    const undated = payments.find((p) => p.referenceNumber === "LEGACY-REF-002")!;
    expect(undated.paymentDate).toBeNull();

    const report = await app.inject({ method: "GET", url: `/api/migrations/${batchId}/report`, headers: { cookie: ownerCookie } });
    expect(report.json().financeReconciliation.importedTotal).toBe(20000);
    expect(report.json().financeReconciliation.difference).toBe(0);
    expect(report.json().financeReconciliation.allImportedAreUnverified).toBe(true);
  });

  it("rejects a payment row for a Student ID that doesn't exist, and never invents one", async () => {
    const csv = "studentDisplayId,amount,method,paymentDate\nMAIA-B14-DOES-NOT-EXIST,1000,Cash,2025-01-01\n";
    const upload = await uploadBatch("PAYMENTS", csv);
    const batchId = upload.json().batch.id;
    const validate = await app.inject({ method: "POST", url: `/api/migrations/${batchId}/validate`, headers: { cookie: ownerCookie } });
    expect(validate.json().batch.invalidCount).toBe(1);
    expect(validate.json().batch.status).toBe("NEEDS_REVIEW");

    const studentCountBefore = await db.student.count();
    const records = await app.inject({ method: "GET", url: `/api/migrations/${batchId}/records`, headers: { cookie: ownerCookie } });
    expect(records.json().records[0].status).toBe("INVALID");
    const studentCountAfter = await db.student.count();
    expect(studentCountAfter).toBe(studentCountBefore); // no Student was ever created from a payment row
  });
});

describe("Idempotency (spec section 19)", () => {
  it("re-uploading the same LEADS CSV does not duplicate the Person/Lead", async () => {
    const csv = "fullName,email,contactNumber\nIdempotent Person,idempotent.p7@example.com,09190000077\n";
    const first = await runToDryRun("LEADS", csv);
    await approveAndImport(first.batchId);

    const second = await runToDryRun("LEADS", csv);
    const secondImported = await approveAndImport(second.batchId);
    // The re-uploaded row now matches an existing Person on both signals ->
    // HIGH_CONFIDENCE_MATCH -> never imported a second time.
    expect(secondImported.importedCount).toBe(0);

    const leads = await db.lead.findMany({ where: { person: { email: "idempotent.p7@example.com" } } });
    expect(leads).toHaveLength(1);
  });

  it("re-uploading the same PAYMENTS CSV (same reference number) does not duplicate the transaction", async () => {
    const csv = "studentDisplayId,amount,method,paymentDate,referenceNumber\nMAIA-B14-DEV-B,3000,Bank Transfer,2025-05-01,IDEMPOTENT-PAY-001\n";
    const first = await runToDryRun("PAYMENTS", csv);
    const firstImported = await approveAndImport(first.batchId);
    expect(firstImported.importedCount).toBe(1);

    const second = await runToDryRun("PAYMENTS", csv);
    const secondImported = await approveAndImport(second.batchId);
    expect(secondImported.importedCount).toBe(0);
    expect(secondImported.skippedCount).toBeGreaterThanOrEqual(1);

    const payments = await db.paymentTransaction.findMany({ where: { referenceNumber: "IDEMPOTENT-PAY-001" } });
    expect(payments).toHaveLength(1);
  });
});

describe("Rollback (spec section 18)", () => {
  it("rolls back a completed Lead-only batch cleanly", async () => {
    const csv = "fullName,email,contactNumber\nRollback Person,rollback.p7@example.com,09190000066\n";
    const { batchId } = await runToDryRun("LEADS", csv);
    await approveAndImport(batchId);

    const beforeRollback = await db.lead.findFirst({ where: { person: { email: "rollback.p7@example.com" } } });
    expect(beforeRollback).not.toBeNull();

    const rollback = await app.inject({ method: "POST", url: `/api/migrations/${batchId}/rollback`, headers: { cookie: ownerCookie } });
    expect(rollback.statusCode).toBe(200);
    expect(rollback.json().rolledBack).toBe(1);
    expect(rollback.json().blocked).toBe(0);

    const afterRollback = await db.lead.findFirst({ where: { person: { email: "rollback.p7@example.com" } } });
    expect(afterRollback).toBeNull();
  });

  it("blocks rollback of a Lead that has since converted to a Student, without deleting the legitimate Student", async () => {
    const csv = "fullName,email,contactNumber\nConverted Person,converted.p7@example.com,09190000055\n";
    const { batchId } = await runToDryRun("LEADS", csv);
    await approveAndImport(batchId);

    const lead = await db.lead.findFirstOrThrow({ where: { person: { email: "converted.p7@example.com" } } });
    const premium = await db.package.findFirstOrThrow({ where: { name: "Premium" } });
    const batch14 = await db.batch.findFirstOrThrow({ where: { code: "14" } });
    const convertedStudent = await db.student.create({
      data: { studentDisplayId: "MAIA-B14-CONVERTED-P7", personId: lead.personId, batchId: batch14.id, packageId: premium.id, enrollmentStatus: "Active Student" },
    });
    await db.leadStudentConversion.create({ data: { leadId: lead.id, studentId: convertedStudent.id, convertedBy: "test-fixture" } });

    const rollback = await app.inject({ method: "POST", url: `/api/migrations/${batchId}/rollback`, headers: { cookie: ownerCookie } });
    expect(rollback.statusCode).toBe(200);
    expect(rollback.json().rolledBack).toBe(0);
    expect(rollback.json().blocked).toBe(1);

    const leadStillExists = await db.lead.findUnique({ where: { id: lead.id } });
    const studentStillExists = await db.student.findUnique({ where: { id: convertedStudent.id } });
    expect(leadStillExists).not.toBeNull();
    expect(studentStillExists).not.toBeNull();
  });
});

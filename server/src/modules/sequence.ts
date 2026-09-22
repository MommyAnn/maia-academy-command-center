import { db } from "../db.js";

// Concurrency-safe sequence generation (spec section 29). An atomic
// upsert-increment is race-free under Postgres's row-level locking on the
// UPDATE — two concurrent enrollments for the same batch can never receive
// the same number, unlike a naive "count existing rows + 1" approach.
export async function nextSequence(scope: string): Promise<number> {
  const row = await db.counter.upsert({
    where: { scope },
    update: { value: { increment: 1 } },
    create: { scope, value: 1 },
  });
  return row.value;
}

export async function generateStudentDisplayId(batchCode: string): Promise<string> {
  const n = await nextSequence(`student:${batchCode}`);
  return `MAIA-B${batchCode}-${String(n).padStart(4, "0")}`;
}

export async function generateEnrollmentDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`enrollment:${year}`);
  return `ENR-${year}-${String(n).padStart(6, "0")}`;
}

export async function generatePaymentDisplayId(batchCode: string): Promise<string> {
  const n = await nextSequence(`payment:${batchCode}`);
  return `PAY-B${batchCode}-${String(n).padStart(6, "0")}`;
}

export async function generateLeadDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`lead:${year}`);
  return `LEAD-${year}-${String(n).padStart(6, "0")}`;
}

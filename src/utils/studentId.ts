import type { Batch, StudentRecord } from "@/types/student";

function batchCode(batch: Batch): string {
  const match = batch.match(/\d+/);
  return match ? match[0] : "00";
}

/** Generates the next sequential demo Student ID for a batch, e.g. MAIA-B14-0004. */
export function generateStudentId(batch: Batch, existingStudents: StudentRecord[]): string {
  const code = batchCode(batch);
  const prefix = `MAIA-B${code}-`;
  const count = existingStudents.filter((s) => s.studentId.startsWith(prefix)).length;
  const nextSeq = String(count + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

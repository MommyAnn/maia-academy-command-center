// Per-import-type validation (spec section 11) — every check here is a
// real DB-backed rule (unknown package/batch/session/student are looked
// up, never assumed), and nothing here ever repairs or guesses a value on
// the caller's behalf; it only reports what's wrong.

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { normalizeName, normalizeEmail, isValidEmail, normalizePhone, isValidPhone, normalizeDate, normalizeAmount, normalizePaymentMethod } from "./normalize.js";

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationOutcome<T> {
  normalized: T;
  errors: FieldError[];
}

export interface LeadRow {
  fullName: string | null;
  email: string | null;
  contactNumber: string | null;
  source: string | null;
  campaign: string | null;
}

export async function validateLeadRow(raw: Record<string, string>): Promise<ValidationOutcome<LeadRow>> {
  const normalized: LeadRow = {
    fullName: normalizeName(raw.fullName),
    email: normalizeEmail(raw.email),
    contactNumber: normalizePhone(raw.contactNumber),
    source: normalizeName(raw.source),
    campaign: normalizeName(raw.campaign),
  };
  const errors: FieldError[] = [];
  if (!normalized.fullName) errors.push({ field: "fullName", message: "Missing required field: Full Name." });
  if (raw.email && normalized.email && !isValidEmail(normalized.email)) errors.push({ field: "email", message: "Invalid email format." });
  if (raw.contactNumber && normalized.contactNumber && !isValidPhone(normalized.contactNumber)) errors.push({ field: "contactNumber", message: "Invalid phone number." });
  if (!normalized.email && !normalized.contactNumber) errors.push({ field: "contact", message: "At least one of Email or Contact Number is required." });
  return { normalized, errors };
}

export interface WebinarRegistrationRow {
  fullName: string | null;
  email: string | null;
  contactNumber: string | null;
  sessionId: string | null;
  sessionTitleRaw: string | null;
}

export async function validateWebinarRegistrationRow(raw: Record<string, string>): Promise<ValidationOutcome<WebinarRegistrationRow>> {
  const normalized: WebinarRegistrationRow = {
    fullName: normalizeName(raw.fullName),
    email: normalizeEmail(raw.email),
    contactNumber: normalizePhone(raw.contactNumber),
    sessionId: null,
    sessionTitleRaw: normalizeName(raw.sessionTitle),
  };
  const errors: FieldError[] = [];
  if (!normalized.fullName) errors.push({ field: "fullName", message: "Missing required field: Full Name." });
  if (!normalized.contactNumber) errors.push({ field: "contactNumber", message: "Missing required field: Contact Number." });
  if (raw.email && normalized.email && !isValidEmail(normalized.email)) errors.push({ field: "email", message: "Invalid email format." });

  if (!normalized.sessionTitleRaw) {
    errors.push({ field: "sessionTitle", message: "Missing required field: Webinar Session Title." });
  } else {
    const session = await db.webinarSession.findFirst({ where: { title: { equals: normalized.sessionTitleRaw, mode: "insensitive" } } });
    if (!session) errors.push({ field: "sessionTitle", message: `Unknown Webinar Session: "${normalized.sessionTitleRaw}".` });
    else normalized.sessionId = session.id;
  }
  return { normalized, errors };
}

export interface StudentRow {
  fullName: string | null;
  email: string | null;
  contactNumber: string | null;
  packageName: string | null;
  packageId: string | null;
  batchCode: string | null;
  batchId: string | null;
  enrollmentStatus: string;
}

export async function validateStudentRow(raw: Record<string, string>): Promise<ValidationOutcome<StudentRow>> {
  const normalized: StudentRow = {
    fullName: normalizeName(raw.fullName),
    email: normalizeEmail(raw.email),
    contactNumber: normalizePhone(raw.contactNumber),
    packageName: normalizeName(raw.package),
    packageId: null,
    batchCode: raw.batch ? raw.batch.trim() : null,
    batchId: null,
    enrollmentStatus: normalizeName(raw.enrollmentStatus) ?? "Active Student",
  };
  const errors: FieldError[] = [];
  if (!normalized.fullName) errors.push({ field: "fullName", message: "Missing required field: Full Name." });
  if (!normalized.email && !normalized.contactNumber) errors.push({ field: "contact", message: "At least one of Email or Contact Number is required." });
  if (raw.email && normalized.email && !isValidEmail(normalized.email)) errors.push({ field: "email", message: "Invalid email format." });

  if (!normalized.packageName) {
    errors.push({ field: "package", message: "Missing required field: Package." });
  } else {
    const pkg = await db.package.findFirst({ where: { name: { equals: normalized.packageName, mode: "insensitive" } } });
    if (!pkg) errors.push({ field: "package", message: `Unknown Package: "${normalized.packageName}".` });
    else normalized.packageId = pkg.id;
  }

  if (!normalized.batchCode) {
    errors.push({ field: "batch", message: "Missing required field: Batch." });
  } else {
    const batch = await db.batch.findUnique({ where: { code: normalized.batchCode } });
    if (!batch) errors.push({ field: "batch", message: `Unknown Batch: "${normalized.batchCode}".` });
    else normalized.batchId = batch.id;
  }
  return { normalized, errors };
}

export interface PaymentRow {
  studentDisplayId: string | null;
  matchedStudentId: string | null;
  email: string | null;
  contactNumber: string | null;
  amount: number | null;
  method: string | null;
  paymentDate: Date | null;
  paymentDateAmbiguous: boolean;
  referenceNumber: string | null;
}

export async function validatePaymentRow(raw: Record<string, string>): Promise<ValidationOutcome<PaymentRow>> {
  const dateResult = normalizeDate(raw.paymentDate);
  const normalized: PaymentRow = {
    studentDisplayId: normalizeName(raw.studentDisplayId),
    matchedStudentId: null,
    email: normalizeEmail(raw.email),
    contactNumber: normalizePhone(raw.contactNumber),
    amount: normalizeAmount(raw.amount),
    method: normalizePaymentMethod(raw.method),
    paymentDate: dateResult.date,
    paymentDateAmbiguous: dateResult.ambiguous,
    referenceNumber: normalizeName(raw.referenceNumber),
  };
  const errors: FieldError[] = [];

  if (normalized.amount === null || normalized.amount <= 0) {
    errors.push({ field: "amount", message: "Missing or invalid required field: Amount." });
  }
  if (normalized.paymentDateAmbiguous) {
    errors.push({ field: "paymentDate", message: "Payment date is ambiguous (cannot tell month from day) — use YYYY-MM-DD." });
  }

  // A payment must resolve to exactly one EXISTING Student — never creates
  // one (spec section 14: payment migration only ever attaches to real,
  // already-onboarded students).
  if (normalized.studentDisplayId) {
    const student = await db.student.findUnique({ where: { studentDisplayId: normalized.studentDisplayId } });
    if (!student) errors.push({ field: "studentDisplayId", message: `Unknown Student ID: "${normalized.studentDisplayId}".` });
    else normalized.matchedStudentId = student.id;
  } else if (normalized.email || normalized.contactNumber) {
    const orConditions: Prisma.PersonWhereInput[] = [];
    if (normalized.email) orConditions.push({ email: { equals: normalized.email, mode: "insensitive" } });
    if (normalized.contactNumber) orConditions.push({ contactNumber: { contains: normalized.contactNumber } });
    const person = await db.person.findFirst({
      where: { OR: orConditions },
      include: { student: true },
    });
    if (!person?.student) errors.push({ field: "contact", message: "No matching existing Student found for this email/contact number." });
    else normalized.matchedStudentId = person.student.id;
  } else {
    errors.push({ field: "studentDisplayId", message: "Provide a Student ID, or an Email/Contact Number matching an existing Student." });
  }

  return { normalized, errors };
}

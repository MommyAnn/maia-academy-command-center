// Free Webinar Lead/Registration/Follow-up/Conversion calculation helpers — Step 10.

import type { StudentRecord } from "@/types/student";
import type {
  DuplicateMatchResult,
  FollowUp,
  Lead,
  LeadStatus,
  RegistrationAttendanceStatus,
  WebinarRegistration,
  WebinarSession,
} from "@/types/webinar";

function currentYear(): string {
  return String(new Date().getFullYear());
}

/** Generates the next sequential demo Webinar Session ID, e.g. WEBR-2026-000001. */
export function generateWebinarSessionId(existing: WebinarSession[]): string {
  const year = currentYear();
  const prefix = `WEBR-${year}-`;
  const count = existing.filter((s) => s.sessionId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

/** Generates the next sequential, STABLE Lead ID — never regenerated for a repeat registration (spec section 11). */
export function generateLeadId(existing: Lead[]): string {
  const year = currentYear();
  const prefix = `LEAD-${year}-`;
  const count = existing.filter((l) => l.leadId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

/** Generates the next sequential demo Registration ID, e.g. REG-2026-000001. */
export function generateRegistrationId(existing: WebinarRegistration[]): string {
  const year = currentYear();
  const prefix = `REG-${year}-`;
  const count = existing.filter((r) => r.registrationId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

/** Generates the next sequential demo Follow-up ID, e.g. FUP-2026-000001. */
export function generateFollowUpId(existing: FollowUp[]): string {
  const year = currentYear();
  const prefix = `FUP-${year}-`;
  const count = existing.filter((f) => f.followUpId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Strips everything but digits, and a leading country/trunk 0/63 so "0917 123 4567" and "+63 917 123 4567" match. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("63")) return digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/**
 * Duplicate detection (spec section 12): an exact email OR phone match
 * against an existing Lead or Student is treated as the same person and
 * auto-associated. Never silently merges when NEITHER matches exactly —
 * callers should still flag a close-but-not-exact match (e.g. same name,
 * different contact info) for manual Admin review rather than guessing.
 */
export function findDuplicateMatch(
  input: { email: string; contactNumber: string },
  leads: Lead[],
  students: StudentRecord[],
): DuplicateMatchResult {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.contactNumber);

  const matchedStudent = students.find((s) => normalizeEmail(s.email) === email || normalizePhone(s.contactNumber) === phone);
  const matchedLead = leads.find((l) => normalizeEmail(l.email) === email || normalizePhone(l.contactNumber) === phone);

  if (matchedStudent || matchedLead) {
    const matchedOn: ("email" | "contactNumber")[] = [];
    const ref = matchedStudent ?? matchedLead!;
    if (normalizeEmail(ref.email) === email) matchedOn.push("email");
    if (normalizePhone(ref.contactNumber) === phone) matchedOn.push("contactNumber");
    return { matchedLead: matchedLead ?? null, matchedStudent: matchedStudent ?? null, confidence: "exact", matchedOn };
  }

  return { matchedLead: null, matchedStudent: null, confidence: "none", matchedOn: [] };
}

const ATTENDED_STATUSES = new Set<RegistrationAttendanceStatus>(["Attended", "Completed Webinar", "Left Early"]);

export function isAttendedStatus(status: RegistrationAttendanceStatus): boolean {
  return ATTENDED_STATUSES.has(status);
}

export interface FunnelCounts {
  registrations: number;
  attended: number;
  interested: number;
  considering: number;
  reservationPaid: number;
  enrolled: number;
}

/** Computes the operational funnel counts for a set of leads + their registrations (spec sections 2/36). */
export function computeFunnelCounts(leads: Lead[], registrations: WebinarRegistration[]): FunnelCounts {
  const leadIds = new Set(leads.map((l) => l.id));
  const relevantRegistrations = registrations.filter((r) => leadIds.has(r.leadId));
  return {
    registrations: relevantRegistrations.length,
    attended: new Set(relevantRegistrations.filter((r) => isAttendedStatus(r.attendanceStatus)).map((r) => r.leadId)).size,
    interested: leads.filter((l) => l.status === "Interested").length,
    considering: leads.filter((l) => l.status === "Considering").length,
    reservationPaid: leads.filter((l) => l.status === "Reservation Paid").length,
    enrolled: leads.filter((l) => l.status === "Enrolled" || l.convertedToStudentId).length,
  };
}

/** A percentage, or 0 when the denominator is 0 — never NaN/Infinity in a KPI tile. */
export function conversionRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function isFollowUpOverdue(followUp: FollowUp, reference = new Date()): boolean {
  if (followUp.status !== "To Do") return false;
  return new Date(`${followUp.date}T${followUp.time || "23:59"}`) < reference;
}

export function isFollowUpToday(followUp: FollowUp, reference = new Date()): boolean {
  if (followUp.status !== "To Do") return false;
  return followUp.date === reference.toISOString().slice(0, 10);
}

export function isFollowUpUpcoming(followUp: FollowUp, reference = new Date()): boolean {
  if (followUp.status !== "To Do") return false;
  return followUp.date > reference.toISOString().slice(0, 10);
}

/** A lead is "high-intent" once they've told us they're interested/considering but nothing is scheduled to move them forward yet. */
export function isHighIntentLead(lead: Lead): boolean {
  return (lead.status === "Interested" || lead.status === "Considering") && !lead.nextFollowUpDate;
}

/**
 * Minimal CSV parser (handles quoted fields containing commas) for the
 * attendance/registration import workflow — no third-party dependency is
 * installed for this, and no real Zoom/webinar-platform integration exists
 * (spec section 19); this only reads a file the admin exports and uploads.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim().length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim().length > 0)) rows.push(row);
  }
  return rows;
}

export function pipelineStageTone(status: LeadStatus): "success" | "warning" | "danger" | "info" | "neutral" | "gold" {
  switch (status) {
    case "Enrolled":
      return "success";
    case "Reservation Paid":
      return "gold";
    case "Interested":
    case "Considering":
      return "info";
    case "Follow-up Needed":
      return "warning";
    case "Not Interested":
      return "danger";
    default:
      return "neutral";
  }
}

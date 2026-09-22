import { db } from "../db.js";

// Duplicate detection (spec sections 28, 51) — signals only, NEVER an
// automatic merge. Callers surface these as a "possible duplicate" flag for
// staff review; nothing in this codebase silently merges two Person rows.

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export interface DuplicateMatch {
  personId: string;
  fullName: string;
  matchedOn: "email" | "phone";
  isLead: boolean;
  isStudent: boolean;
}

export async function findPersonDuplicates(email?: string | null, phone?: string | null): Promise<DuplicateMatch[]> {
  const matches = new Map<string, DuplicateMatch>();

  if (email) {
    const normalized = normalizeEmail(email);
    const people = await db.person.findMany({ where: { email: { equals: normalized, mode: "insensitive" } }, include: { lead: true, student: true } });
    for (const p of people) {
      matches.set(p.id, { personId: p.id, fullName: p.fullName, matchedOn: "email", isLead: !!p.lead, isStudent: !!p.student });
    }
  }

  if (phone) {
    const normalized = normalizePhone(phone);
    if (normalized.length >= 7) {
      const people = await db.person.findMany({ where: { contactNumber: { contains: normalized } }, include: { lead: true, student: true } });
      for (const p of people) {
        if (!matches.has(p.id)) {
          matches.set(p.id, { personId: p.id, fullName: p.fullName, matchedOn: "phone", isLead: !!p.lead, isStudent: !!p.student });
        }
      }
    }
  }

  return Array.from(matches.values());
}

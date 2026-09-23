// Duplicate confidence classification for migration rows (spec section
// 13) — built on top of the existing findPersonDuplicates() signals
// (email, phone), but distinguishes HIGH_CONFIDENCE_MATCH (both signals
// point at the same Person) from POSSIBLE_MATCH (only one signal
// matched). Never auto-merges anything — this only classifies, staging
// the row as DUPLICATE_HIGH / DUPLICATE_POSSIBLE for manual review.

import { db } from "../../db.js";
import { normalizeEmail, normalizePhone } from "../duplicates.js";

export type DuplicateConfidence = "HIGH_CONFIDENCE_MATCH" | "POSSIBLE_MATCH" | "NO_MATCH";

export interface DuplicateClassification {
  confidence: DuplicateConfidence;
  personIds: string[];
}

export async function classifyDuplicate(email?: string | null, phone?: string | null): Promise<DuplicateClassification> {
  const [byEmail, byPhone] = await Promise.all([
    email ? db.person.findMany({ where: { email: { equals: normalizeEmail(email), mode: "insensitive" } } }) : Promise.resolve([]),
    phone && normalizePhone(phone).length >= 7 ? db.person.findMany({ where: { contactNumber: { contains: normalizePhone(phone) } } }) : Promise.resolve([]),
  ]);

  const emailIds = new Set(byEmail.map((p) => p.id));
  const phoneIds = new Set(byPhone.map((p) => p.id));
  const bothIds = [...emailIds].filter((id) => phoneIds.has(id));

  if (bothIds.length > 0) {
    return { confidence: "HIGH_CONFIDENCE_MATCH", personIds: bothIds };
  }
  const anyIds = new Set([...emailIds, ...phoneIds]);
  if (anyIds.size > 0) {
    return { confidence: "POSSIBLE_MATCH", personIds: [...anyIds] };
  }
  return { confidence: "NO_MATCH", personIds: [] };
}

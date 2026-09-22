// ---------------------------------------------------------------------------
// GHL TAG MAPPING — CONFIGURATION PLACEHOLDER, NOT WIRED (Step 10 spec 52)
// ---------------------------------------------------------------------------
// Nothing in this app applies these tags to a real GoHighLevel contact yet —
// there is no GHL connection (see src/integrations/ghlEvents.ts). This file
// exists so the mapping from an internal lead-lifecycle event to a GHL tag
// name is a single, editable table instead of a string hard-coded into
// business logic. When a real GHL integration is built, its outbound-event
// handler reads this map; nothing else in the app needs to change.
// ---------------------------------------------------------------------------

import type { GhlEventType } from "@/integrations/ghlEvents";

export const GHL_TAG_MAPPING: Partial<Record<GhlEventType, string>> = {
  "lead.webinar_registered": "FREE WEBINAR REGISTERED",
  "lead.webinar_attended": "WEBINAR ATTENDED",
  "lead.webinar_no_show": "WEBINAR NO SHOW",
  "lead.follow_up_needed": "FOLLOW-UP NEEDED",
  "lead.interested": "INTERESTED",
  "lead.considering": "CONSIDERING",
  "lead.reservation_paid": "RESERVATION PAID",
  "lead.enrolled": "ENROLLED",
};

/** Batch tags (e.g. "BATCH 15") are generated, never hard-coded per batch — see getBatchTag(). */
export function getBatchTag(batch: string): string {
  return batch.toUpperCase();
}

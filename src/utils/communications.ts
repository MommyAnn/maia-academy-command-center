// Communications, Follow-Up Automation & GoHighLevel Integration calculation
// helpers — Step 11.

import type {
  AutomationRule,
  CommunicationChannel,
  CommunicationLog,
  CommunicationLogStatus,
  CommunicationPreference,
  GhlSyncStatus,
  MessageTemplate,
  SyncLog,
  SyncLogStatus,
} from "@/types/communications";
import { PERSONALIZATION_VARIABLES } from "@/types/communications";
import type { GhlEventPayload } from "@/integrations/ghlEvents";

function currentYear(): string {
  return String(new Date().getFullYear());
}

/** Generates the next sequential year-scoped demo Message Template ID, e.g. TMPL-2026-000001. */
export function generateTemplateId(existing: MessageTemplate[]): string {
  const year = currentYear();
  const prefix = `TMPL-${year}-`;
  const count = existing.filter((t) => t.templateId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

/** Generates the next sequential year-scoped demo Automation Rule ID, e.g. AUTO-2026-000001. */
export function generateAutomationRuleId(existing: AutomationRule[]): string {
  const year = currentYear();
  const prefix = `AUTO-${year}-`;
  const count = existing.filter((r) => r.ruleId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

/** Generates the next sequential year-scoped demo Communication ID, e.g. COMM-2026-000001. */
export function generateCommunicationId(existing: CommunicationLog[]): string {
  const year = currentYear();
  const prefix = `COMM-${year}-`;
  const count = existing.filter((c) => c.communicationId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

/** Generates the next sequential year-scoped demo Sync ID, e.g. SYNC-2026-000001. */
export function generateSyncId(existing: SyncLog[]): string {
  const year = currentYear();
  const prefix = `SYNC-${year}-`;
  const count = existing.filter((s) => s.syncId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Personalization variables (spec sections 35-36)
// ---------------------------------------------------------------------------

/** Loosely-typed context so this file never needs to import Lead/StudentRecord/WebinarSession types directly — the caller (communicationsStore, which already has access to every store) assembles it. */
export interface VariableContext {
  firstName?: string;
  fullName?: string;
  webinarTitle?: string;
  webinarDate?: string;
  webinarTime?: string;
  batch?: string;
  package?: string;
  studentId?: string;
  leadId?: string;
  balance?: string;
  trainingDate?: string;
  courseName?: string;
  feedbackLink?: string;
  portalLink?: string;
}

const VARIABLE_TO_CONTEXT_KEY: Record<(typeof PERSONALIZATION_VARIABLES)[number], keyof VariableContext> = {
  "{{first_name}}": "firstName",
  "{{full_name}}": "fullName",
  "{{webinar_title}}": "webinarTitle",
  "{{webinar_date}}": "webinarDate",
  "{{webinar_time}}": "webinarTime",
  "{{batch}}": "batch",
  "{{package}}": "package",
  "{{student_id}}": "studentId",
  "{{lead_id}}": "leadId",
  "{{balance}}": "balance",
  "{{training_date}}": "trainingDate",
  "{{course_name}}": "courseName",
  "{{feedback_link}}": "feedbackLink",
  "{{portal_link}}": "portalLink",
};

/** Extracts every `{{variable}}` token actually used in a template's subject+message. */
export function extractVariablesUsed(text: string): string[] {
  const matches = text.match(/\{\{[a-z_]+\}\}/g) ?? [];
  return Array.from(new Set(matches)).filter((v) => (PERSONALIZATION_VARIABLES as readonly string[]).includes(v));
}

/**
 * Resolves every known `{{variable}}` in a template against the given
 * context; anything referenced in the text but missing from the context is
 * reported so the admin can be warned before activating the template (spec
 * section 36 — "MISSING VARIABLE").
 */
export function resolveTemplateVariables(text: string, context: VariableContext): { resolved: string; missing: string[] } {
  const missing: string[] = [];
  const resolved = text.replace(/\{\{[a-z_]+\}\}/g, (token) => {
    const key = VARIABLE_TO_CONTEXT_KEY[token as (typeof PERSONALIZATION_VARIABLES)[number]];
    if (!key) return token; // not a recognized/approved variable — left as-is, never silently dropped
    const value = context[key];
    if (value === undefined || value === "") {
      missing.push(token);
      return token;
    }
    return value;
  });
  return { resolved, missing: Array.from(new Set(missing)) };
}

// ---------------------------------------------------------------------------
// Consent / DND eligibility (spec sections 41-42, 44-45)
// ---------------------------------------------------------------------------

export interface ChannelEligibility {
  allowed: boolean;
  reason: string | null;
}

/**
 * The one condition this build actually enforces in code (spec section 13's
 * example: "Communication consent valid") before any Send Communication
 * action fires — never sends to an opted-out contact, and never treats one
 * channel's consent as blanket permission for every channel (spec 41).
 */
export function checkChannelEligibility(
  preference: CommunicationPreference | undefined,
  channel: CommunicationChannel,
  purpose: "marketing" | "operational",
): ChannelEligibility {
  if (!preference) return { allowed: true, reason: null };
  if (preference.optOutDate) return { allowed: false, reason: "Contact opted out" };
  if (purpose === "marketing" && !preference.marketingAllowed) return { allowed: false, reason: "Marketing consent not granted" };
  if (purpose === "operational" && !preference.operationalAllowed) return { allowed: false, reason: "Operational messages not allowed" };
  if (channel === "Email" && !preference.emailAllowed) return { allowed: false, reason: "Email not allowed (DND)" };
  if (channel === "SMS" && !preference.smsAllowed) return { allowed: false, reason: "SMS not allowed (DND)" };
  if (channel === "WhatsApp" && !preference.whatsappAllowed) return { allowed: false, reason: "WhatsApp not allowed (DND)" };
  return { allowed: true, reason: null };
}

// ---------------------------------------------------------------------------
// Idempotency (spec sections 39, 57, 70)
// ---------------------------------------------------------------------------

/**
 * One key per (rule, event type, person, moment) — used to make sure the
 * exact same underlying event never fires the exact same rule's actions
 * twice (e.g. a duplicate payment-verification event). Deliberately does
 * NOT include a random ID, so a genuine re-delivery of the identical event
 * produces the identical key.
 */
export function buildAutomationIdempotencyKey(ruleId: string, payload: GhlEventPayload): string {
  const personKey = payload.leadId ?? payload.studentId ?? payload.taskId ?? "none";
  return `${ruleId}:${payload.type}:${personKey}:${payload.occurredAt}`;
}

// ---------------------------------------------------------------------------
// Badge tone helpers (mirrors utils/webinar.ts's pipelineStageTone pattern)
// ---------------------------------------------------------------------------

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "gold" | "info";

export function syncStatusTone(status: GhlSyncStatus): BadgeTone {
  switch (status) {
    case "Synced":
      return "success";
    case "Syncing":
      return "info";
    case "Needs Update":
      return "warning";
    case "Error":
    case "Conflict":
      return "danger";
    default:
      return "neutral";
  }
}

export function communicationStatusTone(status: CommunicationLogStatus): BadgeTone {
  switch (status) {
    case "Delivered":
    case "Read":
    case "Sent":
      return "success";
    case "Queued":
      return "gold";
    case "Failed":
      return "danger";
    case "Skipped":
    case "Cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

export function syncLogStatusTone(status: SyncLogStatus): BadgeTone {
  switch (status) {
    case "Success":
      return "success";
    case "Retry Pending":
      return "warning";
    case "Failed":
    case "Needs Review":
      return "danger";
    default:
      return "neutral";
  }
}

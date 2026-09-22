// M.A.I.A. Communications, Follow-Up Automation & GoHighLevel Integration
// domain types — Step 11. Backed by demo/local state — see
// src/data/communicationsStore.tsx.
//
// CORE ARCHITECTURE (spec intro): M.A.I.A. is the operational source of
// truth (students, payments, course progress, attendance, Master Brain,
// private documents/feedback, inventory, certificates, internal ops). GHL
// is the communication/follow-up/marketing engine. Nothing here makes GHL
// authoritative over any of the data M.A.I.A. already owns — see
// CONFLICT_AUTHORITY below.
//
// NO REAL GHL CONNECTION EXISTS. Every "sync" and "send" in this build is
// simulated and clearly labeled as such — see IntegrationMode. Building a
// fake-but-convincing integration would be worse than an honest, prepared
// one (spec sections 72-73).

import type { Batch, PackageType } from "@/types/student";
import type { GhlEventType } from "@/integrations/ghlEvents";

// ---------------------------------------------------------------------------
// Channels (spec section 3)
// ---------------------------------------------------------------------------

export type CommunicationChannel = "Email" | "SMS" | "WhatsApp" | "Phone Call" | "Messenger" | "Viber" | "Internal Notification" | "Other";

export const COMMUNICATION_CHANNELS: CommunicationChannel[] = ["Email", "SMS", "WhatsApp", "Phone Call", "Messenger", "Viber", "Internal Notification", "Other"];

/** Channels this build can simulate sending through a (future) GHL connection. */
export const GHL_INTEGRATED_CHANNELS: CommunicationChannel[] = ["Email", "SMS", "WhatsApp"];

/** Channels that stay manual/reference only unless a specific connected provider exists (spec section 3). */
export const MANUAL_ONLY_CHANNELS: CommunicationChannel[] = ["Phone Call", "Messenger", "Viber", "Internal Notification", "Other"];

// ---------------------------------------------------------------------------
// Person reference — a Communication/Sync record always names WHO it is
// about via an ID pair, never by name-matching alone (spec section 4/7).
// ---------------------------------------------------------------------------

export type PersonType = "Lead" | "Student";

// ---------------------------------------------------------------------------
// GHL Contact Sync (spec sections 4, 7, 8, 9)
// ---------------------------------------------------------------------------

export type GhlSyncStatus = "Not Synced" | "Syncing" | "Synced" | "Needs Update" | "Error" | "Conflict";

export const GHL_SYNC_STATUSES: GhlSyncStatus[] = ["Not Synced", "Syncing", "Synced", "Needs Update", "Error", "Conflict"];

/**
 * One per Lead/Student, keyed by (personType, personId) — never by name
 * matching (spec section 4/7). Kept as its own record, cross-referenced by
 * ID, rather than bloating the Lead/StudentRecord types themselves — the
 * same "one source of truth via relationships" pattern Step 10 used for
 * Reservation → PaymentTransaction.
 */
export interface GhlContactSync {
  id: string;
  personType: PersonType;
  personId: string;
  ghlContactId: string | null;
  ghlLocationId: string | null;
  lastSyncDate: string | null;
  lastAttemptDate: string | null;
  lastSyncStatus: GhlSyncStatus;
  syncError: string | null;
  /** True when contact matching found no exact ID/email/phone match but a name looked similar — never auto-merged (spec section 7). */
  possibleDuplicate: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Communication Preferences / Consent / DND (spec sections 41-42)
// ---------------------------------------------------------------------------

export interface CommunicationPreference {
  id: string;
  personType: PersonType;
  personId: string;
  emailAllowed: boolean;
  smsAllowed: boolean;
  whatsappAllowed: boolean;
  marketingAllowed: boolean;
  /** Operational (non-marketing) messages — e.g. "your reservation is confirmed" — tracked separately since consent for one is never assumed to cover the other. */
  operationalAllowed: boolean;
  optOutDate: string | null;
  consentSource: string;
  consentDate: string;
}

// ---------------------------------------------------------------------------
// Message Templates (spec sections 33-36)
// ---------------------------------------------------------------------------

export type MessageTemplateCategory =
  | "Webinar"
  | "Lead Follow-Up"
  | "Enrollment"
  | "Payment"
  | "Requirements"
  | "Training"
  | "Taobao"
  | "Master Brain"
  | "Courses"
  | "Feedback"
  | "Certificate"
  | "General";

export const MESSAGE_TEMPLATE_CATEGORIES: MessageTemplateCategory[] = [
  "Webinar",
  "Lead Follow-Up",
  "Enrollment",
  "Payment",
  "Requirements",
  "Training",
  "Taobao",
  "Master Brain",
  "Courses",
  "Feedback",
  "Certificate",
  "General",
];

export type TemplateChannel = "Email" | "SMS" | "WhatsApp" | "Internal";

export const TEMPLATE_CHANNELS: TemplateChannel[] = ["Email", "SMS", "WhatsApp", "Internal"];

export type MessageTemplateStatus = "Draft" | "Active" | "Archived";

/** Only these variables may be used in a template — never a sensitive field like a password (spec section 35). */
export const PERSONALIZATION_VARIABLES = [
  "{{first_name}}",
  "{{full_name}}",
  "{{webinar_title}}",
  "{{webinar_date}}",
  "{{webinar_time}}",
  "{{batch}}",
  "{{package}}",
  "{{student_id}}",
  "{{lead_id}}",
  "{{balance}}",
  "{{training_date}}",
  "{{course_name}}",
  "{{feedback_link}}",
  "{{portal_link}}",
] as const;

export type PersonalizationVariable = (typeof PERSONALIZATION_VARIABLES)[number];

export interface MessageTemplate {
  id: string;
  templateId: string; // e.g. TMPL-2026-000001
  name: string;
  category: MessageTemplateCategory;
  channel: TemplateChannel;
  subject: string; // only meaningful when channel === "Email"
  message: string;
  status: MessageTemplateStatus;
  variablesUsed: string[];
  lastUpdated: string;
  approvedBy: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Automation Rules (spec sections 12-13, 37-40)
// ---------------------------------------------------------------------------

export type AutomationCategory =
  | "Webinar"
  | "Leads"
  | "Enrollment"
  | "Payment"
  | "Requirements"
  | "Training"
  | "Taobao"
  | "Master Brain"
  | "Courses"
  | "Feedback"
  | "Certificates"
  | "General";

export const AUTOMATION_CATEGORIES: AutomationCategory[] = [
  "Webinar",
  "Leads",
  "Enrollment",
  "Payment",
  "Requirements",
  "Training",
  "Taobao",
  "Master Brain",
  "Courses",
  "Feedback",
  "Certificates",
  "General",
];

export type AutomationActionType = "Sync to GHL" | "Apply Tag" | "Remove Tag" | "Start GHL Workflow" | "Send Communication" | "Stop Automation";

export const AUTOMATION_ACTION_TYPES: AutomationActionType[] = ["Sync to GHL", "Apply Tag", "Remove Tag", "Start GHL Workflow", "Send Communication", "Stop Automation"];

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  /** Only meaningful for "Apply Tag"/"Remove Tag" (a tag name) or "Start GHL Workflow" (a workflow name) — resolved through the configurable mappings, never hard-coded into the rule itself. */
  targetLabel: string;
  /** Only meaningful for "Send Communication". */
  channel: CommunicationChannel | null;
  templateId: string | null;
  /** Minutes to wait before this specific action fires, relative to the trigger (spec section 13's DELAY / WAIT step). 0 = immediate. */
  delayMinutes: number;
}

/** Plain-language eligibility/stop conditions — this builder intentionally does not recreate a full GHL-style condition/workflow engine (spec section 37). */
export const STOP_CONDITION_PRESETS = [
  "Lead Enrolled",
  "Lead marked Not Interested",
  "Contact opted out",
  "DND enabled for required channel",
  "Student Fully Paid",
  "Admin manually paused",
] as const;

export type AutomationRuleStatus = "Draft" | "Active" | "Paused" | "Archived";

export const AUTOMATION_RULE_STATUSES: AutomationRuleStatus[] = ["Draft", "Active", "Paused", "Archived"];

export interface AutomationRule {
  id: string;
  ruleId: string; // e.g. AUTO-2026-000001
  name: string;
  category: AutomationCategory;
  triggerEvent: GhlEventType;
  /** Freeform, human-readable eligibility conditions (e.g. "Communication consent valid") — evaluated informally; the one condition this build actually enforces in code is consent/DND before any Send Communication action (see utils/communications.ts). */
  conditions: string[];
  actions: AutomationAction[];
  stopConditions: string[];
  status: AutomationRuleStatus;
  totalTriggered: number;
  successful: number;
  failed: number;
  lastTriggeredAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Communication Log (spec section 46)
// ---------------------------------------------------------------------------

export type CommunicationLogStatus = "Queued" | "Sent" | "Delivered" | "Read" | "Failed" | "Skipped" | "Cancelled";

export const COMMUNICATION_LOG_STATUSES: CommunicationLogStatus[] = ["Queued", "Sent", "Delivered", "Read", "Failed", "Skipped", "Cancelled"];

export interface CommunicationLog {
  id: string;
  communicationId: string; // e.g. COMM-2026-000001
  personType: PersonType;
  personId: string;
  personName: string; // denormalized snapshot, same rationale as WebinarRegistration's leadSource snapshot in Step 10
  channel: CommunicationChannel;
  templateId: string | null;
  automationId: string | null;
  subject: string | null;
  message: string;
  status: CommunicationLogStatus;
  /** Always "GHL (Simulated)" / "Manual" in this build — never a real provider name, since no real send occurs (spec section 46/73). */
  provider: string;
  externalMessageId: string | null;
  failureReason: string | null;
  occurredAt: string;
  sentBy: string;
}

// ---------------------------------------------------------------------------
// Sync Log (spec section 56)
// ---------------------------------------------------------------------------

export type SyncLogStatus = "Success" | "Failed" | "Retry Pending" | "Needs Review";

export const SYNC_LOG_STATUSES: SyncLogStatus[] = ["Success", "Failed", "Retry Pending", "Needs Review"];

export type SyncDirection = "M.A.I.A. → GHL" | "GHL → M.A.I.A.";

export interface SyncLog {
  id: string;
  syncId: string; // e.g. SYNC-2026-000001
  personType: PersonType;
  personId: string;
  personName: string;
  direction: SyncDirection;
  event: string;
  occurredAt: string;
  status: SyncLogStatus;
  retryCount: number;
  error: string | null;
  externalId: string | null;
}

// ---------------------------------------------------------------------------
// Tag / Field / Workflow Mapping — configurable, never hard-coded into core
// business logic (spec sections 10, 11, 50)
// ---------------------------------------------------------------------------

export interface TagMappingEntry {
  id: string;
  triggerEvent: GhlEventType | "manual";
  tagName: string;
  enabled: boolean;
}

export type SyncFieldDirection = "M.A.I.A. → GHL" | "GHL → M.A.I.A." | "Two-Way";

export const SYNC_FIELD_DIRECTIONS: SyncFieldDirection[] = ["M.A.I.A. → GHL", "GHL → M.A.I.A.", "Two-Way"];

export interface FieldMappingEntry {
  id: string;
  maiaField: string;
  ghlField: string;
  direction: SyncFieldDirection;
  enabled: boolean;
}

export interface WorkflowMappingEntry {
  id: string;
  triggerEvent: GhlEventType;
  ghlWorkflowName: string;
  enabled: boolean;
}

/**
 * Explicit sync authority per data domain (spec section 55) — GHL is never
 * allowed to overwrite verified Academy records. This is a fixed reference
 * table (not admin-editable) because these are the architecture's safety
 * rules, not a business preference.
 */
export const CONFLICT_AUTHORITY: { domain: string; authority: string }[] = [
  { domain: "Finance / Payment Status", authority: "M.A.I.A. wins" },
  { domain: "Course Progress", authority: "M.A.I.A. wins" },
  { domain: "Attendance", authority: "M.A.I.A. wins" },
  { domain: "Master Brain Status", authority: "M.A.I.A. wins" },
  { domain: "GHL DND / Unsubscribe", authority: "GHL may update M.A.I.A. communication preference" },
  { domain: "Contact Phone / Email", authority: "Configurable (see Field Mapping direction)" },
];

// ---------------------------------------------------------------------------
// Integration Settings / Mode (spec sections 48-49, 72-73)
// ---------------------------------------------------------------------------

export type IntegrationMode = "Disconnected" | "Test / Sandbox" | "Production";

export const INTEGRATION_MODES: IntegrationMode[] = ["Disconnected", "Test / Sandbox", "Production"];

/**
 * NEVER holds a real secret (spec section 49) — only display labels. A real
 * build stores API tokens server-side; this frontend never has them.
 */
export interface IntegrationSettings {
  mode: IntegrationMode;
  locationLabel: string;
  webhookUrlLabel: string;
  connectedAt: string | null;
  retryLimit: number;
}

// ---------------------------------------------------------------------------
// Inbound Webhook simulation (spec sections 52-53)
// ---------------------------------------------------------------------------

export interface WebhookLogEntry {
  id: string;
  webhookId: string; // simulated external delivery ID
  eventType: string;
  receivedAt: string;
  signatureVerified: boolean;
  processed: boolean;
  duplicate: boolean;
  payloadSummary: string;
}

// ---------------------------------------------------------------------------
// Manual "Send Message" input (spec section 59)
// ---------------------------------------------------------------------------

export interface SendManualMessageInput {
  personType: PersonType;
  personId: string;
  channel: CommunicationChannel;
  templateId: string | null;
  subject: string;
  message: string;
}

export interface CreateAutomationRuleInput {
  name: string;
  category: AutomationCategory;
  triggerEvent: GhlEventType;
  conditions: string[];
  actions: Omit<AutomationAction, "id">[];
  stopConditions: string[];
}

export interface CreateMessageTemplateInput {
  name: string;
  category: MessageTemplateCategory;
  channel: TemplateChannel;
  subject: string;
  message: string;
}

/** Used by the Batch Communication audience builder (spec section 61) — preview only, never sends on its own. */
export interface AudienceFilter {
  batch: Batch | "all";
  package: PackageType | "all";
  webinarSessionId: string | "all";
  status: string | "all";
}

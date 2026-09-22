// Configuration + demo seed data for the Communications, Follow-Up
// Automation & GoHighLevel Integration module (Step 11). Every "sync" and
// "send" below is DEMO/LOCAL data only — see src/data/communicationsStore.tsx
// for the full disclosure. Seed records referencing an existing Lead/Student
// are looked up by their stable IDs, never by name matching (spec section 7).

import type {
  AutomationRule,
  CommunicationLog,
  CommunicationPreference,
  FieldMappingEntry,
  GhlContactSync,
  IntegrationSettings,
  MessageTemplate,
  SyncLog,
  TagMappingEntry,
  WebhookLogEntry,
  WorkflowMappingEntry,
} from "@/types/communications";
import { extractVariablesUsed } from "@/utils/communications";
import { GHL_TAG_MAPPING } from "@/integrations/ghlTagMapping";
import type { GhlEventType } from "@/integrations/ghlEvents";
import { LEAD_LIGAYA, LEAD_BENJIE, LEAD_CRISTINA, LEAD_NOEL, LEAD_PRINCESS } from "@/data/webinarConfig";
import { DEMO_STUDENTS } from "@/data/demoStudents";

export const CURRENT_DEMO_USER = "Mommy Ann";

function findStudentId(studentDisplayId: string): string {
  const student = DEMO_STUDENTS.find((s) => s.studentId === studentDisplayId);
  if (!student) throw new Error(`Demo student not found: ${studentDisplayId}`);
  return student.id;
}

// ---------------------------------------------------------------------------
// Integration Settings — DISCONNECTED by default (spec sections 48-49, 72).
// No real credential field exists anywhere in this shape or its store.
// ---------------------------------------------------------------------------

export const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  mode: "Disconnected",
  locationLabel: "",
  webhookUrlLabel: "",
  connectedAt: null,
  retryLimit: 3,
};

// ---------------------------------------------------------------------------
// Tag Mapping — seeded from the Step 10 placeholder (src/integrations/
// ghlTagMapping.ts), extended with the additional examples spec section 10
// calls out, and made admin-editable (enable/disable, rename) here instead
// of being a hard-coded permanent business rule.
// ---------------------------------------------------------------------------

function tagEntry(triggerEvent: GhlEventType, tagName: string): TagMappingEntry {
  return { id: crypto.randomUUID(), triggerEvent, tagName, enabled: true };
}

export const DEFAULT_TAG_MAPPINGS: TagMappingEntry[] = [
  ...Object.entries(GHL_TAG_MAPPING).map(([event, tag]) => tagEntry(event as GhlEventType, tag as string)),
  tagEntry("student.fully_paid", "FULLY PAID"),
  tagEntry("student.payment_verified", "PARTIAL PAYMENT"),
  tagEntry("student.master_brain_submitted", "MASTER BRAIN SUBMITTED"),
  tagEntry("student.course_access_granted", "COURSE ACCESS GRANTED"),
  tagEntry("student.course_completed", "COURSE COMPLETED"),
  tagEntry("student.feedback_submitted", "FEEDBACK SUBMITTED"),
];

/**
 * PREMIUM/VIP/DUAL VIP/BATCH X/F2F/ZOOM tags (spec section 10 examples) are
 * derived directly from a Student's current package/batch/attendance
 * preference rather than a specific event — applied automatically every
 * time a contact is synced. Not stored as rows here (nothing "triggers"
 * them), but documented in the GHL Integration page as always-applied,
 * non-configurable derived tags.
 */
export function computeAttributeTags(input: { package?: string; batch?: string; attendance?: string }): string[] {
  const tags: string[] = [];
  if (input.package) tags.push(input.package.toUpperCase());
  if (input.batch) tags.push(input.batch.toUpperCase());
  if (input.attendance === "Face-to-Face") tags.push("F2F");
  if (input.attendance === "Early Access via Zoom") tags.push("ZOOM");
  if (input.attendance === "Both") tags.push("F2F", "ZOOM");
  return tags;
}

// ---------------------------------------------------------------------------
// Field Mapping (spec section 11, 54-55) — direction matters: Finance/
// progress/attendance/Master Brain status are M.A.I.A.-owned and never
// two-way; GHL DND/unsubscribe flows the other direction (see
// CONFLICT_AUTHORITY in types/communications.ts for the fixed safety rules).
// ---------------------------------------------------------------------------

function fieldEntry(maiaField: string, ghlField: string, direction: FieldMappingEntry["direction"]): FieldMappingEntry {
  return { id: crypto.randomUUID(), maiaField, ghlField, direction, enabled: true };
}

export const DEFAULT_FIELD_MAPPINGS: FieldMappingEntry[] = [
  fieldEntry("Full Name", "Full Name", "M.A.I.A. → GHL"),
  fieldEntry("Email", "Email", "Two-Way"),
  fieldEntry("Phone", "Phone", "Two-Way"),
  fieldEntry("Student ID", "MAIA Student ID", "M.A.I.A. → GHL"),
  fieldEntry("Lead ID", "MAIA Lead ID", "M.A.I.A. → GHL"),
  fieldEntry("Batch", "MAIA Batch", "M.A.I.A. → GHL"),
  fieldEntry("Package", "MAIA Package", "M.A.I.A. → GHL"),
  fieldEntry("Payment Status", "MAIA Payment Status", "M.A.I.A. → GHL"),
  fieldEntry("Webinar Attendance", "MAIA Webinar Attendance", "M.A.I.A. → GHL"),
  fieldEntry("Lead Status", "MAIA Lead Status", "M.A.I.A. → GHL"),
  fieldEntry("Communication Preference (DND)", "DND Status", "GHL → M.A.I.A."),
];

// ---------------------------------------------------------------------------
// Workflow Mapping (spec section 50) — never a hard-coded workflow ID.
// ---------------------------------------------------------------------------

function workflowEntry(triggerEvent: GhlEventType, ghlWorkflowName: string): WorkflowMappingEntry {
  return { id: crypto.randomUUID(), triggerEvent, ghlWorkflowName, enabled: true };
}

export const DEFAULT_WORKFLOW_MAPPINGS: WorkflowMappingEntry[] = [
  workflowEntry("lead.webinar_registered", "Webinar Registration Workflow"),
  workflowEntry("lead.webinar_attended", "Post Webinar Workflow"),
  workflowEntry("lead.webinar_no_show", "No Show Workflow"),
  workflowEntry("lead.reservation_verified", "Complete Your Enrollment Workflow"),
  workflowEntry("student.enrolled", "Student Onboarding Workflow"),
  workflowEntry("student.fully_paid", "Fully Paid Student Workflow"),
  workflowEntry("student.master_brain_submitted", "Master Brain Confirmation Workflow"),
];

// ---------------------------------------------------------------------------
// Message Templates (spec sections 33-36)
// ---------------------------------------------------------------------------

let templateCounter = 0;
function template(input: Omit<MessageTemplate, "id" | "templateId" | "variablesUsed" | "lastUpdated" | "createdAt">): MessageTemplate {
  templateCounter += 1;
  return {
    ...input,
    id: crypto.randomUUID(),
    templateId: `TMPL-2026-${String(templateCounter).padStart(6, "0")}`,
    variablesUsed: extractVariablesUsed(`${input.subject} ${input.message}`),
    lastUpdated: "2026-09-01T09:00:00+08:00",
    createdAt: "2026-09-01T09:00:00+08:00",
  };
}

export const TEMPLATE_WEBINAR_CONFIRMATION = template({
  name: "Webinar Registration Confirmation",
  category: "Webinar",
  channel: "Email",
  subject: "You're registered for {{webinar_title}}!",
  message: "Hi {{first_name}}, you're confirmed for {{webinar_title}} on {{webinar_date}} at {{webinar_time}}. See you there!",
  status: "Active",
  approvedBy: CURRENT_DEMO_USER,
});

export const TEMPLATE_WEBINAR_THANK_YOU = template({
  name: "Post-Webinar Thank You",
  category: "Webinar",
  channel: "Email",
  subject: "Thanks for joining {{webinar_title}}!",
  message: "Hi {{first_name}}, thank you for attending {{webinar_title}}! We'd love your feedback: {{feedback_link}}",
  status: "Active",
  approvedBy: CURRENT_DEMO_USER,
});

export const TEMPLATE_WEBINAR_NO_SHOW = template({
  name: "Sorry We Missed You",
  category: "Webinar",
  channel: "Email",
  subject: "We missed you at {{webinar_title}}",
  message: "Hi {{first_name}}, sorry we missed you at {{webinar_title}}! We'll let you know about the next available schedule.",
  status: "Active",
  approvedBy: CURRENT_DEMO_USER,
});

export const TEMPLATE_LEAD_INTERESTED = template({
  name: "Interested Lead Follow-Up",
  category: "Lead Follow-Up",
  channel: "Email",
  subject: "Great to hear you're interested, {{first_name}}!",
  message: "Hi {{first_name}}, our team will reach out shortly to answer your questions about the program.",
  status: "Active",
  approvedBy: CURRENT_DEMO_USER,
});

export const TEMPLATE_LEAD_CONSIDERING = template({
  name: "Considering Lead — Program Info",
  category: "Lead Follow-Up",
  channel: "Email",
  subject: "Here's more info while you decide",
  message: "Hi {{first_name}}, here's some additional program information and FAQs to help with your decision.",
  status: "Active",
  approvedBy: CURRENT_DEMO_USER,
});

export const TEMPLATE_RESERVATION_CONFIRMED = template({
  name: "Reservation Payment Confirmed",
  category: "Payment",
  channel: "Email",
  subject: "Your reservation is confirmed!",
  message: "Hi {{first_name}}, we've confirmed your reservation payment. Let's complete your enrollment — remaining balance: {{balance}}.",
  status: "Active",
  approvedBy: CURRENT_DEMO_USER,
});

export const TEMPLATE_STUDENT_WELCOME = template({
  name: "Student Welcome / Onboarding",
  category: "Enrollment",
  channel: "Email",
  subject: "Welcome to M.A.I.A. Academy, {{first_name}}!",
  message: "Hi {{full_name}}, welcome to Batch {{batch}} ({{package}})! Your Student ID is {{student_id}}. Access your portal: {{portal_link}}",
  status: "Active",
  approvedBy: CURRENT_DEMO_USER,
});

export const TEMPLATE_FULLY_PAID = template({
  name: "Fully Paid Confirmation",
  category: "Payment",
  channel: "Email",
  subject: "You're Fully Paid!",
  message: "Hi {{first_name}}, your account is now Fully Paid. Thank you! Your training schedule details will follow.",
  status: "Active",
  approvedBy: CURRENT_DEMO_USER,
});

export const TEMPLATE_COURSE_ACCESS = template({
  name: "Course Access Granted",
  category: "Courses",
  channel: "Email",
  subject: "{{course_name}} is now available!",
  message: "Hi {{first_name}}, you now have access to {{course_name}}. Start learning here: {{portal_link}}",
  status: "Active",
  approvedBy: CURRENT_DEMO_USER,
});

export const TEMPLATE_MASTER_BRAIN_READY = template({
  name: "Master Brain Ready",
  category: "Master Brain",
  channel: "Email",
  subject: "Your Brand Master Brain is ready!",
  message: "Hi {{first_name}}, your Brand Master Brain document has been published. View it here: {{portal_link}}",
  status: "Active",
  approvedBy: CURRENT_DEMO_USER,
});

export const TEMPLATE_FEEDBACK_THANK_YOU = template({
  name: "Feedback Thank You",
  category: "Feedback",
  channel: "Email",
  subject: "Thank you for your feedback!",
  message: "Hi {{first_name}}, thank you for sharing your feedback — it genuinely helps us improve.",
  status: "Active",
  approvedBy: CURRENT_DEMO_USER,
});

export const DEMO_MESSAGE_TEMPLATES: MessageTemplate[] = [
  TEMPLATE_WEBINAR_CONFIRMATION,
  TEMPLATE_WEBINAR_THANK_YOU,
  TEMPLATE_WEBINAR_NO_SHOW,
  TEMPLATE_LEAD_INTERESTED,
  TEMPLATE_LEAD_CONSIDERING,
  TEMPLATE_RESERVATION_CONFIRMED,
  TEMPLATE_STUDENT_WELCOME,
  TEMPLATE_FULLY_PAID,
  TEMPLATE_COURSE_ACCESS,
  TEMPLATE_MASTER_BRAIN_READY,
  TEMPLATE_FEEDBACK_THANK_YOU,
];

// ---------------------------------------------------------------------------
// Automation Rules (spec sections 12-32, 37-40) — every rule mirrors a
// spec example. "Create Task" is intentionally never one of these actions:
// Step 10 already owns staff-task automation for the webinar/lead lifecycle
// (see src/data/taskStore.tsx) — duplicating it here would double-create
// tasks for the same event.
// ---------------------------------------------------------------------------

function action(input: Omit<AutomationRule["actions"][number], "id">): AutomationRule["actions"][number] {
  return { ...input, id: crypto.randomUUID() };
}

let ruleCounter = 0;
function rule(input: Omit<AutomationRule, "id" | "ruleId" | "totalTriggered" | "successful" | "failed" | "lastTriggeredAt" | "createdBy" | "createdAt" | "updatedAt">): AutomationRule {
  ruleCounter += 1;
  return {
    ...input,
    id: crypto.randomUUID(),
    ruleId: `AUTO-2026-${String(ruleCounter).padStart(6, "0")}`,
    totalTriggered: 0,
    successful: 0,
    failed: 0,
    lastTriggeredAt: null,
    createdBy: CURRENT_DEMO_USER,
    createdAt: "2026-09-01T09:00:00+08:00",
    updatedAt: "2026-09-01T09:00:00+08:00",
  };
}

export const DEMO_AUTOMATION_RULES: AutomationRule[] = [
  rule({
    name: "Webinar Registration Automation",
    category: "Webinar",
    triggerEvent: "lead.webinar_registered",
    conditions: ["Communication consent valid"],
    actions: [
      action({ type: "Sync to GHL", targetLabel: "", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Apply Tag", targetLabel: "FREE WEBINAR REGISTERED", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Start GHL Workflow", targetLabel: "Webinar Registration Workflow", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: TEMPLATE_WEBINAR_CONFIRMATION.id, delayMinutes: 0 }),
    ],
    stopConditions: ["Contact opted out"],
    status: "Active",
  }),
  rule({
    name: "Webinar Attended Follow-Up",
    category: "Webinar",
    triggerEvent: "lead.webinar_attended",
    conditions: ["Communication consent valid"],
    actions: [
      action({ type: "Sync to GHL", targetLabel: "", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Apply Tag", targetLabel: "WEBINAR ATTENDED", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Start GHL Workflow", targetLabel: "Post Webinar Workflow", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: TEMPLATE_WEBINAR_THANK_YOU.id, delayMinutes: 60 }),
    ],
    stopConditions: ["Lead Enrolled", "Lead marked Not Interested", "Contact opted out"],
    status: "Active",
  }),
  rule({
    name: "Webinar No-Show Follow-Up",
    category: "Webinar",
    triggerEvent: "lead.webinar_no_show",
    conditions: ["Communication consent valid"],
    actions: [
      action({ type: "Apply Tag", targetLabel: "WEBINAR NO SHOW", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Start GHL Workflow", targetLabel: "No Show Workflow", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: TEMPLATE_WEBINAR_NO_SHOW.id, delayMinutes: 0 }),
    ],
    stopConditions: ["Lead Enrolled", "Contact opted out"],
    status: "Active",
  }),
  rule({
    name: "Interested Lead Follow-Up",
    category: "Leads",
    triggerEvent: "lead.interested",
    conditions: ["Communication consent valid"],
    actions: [
      action({ type: "Sync to GHL", targetLabel: "", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Apply Tag", targetLabel: "INTERESTED", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: TEMPLATE_LEAD_INTERESTED.id, delayMinutes: 0 }),
    ],
    stopConditions: ["Lead Enrolled", "Lead marked Not Interested", "Contact opted out"],
    status: "Active",
  }),
  rule({
    name: "Considering Lead Nurture",
    category: "Leads",
    triggerEvent: "lead.considering",
    conditions: ["Communication consent valid"],
    actions: [
      action({ type: "Apply Tag", targetLabel: "CONSIDERING", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: TEMPLATE_LEAD_CONSIDERING.id, delayMinutes: 0 }),
    ],
    stopConditions: ["Lead Enrolled", "Lead marked Not Interested", "Contact opted out"],
    status: "Active",
  }),
  rule({
    name: "Reservation Verified — Complete Enrollment",
    category: "Payment",
    triggerEvent: "lead.reservation_verified",
    conditions: ["Reservation payment status is Verified (never merely uploaded)"],
    actions: [
      action({ type: "Apply Tag", targetLabel: "RESERVATION PAID", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Start GHL Workflow", targetLabel: "Complete Your Enrollment Workflow", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: TEMPLATE_RESERVATION_CONFIRMED.id, delayMinutes: 0 }),
    ],
    stopConditions: ["Contact opted out"],
    status: "Active",
  }),
  rule({
    name: "Lead Converted to Student — Preserve GHL Contact",
    category: "Enrollment",
    triggerEvent: "lead.converted_to_student",
    conditions: ["Same GHL Contact ID reused — never a new contact"],
    actions: [
      action({ type: "Sync to GHL", targetLabel: "", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Apply Tag", targetLabel: "ENROLLED", channel: null, templateId: null, delayMinutes: 0 }),
    ],
    stopConditions: [],
    status: "Active",
  }),
  rule({
    name: "Student Onboarding Workflow",
    category: "Enrollment",
    triggerEvent: "student.enrolled",
    conditions: ["Communication consent valid"],
    actions: [
      action({ type: "Start GHL Workflow", targetLabel: "Student Onboarding Workflow", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: TEMPLATE_STUDENT_WELCOME.id, delayMinutes: 0 }),
    ],
    stopConditions: ["Contact opted out"],
    status: "Active",
  }),
  rule({
    name: "Fully Paid Automation",
    category: "Payment",
    triggerEvent: "student.fully_paid",
    conditions: ["Derived payment status is Fully Paid (never merely proof uploaded)"],
    actions: [
      action({ type: "Sync to GHL", targetLabel: "", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Apply Tag", targetLabel: "FULLY PAID", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Remove Tag", targetLabel: "PARTIAL PAYMENT", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: TEMPLATE_FULLY_PAID.id, delayMinutes: 0 }),
    ],
    stopConditions: ["Contact opted out"],
    status: "Active",
  }),
  rule({
    name: "Requirements Reminder",
    category: "Requirements",
    triggerEvent: "student.requirement_missing",
    conditions: ["Communication consent valid"],
    actions: [action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: null, delayMinutes: 0 })],
    stopConditions: ["Contact opted out"],
    status: "Paused",
  }),
  rule({
    name: "Course Access Granted Welcome",
    category: "Courses",
    triggerEvent: "student.course_access_granted",
    conditions: ["Communication consent valid"],
    actions: [action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: TEMPLATE_COURSE_ACCESS.id, delayMinutes: 0 })],
    stopConditions: ["Contact opted out"],
    status: "Active",
  }),
  rule({
    name: "Master Brain Published",
    category: "Master Brain",
    triggerEvent: "masterbrain.published",
    conditions: ["Communication consent valid"],
    actions: [action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: TEMPLATE_MASTER_BRAIN_READY.id, delayMinutes: 0 })],
    stopConditions: ["Contact opted out"],
    status: "Active",
  }),
  rule({
    name: "Feedback Submitted Thank You",
    category: "Feedback",
    triggerEvent: "student.feedback_submitted",
    conditions: ["Communication consent valid"],
    actions: [
      action({ type: "Apply Tag", targetLabel: "FEEDBACK SUBMITTED", channel: null, templateId: null, delayMinutes: 0 }),
      action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: TEMPLATE_FEEDBACK_THANK_YOU.id, delayMinutes: 0 }),
    ],
    stopConditions: ["Contact opted out"],
    status: "Active",
  }),
  rule({
    name: "Certificate Ready Notification",
    category: "Certificates",
    triggerEvent: "certificate.ready",
    conditions: ["Communication consent valid"],
    actions: [action({ type: "Send Communication", targetLabel: "", channel: "Email", templateId: null, delayMinutes: 0 })],
    stopConditions: ["Contact opted out"],
    status: "Draft",
  }),
];

// ---------------------------------------------------------------------------
// GHL Contact Sync + Communication Preference seed data — a handful of
// existing Step 10 demo Leads/Students, spanning every sync status so the
// UI isn't empty on first load.
// ---------------------------------------------------------------------------

function contactSync(input: Omit<GhlContactSync, "id" | "createdAt" | "updatedAt">): GhlContactSync {
  return { ...input, id: crypto.randomUUID(), createdAt: "2026-09-10T14:05:00+08:00", updatedAt: "2026-09-10T14:05:00+08:00" };
}

export const DEMO_GHL_CONTACT_SYNCS: GhlContactSync[] = [
  contactSync({
    personType: "Lead",
    personId: LEAD_LIGAYA.id,
    ghlContactId: "ghl-contact-demo-0001",
    ghlLocationId: "ghl-location-demo",
    lastSyncDate: "2026-09-10T14:05:00+08:00",
    lastAttemptDate: "2026-09-10T14:05:00+08:00",
    lastSyncStatus: "Synced",
    syncError: null,
    possibleDuplicate: false,
  }),
  contactSync({
    personType: "Lead",
    personId: LEAD_BENJIE.id,
    ghlContactId: "ghl-contact-demo-0002",
    ghlLocationId: "ghl-location-demo",
    lastSyncDate: "2026-09-11T09:00:00+08:00",
    lastAttemptDate: "2026-09-11T09:00:00+08:00",
    lastSyncStatus: "Synced",
    syncError: null,
    possibleDuplicate: false,
  }),
  contactSync({
    personType: "Lead",
    personId: LEAD_CRISTINA.id,
    ghlContactId: null,
    ghlLocationId: null,
    lastSyncDate: null,
    lastAttemptDate: "2026-09-12T16:20:00+08:00",
    lastSyncStatus: "Error",
    syncError: "Simulated timeout — no real GHL connection exists in this build.",
    possibleDuplicate: false,
  }),
  contactSync({
    personType: "Lead",
    personId: LEAD_NOEL.id,
    ghlContactId: null,
    ghlLocationId: null,
    lastSyncDate: null,
    lastAttemptDate: null,
    lastSyncStatus: "Not Synced",
    syncError: null,
    possibleDuplicate: false,
  }),
  contactSync({
    personType: "Student",
    personId: findStudentId("MAIA-B14-0001"),
    ghlContactId: "ghl-contact-demo-0010",
    ghlLocationId: "ghl-location-demo",
    lastSyncDate: "2026-09-05T10:00:00+08:00",
    lastAttemptDate: "2026-09-05T10:00:00+08:00",
    lastSyncStatus: "Synced",
    syncError: null,
    possibleDuplicate: false,
  }),
  contactSync({
    personType: "Student",
    personId: findStudentId("MAIA-B14-0002"),
    ghlContactId: "ghl-contact-demo-0011",
    ghlLocationId: "ghl-location-demo",
    lastSyncDate: "2026-08-20T10:00:00+08:00",
    lastAttemptDate: "2026-09-14T08:00:00+08:00",
    lastSyncStatus: "Needs Update",
    syncError: null,
    possibleDuplicate: false,
  }),
];

function preference(input: Omit<CommunicationPreference, "id">): CommunicationPreference {
  return { ...input, id: crypto.randomUUID() };
}

export const DEMO_COMMUNICATION_PREFERENCES: CommunicationPreference[] = [
  preference({
    personType: "Lead",
    personId: LEAD_LIGAYA.id,
    emailAllowed: true,
    smsAllowed: true,
    whatsappAllowed: false,
    marketingAllowed: true,
    operationalAllowed: true,
    optOutDate: null,
    consentSource: "Webinar registration form",
    consentDate: "2026-09-10T14:00:00+08:00",
  }),
  preference({
    personType: "Lead",
    personId: LEAD_BENJIE.id,
    emailAllowed: true,
    smsAllowed: true,
    whatsappAllowed: false,
    marketingAllowed: false,
    operationalAllowed: true,
    optOutDate: null,
    consentSource: "Webinar registration form",
    consentDate: "2026-09-08T10:00:00+08:00",
  }),
  preference({
    personType: "Lead",
    personId: LEAD_PRINCESS.id,
    emailAllowed: false,
    smsAllowed: false,
    whatsappAllowed: false,
    marketingAllowed: false,
    operationalAllowed: false,
    optOutDate: "2026-09-15T11:00:00+08:00",
    consentSource: "Lead requested no further contact",
    consentDate: "2026-09-01T10:00:00+08:00",
  }),
  preference({
    personType: "Student",
    personId: findStudentId("MAIA-B14-0001"),
    emailAllowed: true,
    smsAllowed: true,
    whatsappAllowed: false,
    marketingAllowed: true,
    operationalAllowed: true,
    optOutDate: null,
    consentSource: "Enrollment form",
    consentDate: "2026-07-01T09:00:00+08:00",
  }),
];

// ---------------------------------------------------------------------------
// Communication Log + Sync Log seed data
// ---------------------------------------------------------------------------

let commLogCounter = 0;
function commLog(input: Omit<CommunicationLog, "id" | "communicationId">): CommunicationLog {
  commLogCounter += 1;
  return { ...input, id: crypto.randomUUID(), communicationId: `COMM-2026-${String(commLogCounter).padStart(6, "0")}` };
}

export const DEMO_COMMUNICATION_LOGS: CommunicationLog[] = [
  commLog({
    personType: "Lead",
    personId: LEAD_LIGAYA.id,
    personName: LEAD_LIGAYA.fullName,
    channel: "Email",
    templateId: TEMPLATE_WEBINAR_CONFIRMATION.id,
    automationId: null,
    subject: "You're registered for Manufacturer Process Unlock Masterclass!",
    message: "Hi Ligaya, you're confirmed for the webinar. See you there!",
    status: "Sent",
    provider: "GHL (Simulated)",
    externalMessageId: null,
    failureReason: null,
    occurredAt: "2026-09-10T14:05:00+08:00",
    sentBy: "System (Automatic)",
  }),
  commLog({
    personType: "Lead",
    personId: LEAD_CRISTINA.id,
    personName: LEAD_CRISTINA.fullName,
    channel: "Email",
    templateId: TEMPLATE_LEAD_INTERESTED.id,
    automationId: null,
    subject: "Great to hear you're interested, Cristina!",
    message: "Hi Cristina, our team will reach out shortly.",
    status: "Failed",
    provider: "GHL (Simulated)",
    externalMessageId: null,
    failureReason: "Simulated: GHL contact not yet synced for this Lead.",
    occurredAt: "2026-09-12T16:21:00+08:00",
    sentBy: "System (Automatic)",
  }),
];

let syncLogCounter = 0;
function syncLog(input: Omit<SyncLog, "id" | "syncId">): SyncLog {
  syncLogCounter += 1;
  return { ...input, id: crypto.randomUUID(), syncId: `SYNC-2026-${String(syncLogCounter).padStart(6, "0")}` };
}

export const DEMO_SYNC_LOGS: SyncLog[] = [
  syncLog({
    personType: "Lead",
    personId: LEAD_LIGAYA.id,
    personName: LEAD_LIGAYA.fullName,
    direction: "M.A.I.A. → GHL",
    event: "lead.webinar_registered",
    occurredAt: "2026-09-10T14:05:00+08:00",
    status: "Success",
    retryCount: 0,
    error: null,
    externalId: "ghl-contact-demo-0001",
  }),
  syncLog({
    personType: "Lead",
    personId: LEAD_CRISTINA.id,
    personName: LEAD_CRISTINA.fullName,
    direction: "M.A.I.A. → GHL",
    event: "lead.created",
    occurredAt: "2026-09-12T16:20:00+08:00",
    status: "Retry Pending",
    retryCount: 1,
    error: "Simulated timeout — no real GHL connection exists in this build.",
    externalId: null,
  }),
];

export const DEMO_WEBHOOK_LOG: WebhookLogEntry[] = [
  {
    id: crypto.randomUUID(),
    webhookId: "whk-demo-0001",
    eventType: "Contact Updated",
    receivedAt: "2026-09-11T09:10:00+08:00",
    signatureVerified: true,
    processed: true,
    duplicate: false,
    payloadSummary: "Simulated: GHL contact tag list changed.",
  },
];

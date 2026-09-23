// Communication eligibility engine (spec sections 39-45, 53-54) — a pure
// read/decide function every automated send (outbox consumer, manual send,
// bulk send) must pass through before a message is ever queued. Nothing in
// this file ever sends anything; it only answers "is this send allowed?"
// and, if not, gives the safe reason a CommunicationLog row is stored with
// (status "Skipped", never fabricated as "Sent"/"Delivered").
//
// Consent/DND/opt-out live only on the Lead row (spec section 48's
// canEmail/canSms/canWhatsapp/optedOut/dnd flags) — a Student who was
// converted from a Lead keeps that Lead row for life (Phase 4: "the Lead
// is never deleted after conversion"), so its consent still applies. A
// Student who was created directly, with no Lead row ever created for
// their Person, has no consent record at all — this engine fails CLOSED
// in that case rather than assuming permission.

import { db } from "../../db.js";
import { computeStudentFinanceSummary, resolveNetAmountDue } from "../finance/calc.js";

export type CommunicationChannel = "Email" | "SMS" | "WhatsApp" | "Manual Viber" | "Manual Messenger" | "Other";

export const AUTOMATED_CHANNELS: readonly CommunicationChannel[] = ["Email", "SMS", "WhatsApp"];

export type EligibilityResult = { eligible: true } | { eligible: false; reason: string };

export async function checkCommunicationEligibility(personId: string, channel: CommunicationChannel): Promise<EligibilityResult> {
  // Manual (non-integrated) channels are never sent automatically — they
  // may only be logged as a manual follow-up a human actually performed
  // (spec section 45), so they never clear this automated-send gate.
  if (!AUTOMATED_CHANNELS.includes(channel)) {
    return { eligible: false, reason: `${channel} is a manual channel — it must be logged as a manual follow-up, never sent automatically.` };
  }

  const [person, lead] = await Promise.all([
    db.person.findUnique({ where: { id: personId } }),
    db.lead.findUnique({ where: { personId } }),
  ]);
  if (!person) return { eligible: false, reason: "Unknown contact." };
  if (!lead) return { eligible: false, reason: "No consent record on file for this contact." };
  if (lead.dnd) return { eligible: false, reason: "Contact has Do Not Disturb enabled." };
  if (lead.optedOut) return { eligible: false, reason: "Contact has opted out of marketing communication." };

  if (channel === "Email") {
    if (!lead.canEmail) return { eligible: false, reason: "No email consent on file." };
    if (!person.email) return { eligible: false, reason: "Contact has no email address on file." };
  } else if (channel === "SMS") {
    if (!lead.canSms) return { eligible: false, reason: "No SMS consent on file." };
    if (!person.contactNumber) return { eligible: false, reason: "Contact has no phone number on file." };
  } else if (channel === "WhatsApp") {
    if (!lead.canWhatsapp) return { eligible: false, reason: "No WhatsApp consent on file." };
    if (!person.contactNumber) return { eligible: false, reason: "Contact has no phone number on file." };
  }

  return { eligible: true };
}

/**
 * Draft/Archived templates may never be used to send (only previewed) —
 * spec section 46-47. Paused is a template concept that doesn't exist;
 * only Draft | Active | Archived apply to MessageTemplate.status.
 */
export function checkTemplateApproved(template: { status: string } | null): EligibilityResult {
  if (!template) return { eligible: false, reason: "No template selected." };
  if (template.status !== "Active") return { eligible: false, reason: `Template is ${template.status}, not Active — it cannot be used to send.` };
  return { eligible: true };
}

/**
 * Draft/Paused/Archived automation rules never execute (spec section 50)
 * — only an Active rule may queue a send.
 */
export function checkAutomationRuleActive(rule: { status: string } | null): EligibilityResult {
  if (!rule) return { eligible: false, reason: "Automation rule not found." };
  if (rule.status !== "Active") return { eligible: false, reason: `Automation rule is ${rule.status} — only Active rules execute.` };
  return { eligible: true };
}

/**
 * Stop conditions (spec section 51) — an automation rule listing e.g.
 * "LEAD_CONVERTED" must never fire for a Lead that has already converted,
 * even if the triggering event itself still matches.
 */
export async function checkStopConditions(personId: string, stopConditions: string[] | null | undefined): Promise<EligibilityResult> {
  if (!stopConditions || stopConditions.length === 0) return { eligible: true };
  const lead = await db.lead.findUnique({ where: { personId } });
  if (!lead) return { eligible: true };

  const triggered: string[] = [];
  if (stopConditions.includes("LEAD_CONVERTED") && lead.status === "Converted") triggered.push("LEAD_CONVERTED");
  if (stopConditions.includes("STUDENT_FULLY_PAID")) {
    const student = await db.student.findUnique({ where: { personId } });
    if (student) {
      const summary = await computeStudentFinanceSummary(student.id, await resolveNetAmountDue(student.id));
      if (summary.status === "Fully Paid") triggered.push("STUDENT_FULLY_PAID");
    }
  }
  if (stopConditions.includes("LEAD_OPTED_OUT") && lead.optedOut) triggered.push("LEAD_OPTED_OUT");
  if (stopConditions.includes("LEAD_MARKED_NOT_INTERESTED") && lead.pipelineStage === "NOT_INTERESTED") triggered.push("LEAD_MARKED_NOT_INTERESTED");
  if (stopConditions.includes("CONTACT_DND") && lead.dnd) triggered.push("CONTACT_DND");
  if (stopConditions.includes("PAYMENT_VERIFIED")) {
    const verifiedPayment = await db.paymentTransaction.findFirst({ where: { leadId: lead.id, status: "VERIFIED" } });
    if (verifiedPayment) triggered.push("PAYMENT_VERIFIED");
  }
  if (stopConditions.includes("ENROLLED")) {
    const student = await db.student.findUnique({ where: { personId } });
    if (student) {
      const enrollment = await db.enrollment.findFirst({ where: { studentId: student.id } });
      if (enrollment) triggered.push("ENROLLED");
    }
  }
  if (stopConditions.includes("REQUIREMENT_COMPLETED")) {
    const student = await db.student.findUnique({ where: { personId } });
    if (student) {
      const [total, verified] = await Promise.all([
        db.requirement.count({ where: { studentId: student.id } }),
        db.requirement.count({ where: { studentId: student.id, status: "VERIFIED" } }),
      ]);
      if (total > 0 && total === verified) triggered.push("REQUIREMENT_COMPLETED");
    }
  }

  if (triggered.length > 0) {
    return { eligible: false, reason: `Stop condition met: ${triggered.join(", ")}.` };
  }
  return { eligible: true };
}

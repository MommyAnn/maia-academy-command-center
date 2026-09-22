// ---------------------------------------------------------------------------
// GOHIGHLEVEL INTEGRATION — ARCHITECTURE / HOOKS ONLY
// ---------------------------------------------------------------------------
// This file does NOT talk to GoHighLevel. There is no API key, no HTTP call,
// and no real webhook here — building a fake integration would be worse
// than building none, since it would look connected without doing anything.
//
// What this file IS: a single, typed place other parts of the app can call
// when a real-world event happens (a new enrollment, a payment verified, a
// task completed, etc.) so that once a real GHL connection exists, wiring it
// up means implementing the body of `dispatchGhlEvent` below — no other
// file in the app needs to change, because callers already go through here.
//
// Until then, `dispatchGhlEvent` only logs to the console in development,
// so the "hook points" are visible and testable without pretending to be a
// finished integration.
// ---------------------------------------------------------------------------

export type GhlEventType =
  | "student.enrolled"
  | "student.payment_verified"
  | "student.fully_paid"
  | "student.master_brain_approved"
  | "student.training_completed"
  | "task.created"
  | "task.completed"
  // Student Portal events (Step 7) — same "prepared hook, not a real
  // integration" rule as everything above. Only a few of these have an
  // actual dispatch call site yet (see each store's action); the rest
  // (e.g. Taobao OTP Needed) are declared so the shape is ready even
  // though nothing in the app produces that event yet.
  | "portal.activated"
  | "student.requirement_missing"
  | "student.taobao_otp_needed"
  | "student.master_brain_submitted"
  | "training.scheduled"
  | "certificate.ready"
  // Course Access & LMS events (Step 9) — same "prepared hook" rule.
  | "student.course_access_granted"
  | "student.course_completed"
  // Global Feedback & Testimonial events (Step 9).
  | "student.feedback_submitted"
  | "student.marketing_consent_granted"
  | "student.incentive_unlocked"
  // Free Webinar Lead & Conversion events (Step 10) — same "prepared hook,
  // not a real integration" rule as every event above. Incoming GHL events
  // (Contact Created/Updated, Tag Applied, Workflow Status, Form Submission,
  // Appointment/Event) have no inbound handler yet — outbound only for now.
  | "lead.created"
  | "lead.webinar_registered"
  | "lead.webinar_attended"
  | "lead.webinar_no_show"
  | "lead.follow_up_needed"
  | "lead.interested"
  | "lead.considering"
  | "lead.reservation_paid"
  | "lead.enrolled"
  | "lead.converted_to_student";

export interface GhlEventPayload {
  type: GhlEventType;
  occurredAt: string;
  studentId?: string;
  studentDisplayId?: string;
  taskId?: string;
  leadId?: string;
  summary: string;
}

/**
 * Prepared hook for future GoHighLevel automation (e.g. triggering a GHL
 * workflow when a student is fully paid). Currently a no-op that only logs
 * in development — replace the body with a real API/webhook call once GHL
 * credentials and an integration plan exist. Every call site in this app
 * already goes through this function, so that will be the only file that
 * needs to change.
 */
export function dispatchGhlEvent(payload: GhlEventPayload): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[GHL integration stub] would dispatch:", payload);
  }
}

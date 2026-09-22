import { db } from "../db.js";

// Durable audit logging (spec sections 31-32). Callers pass only the
// whitelisted fields below — there is deliberately no "extra data" bag on
// this function, so a future caller cannot accidentally pass a password,
// token, or API key through to storage. Compare any new call site against
// this list before adding one.
export const AUDIT_ACTIONS = [
  "Login",
  "Login Failed",
  "Logout",
  "Password Reset Requested",
  "Password Reset Completed",
  "Account Provisioned",
  "Student Created",
  "Student Updated",
  "Payment Submitted",
  "Payment Verified",
  "Payment Rejected",
  "Requirement Verified",
  "Role Changed",
  "Permission Changed",
  "Lead Converted",
  "Course Access Granted",
  "Course Access Revoked",
  "Master Brain Published",
  "Feedback Approved",
  "Marketing Consent Changed",
  "Certificate Issued",
  "Integration Configuration Changed",
  "Admin Viewed As Student",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

interface AuditEntry {
  action: AuditAction;
  summary: string;
  actorUserId?: string | null;
  actorStudentId?: string | null;
  entityType?: string;
  entityId?: string;
}

export async function writeAuditLog(entry: AuditEntry) {
  await db.activityLog.create({
    data: {
      action: entry.action,
      summary: entry.summary,
      actorUserId: entry.actorUserId ?? null,
      actorStudentId: entry.actorStudentId ?? null,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
    },
  });
}

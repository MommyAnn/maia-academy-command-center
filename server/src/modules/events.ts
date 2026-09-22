import type { Prisma } from "@prisma/client";
import { db } from "../db.js";

// Internal domain events only (spec sections 37-39) — nothing in Phase 2
// dispatches these anywhere outside this table. This is deliberately the
// seam a future GHL/email/SMS integration phase subscribes to, so core
// business logic (enrollment, payment verification, requirement review)
// never has to know GHL exists.
export const DOMAIN_EVENT_TYPES = [
  "STUDENT_CREATED",
  "ENROLLMENT_CREATED",
  "ENROLLMENT_CONFIRMED",
  "STUDENT_FULLY_PAID",
  "REQUIREMENT_SUBMITTED",
  "REQUIREMENT_VERIFIED",
  "REQUIREMENT_REJECTED",
  "LEAD_CONVERTED",
  // Phase 3 — Training / LMS / Certificates / Feedback (spec sections 51-54)
  "TRAINING_REGISTERED",
  "TRAINING_ATTENDED",
  "TRAINING_ABSENT",
  "TRAINING_COMPLETED",
  "COURSE_ACCESS_GRANTED",
  "COURSE_ACCESS_REVOKED",
  "COURSE_STARTED",
  "COURSE_COMPLETED",
  "LESSON_COMPLETED",
  "CERTIFICATE_ELIGIBLE",
  "CERTIFICATE_READY",
  "CERTIFICATE_ISSUED",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export async function recordDomainEvent(
  type: DomainEventType,
  payload: { studentId?: string; enrollmentId?: string; [key: string]: unknown },
) {
  await db.domainEvent.create({
    data: {
      type,
      studentId: payload.studentId ?? null,
      enrollmentId: payload.enrollmentId ?? null,
      payloadJson: payload as Prisma.InputJsonObject,
    },
  });
}

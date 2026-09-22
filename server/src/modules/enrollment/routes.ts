import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { generateStudentDisplayId, generateEnrollmentDisplayId } from "../sequence.js";
import { recordDomainEvent } from "../events.js";
import { writeAuditLog } from "../../audit/log.js";
import { findPersonDuplicates } from "../duplicates.js";

const enrollSchema = z.object({
  fullName: z.string().min(1),
  facebookName: z.string().optional(),
  email: z.string().email().optional(),
  contactNumber: z.string().min(1),
  city: z.string().optional(),
  batchId: z.string().min(1),
  packageId: z.string().min(1),
  attendanceChoice: z.enum(["Face-to-Face", "Zoom"]).optional(),
  companionName: z.string().optional(),
  discount: z.number().nonnegative().default(0),
  source: z.string().optional(),
});

// This mirrors the existing public /enroll form (spec section 7: "Preserve
// existing Step 1 enrollment experience") — intentionally unauthenticated,
// exactly like that form, since a prospective student has no account yet.
// Every other Phase 2 write route requires a real session; this one is the
// deliberate, spec-acknowledged exception, matching current app behavior.
export async function enrollmentRoutes(app: FastifyInstance) {
  app.post(
    "/api/enroll",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = enrollSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid enrollment submission.", details: parsed.error.flatten() });
      const input = parsed.data;

      const [batch, pkg] = await Promise.all([
        db.batch.findUnique({ where: { id: input.batchId } }),
        db.package.findUnique({ where: { id: input.packageId } }),
      ]);
      if (!batch) return reply.code(404).send({ error: "Batch not found." });
      if (!pkg) return reply.code(404).send({ error: "Package not found." });
      if (!pkg.isActive) return reply.code(422).send({ error: "This package is no longer available." });

      // Flagged for staff review only — never blocks submission, never auto-merges (spec section 28).
      const duplicates = await findPersonDuplicates(input.email, input.contactNumber);

      const netAmountDue = Math.max(Number(pkg.defaultPrice ?? 0) - input.discount, 0);

      const result = await db.$transaction(async (tx) => {
        const person = await tx.person.create({
          data: {
            fullName: input.fullName,
            facebookName: input.facebookName ?? null,
            email: input.email ?? null,
            contactNumber: input.contactNumber,
            city: input.city ?? null,
          },
        });

        const studentDisplayId = await generateStudentDisplayId(batch.code);
        const student = await tx.student.create({
          data: {
            studentDisplayId,
            personId: person.id,
            batchId: batch.id,
            packageId: pkg.id,
            enrollmentStatus: "New Registration",
          },
        });

        const enrollmentDisplayId = await generateEnrollmentDisplayId();
        const enrollment = await tx.enrollment.create({
          data: {
            enrollmentDisplayId,
            studentId: student.id,
            batchId: batch.id,
            packageId: pkg.id,
            attendanceChoice: input.attendanceChoice ?? null,
            companionName: input.companionName ?? null,
            // CRITICAL (spec section 8): frozen at creation time — never
            // recomputed from Package.defaultPrice again after this write.
            packagePriceSnapshot: pkg.defaultPrice ?? 0,
            discount: input.discount,
            netAmountDue,
            status: "New Registration",
            source: input.source ?? "Public Enrollment Form",
          },
        });

        return { person, student, enrollment };
      });

      await recordDomainEvent("STUDENT_CREATED", { studentId: result.student.id, studentDisplayId: result.student.studentDisplayId });
      await recordDomainEvent("ENROLLMENT_CREATED", { studentId: result.student.id, enrollmentId: result.enrollment.id, enrollmentDisplayId: result.enrollment.enrollmentDisplayId });
      await writeAuditLog({ action: "Student Created", summary: `${result.person.fullName} enrolled (${result.student.studentDisplayId})`, entityType: "Student", entityId: result.student.id });
      await writeAuditLog({ action: "Enrollment Created", summary: `Enrollment ${result.enrollment.enrollmentDisplayId} created for ${result.person.fullName}`, entityType: "Enrollment", entityId: result.enrollment.id });

      return reply.code(201).send({
        student: { id: result.student.id, studentDisplayId: result.student.studentDisplayId },
        enrollment: { id: result.enrollment.id, enrollmentDisplayId: result.enrollment.enrollmentDisplayId, netAmountDue },
        possibleDuplicates: duplicates.filter((d) => d.personId !== result.person.id),
      });
    },
  );

  // Confirming an enrollment (staff action, distinct from creation) — the
  // "ENROLLMENT_CONFIRMED" domain event (spec section 39).
  app.post(
    "/api/enrollments/:enrollmentId/confirm",
    { preHandler: [requireAuth, requirePermission("Enrollment", "VERIFY")] },
    async (request, reply) => {
      const { enrollmentId } = request.params as { enrollmentId: string };
      const enrollment = await db.enrollment.findUnique({ where: { id: enrollmentId }, include: { student: true } });
      if (!enrollment) return reply.code(404).send({ error: "Enrollment not found." });

      const updated = await db.enrollment.update({ where: { id: enrollmentId }, data: { status: "Confirmed Student" } });
      await db.student.update({ where: { id: enrollment.studentId }, data: { enrollmentStatus: "Confirmed Student" } });
      await recordDomainEvent("ENROLLMENT_CONFIRMED", { studentId: enrollment.studentId, enrollmentId });
      await writeAuditLog({
        action: "Enrollment Updated",
        summary: `Enrollment ${enrollment.enrollmentDisplayId} confirmed`,
        actorUserId: request.authContext!.userId,
        entityType: "Enrollment",
        entityId: enrollmentId,
      });
      return reply.send({ enrollment: updated });
    },
  );
}

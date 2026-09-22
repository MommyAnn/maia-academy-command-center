import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { generateLeadDisplayId, generateStudentDisplayId, generateEnrollmentDisplayId, generatePaymentDisplayId } from "../sequence.js";
import { recordDomainEvent } from "../events.js";
import { writeAuditLog } from "../../audit/log.js";
import { findPersonDuplicates } from "../duplicates.js";

const createLeadSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  contactNumber: z.string().optional(),
  facebookName: z.string().optional(),
  source: z.string().optional(),
  campaign: z.string().optional(),
});

const reservationSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1),
  referenceNumber: z.string().optional(),
  batchId: z.string().min(1),
  packageId: z.string().min(1),
});

const convertSchema = z.object({
  batchId: z.string().min(1),
  packageId: z.string().min(1),
  attendanceChoice: z.enum(["Face-to-Face", "Zoom"]).optional(),
  discount: z.number().nonnegative().default(0),
});

export async function leadRoutes(app: FastifyInstance) {
  app.post("/api/leads", { preHandler: [requireAuth, requirePermission("Free Webinar", "CREATE")] }, async (request, reply) => {
    const parsed = createLeadSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid lead.", details: parsed.error.flatten() });

    const duplicates = await findPersonDuplicates(parsed.data.email, parsed.data.contactNumber);

    const leadDisplayId = await generateLeadDisplayId();
    const created = await db.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: { fullName: parsed.data.fullName, email: parsed.data.email ?? null, contactNumber: parsed.data.contactNumber ?? null, facebookName: parsed.data.facebookName ?? null },
      });
      const lead = await tx.lead.create({
        data: { leadDisplayId, personId: person.id, source: parsed.data.source ?? null, campaign: parsed.data.campaign ?? null },
      });
      await tx.leadActivity.create({ data: { leadId: lead.id, action: "Lead created", userLabel: request.authContext!.fullName } });
      return lead;
    });

    return reply.code(201).send({ lead: created, possibleDuplicates: duplicates });
  });

  // Records a reservation payment AGAINST THE LEAD, before any Student
  // exists — this is the transaction that Convert-to-Student later
  // re-parents rather than duplicates (spec section 14).
  app.post("/api/leads/:leadId/reservation-payment", { preHandler: [requireAuth, requirePermission("Free Webinar - Finance", "CREATE")] }, async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const parsed = reservationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid reservation payment.", details: parsed.error.flatten() });

    const lead = await db.lead.findUnique({ where: { id: leadId }, include: { conversion: true } });
    if (!lead) return reply.code(404).send({ error: "Lead not found." });
    if (lead.conversion) return reply.code(409).send({ error: "This lead has already been converted." });

    const existingReservation = await db.paymentTransaction.findFirst({ where: { leadId, type: "Reservation" } });
    if (existingReservation) return reply.code(409).send({ error: "A reservation payment already exists for this lead — the same reservation cannot be linked twice." });

    const batch = await db.batch.findUniqueOrThrow({ where: { id: parsed.data.batchId } });
    const payment = await db.paymentTransaction.create({
      data: {
        paymentDisplayId: await generatePaymentDisplayId(batch.code),
        leadId,
        batchId: parsed.data.batchId,
        packageId: parsed.data.packageId,
        paymentDate: new Date(),
        type: "Reservation",
        amount: parsed.data.amount,
        method: parsed.data.method,
        referenceNumber: parsed.data.referenceNumber ?? null,
        status: "PENDING_VERIFICATION",
        recordedById: request.authContext!.userId,
      },
    });

    await db.lead.update({ where: { id: leadId }, data: { pipelineStage: "RESERVATION_PAID" } });
    await db.leadActivity.create({ data: { leadId, action: `Reservation payment recorded: ${parsed.data.amount}`, userLabel: request.authContext!.fullName } });

    return reply.code(201).send({ payment: { ...payment, amount: Number(payment.amount) } });
  });

  // The core Lead -> Student conversion (spec sections 14, 27, 30).
  // Transactional: if any step fails, nothing partial is left behind
  // (spec section 30). Never creates a second Person, never duplicates the
  // reservation payment, never deletes the Lead.
  app.post("/api/leads/:leadId/convert", { preHandler: [requireAuth, requirePermission("Students", "CREATE")] }, async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const parsed = convertSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid conversion request.", details: parsed.error.flatten() });

    const lead = await db.lead.findUnique({ where: { id: leadId }, include: { person: true, conversion: true } });
    if (!lead) return reply.code(404).send({ error: "Lead not found." });
    if (lead.conversion) return reply.code(409).send({ error: "This lead has already been converted to a student." });

    const [batch, pkg] = await Promise.all([
      db.batch.findUnique({ where: { id: parsed.data.batchId } }),
      db.package.findUnique({ where: { id: parsed.data.packageId } }),
    ]);
    if (!batch) return reply.code(404).send({ error: "Batch not found." });
    if (!pkg) return reply.code(404).send({ error: "Package not found." });

    const netAmountDue = Math.max(Number(pkg.defaultPrice ?? 0) - parsed.data.discount, 0);

    const result = await db.$transaction(async (tx) => {
      // Reuses the Lead's EXISTING Person — never creates a duplicate one (spec section 4).
      const studentDisplayId = await generateStudentDisplayId(batch.code);
      const student = await tx.student.create({
        data: {
          studentDisplayId,
          personId: lead.personId,
          batchId: batch.id,
          packageId: pkg.id,
          enrollmentStatus: "Confirmed Student",
        },
      });

      const enrollmentDisplayId = await generateEnrollmentDisplayId();
      const enrollment = await tx.enrollment.create({
        data: {
          enrollmentDisplayId,
          studentId: student.id,
          batchId: batch.id,
          packageId: pkg.id,
          attendanceChoice: parsed.data.attendanceChoice ?? null,
          packagePriceSnapshot: pkg.defaultPrice ?? 0,
          discount: parsed.data.discount,
          netAmountDue,
          status: "Confirmed Student",
          source: `Converted from Lead ${lead.leadDisplayId}`,
        },
      });

      await tx.leadStudentConversion.create({
        data: { leadId: lead.id, studentId: student.id, convertedBy: request.authContext!.userId },
      });

      // Re-parents the SAME reservation payment row (studentId + enrollmentId
      // set on the existing transaction) — the payment is never duplicated,
      // and its leadId is deliberately left in place as a permanent record
      // of where it originated.
      const reservationUpdate = await tx.paymentTransaction.updateMany({
        where: { leadId: lead.id, type: "Reservation" },
        data: { studentId: student.id, enrollmentId: enrollment.id },
      });

      await tx.leadActivity.create({ data: { leadId: lead.id, action: `Converted to Student ${studentDisplayId}`, userLabel: request.authContext!.fullName } });

      return { student, enrollment, reservationCarried: reservationUpdate.count > 0 };
    });

    await recordDomainEvent("STUDENT_CREATED", { studentId: result.student.id, studentDisplayId: result.student.studentDisplayId, fromLeadId: lead.id });
    await recordDomainEvent("ENROLLMENT_CREATED", { studentId: result.student.id, enrollmentId: result.enrollment.id });
    await recordDomainEvent("LEAD_CONVERTED", { studentId: result.student.id, leadId: lead.id, reservationCarried: result.reservationCarried });
    await writeAuditLog({
      action: "Lead Converted",
      summary: `Lead ${lead.leadDisplayId} (${lead.person.fullName}) converted to Student ${result.student.studentDisplayId}`,
      actorUserId: request.authContext!.userId,
      entityType: "Student",
      entityId: result.student.id,
    });

    return reply.code(201).send({
      student: { id: result.student.id, studentDisplayId: result.student.studentDisplayId },
      enrollment: { id: result.enrollment.id, enrollmentDisplayId: result.enrollment.enrollmentDisplayId },
      reservationPaymentCarriedForward: result.reservationCarried,
    });
  });
}

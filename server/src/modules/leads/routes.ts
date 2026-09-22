import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { generateLeadDisplayId, generateStudentDisplayId, generateEnrollmentDisplayId, generatePaymentDisplayId } from "../sequence.js";
import { recordDomainEvent } from "../events.js";
import { writeAuditLog } from "../../audit/log.js";
import { findPersonDuplicates } from "../duplicates.js";
import { moveLeadStage } from "./pipeline.js";

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

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  pipelineStage: z.string().optional(),
  source: z.string().optional(),
  campaign: z.string().optional(),
  leadOwnerId: z.string().optional(),
});

const pipelineStageSchema = z.object({
  stage: z.enum(["NOT_CONTACTED", "FOLLOW_UP_NEEDED", "INTERESTED", "CONSIDERING", "RESERVATION_PAID", "ENROLLED", "NOT_INTERESTED", "NO_RESPONSE"]),
  reason: z.string().optional(),
});

const updateLeadSchema = z.object({
  leadOwnerId: z.string().nullable().optional(),
  businessStatus: z.string().optional(),
  businessName: z.string().optional(),
  status: z.enum(["Active", "Converted", "Inactive"]).optional(),
});

const consentSchema = z.object({
  canEmail: z.boolean().optional(),
  canSms: z.boolean().optional(),
  canWhatsapp: z.boolean().optional(),
  optedOut: z.boolean().optional(),
  consentVersion: z.string().optional(),
});

const noteSchema = z.object({ note: z.string().min(1) });

const STAGE_TO_DOMAIN_EVENT: Partial<Record<string, "LEAD_INTERESTED" | "LEAD_CONSIDERING">> = {
  INTERESTED: "LEAD_INTERESTED",
  CONSIDERING: "LEAD_CONSIDERING",
};

export async function leadRoutes(app: FastifyInstance) {
  app.get("/api/leads", { preHandler: [requireAuth, requirePermission("Free Webinar", "VIEW")] }, async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid query parameters." });
    const { page, pageSize, search, pipelineStage, source, campaign, leadOwnerId } = parsed.data;

    const where = {
      pipelineStage: pipelineStage ? (pipelineStage as never) : undefined,
      source: source || undefined,
      campaign: campaign || undefined,
      leadOwnerId: leadOwnerId || undefined,
      ...(search
        ? {
            OR: [
              { leadDisplayId: { contains: search, mode: "insensitive" as const } },
              { person: { fullName: { contains: search, mode: "insensitive" as const } } },
              { person: { email: { contains: search, mode: "insensitive" as const } } },
              { person: { contactNumber: { contains: search } } },
              { person: { facebookName: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [total, leads] = await Promise.all([
      db.lead.count({ where }),
      db.lead.findMany({ where, include: { person: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);

    return reply.send({ leads, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  });

  // Respects the same Free Webinar/VIEW gate as the list above — export is
  // a data shape, not a separate authorization surface (spec section 54).
  // No internal notes are ever included.
  app.get("/api/leads/export", { preHandler: [requireAuth, requirePermission("Free Webinar", "EXPORT")] }, async (_request, reply) => {
    const leads = await db.lead.findMany({ include: { person: true }, orderBy: { createdAt: "desc" } });
    const rows = leads.map((l) => ({
      leadDisplayId: l.leadDisplayId,
      fullName: l.person.fullName,
      email: l.person.email,
      contactNumber: l.person.contactNumber,
      source: l.source,
      campaign: l.campaign,
      pipelineStage: l.pipelineStage,
      createdAt: l.createdAt,
    }));
    return reply.send({ rows });
  });

  // Lead Profile (spec section 20) — every section the frontend needs in
  // one call: overview, webinar history, attendance (folded into the
  // registration rows), follow-ups, notes, feedback, reservation/payment,
  // conversion, and activity.
  app.get("/api/leads/:leadId", { preHandler: [requireAuth, requirePermission("Free Webinar", "VIEW")] }, async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
        person: true,
        conversion: { include: { student: true } },
        webinarRegistrations: { include: { session: true }, orderBy: { registeredAt: "desc" } },
        followUps: { orderBy: { scheduledFor: "desc" } },
        notes: { orderBy: { createdAt: "desc" } },
        feedbackSubmissions: true,
        paymentTransactions: true,
        activity: { orderBy: { occurredAt: "desc" } },
        pipelineHistory: { orderBy: { occurredAt: "desc" } },
      },
    });
    if (!lead) return reply.code(404).send({ error: "Lead not found." });
    return reply.send({ lead });
  });

  app.patch("/api/leads/:leadId", { preHandler: [requireAuth, requirePermission("Free Webinar", "EDIT")] }, async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const parsed = updateLeadSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const existing = await db.lead.findUnique({ where: { id: leadId } });
    if (!existing) return reply.code(404).send({ error: "Lead not found." });

    const updated = await db.lead.update({ where: { id: leadId }, data: parsed.data });

    if (parsed.data.leadOwnerId !== undefined && parsed.data.leadOwnerId !== existing.leadOwnerId) {
      await writeAuditLog({ action: "Lead Assigned", summary: `Lead ${existing.leadDisplayId} assigned`, actorUserId: request.authContext!.userId, entityType: "Lead", entityId: leadId });
    }

    return reply.send({ lead: updated });
  });

  // Pipeline stage change (spec sections 17-19) — always goes through
  // moveLeadStage so the append-only LeadPipelineHistory trail never drifts.
  app.patch("/api/leads/:leadId/pipeline-stage", { preHandler: [requireAuth, requirePermission("Free Webinar", "EDIT")] }, async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const parsed = pipelineStageSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid pipeline stage.", details: parsed.error.flatten() });

    const existing = await db.lead.findUnique({ where: { id: leadId } });
    if (!existing) return reply.code(404).send({ error: "Lead not found." });

    const updated = await moveLeadStage(db, leadId, parsed.data.stage, request.authContext!.userId, parsed.data.reason);
    await writeAuditLog({
      action: "Pipeline Stage Changed",
      summary: `Lead ${existing.leadDisplayId} moved ${existing.pipelineStage} -> ${parsed.data.stage}`,
      actorUserId: request.authContext!.userId,
      entityType: "Lead",
      entityId: leadId,
    });

    const eventType = STAGE_TO_DOMAIN_EVENT[parsed.data.stage];
    if (eventType) await recordDomainEvent(eventType, { leadId });

    return reply.send({ lead: updated });
  });

  app.get("/api/leads/:leadId/notes", { preHandler: [requireAuth, requirePermission("Free Webinar", "VIEW")] }, async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const notes = await db.leadNote.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } });
    return reply.send({ notes });
  });

  app.post("/api/leads/:leadId/notes", { preHandler: [requireAuth, requirePermission("Free Webinar", "EDIT")] }, async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const parsed = noteSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "A note is required." });

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return reply.code(404).send({ error: "Lead not found." });

    const note = await db.leadNote.create({ data: { leadId, authorId: request.authContext!.userId, note: parsed.data.note } });
    return reply.code(201).send({ note });
  });

  // Consent updates (spec sections 7, 48) — always append-only via
  // LeadConsentEvent; the Lead row's own fields are just the latest cache.
  app.patch("/api/leads/:leadId/consent", { preHandler: [requireAuth, requirePermission("Free Webinar", "EDIT")] }, async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const parsed = consentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid consent update.", details: parsed.error.flatten() });

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return reply.code(404).send({ error: "Lead not found." });

    const next = {
      canEmail: parsed.data.canEmail ?? lead.canEmail,
      canSms: parsed.data.canSms ?? lead.canSms,
      canWhatsapp: parsed.data.canWhatsapp ?? lead.canWhatsapp,
      optedOut: parsed.data.optedOut ?? lead.optedOut,
    };

    const updated = await db.lead.update({
      where: { id: leadId },
      data: { ...next, consentVersion: parsed.data.consentVersion ?? lead.consentVersion, consentDate: new Date() },
    });
    await db.leadConsentEvent.create({
      data: { leadId, action: next.optedOut ? "Opted Out" : "Updated", ...next, consentVersion: parsed.data.consentVersion ?? lead.consentVersion, source: "Staff Update" },
    });
    await writeAuditLog({ action: "Consent Updated", summary: `Communication consent updated for ${lead.leadDisplayId}`, actorUserId: request.authContext!.userId, entityType: "Lead", entityId: leadId });

    return reply.send({ lead: updated });
  });

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
        data: { leadDisplayId, personId: person.id, source: parsed.data.source ?? null, campaign: parsed.data.campaign ?? null, firstRegistrationDate: new Date() },
      });
      await tx.leadActivity.create({ data: { leadId: lead.id, action: "Lead created", userLabel: request.authContext!.fullName } });
      return lead;
    });

    await recordDomainEvent("LEAD_CREATED", { leadId: created.id });
    return reply.code(201).send({ lead: created, possibleDuplicates: duplicates });
  });

  // Records a reservation payment AGAINST THE LEAD, before any Student
  // exists — this is the transaction that Convert-to-Student later
  // re-parents rather than duplicates (spec section 31).
  //
  // IMPORTANT (Phase 4 spec sections 32-33, fixing a Phase 2 gap): this
  // route NEVER moves the pipeline to RESERVATION_PAID — a submitted proof
  // is PENDING VERIFICATION, and the pipeline must not claim a verified
  // reservation before it is one. The move to RESERVATION_PAID happens
  // only when this transaction is actually VERIFIED, in
  // finance/routes.ts's payment-verify route.
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

    await db.leadActivity.create({ data: { leadId, action: `Reservation payment recorded: ${parsed.data.amount}`, userLabel: request.authContext!.fullName } });
    await recordDomainEvent("RESERVATION_SUBMITTED", { leadId, paymentId: payment.id });
    await writeAuditLog({ action: "Reservation Submitted", summary: `Reservation payment ${payment.paymentDisplayId} submitted, pending verification`, actorUserId: request.authContext!.userId, entityType: "PaymentTransaction", entityId: payment.id });

    return reply.code(201).send({ payment: { ...payment, amount: Number(payment.amount) } });
  });

  // Conversion preview (spec section 37) — the review screen staff sees
  // before confirming, surfacing exactly the data spec section 37 lists,
  // including duplicate-Student/Person signals from the SAME detector used
  // everywhere else (never a separate ad-hoc check).
  app.get("/api/leads/:leadId/conversion-preview", { preHandler: [requireAuth, requirePermission("Students", "VIEW")] }, async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: { person: true, conversion: true, webinarRegistrations: { include: { session: true } }, paymentTransactions: true },
    });
    if (!lead) return reply.code(404).send({ error: "Lead not found." });

    const duplicates = await findPersonDuplicates(lead.person.email, lead.person.contactNumber);
    const reservation = lead.paymentTransactions.find((p) => p.type === "Reservation") ?? null;

    return reply.send({
      person: lead.person,
      lead,
      webinarHistory: lead.webinarRegistrations,
      reservation: reservation ? { ...reservation, amount: Number(reservation.amount) } : null,
      alreadyConverted: !!lead.conversion,
      potentialDuplicates: duplicates.filter((d) => d.personId !== lead.personId),
    });
  });

  // The core Lead -> Student conversion (spec sections 34, 38, 39).
  // Transactional: if any step fails, nothing partial is left behind. Never
  // creates a second Person, never duplicates the reservation payment,
  // never deletes the Lead. Idempotent: the P2002 catch below is the real
  // guard against a double-click or a retried request creating a second
  // Student — LeadStudentConversion.leadId is a unique DB constraint, so a
  // second concurrent attempt fails atomically rather than racing.
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

    let result: { student: { id: string; studentDisplayId: string }; enrollment: { id: string; enrollmentDisplayId: string }; reservationCarried: boolean };
    try {
      result = await db.$transaction(async (tx) => {
        // Reuses the Lead's EXISTING Person — never creates a duplicate one (spec section 1).
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

        // The unique constraint on leadId is what makes this operation
        // idempotent under a concurrent retry (spec section 39) — a second
        // simultaneous attempt fails here with P2002 rather than creating a
        // second Student.
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

        await moveLeadStage(tx, lead.id, "ENROLLED", request.authContext!.userId, `Converted to Student ${studentDisplayId}`);
        await tx.lead.update({ where: { id: lead.id }, data: { status: "Converted" } });
        await tx.leadActivity.create({ data: { leadId: lead.id, action: `Converted to Student ${studentDisplayId}`, userLabel: request.authContext!.fullName } });

        return { student, enrollment, reservationCarried: reservationUpdate.count > 0 };
      });
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
        return reply.code(409).send({ error: "This lead has already been converted to a student." });
      }
      throw err;
    }

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

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { recordDomainEvent } from "../events.js";
import { generateWebinarSessionDisplayId, generateLeadDisplayId } from "../sequence.js";
import { findPersonDuplicates } from "../duplicates.js";

const createSessionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string().min(1),
  date: z.string().datetime(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  platform: z.string().min(1),
  meetingLink: z.string().optional(),
  meetingId: z.string().optional(),
  passcode: z.string().optional(),
  host: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  registrationOpenDate: z.string().datetime().optional(),
  registrationCloseDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  status: z.enum(["Draft", "Upcoming", "Registration Open", "Registration Closed", "Ongoing", "Completed", "Cancelled", "Archived"]).optional(),
});

const updateSessionSchema = createSessionSchema.partial();

const CLOSED_STATUSES = new Set(["Draft", "Cancelled", "Archived", "Completed"]);

const registerSchema = z.object({
  fullName: z.string().min(1).max(200),
  facebookName: z.string().max(200).optional(),
  email: z.string().email().max(200).optional(),
  contactNumber: z.string().min(1).max(40),
  city: z.string().max(200).optional(),
  businessStatus: z.string().max(200).optional(),
  businessName: z.string().max(200).optional(),
  sessionId: z.string().min(1),
  source: z.string().max(200).optional(),
  campaign: z.string().max(200).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  landingPage: z.string().max(500).optional(),
  referralSource: z.string().max(200).optional(),
  // Deliberately its OWN object, never implied by submitting the form
  // (spec section 7) — omitting it entirely means no consent was granted.
  consent: z
    .object({
      canEmail: z.boolean().default(false),
      canSms: z.boolean().default(false),
      canWhatsapp: z.boolean().default(false),
      consentVersion: z.string().default("v1.0"),
    })
    .optional(),
});

const attendanceSchema = z.object({ status: z.string().min(1), notes: z.string().optional() });

export async function webinarRoutes(app: FastifyInstance) {
  app.get("/api/webinar/sessions", { preHandler: [requireAuth, requirePermission("Free Webinar", "VIEW")] }, async (_request, reply) => {
    const sessions = await db.webinarSession.findMany({ orderBy: { date: "desc" } });
    return reply.send({ sessions });
  });

  app.post("/api/webinar/sessions", { preHandler: [requireAuth, requirePermission("Free Webinar", "CREATE")] }, async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid webinar session.", details: parsed.error.flatten() });

    const sessionDisplayId = await generateWebinarSessionDisplayId();
    const created = await db.webinarSession.create({
      data: {
        sessionDisplayId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        type: parsed.data.type,
        date: new Date(parsed.data.date),
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        platform: parsed.data.platform,
        meetingLink: parsed.data.meetingLink ?? null,
        meetingId: parsed.data.meetingId ?? null,
        passcode: parsed.data.passcode ?? null,
        host: parsed.data.host ?? null,
        capacity: parsed.data.capacity ?? null,
        registrationOpenDate: parsed.data.registrationOpenDate ? new Date(parsed.data.registrationOpenDate) : null,
        registrationCloseDate: parsed.data.registrationCloseDate ? new Date(parsed.data.registrationCloseDate) : null,
        notes: parsed.data.notes ?? null,
        status: parsed.data.status,
        createdById: request.authContext!.userId,
      },
    });
    return reply.code(201).send({ session: created });
  });

  app.patch("/api/webinar/sessions/:sessionId", { preHandler: [requireAuth, requirePermission("Free Webinar", "EDIT")] }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const parsed = updateSessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const { date, registrationOpenDate, registrationCloseDate, ...rest } = parsed.data;
    const updated = await db.webinarSession
      .update({
        where: { id: sessionId },
        data: {
          ...rest,
          date: date ? new Date(date) : undefined,
          registrationOpenDate: registrationOpenDate ? new Date(registrationOpenDate) : undefined,
          registrationCloseDate: registrationCloseDate ? new Date(registrationCloseDate) : undefined,
        },
      })
      .catch(() => null);
    if (!updated) return reply.code(404).send({ error: "Webinar session not found." });
    return reply.send({ session: updated });
  });

  app.get(
    "/api/webinar/sessions/:sessionId/registrations",
    { preHandler: [requireAuth, requirePermission("Free Webinar", "VIEW")] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const registrations = await db.webinarRegistration.findMany({
        where: { sessionId },
        include: { lead: { include: { person: true } } },
        orderBy: { registeredAt: "asc" },
      });
      return reply.send({ registrations });
    },
  );

  // Public, unauthenticated registration (spec section 6) — the same
  // deliberate exception as /api/enroll in Phase 2: a prospective lead has
  // no account yet. Rate-limited against automated abuse (spec section 50).
  app.post(
    "/api/webinar/register",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid registration.", details: parsed.error.flatten() });
      const input = parsed.data;

      const session = await db.webinarSession.findUnique({ where: { id: input.sessionId } });
      if (!session) return reply.code(404).send({ error: "Webinar not found." });
      if (CLOSED_STATUSES.has(session.status)) return reply.code(422).send({ error: "WEBINAR CLOSED" });
      const now = new Date();
      if (session.registrationOpenDate && now < session.registrationOpenDate) return reply.code(422).send({ error: "WEBINAR CLOSED" });
      if (session.registrationCloseDate && now > session.registrationCloseDate) return reply.code(422).send({ error: "WEBINAR CLOSED" });
      if (session.capacity !== null) {
        const registeredCount = await db.webinarRegistration.count({ where: { sessionId: session.id, registrationStatus: "Registered" } });
        if (registeredCount >= session.capacity) return reply.code(422).send({ error: "WEBINAR FULL" });
      }

      // Flagged for staff review only — never blocks submission, never
      // auto-merges (spec section 8).
      const duplicates = await findPersonDuplicates(input.email, input.contactNumber);
      const existingMatch = duplicates[0] ?? null;
      const matchedExistingStudent = existingMatch?.isStudent ?? false;

      let registrationResult: { leadId: string; leadDisplayId: string; isNewLead: boolean; personId: string };
      try {
        registrationResult = await db.$transaction(async (tx) => {
          let personId: string;
          if (existingMatch) {
            personId = existingMatch.personId;
          } else {
            const person = await tx.person.create({
              data: { fullName: input.fullName, facebookName: input.facebookName ?? null, email: input.email ?? null, contactNumber: input.contactNumber, city: input.city ?? null },
            });
            personId = person.id;
          }

          let lead = await tx.lead.findUnique({ where: { personId } });
          let isNewLead = false;
          if (!lead) {
            isNewLead = true;
            const leadDisplayId = await generateLeadDisplayId();
            lead = await tx.lead.create({
              data: {
                leadDisplayId,
                personId,
                // First-touch attribution — written once, here, and never
                // touched again by any later registration (spec section 12).
                source: input.source ?? null,
                campaign: input.campaign ?? null,
                utmSource: input.utmSource ?? null,
                utmMedium: input.utmMedium ?? null,
                utmCampaign: input.utmCampaign ?? null,
                utmContent: input.utmContent ?? null,
                utmTerm: input.utmTerm ?? null,
                landingPage: input.landingPage ?? null,
                referralSource: input.referralSource ?? null,
                firstRegistrationDate: now,
                businessStatus: input.businessStatus ?? null,
                businessName: input.businessName ?? null,
                // An existing Student registering for another webinar isn't
                // a fresh prospect — their pipeline reflects that reality
                // instead of restarting the funnel at NOT_CONTACTED (spec
                // sections 36, 63).
                pipelineStage: matchedExistingStudent ? "ENROLLED" : "NOT_CONTACTED",
              },
            });
          }

          let consentReference: string | null = null;
          if (input.consent) {
            await tx.lead.update({
              where: { id: lead.id },
              data: {
                canEmail: input.consent.canEmail,
                canSms: input.consent.canSms,
                canWhatsapp: input.consent.canWhatsapp,
                consentVersion: input.consent.consentVersion,
                consentSource: "Webinar Registration Form",
                consentDate: now,
              },
            });
            const consentEvent = await tx.leadConsentEvent.create({
              data: {
                leadId: lead.id,
                action: "Granted",
                canEmail: input.consent.canEmail,
                canSms: input.consent.canSms,
                canWhatsapp: input.consent.canWhatsapp,
                optedOut: false,
                consentVersion: input.consent.consentVersion,
                source: "Webinar Registration Form",
              },
            });
            consentReference = consentEvent.id;
          }

          // LATEST-touch attribution — always the values submitted THIS
          // time, on the registration row, never overwriting the Lead's
          // first-touch fields above (spec section 12).
          await tx.webinarRegistration.create({
            data: {
              sessionId: session.id,
              leadId: lead.id,
              source: input.source ?? null,
              campaign: input.campaign ?? null,
              utmSource: input.utmSource ?? null,
              utmMedium: input.utmMedium ?? null,
              utmCampaign: input.utmCampaign ?? null,
              utmContent: input.utmContent ?? null,
              utmTerm: input.utmTerm ?? null,
              landingPage: input.landingPage ?? null,
              referralSource: input.referralSource ?? null,
              consentReference,
            },
          });

          await tx.leadActivity.create({ data: { leadId: lead.id, action: `Registered for webinar "${session.title}"`, userLabel: "Public Registration Form" } });

          return { leadId: lead.id, leadDisplayId: lead.leadDisplayId, isNewLead, personId };
        });
      } catch (err) {
        if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
          return reply.code(409).send({ error: "DUPLICATE REGISTRATION" });
        }
        throw err;
      }

      if (registrationResult.isNewLead) {
        await recordDomainEvent("LEAD_CREATED", { leadId: registrationResult.leadId });
        await writeAuditLog({ action: "Lead Created", summary: `Lead created via webinar registration`, entityType: "Lead", entityId: registrationResult.leadId });
      }
      await recordDomainEvent("WEBINAR_REGISTERED", { leadId: registrationResult.leadId, sessionId: session.id });
      await writeAuditLog({ action: "Registration Created", summary: `Registered for "${session.title}"`, entityType: "WebinarRegistration", entityId: registrationResult.leadId });
      if (existingMatch && duplicates.length > 0) {
        await writeAuditLog({ action: "Duplicate Flagged", summary: `Possible duplicate identity matched on registration (${existingMatch.matchedOn})`, entityType: "Person", entityId: existingMatch.personId });
      }

      return reply.code(201).send({
        lead: { id: registrationResult.leadId, leadDisplayId: registrationResult.leadDisplayId },
        possibleDuplicates: duplicates,
        matchedExistingStudent,
      });
    },
  );

  app.post(
    "/api/webinar/registrations/:registrationId/attendance",
    { preHandler: [requireAuth, requirePermission("Free Webinar", "EDIT")] },
    async (request, reply) => {
      const { registrationId } = request.params as { registrationId: string };
      const parsed = attendanceSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid attendance update.", details: parsed.error.flatten() });

      const registration = await db.webinarRegistration.findUnique({ where: { id: registrationId } });
      if (!registration) return reply.code(404).send({ error: "Registration not found." });

      const wasAlreadyMarked = registration.attendanceStatus !== "Registered";
      const updated = await db.webinarRegistration.update({
        where: { id: registrationId },
        data: { attendanceStatus: parsed.data.status, notes: parsed.data.notes ?? registration.notes, recordedById: request.authContext!.userId, recordedAt: new Date() },
      });

      await writeAuditLog({
        action: wasAlreadyMarked ? "Attendance Updated" : "Attendance Marked",
        summary: `Webinar attendance set to ${parsed.data.status}`,
        actorUserId: request.authContext!.userId,
        entityType: "WebinarRegistration",
        entityId: registrationId,
      });

      if (parsed.data.status === "Attended" || parsed.data.status === "Completed Webinar" || parsed.data.status === "Left Early") {
        await recordDomainEvent("WEBINAR_ATTENDED", { leadId: registration.leadId, sessionId: registration.sessionId });
      } else if (parsed.data.status === "No Show") {
        await recordDomainEvent("WEBINAR_NO_SHOW", { leadId: registration.leadId, sessionId: registration.sessionId });
      }

      return reply.send({ registration: updated });
    },
  );
}

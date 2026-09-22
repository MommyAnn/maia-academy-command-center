import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";

const filterSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sessionId: z.string().optional(),
  campaign: z.string().optional(),
  source: z.string().optional(),
  assignedStaffId: z.string().optional(),
});

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

export async function webinarDashboardRoutes(app: FastifyInstance) {
  // Every figure here is computed live from real rows (spec section 41:
  // "do not use hard-coded percentages") — no cached/stored KPI exists.
  app.get("/api/webinar/dashboard", { preHandler: [requireAuth, requirePermission("Free Webinar", "VIEW")] }, async (request, reply) => {
    const parsed = filterSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid filters." });
    const { from, to, sessionId, campaign, source, assignedStaffId } = parsed.data;

    const registrationWhere: Prisma.WebinarRegistrationWhereInput = {
      sessionId: sessionId || undefined,
      campaign: campaign || undefined,
      source: source || undefined,
      registeredAt: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    };
    const hasRegistrationFilter = !!(sessionId || campaign || source || from || to);

    let leadIdFilter: string[] | undefined;
    if (hasRegistrationFilter) {
      const regs = await db.webinarRegistration.findMany({ where: registrationWhere, select: { leadId: true } });
      leadIdFilter = [...new Set(regs.map((r) => r.leadId))];
    }
    const leadWhereBase: Prisma.LeadWhereInput = {
      ...(leadIdFilter ? { id: { in: leadIdFilter } } : {}),
      leadOwnerId: assignedStaffId || undefined,
    };

    const [registrations, attended, noShow, followUpNeeded, interested, considering, reservationPaid, converted, upcomingWebinars] = await Promise.all([
      db.webinarRegistration.count({ where: registrationWhere }),
      db.webinarRegistration.count({ where: { ...registrationWhere, attendanceStatus: { in: ["Attended", "Completed Webinar", "Left Early"] } } }),
      db.webinarRegistration.count({ where: { ...registrationWhere, attendanceStatus: "No Show" } }),
      db.lead.count({ where: { ...leadWhereBase, pipelineStage: "FOLLOW_UP_NEEDED" } }),
      db.lead.count({ where: { ...leadWhereBase, pipelineStage: "INTERESTED" } }),
      db.lead.count({ where: { ...leadWhereBase, pipelineStage: "CONSIDERING" } }),
      db.lead.count({ where: { ...leadWhereBase, pipelineStage: "RESERVATION_PAID" } }),
      db.lead.count({ where: { ...leadWhereBase, pipelineStage: "ENROLLED" } }),
      db.webinarSession.count({ where: { status: { in: ["Upcoming", "Registration Open"] }, date: { gte: new Date() } } }),
    ]);

    return reply.send({
      summary: { registrations, upcomingWebinars, attended, noShow, followUpNeeded, interested, considering, reservationPaid, converted },
      conversionRates: {
        registrationToAttendance: percent(attended, registrations),
        attendanceToInterested: percent(interested, attended),
        interestedToReservation: percent(reservationPaid, interested),
        reservationToEnrollment: percent(converted, reservationPaid),
        registrationToEnrollment: percent(converted, registrations),
      },
    });
  });

  // Consolidated reporting (spec section 43) — one call returns every
  // listed breakdown rather than nine separate endpoints, all from real
  // grouped counts. No Lead PII beyond what the caller's own Free
  // Webinar/VIEW permission already grants them elsewhere.
  app.get("/api/webinar/reports", { preHandler: [requireAuth, requirePermission("Free Webinar", "VIEW")] }, async (_request, reply) => {
    const [registrationsBySession, attendanceByStatus, bySource, byCampaign, byPipelineStage, followUpByStatus, reservationsByStatus, conversions] = await Promise.all([
      db.webinarRegistration.groupBy({ by: ["sessionId"], _count: { _all: true } }),
      db.webinarRegistration.groupBy({ by: ["attendanceStatus"], _count: { _all: true } }),
      db.lead.groupBy({ by: ["source"], _count: { _all: true } }),
      db.lead.groupBy({ by: ["campaign"], _count: { _all: true } }),
      db.lead.groupBy({ by: ["pipelineStage"], _count: { _all: true } }),
      db.followUp.groupBy({ by: ["status"], _count: { _all: true } }),
      db.paymentTransaction.groupBy({ by: ["status"], where: { type: "Reservation" }, _count: { _all: true } }),
      db.leadStudentConversion.count(),
    ]);

    const sessions = await db.webinarSession.findMany({ where: { id: { in: registrationsBySession.map((r) => r.sessionId) } }, select: { id: true, title: true } });
    const sessionTitleById = new Map(sessions.map((s) => [s.id, s.title]));

    return reply.send({
      registrationsBySession: registrationsBySession.map((r) => ({ sessionId: r.sessionId, sessionTitle: sessionTitleById.get(r.sessionId) ?? "Unknown", count: r._count._all })),
      attendanceByStatus: attendanceByStatus.map((r) => ({ status: r.attendanceStatus, count: r._count._all })),
      bySource: bySource.map((r) => ({ source: r.source ?? "(none)", count: r._count._all })),
      byCampaign: byCampaign.map((r) => ({ campaign: r.campaign ?? "(none)", count: r._count._all })),
      byPipelineStage: byPipelineStage.map((r) => ({ stage: r.pipelineStage, count: r._count._all })),
      followUpOutcomes: followUpByStatus.map((r) => ({ status: r.status, count: r._count._all })),
      reservationsByStatus: reservationsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
      totalConversions: conversions,
    });
  });
}

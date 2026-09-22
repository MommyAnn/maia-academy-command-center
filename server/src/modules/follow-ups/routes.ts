import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";

const createSchema = z.object({
  purpose: z.string().optional(),
  channel: z.string().min(1),
  scheduledFor: z.string().datetime(),
  assignedStaffId: z.string().optional(),
  notes: z.string().optional(),
  createTask: z.boolean().default(false),
});

const updateSchema = z.object({
  status: z.enum(["Scheduled", "Due", "Completed", "No Response", "Rescheduled", "Cancelled"]).optional(),
  scheduledFor: z.string().datetime().optional(),
  outcome: z.string().optional(),
  notes: z.string().optional(),
  nextFollowUpAt: z.string().datetime().optional(),
  assignedStaffId: z.string().nullable().optional(),
});

const BROAD_VISIBILITY_ROLES = new Set(["Owner", "Administrator"]);

export async function followUpRoutes(app: FastifyInstance) {
  app.post("/api/leads/:leadId/follow-ups", { preHandler: [requireAuth, requirePermission("Free Webinar", "CREATE")] }, async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid follow-up.", details: parsed.error.flatten() });

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return reply.code(404).send({ error: "Lead not found." });

    const followUp = await db.followUp.create({
      data: {
        leadId,
        purpose: parsed.data.purpose ?? null,
        channel: parsed.data.channel,
        scheduledFor: new Date(parsed.data.scheduledFor),
        assignedStaffId: parsed.data.assignedStaffId ?? null,
        notes: parsed.data.notes ?? null,
        createdById: request.authContext!.userId,
      },
    });

    // Connects to the existing Staff & Tasks architecture (spec section
    // 26) — autoTriggerKey is the same dedup mechanism Task already uses
    // elsewhere, so calling this twice for the same follow-up never creates
    // two Tasks.
    let taskId: string | null = null;
    if (parsed.data.createTask && parsed.data.assignedStaffId) {
      const assignedUser = await db.user.findUnique({ where: { id: parsed.data.assignedStaffId } });
      const staff = assignedUser ? await db.staff.findUnique({ where: { personId: assignedUser.personId } }) : null;
      if (staff) {
        const task = await db.task.upsert({
          where: { autoTriggerKey: `followup:${followUp.id}` },
          update: {},
          create: {
            taskDisplayId: `TASK-FOLLOWUP-${followUp.id}`,
            title: `Follow up: ${lead.leadDisplayId}`,
            status: "Open",
            priority: "Normal",
            createdById: staff.id,
            assignedToId: staff.id,
            autoTriggerKey: `followup:${followUp.id}`,
          },
        });
        taskId = task.id;
        await db.followUp.update({ where: { id: followUp.id }, data: { taskId } });
      }
    }

    await db.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: followUp.scheduledFor } });
    await writeAuditLog({ action: "Follow-Up Created", summary: `Follow-up scheduled for ${lead.leadDisplayId}`, actorUserId: request.authContext!.userId, entityType: "FollowUp", entityId: followUp.id });

    return reply.code(201).send({ followUp: { ...followUp, taskId } });
  });

  app.patch("/api/follow-ups/:followUpId", { preHandler: [requireAuth, requirePermission("Free Webinar", "EDIT")] }, async (request, reply) => {
    const { followUpId } = request.params as { followUpId: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const existing = await db.followUp.findUnique({ where: { id: followUpId } });
    if (!existing) return reply.code(404).send({ error: "Follow-up not found." });
    // Completed history is never silently overwritten (spec section 27) —
    // a completed follow-up can still be annotated, but not un-completed
    // or have its outcome erased by an unrelated update.
    if (existing.status === "Completed" && parsed.data.status && parsed.data.status !== "Completed") {
      return reply.code(409).send({ error: "This follow-up is already completed and its outcome cannot be reopened." });
    }

    const updated = await db.followUp.update({
      where: { id: followUpId },
      data: {
        ...parsed.data,
        scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : undefined,
        nextFollowUpAt: parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : undefined,
        completedAt: parsed.data.status === "Completed" ? new Date() : existing.completedAt,
      },
    });

    if (parsed.data.status === "Completed") {
      await db.lead.update({ where: { id: existing.leadId }, data: { lastFollowUpAt: new Date(), nextFollowUpAt: parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null } });
      await writeAuditLog({ action: "Follow-Up Completed", summary: `Follow-up completed`, actorUserId: request.authContext!.userId, entityType: "FollowUp", entityId: followUpId });
    }

    return reply.send({ followUp: updated });
  });

  // The queue (spec section 24), scoped by assignment unless the caller
  // holds a broad-visibility role — Owner/Admin see everything, matching
  // spec section 25's "Owner/Admin may have broader visibility."
  app.get("/api/follow-ups/queue", { preHandler: [requireAuth, requirePermission("Free Webinar", "VIEW")] }, async (request, reply) => {
    const { bucket } = request.query as { bucket?: string };
    const ctx = request.authContext!;
    const scopeToSelf = !BROAD_VISIBILITY_ROLES.has(ctx.roleName ?? "");

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const assignmentFilter = scopeToSelf ? { assignedStaffId: ctx.userId } : {};

    let where: Prisma.FollowUpWhereInput;
    switch (bucket) {
      case "overdue":
        where = { ...assignmentFilter, status: { in: ["Scheduled", "Due"] }, scheduledFor: { lt: startOfToday } };
        break;
      case "upcoming":
        where = { ...assignmentFilter, status: { in: ["Scheduled", "Due"] }, scheduledFor: { gt: endOfToday } };
        break;
      case "no-response":
        where = { ...assignmentFilter, status: "No Response" };
        break;
      case "high-intent":
        where = { ...assignmentFilter, status: { in: ["Scheduled", "Due"] }, lead: { pipelineStage: { in: ["INTERESTED", "CONSIDERING", "RESERVATION_PAID"] } } };
        break;
      case "today":
      default:
        where = { ...assignmentFilter, status: { in: ["Scheduled", "Due"] }, scheduledFor: { gte: startOfToday, lte: endOfToday } };
        break;
    }

    const followUps = await db.followUp.findMany({ where, include: { lead: { include: { person: true } } }, orderBy: { scheduledFor: "asc" } });
    return reply.send({ followUps });
  });
}

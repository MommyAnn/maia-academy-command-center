import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelf } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { recordDomainEvent } from "../events.js";

const REQUIREMENT_TYPES = ["ValidId", "PaymentProof"] as const;

const submitSchema = z.object({ documentId: z.string().min(1) });
const rejectSchema = z.object({ reason: z.string().min(1) });

export async function requirementRoutes(app: FastifyInstance) {
  // Submit or RESUBMIT a requirement — a resubmission creates a new
  // RequirementReview entry rather than overwriting the previous one, so
  // the full review trail survives (spec section 36).
  app.post(
    "/api/students/:studentId/requirements/:type/submit",
    { preHandler: [requireAuth, requireStudentSelf("studentId")] },
    async (request, reply) => {
      const { studentId, type } = request.params as { studentId: string; type: string };
      if (!(REQUIREMENT_TYPES as readonly string[]).includes(type)) return reply.code(400).send({ error: "Unknown requirement type." });

      const parsed = submitSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "A documentId is required." });

      const document = await db.document.findUnique({ where: { id: parsed.data.documentId } });
      if (!document || document.ownerStudentId !== studentId) {
        return reply.code(403).send({ error: "That document does not belong to you." });
      }

      const requirement = await db.requirement.upsert({
        where: { studentId_type: { studentId, type } },
        update: { currentDocumentId: document.id, status: "PENDING", submittedAt: new Date(), reviewedAt: null, reviewedById: null, reasonNote: null },
        create: { studentId, type, currentDocumentId: document.id, status: "PENDING", submittedAt: new Date() },
      });

      await db.requirementReview.create({ data: { requirementId: requirement.id, documentId: document.id, status: "PENDING", actedById: request.authContext!.userId } });
      await recordDomainEvent("REQUIREMENT_SUBMITTED", { studentId, requirementId: requirement.id, type });
      await writeAuditLog({ action: "Requirement Submitted", summary: `${type} submitted for review`, actorStudentId: studentId, entityType: "Requirement", entityId: requirement.id });

      return reply.code(201).send({ requirement });
    },
  );

  app.post(
    "/api/requirements/:requirementId/verify",
    { preHandler: [requireAuth, requirePermission("Students", "VERIFY")] },
    async (request, reply) => {
      const { requirementId } = request.params as { requirementId: string };
      const requirement = await db.requirement.findUnique({ where: { id: requirementId } });
      if (!requirement) return reply.code(404).send({ error: "Requirement not found." });
      if (requirement.status !== "PENDING") return reply.code(409).send({ error: `Cannot verify a requirement with status ${requirement.status}.` });

      const updated = await db.requirement.update({
        where: { id: requirementId },
        data: { status: "VERIFIED", reviewedAt: new Date(), reviewedById: request.authContext!.userId, reasonNote: null },
      });
      await db.requirementReview.create({ data: { requirementId, documentId: requirement.currentDocumentId, status: "VERIFIED", actedById: request.authContext!.userId } });
      await recordDomainEvent("REQUIREMENT_VERIFIED", { studentId: requirement.studentId, requirementId, type: requirement.type });
      await writeAuditLog({ action: "Requirement Verified", summary: `${requirement.type} verified`, actorUserId: request.authContext!.userId, entityType: "Requirement", entityId: requirementId });

      return reply.send({ requirement: updated });
    },
  );

  app.post(
    "/api/requirements/:requirementId/reject",
    { preHandler: [requireAuth, requirePermission("Students", "VERIFY")] },
    async (request, reply) => {
      const { requirementId } = request.params as { requirementId: string };
      const parsed = rejectSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "A rejection reason is required." });

      const requirement = await db.requirement.findUnique({ where: { id: requirementId } });
      if (!requirement) return reply.code(404).send({ error: "Requirement not found." });
      if (requirement.status !== "PENDING") return reply.code(409).send({ error: `Cannot reject a requirement with status ${requirement.status}.` });

      const updated = await db.requirement.update({
        where: { id: requirementId },
        data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: request.authContext!.userId, reasonNote: parsed.data.reason },
      });
      await db.requirementReview.create({ data: { requirementId, documentId: requirement.currentDocumentId, status: "REJECTED", reason: parsed.data.reason, actedById: request.authContext!.userId } });
      await recordDomainEvent("REQUIREMENT_REJECTED", { studentId: requirement.studentId, requirementId, type: requirement.type, reason: parsed.data.reason });
      await writeAuditLog({ action: "Requirement Rejected", summary: `${requirement.type} rejected: ${parsed.data.reason}`, actorUserId: request.authContext!.userId, entityType: "Requirement", entityId: requirementId });

      return reply.send({ requirement: updated });
    },
  );

  app.get(
    "/api/students/:studentId/requirements",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Students", "VIEW")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const requirements = await db.requirement.findMany({ where: { studentId }, include: { reviews: { orderBy: { occurredAt: "asc" } } } });
      return reply.send({ requirements });
    },
  );
}

function requireStudentSelfOrPermission(module: Parameters<typeof requirePermission>[0], action: Parameters<typeof requirePermission>[1]) {
  const selfCheck = requireStudentSelf("studentId");
  const permCheck = requirePermission(module, action);
  return async (request: Parameters<typeof selfCheck>[0], reply: Parameters<typeof selfCheck>[1]) => {
    if (request.authContext?.kind === "student") return selfCheck(request, reply);
    return permCheck(request, reply);
  };
}


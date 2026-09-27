// M.A.I.A. Business OS — Unified CRM (spec sections 23-31). BusinessContact
// links to the EXISTING Person identity (deduped via the same
// findPersonDuplicates helper Lead/Enrollment/Webinar already use) — never
// a duplicate CRM record, and deliberately separate from the Academy's own
// Lead model (spec section 25: "Pipeline != Academy Pipeline"). Every
// pipeline is per-Business and configurable, defaulting to the example
// stages in spec section 24 on first use.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requireStudentSelfOrPermission, requirePermission, assertBusinessAccess, type AuthContext } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateBusinessContactDisplayId, generateOpportunityDisplayId } from "../sequence.js";
import { findPersonDuplicates, normalizeEmail } from "../duplicates.js";

const DEFAULT_PIPELINE_STAGES = [
  { key: "NEW_LEAD", label: "New Lead" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "INTERESTED", label: "Interested" },
  { key: "QUALIFIED", label: "Qualified" },
  { key: "CONSIDERING", label: "Considering" },
  { key: "BOOKED", label: "Booked" },
  { key: "RESERVATION_DEPOSIT", label: "Reservation / Deposit" },
  { key: "CUSTOMER", label: "Customer" },
  { key: "NOT_INTERESTED", label: "Not Interested" },
  { key: "LOST", label: "Lost" },
];

interface PipelineStage {
  key: string;
  label: string;
}

async function getOrCreatePipeline(businessId: string) {
  const existing = await db.businessPipeline.findUnique({ where: { businessId } });
  if (existing) return existing;
  return db.businessPipeline.create({ data: { businessId, stagesJson: DEFAULT_PIPELINE_STAGES } });
}

function stageKeys(pipeline: { stagesJson: unknown }): string[] {
  return ((pipeline.stagesJson as PipelineStage[]) ?? []).map((s) => s.key);
}

async function authorizeBusinessRoute(request: { authContext?: AuthContext }, businessId: string, level: "VIEW" | "EDIT"): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  return assertBusinessAccess(businessId, ctx, level);
}

export async function businessCrmRoutes(app: FastifyInstance) {
  // --- Pipeline configuration ----------------------------------------------

  app.get("/api/businesses/:businessId/pipeline", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorizeBusinessRoute(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const pipeline = await getOrCreatePipeline(businessId);
    return reply.send({ pipeline });
  });

  const pipelineUpdateSchema = z.object({ stages: z.array(z.object({ key: z.string().min(1), label: z.string().min(1) })).min(1) });

  app.put("/api/businesses/:businessId/pipeline", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorizeBusinessRoute(request, businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const parsed = pipelineUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    await getOrCreatePipeline(businessId);
    const pipeline = await db.businessPipeline.update({ where: { businessId }, data: { stagesJson: parsed.data.stages, updatedById: request.authContext!.userId } });
    return reply.send({ pipeline });
  });

  // --- Contacts --------------------------------------------------------------

  const createContactSchema = z.object({
    businessId: z.string().min(1),
    fullName: z.string().min(1),
    email: z.string().email().optional(),
    contactNumber: z.string().optional(),
    source: z.string().optional(),
    campaignId: z.string().optional(),
    pipelineStageKey: z.string().optional(),
  });

  app.post("/api/students/:studentId/business-contacts", { preHandler: [requireAuth, requireStudentSelfOrPermission("Business OS", "CREATE")], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = createContactSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    if (!(await authorizeBusinessRoute(request, parsed.data.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const pipeline = await getOrCreatePipeline(parsed.data.businessId);
    const stageKey = parsed.data.pipelineStageKey ?? stageKeys(pipeline)[0];
    if (!stageKeys(pipeline).includes(stageKey)) return reply.code(400).send({ error: `Unknown pipeline stage "${stageKey}" for this business.` });

    // Reuse an existing Person by exact email match rather than duplicating
    // identity (spec section 26) — anything looser than exact-match risks a
    // false merge, so this stays deliberately conservative.
    let personId: string;
    if (parsed.data.email) {
      const dup = (await findPersonDuplicates(parsed.data.email, parsed.data.contactNumber)).find((d) => d.matchedOn === "email");
      personId = dup?.personId ?? (await db.person.create({ data: { fullName: parsed.data.fullName, email: normalizeEmail(parsed.data.email), contactNumber: parsed.data.contactNumber } })).id;
    } else {
      personId = (await db.person.create({ data: { fullName: parsed.data.fullName, contactNumber: parsed.data.contactNumber } })).id;
    }

    const ctx = request.authContext!;
    const contact = await db.businessContact.create({
      data: {
        contactDisplayId: await generateBusinessContactDisplayId(),
        businessId: parsed.data.businessId,
        personId,
        source: parsed.data.source,
        campaignId: parsed.data.campaignId,
        pipelineStageKey: stageKey,
        ownerId: ctx.userId,
        createdById: ctx.userId,
      },
      include: { person: true },
    });
    await writeAuditLog({ action: "Business Contact Created", summary: `Business contact ${contact.contactDisplayId} created`, actorUserId: ctx.userId, entityType: "BusinessContact", entityId: contact.id });
    return reply.code(201).send({ contact });
  });

  app.get("/api/businesses/:businessId/business-contacts", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorizeBusinessRoute(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const { pipelineStageKey, status } = request.query as { pipelineStageKey?: string; status?: string };
    const contacts = await db.businessContact.findMany({ where: { businessId, pipelineStageKey: pipelineStageKey || undefined, status: status || undefined }, include: { person: true }, orderBy: { createdAt: "desc" }, take: 200 });
    return reply.send({ contacts });
  });

  app.get("/api/business-contacts/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const contact = await db.businessContact.findUnique({ where: { id }, include: { person: true, opportunities: true } });
    if (!contact) return reply.code(404).send({ error: "Contact not found." });
    if (!(await authorizeBusinessRoute(request, contact.businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ contact });
  });

  const updateContactSchema = z.object({ pipelineStageKey: z.string().optional(), status: z.enum(["Active", "Customer", "Lost"]).optional() });

  app.patch("/api/business-contacts/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const contact = await db.businessContact.findUnique({ where: { id } });
    if (!contact) return reply.code(404).send({ error: "Contact not found." });
    if (!(await authorizeBusinessRoute(request, contact.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden." });
    const parsed = updateContactSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    if (parsed.data.pipelineStageKey) {
      const pipeline = await getOrCreatePipeline(contact.businessId);
      if (!stageKeys(pipeline).includes(parsed.data.pipelineStageKey)) return reply.code(400).send({ error: `Unknown pipeline stage "${parsed.data.pipelineStageKey}" for this business.` });
    }

    const updated = await db.businessContact.update({ where: { id }, data: parsed.data, include: { person: true } });
    if (parsed.data.pipelineStageKey) {
      await writeAuditLog({ action: "Business Contact Pipeline Stage Changed", summary: `Contact ${contact.contactDisplayId} moved to ${parsed.data.pipelineStageKey}`, actorUserId: request.authContext!.userId, entityType: "BusinessContact", entityId: id });
    }
    return reply.send({ contact: updated });
  });

  // --- Opportunities (Sales workspace) ---------------------------------------

  const createOpportunitySchema = z.object({
    businessId: z.string().min(1),
    contactId: z.string().min(1),
    pipelineStageKey: z.string().optional(),
    estimatedValue: z.number().nonnegative().optional(),
    nextAction: z.string().optional(),
  });

  app.post("/api/students/:studentId/opportunities", { preHandler: [requireAuth, requireStudentSelfOrPermission("Business OS", "CREATE")], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = createOpportunitySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    if (!(await authorizeBusinessRoute(request, parsed.data.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const contact = await db.businessContact.findUnique({ where: { id: parsed.data.contactId } });
    if (!contact || contact.businessId !== parsed.data.businessId) return reply.code(403).send({ error: "This contact does not belong to this business." });

    const pipeline = await getOrCreatePipeline(parsed.data.businessId);
    const stageKey = parsed.data.pipelineStageKey ?? contact.pipelineStageKey;
    if (!stageKeys(pipeline).includes(stageKey)) return reply.code(400).send({ error: `Unknown pipeline stage "${stageKey}" for this business.` });

    const ctx = request.authContext!;
    const opportunity = await db.opportunity.create({
      data: {
        opportunityDisplayId: await generateOpportunityDisplayId(),
        businessId: parsed.data.businessId,
        contactId: parsed.data.contactId,
        pipelineStageKey: stageKey,
        estimatedValue: parsed.data.estimatedValue,
        nextAction: parsed.data.nextAction,
        ownerId: ctx.userId,
        createdById: ctx.userId,
      },
    });
    await writeAuditLog({ action: "Opportunity Created", summary: `Opportunity ${opportunity.opportunityDisplayId} created`, actorUserId: ctx.userId, entityType: "Opportunity", entityId: opportunity.id });
    return reply.code(201).send({ opportunity });
  });

  app.get("/api/businesses/:businessId/opportunities", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorizeBusinessRoute(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const { status } = request.query as { status?: string };
    const opportunities = await db.opportunity.findMany({ where: { businessId, status: status || undefined }, include: { contact: { include: { person: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
    return reply.send({ opportunities });
  });

  const updateOpportunitySchema = z.object({ pipelineStageKey: z.string().optional(), status: z.enum(["OPEN", "WON", "LOST"]).optional(), estimatedValue: z.number().nonnegative().optional(), nextAction: z.string().optional() });

  app.patch("/api/opportunities/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const opportunity = await db.opportunity.findUnique({ where: { id } });
    if (!opportunity) return reply.code(404).send({ error: "Opportunity not found." });
    if (!(await authorizeBusinessRoute(request, opportunity.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden." });
    const parsed = updateOpportunitySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    if (parsed.data.pipelineStageKey) {
      const pipeline = await getOrCreatePipeline(opportunity.businessId);
      if (!stageKeys(pipeline).includes(parsed.data.pipelineStageKey)) return reply.code(400).send({ error: `Unknown pipeline stage "${parsed.data.pipelineStageKey}" for this business.` });
    }

    const updated = await db.opportunity.update({ where: { id }, data: parsed.data });
    if (parsed.data.status) {
      await writeAuditLog({ action: "Opportunity Status Changed", summary: `Opportunity ${opportunity.opportunityDisplayId} status -> ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "Opportunity", entityId: id });
    }
    return reply.send({ opportunity: updated });
  });

  // --- Admin oversight -----------------------------------------------------

  app.get("/api/business-os/contacts", { preHandler: [requireAuth, requirePermission("Business OS", "VIEW")] }, async (request, reply) => {
    const { businessId } = request.query as { businessId?: string };
    const contacts = await db.businessContact.findMany({ where: { businessId: businessId || undefined }, include: { person: true }, orderBy: { createdAt: "desc" }, take: 200 });
    return reply.send({ contacts });
  });
}

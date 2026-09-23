// M.A.I.A. Automation Studio routes (Phase 12 spec sections 3-7, 39-52,
// 80-89). Every route enforces the same real server-side ownership/
// permission rules as every other module — a Student session only ever
// reaches their own Journeys/Automations; a tampered id resolves to
// 403/404, never a cross-business leak. ACTIVE is only ever set by the one
// /activate route below, and only after re-checking the platform
// connection it actually needs (spec: "Do not pretend an automation is live").

import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission, assertBusinessOwnedByStudent } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateJourneyDisplayId, generateAutomationDisplayId } from "../sequence.js";
import { validateFlow, checkDuplicateAutomationRisk } from "./validator.js";
import { flowDefinitionSchema, type FlowDefinition } from "./flow.js";
import { simulateFlow } from "./simulator.js";
import { startRun, advanceRun, cancelRun, retryRun } from "./executor.js";
import { generateAutomationBlueprint } from "./architect.js";

const JOURNEY_STATUSES = ["DRAFT", "FOR_REVIEW", "APPROVED", "ACTIVE", "PAUSED", "ARCHIVED"] as const;

const journeyCreateSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  objective: z.string().optional(),
  audience: z.string().optional(),
  entryPoint: z.string().optional(),
  stages: z
    .array(
      z.object({
        stageName: z.string().min(1),
        purpose: z.string().optional(),
        customerState: z.string().optional(),
        businessGoal: z.string().optional(),
        entryCondition: z.string().optional(),
        exitCondition: z.string().optional(),
        touchpoints: z.array(z.string()).optional(),
        messages: z.array(z.string()).optional(),
        automations: z.array(z.string()).optional(),
        responsibleRole: z.string().optional(),
        metrics: z.array(z.string()).optional(),
      }),
    )
    .default([]),
});

async function assertBusinessAccessible(request: { authContext?: { kind: string; studentId?: string } }, businessId: string): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  if (ctx.kind === "staff") return true;
  if (ctx.kind === "student" && ctx.studentId) return assertBusinessOwnedByStudent(businessId, ctx.studentId);
  return false;
}

function ownedByRequester(request: { authContext?: { kind: string; studentId?: string } }, row: { studentId: string }): boolean {
  const ctx = request.authContext;
  if (!ctx) return false;
  if (ctx.kind === "staff") return true;
  return ctx.kind === "student" && ctx.studentId === row.studentId;
}

async function isGhlConnected(): Promise<boolean> {
  const config = await db.ghlIntegrationConfig.findUnique({ where: { id: "singleton" } });
  return config?.status === "CONNECTED";
}

export async function automationStudioRoutes(app: FastifyInstance) {
  // --- Customer Journeys (spec sections 3-8) ----------------------------

  app.get("/api/businesses/:businessId/journeys", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const journeys = await db.customerJourney.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ journeys });
  });

  app.post("/api/students/:studentId/journeys", { preHandler: [requireAuth, requireStudentSelfOrPermission("Automation Studio", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = journeyCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid journey.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const publishedDoc = await db.masterBrainDocument.findFirst({ where: { businessId: parsed.data.businessId, isCurrentPublished: true } });
    const journey = await db.customerJourney.create({
      data: {
        journeyDisplayId: await generateJourneyDisplayId(),
        studentId,
        businessId: parsed.data.businessId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        objective: parsed.data.objective ?? null,
        audience: parsed.data.audience ?? null,
        entryPoint: parsed.data.entryPoint ?? null,
        stagesJson: parsed.data.stages as unknown as Prisma.InputJsonValue,
        masterBrainVersionAtCreation: publishedDoc?.documentVersion ?? null,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Journey Created", summary: `Journey "${journey.name}" created`, actorUserId: request.authContext!.userId, entityType: "CustomerJourney", entityId: journey.id });
    return reply.code(201).send({ journey });
  });

  app.get("/api/journeys/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const journey = await db.customerJourney.findUnique({ where: { id }, include: { automations: true } });
    if (!journey) return reply.code(404).send({ error: "Journey not found." });
    if (!ownedByRequester(request, journey)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ journey });
  });

  app.patch("/api/journeys/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const journey = await db.customerJourney.findUnique({ where: { id } });
    if (!journey) return reply.code(404).send({ error: "Journey not found." });
    if (!ownedByRequester(request, journey)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = journeyCreateSchema.omit({ businessId: true }).partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const { stages, ...rest } = parsed.data;
    const updated = await db.customerJourney.update({
      where: { id },
      data: { ...rest, stagesJson: stages ? (stages as unknown as Prisma.InputJsonValue) : undefined },
    });
    return reply.send({ journey: updated });
  });

  app.post("/api/journeys/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const journey = await db.customerJourney.findUnique({ where: { id } });
    if (!journey) return reply.code(404).send({ error: "Journey not found." });
    if (!ownedByRequester(request, journey)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.enum(JOURNEY_STATUSES) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });

    const updated = await db.customerJourney.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAuditLog({ action: "Journey Status Changed", summary: `Journey "${journey.name}" status changed ${journey.status} -> ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "CustomerJourney", entityId: id });
    return reply.send({ journey: updated });
  });

  // --- Automations: create + read (spec sections 9-12, 41) ---------------

  const automationCreateSchema = z.object({
    businessId: z.string().min(1),
    journeyId: z.string().optional(),
    name: z.string().min(1),
    goal: z.string().optional(),
    audience: z.string().optional(),
    flow: flowDefinitionSchema,
    triggerType: z.string().min(1),
    triggerConfig: z.record(z.string(), z.unknown()).optional(),
  });

  app.post("/api/students/:studentId/automations", { preHandler: [requireAuth, requireStudentSelfOrPermission("Automation Studio", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = automationCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid automation.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    if (parsed.data.journeyId) {
      const journey = await db.customerJourney.findUnique({ where: { id: parsed.data.journeyId } });
      if (!journey || journey.businessId !== parsed.data.businessId) return reply.code(403).send({ error: "This journey does not belong to this business." });
    }

    const [validation, duplicateWarnings] = await Promise.all([validateFlow(parsed.data.flow as FlowDefinition), checkDuplicateAutomationRisk(parsed.data.triggerType)]);
    const issues = [...validation.issues, ...duplicateWarnings];

    const automation = await db.automation.create({
      data: {
        automationDisplayId: await generateAutomationDisplayId(),
        studentId,
        businessId: parsed.data.businessId,
        journeyId: parsed.data.journeyId ?? null,
        name: parsed.data.name,
        goal: parsed.data.goal ?? null,
        audience: parsed.data.audience ?? null,
        readiness: validation.blocking ? "DESIGN_ONLY" : "READY_FOR_TEST",
        createdById: request.authContext!.userId,
      },
    });
    const version = await db.automationVersion.create({
      data: {
        automationId: automation.id,
        versionNumber: 1,
        flowJson: parsed.data.flow as unknown as Prisma.InputJsonValue,
        triggerType: parsed.data.triggerType,
        triggerConfig: (parsed.data.triggerConfig as unknown as Prisma.InputJsonValue) ?? undefined,
        validationJson: { issues, blocking: validation.blocking } as unknown as Prisma.InputJsonValue,
        createdById: request.authContext!.userId,
      },
    });
    await db.automation.update({ where: { id: automation.id }, data: { currentVersionId: version.id } });
    await writeAuditLog({ action: "Automation Created", summary: `Automation "${automation.name}" created`, actorUserId: request.authContext!.userId, entityType: "Automation", entityId: automation.id });

    return reply.code(201).send({ automation, version });
  });

  // AI Automation Architect (spec sections 43-45, 110-113)
  app.post(
    "/api/students/:studentId/automations/architect",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Automation Studio", "CREATE")], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const parsed = z.object({ businessId: z.string().min(1), journeyId: z.string().optional(), description: z.string().min(1) }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

      const outcome = await generateAutomationBlueprint({ studentId, businessId: parsed.data.businessId, journeyId: parsed.data.journeyId, description: parsed.data.description, actorUserId: request.authContext!.userId });
      if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
      const automation = await db.automation.findUniqueOrThrow({ where: { id: outcome.automationId }, include: { currentVersion: true } });
      return reply.code(201).send({ generationId: outcome.generationId, automation });
    },
  );

  app.get("/api/businesses/:businessId/automations", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const automations = await db.automation.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, include: { currentVersion: true } });
    return reply.send({ automations });
  });

  app.get("/api/automations/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const automation = await db.automation.findUnique({ where: { id }, include: { currentVersion: true, versions: { orderBy: { versionNumber: "desc" } } } });
    if (!automation) return reply.code(404).send({ error: "Automation not found." });
    if (!ownedByRequester(request, automation)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ automation });
  });

  // --- Versions: create draft, edit, validate, dry-run, test-run --------

  app.post("/api/automations/:id/versions", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const automation = await db.automation.findUnique({ where: { id }, include: { currentVersion: true } });
    if (!automation) return reply.code(404).send({ error: "Automation not found." });
    if (!ownedByRequester(request, automation)) return reply.code(403).send({ error: "Forbidden." });

    const parsed = z.object({ flow: flowDefinitionSchema.optional(), triggerType: z.string().optional(), triggerConfig: z.record(z.string(), z.unknown()).optional(), changeNotes: z.string().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid version.", details: parsed.error.flatten() });

    const maxVersion = await db.automationVersion.aggregate({ where: { automationId: id }, _max: { versionNumber: true } });
    const flow = (parsed.data.flow as FlowDefinition | undefined) ?? (automation.currentVersion?.flowJson as unknown as FlowDefinition) ?? { nodes: [], edges: [] };
    const triggerType = parsed.data.triggerType ?? automation.currentVersion?.triggerType ?? "MANUAL";
    const [validation, duplicateWarnings] = await Promise.all([validateFlow(flow), checkDuplicateAutomationRisk(triggerType)]);

    const version = await db.automationVersion.create({
      data: {
        automationId: id,
        versionNumber: (maxVersion._max.versionNumber ?? 0) + 1,
        flowJson: flow as unknown as Prisma.InputJsonValue,
        triggerType,
        triggerConfig: (parsed.data.triggerConfig as unknown as Prisma.InputJsonValue) ?? automation.currentVersion?.triggerConfig ?? undefined,
        changeNotes: parsed.data.changeNotes ?? null,
        validationJson: { issues: [...validation.issues, ...duplicateWarnings], blocking: validation.blocking } as unknown as Prisma.InputJsonValue,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Automation Version Created", summary: `Automation "${automation.name}" v${version.versionNumber} drafted`, actorUserId: request.authContext!.userId, entityType: "AutomationVersion", entityId: version.id });

    // Only DRAFT-status Automations track readiness directly off this new version — an ACTIVE automation's readiness/status keeps reflecting its currently-published version until THIS draft is itself published.
    if (automation.status === "DRAFT") {
      await db.automation.update({ where: { id }, data: { currentVersionId: version.id, readiness: validation.blocking ? "DESIGN_ONLY" : "READY_FOR_TEST" } });
    }
    return reply.code(201).send({ version });
  });

  app.patch("/api/automation-versions/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const version = await db.automationVersion.findUnique({ where: { id }, include: { automation: true } });
    if (!version) return reply.code(404).send({ error: "Version not found." });
    if (!ownedByRequester(request, version.automation)) return reply.code(403).send({ error: "Forbidden." });
    if (version.status !== "DRAFT") return reply.code(409).send({ error: `Cannot edit a version with status ${version.status} — only DRAFT versions may be edited.` });

    const parsed = z.object({ flow: flowDefinitionSchema.optional(), triggerType: z.string().optional(), triggerConfig: z.record(z.string(), z.unknown()).optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const flow = (parsed.data.flow as FlowDefinition | undefined) ?? (version.flowJson as unknown as FlowDefinition);
    const triggerType = parsed.data.triggerType ?? version.triggerType;
    const [validation, duplicateWarnings] = await Promise.all([validateFlow(flow), checkDuplicateAutomationRisk(triggerType)]);

    const updated = await db.automationVersion.update({
      where: { id },
      data: {
        flowJson: flow as unknown as Prisma.InputJsonValue,
        triggerType,
        triggerConfig: (parsed.data.triggerConfig as unknown as Prisma.InputJsonValue) ?? undefined,
        validationJson: { issues: [...validation.issues, ...duplicateWarnings], blocking: validation.blocking } as unknown as Prisma.InputJsonValue,
      },
    });
    if (version.automation.currentVersionId === id) {
      await db.automation.update({ where: { id: version.automationId }, data: { readiness: validation.blocking ? "DESIGN_ONLY" : "READY_FOR_TEST" } });
    }
    return reply.send({ version: updated });
  });

  app.post("/api/automation-versions/:id/validate", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const version = await db.automationVersion.findUnique({ where: { id }, include: { automation: true } });
    if (!version) return reply.code(404).send({ error: "Version not found." });
    if (!ownedByRequester(request, version.automation)) return reply.code(403).send({ error: "Forbidden." });

    const flow = version.flowJson as unknown as FlowDefinition;
    const [validation, duplicateWarnings] = await Promise.all([validateFlow(flow), checkDuplicateAutomationRisk(version.triggerType)]);
    const validationJson = { issues: [...validation.issues, ...duplicateWarnings], blocking: validation.blocking };
    const updated = await db.automationVersion.update({ where: { id }, data: { validationJson: validationJson as unknown as Prisma.InputJsonValue } });
    return reply.send({ version: updated, validation: validationJson });
  });

  app.post("/api/automation-versions/:id/dry-run", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const version = await db.automationVersion.findUnique({ where: { id }, include: { automation: true } });
    if (!version) return reply.code(404).send({ error: "Version not found." });
    if (!ownedByRequester(request, version.automation)) return reply.code(403).send({ error: "Forbidden." });

    const parsed = z.object({ entityType: z.enum(["Lead", "Student"]), entityId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const flow = version.flowJson as unknown as FlowDefinition;
    const result = await simulateFlow(flow, parsed.data.entityType, parsed.data.entityId);
    return reply.send({ simulation: result });
  });

  app.post("/api/automation-versions/:id/test-run", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const version = await db.automationVersion.findUnique({ where: { id }, include: { automation: true } });
    if (!version) return reply.code(404).send({ error: "Version not found." });
    if (!ownedByRequester(request, version.automation)) return reply.code(403).send({ error: "Forbidden." });

    const parsed = z.object({ entityType: z.enum(["Lead", "Student"]), entityId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    // TEST MODE may only ever target a configured test contact — never the real student population (spec section 50).
    const testContact = await db.automationTestContact.findFirst({ where: { businessId: version.automation.businessId, entityType: parsed.data.entityType, entityId: parsed.data.entityId } });
    if (!testContact) return reply.code(403).send({ error: "This entity is not a configured Test Contact for this business — TEST MODE may only target configured test contacts." });

    const run = await startRun({
      automationId: version.automationId,
      automationVersionId: id,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      triggerEvent: "MANUAL_TEST",
      isTest: true,
      actorUserId: request.authContext!.userId,
    });
    await writeAuditLog({ action: "Automation Test Run", summary: `Test run started for automation "${version.automation.name}"`, actorUserId: request.authContext!.userId, entityType: "AutomationRun", entityId: run.id });

    // Advance synchronously (bounded) so a TEST MODE run gives immediate feedback rather than waiting for the dispatcher interval.
    for (let i = 0; i < 25; i++) {
      const current = await db.automationRun.findUniqueOrThrow({ where: { id: run.id } });
      if (current.status !== "QUEUED" && current.status !== "RUNNING") break;
      await advanceRun(run.id);
    }
    const finished = await db.automationRun.findUniqueOrThrow({ where: { id: run.id }, include: { steps: { orderBy: { stepIndex: "asc" } } } });
    return reply.code(201).send({ run: finished });
  });

  // --- Approval workflow (spec sections 41-42, 47) -----------------------

  app.post("/api/automations/:id/submit-for-review", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const automation = await db.automation.findUnique({ where: { id }, include: { currentVersion: true } });
    if (!automation) return reply.code(404).send({ error: "Automation not found." });
    if (!ownedByRequester(request, automation)) return reply.code(403).send({ error: "Forbidden." });
    if (automation.status !== "DRAFT") return reply.code(409).send({ error: `Cannot submit an automation with status ${automation.status}.` });
    const validation = automation.currentVersion?.validationJson as { blocking?: boolean } | null;
    if (validation?.blocking) return reply.code(422).send({ error: "This automation has blocking validation issues and cannot be submitted for review yet." });

    const updated = await db.automation.update({ where: { id }, data: { status: "FOR_REVIEW", readiness: "READY_FOR_APPROVAL" } });
    return reply.send({ automation: updated });
  });

  app.post("/api/automations/:id/approve", { preHandler: [requireAuth, requirePermission("Automation Studio", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const automation = await db.automation.findUnique({ where: { id }, include: { currentVersion: true } });
    if (!automation) return reply.code(404).send({ error: "Automation not found." });
    if (automation.status !== "FOR_REVIEW") return reply.code(409).send({ error: `Cannot approve an automation with status ${automation.status}.` });

    const updated = await db.automation.update({ where: { id }, data: { status: "APPROVED", readiness: "READY_TO_PUBLISH" } });
    if (automation.currentVersionId) {
      await db.automationVersion.update({ where: { id: automation.currentVersionId }, data: { reviewedById: request.authContext!.userId, reviewedAt: new Date() } });
    }
    await writeAuditLog({ action: "Automation Approved", summary: `Automation "${automation.name}" approved`, actorUserId: request.authContext!.userId, entityType: "Automation", entityId: id });
    return reply.send({ automation: updated });
  });

  app.post("/api/automations/:id/publish", { preHandler: [requireAuth, requirePermission("Automation Studio", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const automation = await db.automation.findUnique({ where: { id }, include: { currentVersion: true } });
    if (!automation) return reply.code(404).send({ error: "Automation not found." });
    if (automation.status !== "APPROVED") return reply.code(409).send({ error: `Cannot publish an automation with status ${automation.status}.` });
    if (!automation.currentVersion) return reply.code(422).send({ error: "No version to publish." });
    const validation = automation.currentVersion.validationJson as { blocking?: boolean } | null;
    if (validation?.blocking) return reply.code(422).send({ error: "This version has blocking validation issues and cannot be published." });

    await db.$transaction([
      db.automationVersion.updateMany({ where: { automationId: id, status: "ACTIVE" }, data: { status: "ARCHIVED" } }),
      db.automationVersion.update({ where: { id: automation.currentVersion.id }, data: { status: "ACTIVE", publishedAt: new Date() } }),
      db.automation.update({ where: { id }, data: { status: "PUBLISHED", readiness: "READY_TO_PUBLISH" } }),
    ]);
    await writeAuditLog({ action: "Automation Published", summary: `Automation "${automation.name}" published (v${automation.currentVersion.versionNumber})`, actorUserId: request.authContext!.userId, entityType: "Automation", entityId: id });
    const updated = await db.automation.findUniqueOrThrow({ where: { id }, include: { currentVersion: true } });
    return reply.send({ automation: updated });
  });

  // ACTIVE is only ever set here, and only after re-checking the platform this automation actually needs (never a claim of "live" without one) — spec: "Do not pretend an automation is live merely because a flowchart exists."
  app.post("/api/automations/:id/activate", { preHandler: [requireAuth, requirePermission("Automation Studio", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const automation = await db.automation.findUnique({ where: { id }, include: { currentVersion: true } });
    if (!automation) return reply.code(404).send({ error: "Automation not found." });
    if (automation.status !== "PUBLISHED" && automation.status !== "PAUSED") return reply.code(409).send({ error: `Cannot activate an automation with status ${automation.status}.` });

    if (automation.platformExecutionMode === "GHL" && !(await isGhlConnected())) {
      return reply.code(422).send({ error: "This automation's platform is GHL, and GHL is not CONNECTED — activation is blocked until the connection is real." });
    }

    const updated = await db.automation.update({ where: { id }, data: { status: "ACTIVE", readiness: "ACTIVE" } });
    await writeAuditLog({ action: "Automation Activated", summary: `Automation "${automation.name}" activated`, actorUserId: request.authContext!.userId, entityType: "Automation", entityId: id });
    return reply.send({ automation: updated });
  });

  app.post("/api/automations/:id/pause", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const automation = await db.automation.findUnique({ where: { id } });
    if (!automation) return reply.code(404).send({ error: "Automation not found." });
    if (!ownedByRequester(request, automation)) return reply.code(403).send({ error: "Forbidden." });
    if (automation.status !== "ACTIVE") return reply.code(409).send({ error: `Cannot pause an automation with status ${automation.status}.` });

    const updated = await db.automation.update({ where: { id }, data: { status: "PAUSED" } });
    await writeAuditLog({ action: "Automation Paused", summary: `Automation "${automation.name}" paused`, actorUserId: request.authContext!.userId, entityType: "Automation", entityId: id });
    return reply.send({ automation: updated });
  });

  app.post("/api/automations/:id/archive", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const automation = await db.automation.findUnique({ where: { id } });
    if (!automation) return reply.code(404).send({ error: "Automation not found." });
    if (!ownedByRequester(request, automation)) return reply.code(403).send({ error: "Forbidden." });
    if (automation.status === "ACTIVE") return reply.code(409).send({ error: "Pause this automation before archiving it." });

    const updated = await db.automation.update({ where: { id }, data: { status: "ARCHIVED" } });
    await writeAuditLog({ action: "Automation Archived", summary: `Automation "${automation.name}" archived`, actorUserId: request.authContext!.userId, entityType: "Automation", entityId: id });
    return reply.send({ automation: updated });
  });

  // --- Runs (spec sections 35-38, 82-84) ----------------------------------

  app.get("/api/automations/:id/runs", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const automation = await db.automation.findUnique({ where: { id } });
    if (!automation) return reply.code(404).send({ error: "Automation not found." });
    if (!ownedByRequester(request, automation)) return reply.code(403).send({ error: "Forbidden." });
    const { status } = request.query as { status?: string };
    const runs = await db.automationRun.findMany({ where: { automationId: id, status: status || undefined }, orderBy: { startedAt: "desc" }, take: 200 });
    return reply.send({ runs });
  });

  app.get("/api/automation-runs/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await db.automationRun.findUnique({ where: { id }, include: { steps: { orderBy: { stepIndex: "asc" } }, automation: true } });
    if (!run) return reply.code(404).send({ error: "Run not found." });
    if (!ownedByRequester(request, run.automation)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ run });
  });

  app.post("/api/automation-runs/:id/retry", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await db.automationRun.findUnique({ where: { id }, include: { automation: true } });
    if (!run) return reply.code(404).send({ error: "Run not found." });
    if (!ownedByRequester(request, run.automation)) return reply.code(403).send({ error: "Forbidden." });
    try {
      await retryRun(id, request.authContext!.userId);
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : "Cannot retry this run." });
    }
    const updated = await db.automationRun.findUniqueOrThrow({ where: { id }, include: { steps: { orderBy: { stepIndex: "asc" } } } });
    return reply.send({ run: updated });
  });

  app.post("/api/automation-runs/:id/cancel", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await db.automationRun.findUnique({ where: { id }, include: { automation: true } });
    if (!run) return reply.code(404).send({ error: "Run not found." });
    if (!ownedByRequester(request, run.automation)) return reply.code(403).send({ error: "Forbidden." });
    await cancelRun(id, request.authContext!.userId);
    const updated = await db.automationRun.findUniqueOrThrow({ where: { id } });
    return reply.send({ run: updated });
  });

  // --- Test Contacts (spec section 50) ------------------------------------

  app.get("/api/businesses/:businessId/automation-test-contacts", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const contacts = await db.automationTestContact.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ testContacts: contacts });
  });

  app.post("/api/businesses/:businessId/automation-test-contacts", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const parsed = z.object({ label: z.string().min(1), entityType: z.enum(["Lead", "Student"]), entityId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid test contact.", details: parsed.error.flatten() });

    const contact = await db.automationTestContact.create({ data: { businessId, label: parsed.data.label, entityType: parsed.data.entityType, entityId: parsed.data.entityId, createdById: request.authContext!.userId } });
    return reply.code(201).send({ testContact: contact });
  });

  // --- Automation Health / Failure Queue (spec sections 80-83) -----------

  app.get("/api/automation-studio/health", { preHandler: [requireAuth, requirePermission("Automation Studio", "VIEW")] }, async (_request, reply) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [activeAutomations, runsToday, statusCounts] = await Promise.all([
      db.automation.count({ where: { status: "ACTIVE" } }),
      db.automationRun.count({ where: { startedAt: { gte: startOfToday } } }),
      db.automationRun.groupBy({ by: ["status"], where: { startedAt: { gte: startOfToday } }, _count: { _all: true } }),
    ]);
    const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));
    return reply.send({ activeAutomations, runsToday, byStatus });
  });

  app.get("/api/automation-studio/failures", { preHandler: [requireAuth, requirePermission("Automation Studio", "VIEW")] }, async (_request, reply) => {
    const failures = await db.automationRun.findMany({ where: { status: "FAILED" }, orderBy: { startedAt: "desc" }, take: 200, include: { automation: true } });
    return reply.send({ failures });
  });

  // --- Intelligence handoff (spec sections 71-72) — recommendation only, never auto-activation.

  app.get("/api/intelligence/signals/:signalId/suggest-automation-description", { preHandler: [requireAuth, requirePermission("M.A.I.A. Intelligence", "VIEW")] }, async (request, reply) => {
    const { signalId } = request.params as { signalId: string };
    const signal = await db.intelligenceSignal.findUnique({ where: { id: signalId } });
    if (!signal) return reply.code(404).send({ error: "Signal not found." });
    const suggestedDescription = `${signal.title}. ${signal.explanation} Build an automation that addresses this — a Business and Journey must still be chosen manually before generating a blueprint.`;
    return reply.send({ suggestedDescription });
  });
}

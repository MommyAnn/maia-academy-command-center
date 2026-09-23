// M.A.I.A. Creative Studio routes (Phase 11 spec sections 4-7, 11-13,
// 16-20, 24-33, 40-55, 57-58, 88). Every route enforces the same real
// server-side ownership/permission rules as every other module in this
// codebase — a Student session only ever reaches their own Campaigns/
// Businesses; a tampered :campaignId, :businessId, or child-resource id
// resolves to 403/404, never a cross-business leak.

import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission, assertBusinessOwnedByStudent, checkPermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateCampaignDisplayId, generateCreativePackageDisplayId } from "../sequence.js";
import { runToolGeneration } from "../ai-tools/engine.js";
import { generateCreativeAngles, generateHooks, generateScript, generateStoryboard, generateScenePrompt } from "./generation.js";

const CAMPAIGN_OBJECTIVES = ["Awareness", "Engagement", "Lead Generation", "Messages", "Webinar Registration", "Sales", "Enrollment", "Product Launch", "Retargeting", "Customer Retention", "Other"] as const;
const CAMPAIGN_STATUSES = ["DRAFT", "STRATEGY", "CREATIVE_DEVELOPMENT", "FOR_REVIEW", "APPROVED", "PRODUCTION", "TESTING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;
const ANGLE_STATUSES = ["Generated", "Saved", "Selected", "Rejected"] as const;
const HOOK_STATUSES = ["Generated", "Saved", "Favorited", "Rejected", "SentToScript"] as const;
const SCRIPT_STATUSES = ["Draft", "Approved", "Revision Requested"] as const;
const PACKAGE_STATUSES = ["DRAFT", "FOR_REVIEW", "REVISION_REQUESTED", "APPROVED", "READY_FOR_PRODUCTION", "PRODUCED", "READY_FOR_TESTING"] as const;

const campaignCreateSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1),
  objective: z.enum(CAMPAIGN_OBJECTIVES),
  product: z.string().optional(),
  offer: z.string().optional(),
  audience: z.string().optional(),
  platform: z.string().optional(),
  funnelStage: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const campaignUpdateSchema = campaignCreateSchema.partial().omit({ businessId: true });

/** Every :businessId route needs this — mirrors the identical helper in master-brain/routes.ts (spec section 15 business isolation, applied here to Creative Studio). */
async function assertBusinessAccessible(request: { authContext?: { kind: string; studentId?: string } }, businessId: string): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  if (ctx.kind === "staff") return true;
  if (ctx.kind === "student" && ctx.studentId) return assertBusinessOwnedByStudent(businessId, ctx.studentId);
  return false;
}

/** A Student may only reach their own Campaign; Staff access is governed by requirePermission at the route level. */
function campaignAccessible(request: { authContext?: { kind: string; studentId?: string } }, campaign: { studentId: string }): boolean {
  const ctx = request.authContext;
  if (!ctx) return false;
  if (ctx.kind === "staff") return true;
  return ctx.kind === "student" && ctx.studentId === campaign.studentId;
}

export async function creativeStudioRoutes(app: FastifyInstance) {
  // --- Campaigns (spec sections 4-7) -----------------------------------------

  app.get("/api/businesses/:businessId/campaigns", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const campaigns = await db.campaign.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ campaigns });
  });

  app.post("/api/students/:studentId/campaigns", { preHandler: [requireAuth, requireStudentSelfOrPermission("Creative Studio", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = campaignCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid campaign.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const publishedDoc = await db.masterBrainDocument.findFirst({ where: { businessId: parsed.data.businessId, isCurrentPublished: true } });
    const campaign = await db.campaign.create({
      data: {
        campaignDisplayId: await generateCampaignDisplayId(),
        studentId,
        businessId: parsed.data.businessId,
        name: parsed.data.name,
        objective: parsed.data.objective,
        product: parsed.data.product ?? null,
        offer: parsed.data.offer ?? null,
        audience: parsed.data.audience ?? null,
        platform: parsed.data.platform ?? null,
        funnelStage: parsed.data.funnelStage ?? null,
        masterBrainVersionAtCreation: publishedDoc?.documentVersion ?? null,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Campaign Created", summary: `Campaign "${campaign.name}" created`, actorUserId: request.authContext!.userId, actorStudentId: studentId, entityType: "Campaign", entityId: campaign.id });
    return reply.code(201).send({ campaign });
  });

  app.get("/api/campaigns/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ campaign });
  });

  app.patch("/api/campaigns/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = campaignUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const updated = await db.campaign.update({
      where: { id },
      data: {
        ...parsed.data,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      },
    });
    return reply.send({ campaign: updated });
  });

  // ACTIVE here is never a claim that a real ad platform campaign is live (spec section 7) — only Academy-side status.
  app.post("/api/campaigns/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.enum(CAMPAIGN_STATUSES) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });

    const updated = await db.campaign.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAuditLog({ action: "Campaign Status Changed", summary: `Campaign "${campaign.name}" status changed ${campaign.status} -> ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "Campaign", entityId: id });
    return reply.send({ campaign: updated });
  });

  // --- Campaign Strategist (spec sections 8-10) — free-text, generic engine ---

  app.post("/api/campaigns/:id/strategy/generate", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ additionalContext: z.string().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const userRequest = [
      `CAMPAIGN "${campaign.name}" — Objective: ${campaign.objective}${campaign.product ? `; Product: ${campaign.product}` : ""}${campaign.offer ? `; Offer: ${campaign.offer}` : ""}${campaign.audience ? `; Audience: ${campaign.audience}` : ""}${campaign.platform ? `; Platform: ${campaign.platform}` : ""}${campaign.funnelStage ? `; Funnel Stage: ${campaign.funnelStage}` : ""}`,
      parsed.data.additionalContext ?? "",
    ].filter(Boolean).join("\n\n");

    const outcome = await runToolGeneration({
      studentId: campaign.studentId,
      businessId: campaign.businessId,
      toolKey: "campaign-strategist",
      userRequest,
      actorUserId: request.authContext!.userId,
    });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    const generation = await db.aiGeneration.findUniqueOrThrow({ where: { id: outcome.generationId } });
    return reply.code(201).send({ generation });
  });

  // --- Creative Angle Engine (spec section 16) --------------------------------

  app.post("/api/campaigns/:id/angles/generate", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ angleCount: z.number().int().positive().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const outcome = await generateCreativeAngles({ studentId: campaign.studentId, businessId: campaign.businessId, campaignId: id, angleCount: parsed.data.angleCount, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    return reply.code(201).send({ generationId: outcome.generationId, angles: outcome.data });
  });

  app.get("/api/campaigns/:id/angles", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const angles = await db.creativeAngle.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ angles });
  });

  app.post("/api/angles/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const angle = await db.creativeAngle.findUnique({ where: { id } });
    if (!angle) return reply.code(404).send({ error: "Angle not found." });
    if (!campaignAccessible(request, angle)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.enum(ANGLE_STATUSES) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });
    const updated = await db.creativeAngle.update({ where: { id }, data: { status: parsed.data.status } });
    return reply.send({ angle: updated });
  });

  // --- Hook Lab (spec section 18) ---------------------------------------------

  app.post("/api/campaigns/:id/hooks/generate", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ angleId: z.string().optional(), hookCount: z.number().int().positive().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const outcome = await generateHooks({ studentId: campaign.studentId, businessId: campaign.businessId, campaignId: id, angleId: parsed.data.angleId, hookCount: parsed.data.hookCount, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    return reply.code(201).send({ generationId: outcome.generationId, hooks: outcome.data });
  });

  app.get("/api/campaigns/:id/hooks", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const hooks = await db.hook.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ hooks });
  });

  app.post("/api/hooks/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const hook = await db.hook.findUnique({ where: { id } });
    if (!hook) return reply.code(404).send({ error: "Hook not found." });
    if (!campaignAccessible(request, hook)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.enum(HOOK_STATUSES) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });
    const updated = await db.hook.update({ where: { id }, data: { status: parsed.data.status } });
    if (parsed.data.status === "Favorited" || parsed.data.status === "Rejected") {
      await writeAuditLog({ action: "Hook Status Changed", summary: `Hook ${id} marked ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "Hook", entityId: id });
    }
    return reply.send({ hook: updated });
  });

  // --- Script Studio (spec sections 24-26) ------------------------------------

  app.post("/api/campaigns/:id/scripts/generate", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ angleId: z.string().optional(), hookId: z.string().optional(), scriptType: z.string().optional(), durationSeconds: z.number().int().positive().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const outcome = await generateScript({ studentId: campaign.studentId, businessId: campaign.businessId, campaignId: id, ...parsed.data, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    const script = await db.script.findUniqueOrThrow({ where: { id: outcome.data.id } });
    return reply.code(201).send({ generationId: outcome.generationId, script });
  });

  app.get("/api/campaigns/:id/scripts", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const scripts = await db.script.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ scripts });
  });

  app.get("/api/scripts/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const script = await db.script.findUnique({ where: { id } });
    if (!script) return reply.code(404).send({ error: "Script not found." });
    if (!campaignAccessible(request, script)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ script });
  });

  app.post("/api/scripts/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const script = await db.script.findUnique({ where: { id } });
    if (!script) return reply.code(404).send({ error: "Script not found." });
    if (!campaignAccessible(request, script)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.enum(SCRIPT_STATUSES) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });
    const updated = await db.script.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAuditLog({ action: "Script Status Changed", summary: `Script ${id} status changed ${script.status} -> ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "Script", entityId: id });
    return reply.send({ script: updated });
  });

  // --- Storyboard Studio (spec sections 27-29) --------------------------------

  app.post("/api/scripts/:id/storyboard/generate", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const script = await db.script.findUnique({ where: { id } });
    if (!script) return reply.code(404).send({ error: "Script not found." });
    if (!campaignAccessible(request, script)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ visualStyle: z.string().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const outcome = await generateStoryboard({ studentId: script.studentId, businessId: script.businessId, campaignId: script.campaignId, scriptId: id, visualStyle: parsed.data.visualStyle, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    const storyboard = await db.storyboard.findUniqueOrThrow({ where: { id: outcome.data.id }, include: { scenes: { orderBy: { sceneNumber: "asc" } } } });
    return reply.code(201).send({ generationId: outcome.generationId, storyboard });
  });

  app.get("/api/campaigns/:id/storyboards", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const storyboards = await db.storyboard.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ storyboards });
  });

  app.get("/api/storyboards/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const storyboard = await db.storyboard.findUnique({ where: { id }, include: { scenes: { orderBy: { sceneNumber: "asc" }, include: { prompts: true } } } });
    if (!storyboard) return reply.code(404).send({ error: "Storyboard not found." });
    if (!campaignAccessible(request, storyboard)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ storyboard });
  });

  // --- Character Profiles (spec sections 30-33) -------------------------------

  const characterCreateSchema = z.object({
    name: z.string().min(1),
    role: z.string().optional(),
    referenceImageDocumentId: z.string().optional(),
    appearanceNotes: z.string().optional(),
    defaultWardrobe: z.string().optional(),
    accessories: z.string().optional(),
    brandRole: z.string().optional(),
    continuityInstructions: z.string().optional(),
  });

  app.get("/api/businesses/:businessId/character-profiles", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const profiles = await db.characterProfile.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ characterProfiles: profiles });
  });

  app.post("/api/businesses/:businessId/character-profiles", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const ctx = request.authContext!;
    const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
    const parsed = characterCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid character profile.", details: parsed.error.flatten() });

    if (parsed.data.referenceImageDocumentId) {
      const doc = await db.document.findUnique({ where: { id: parsed.data.referenceImageDocumentId } });
      if (!doc || (doc.ownerStudentId !== business.studentId && doc.ownerBusinessId !== businessId)) {
        return reply.code(403).send({ error: "Reference image document does not belong to this student/business." });
      }
    }

    const continuityInstructions =
      parsed.data.continuityInstructions ??
      "Use the provided character reference as the same main character, and maintain consistent face, facial features, skin tone, hair, body proportions, age appearance, and identity.";

    const profile = await db.characterProfile.create({
      data: {
        businessId,
        studentId: business.studentId,
        name: parsed.data.name,
        role: parsed.data.role ?? null,
        referenceImageDocumentId: parsed.data.referenceImageDocumentId ?? null,
        appearanceNotes: parsed.data.appearanceNotes ?? null,
        defaultWardrobe: parsed.data.defaultWardrobe ?? null,
        accessories: parsed.data.accessories ?? null,
        brandRole: parsed.data.brandRole ?? null,
        continuityInstructions,
      },
    });
    await writeAuditLog({ action: "Character Profile Created", summary: `Character profile "${profile.name}" created`, actorUserId: ctx.userId, entityType: "CharacterProfile", entityId: profile.id });
    return reply.code(201).send({ characterProfile: profile });
  });

  // --- Scene Prompt Studio (spec sections 40-44) ------------------------------

  app.post("/api/scenes/:id/prompt/generate", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scene = await db.storyboardScene.findUnique({ where: { id }, include: { storyboard: true } });
    if (!scene) return reply.code(404).send({ error: "Scene not found." });
    if (!campaignAccessible(request, scene.storyboard)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ characterProfileId: z.string().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const outcome = await generateScenePrompt({
      studentId: scene.storyboard.studentId,
      businessId: scene.storyboard.businessId,
      campaignId: scene.storyboard.campaignId,
      sceneId: id,
      characterProfileId: parsed.data.characterProfileId,
      actorUserId: request.authContext!.userId,
    });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    const scenePrompt = await db.scenePrompt.findUniqueOrThrow({ where: { id: outcome.data.id } });
    return reply.code(201).send({ generationId: outcome.generationId, scenePrompt });
  });

  // --- Copy Studio (spec sections 51-52) — reuses the existing "copywriter" tool

  app.post("/api/campaigns/:id/copy/generate", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z
      .object({ platform: z.string().optional(), copyType: z.string().min(1), userRequest: z.string().min(1) })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const userRequest = [
      `CAMPAIGN "${campaign.name}" — Objective: ${campaign.objective}${campaign.offer ? `; Offer: ${campaign.offer}` : ""}${campaign.audience ? `; Audience: ${campaign.audience}` : ""}`,
      `COPY TYPE: ${parsed.data.copyType}${parsed.data.platform ? ` (Platform: ${parsed.data.platform})` : ""}`,
      parsed.data.userRequest,
    ].join("\n\n");

    const outcome = await runToolGeneration({ studentId: campaign.studentId, businessId: campaign.businessId, toolKey: "copywriter", userRequest, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });

    const variant = await db.campaignCopyVariant.create({
      data: { campaignId: id, studentId: campaign.studentId, businessId: campaign.businessId, platform: parsed.data.platform ?? null, copyType: parsed.data.copyType, generationId: outcome.generationId },
    });
    const generation = await db.aiGeneration.findUniqueOrThrow({ where: { id: outcome.generationId } });
    return reply.code(201).send({ copyVariant: variant, generation });
  });

  app.get("/api/campaigns/:id/copy", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const variants = await db.campaignCopyVariant.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" } });
    const generations = await db.aiGeneration.findMany({ where: { id: { in: variants.map((v) => v.generationId) } } });
    const byId = new Map(generations.map((g) => [g.id, g]));
    return reply.send({ copyVariants: variants.map((v) => ({ ...v, generation: byId.get(v.generationId) ?? null })) });
  });

  // --- Creative Package (spec sections 53-55) — human approval workflow ------

  const packageAssembleSchema = z.object({
    angleId: z.string().optional(),
    hookId: z.string().optional(),
    scriptId: z.string().optional(),
    storyboardId: z.string().optional(),
    characterProfileId: z.string().optional(),
    copyVariantIds: z.array(z.string()).optional(),
  });

  app.post("/api/campaigns/:id/packages", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = packageAssembleSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid package.", details: parsed.error.flatten() });

    const pkg = await db.creativePackage.create({
      data: {
        packageDisplayId: await generateCreativePackageDisplayId(),
        campaignId: id,
        studentId: campaign.studentId,
        businessId: campaign.businessId,
        angleId: parsed.data.angleId ?? null,
        hookId: parsed.data.hookId ?? null,
        scriptId: parsed.data.scriptId ?? null,
        storyboardId: parsed.data.storyboardId ?? null,
        characterProfileId: parsed.data.characterProfileId ?? null,
        copyVariantIdsJson: (parsed.data.copyVariantIds ?? []) as unknown as Prisma.InputJsonValue,
        status: "DRAFT",
        version: 1,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Creative Package Assembled", summary: `Creative package assembled for campaign "${campaign.name}"`, actorUserId: request.authContext!.userId, entityType: "CreativePackage", entityId: pkg.id });
    return reply.code(201).send({ creativePackage: pkg });
  });

  app.get("/api/campaigns/:id/packages", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const packages = await db.creativePackage.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ creativePackages: packages });
  });

  // Student may submit DRAFT -> FOR_REVIEW; only staff holding VERIFY may approve/request revision (human approval — never AI auto-publish, spec section 53).
  app.post("/api/creative-packages/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pkg = await db.creativePackage.findUnique({ where: { id } });
    if (!pkg) return reply.code(404).send({ error: "Creative package not found." });
    const parsed = z.object({ status: z.enum(PACKAGE_STATUSES), reviewNotes: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });

    const ctx = request.authContext!;
    const studentAllowedTransition = pkg.status === "DRAFT" && parsed.data.status === "FOR_REVIEW";
    if (ctx.kind === "student") {
      if (ctx.studentId !== pkg.studentId) return reply.code(403).send({ error: "Forbidden." });
      if (!studentAllowedTransition) return reply.code(403).send({ error: "Only staff may approve, reject, or request revision on a creative package." });
    } else {
      const allowed = await checkPermission(ctx.userId, "Creative Studio", "VERIFY");
      if (!allowed) return reply.code(403).send({ error: "Forbidden: requires Creative Studio / VERIFY." });
    }

    const updated = await db.creativePackage.update({
      where: { id },
      data: { status: parsed.data.status, reviewNotes: parsed.data.reviewNotes ?? pkg.reviewNotes, reviewedById: ctx.kind === "staff" ? ctx.userId : pkg.reviewedById, reviewedAt: ctx.kind === "staff" ? new Date() : pkg.reviewedAt },
    });
    await writeAuditLog({ action: "Creative Package Status Changed", summary: `Creative package status changed ${pkg.status} -> ${parsed.data.status}`, actorUserId: ctx.userId, entityType: "CreativePackage", entityId: id });
    return reply.send({ creativePackage: updated });
  });

  // A revision is always a NEW package row referencing the one it supersedes — never an in-place overwrite of an approved package (spec section 55).
  app.post("/api/creative-packages/:id/revise", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pkg = await db.creativePackage.findUnique({ where: { id } });
    if (!pkg) return reply.code(404).send({ error: "Creative package not found." });
    if (!campaignAccessible(request, pkg)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = packageAssembleSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid package.", details: parsed.error.flatten() });

    const revised = await db.creativePackage.create({
      data: {
        packageDisplayId: await generateCreativePackageDisplayId(),
        campaignId: pkg.campaignId,
        studentId: pkg.studentId,
        businessId: pkg.businessId,
        angleId: parsed.data.angleId ?? pkg.angleId,
        hookId: parsed.data.hookId ?? pkg.hookId,
        scriptId: parsed.data.scriptId ?? pkg.scriptId,
        storyboardId: parsed.data.storyboardId ?? pkg.storyboardId,
        characterProfileId: parsed.data.characterProfileId ?? pkg.characterProfileId,
        copyVariantIdsJson: (parsed.data.copyVariantIds ?? (pkg.copyVariantIdsJson as unknown as string[])) as unknown as Prisma.InputJsonValue,
        status: "DRAFT",
        version: pkg.version + 1,
        supersedesId: pkg.id,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Creative Package Assembled", summary: `Creative package revised (v${revised.version}, supersedes ${pkg.id})`, actorUserId: request.authContext!.userId, entityType: "CreativePackage", entityId: revised.id });
    return reply.code(201).send({ creativePackage: revised });
  });

  // --- Creative Testing (spec sections 57-59) — metrics are NEVER invented ---

  const testCreateSchema = z.object({
    creativePackageId: z.string().optional(),
    angleLabel: z.string().optional(),
    hookLabel: z.string().optional(),
    format: z.string().optional(),
    platform: z.string().optional(),
    startDate: z.string().datetime().optional(),
  });

  app.post("/api/campaigns/:id/tests", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = testCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid test.", details: parsed.error.flatten() });

    const test = await db.creativeTest.create({
      data: {
        campaignId: id,
        studentId: campaign.studentId,
        businessId: campaign.businessId,
        creativePackageId: parsed.data.creativePackageId ?? null,
        angleLabel: parsed.data.angleLabel ?? null,
        hookLabel: parsed.data.hookLabel ?? null,
        format: parsed.data.format ?? null,
        platform: parsed.data.platform ?? null,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        status: "Planned",
      },
    });
    await writeAuditLog({ action: "Creative Test Created", summary: `Creative test created for campaign "${campaign.name}"`, actorUserId: request.authContext!.userId, entityType: "CreativeTest", entityId: test.id });
    return reply.code(201).send({ creativeTest: test });
  });

  app.get("/api/campaigns/:id/tests", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!campaignAccessible(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const tests = await db.creativeTest.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ creativeTests: tests });
  });

  const metricsSchema = z.object({
    status: z.enum(["Planned", "Running", "Completed", "Paused"]).optional(),
    spend: z.number().nonnegative().optional(),
    impressions: z.number().int().nonnegative().optional(),
    reach: z.number().int().nonnegative().optional(),
    ctr: z.number().nonnegative().optional(),
    cpc: z.number().nonnegative().optional(),
    cpm: z.number().nonnegative().optional(),
    leads: z.number().int().nonnegative().optional(),
    costPerLead: z.number().nonnegative().optional(),
    messages: z.number().int().nonnegative().optional(),
    costPerConversation: z.number().nonnegative().optional(),
    purchases: z.number().int().nonnegative().optional(),
    revenue: z.number().nonnegative().optional(),
    roas: z.number().nonnegative().optional(),
    notes: z.string().optional(),
  });

  // Staff-entered only (manual or a future real ads-platform connector — never AI-invented, spec section 57).
  app.patch("/api/creative-tests/:id/metrics", { preHandler: [requireAuth, requirePermission("Creative Studio", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const test = await db.creativeTest.findUnique({ where: { id } });
    if (!test) return reply.code(404).send({ error: "Creative test not found." });
    const parsed = metricsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid metrics.", details: parsed.error.flatten() });

    const updated = await db.creativeTest.update({ where: { id }, data: parsed.data });
    await writeAuditLog({ action: "Creative Test Metrics Updated", summary: `Metrics updated for creative test ${id}`, actorUserId: request.authContext!.userId, entityType: "CreativeTest", entityId: id });
    return reply.send({ creativeTest: updated });
  });

  // Analyzer strictly reads ONLY the metric fields actually stored on this row — never estimates a missing one (spec section 58).
  app.post("/api/creative-tests/:id/analyze", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const test = await db.creativeTest.findUnique({ where: { id } });
    if (!test) return reply.code(404).send({ error: "Creative test not found." });
    if (!campaignAccessible(request, test)) return reply.code(403).send({ error: "Forbidden." });

    const suppliedMetrics = {
      spend: test.spend?.toString() ?? "UNKNOWN",
      impressions: test.impressions ?? "UNKNOWN",
      reach: test.reach ?? "UNKNOWN",
      ctr: test.ctr?.toString() ?? "UNKNOWN",
      cpc: test.cpc?.toString() ?? "UNKNOWN",
      cpm: test.cpm?.toString() ?? "UNKNOWN",
      leads: test.leads ?? "UNKNOWN",
      costPerLead: test.costPerLead?.toString() ?? "UNKNOWN",
      messages: test.messages ?? "UNKNOWN",
      costPerConversation: test.costPerConversation?.toString() ?? "UNKNOWN",
      purchases: test.purchases ?? "UNKNOWN",
      revenue: test.revenue?.toString() ?? "UNKNOWN",
      roas: test.roas?.toString() ?? "UNKNOWN",
    };
    const userRequest = `CREATIVE TEST (angle: ${test.angleLabel ?? "n/a"}, hook: ${test.hookLabel ?? "n/a"}, format: ${test.format ?? "n/a"}, platform: ${test.platform ?? "n/a"}, status: ${test.status}).\nSUPPLIED METRICS (JSON — any "UNKNOWN" value was never entered and must not be estimated):\n${JSON.stringify(suppliedMetrics)}`;

    const outcome = await runToolGeneration({ studentId: test.studentId, businessId: test.businessId, toolKey: "creative-analyzer", userRequest, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    const generation = await db.aiGeneration.findUniqueOrThrow({ where: { id: outcome.generationId } });
    return reply.code(201).send({ generation });
  });

  // --- Inspiration Library (spec sections 21-22) — never fake reference analysis

  const inspirationCreateSchema = z.object({
    referenceType: z.enum(["Image", "Video", "Ad", "UGC", "Screenshot", "Text", "Link"]),
    title: z.string().optional(),
    url: z.string().optional(),
    documentId: z.string().optional(),
    notes: z.string().optional(),
  });

  app.post("/api/businesses/:businessId/inspiration-references", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
    const parsed = inspirationCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid inspiration reference.", details: parsed.error.flatten() });

    const reference = await db.inspirationReference.create({
      data: {
        businessId,
        studentId: business.studentId,
        referenceType: parsed.data.referenceType,
        title: parsed.data.title ?? null,
        url: parsed.data.url ?? null,
        documentId: parsed.data.documentId ?? null,
        notes: parsed.data.notes ?? null,
        createdById: request.authContext!.userId,
      },
    });
    return reply.code(201).send({ inspirationReference: reference });
  });

  app.get("/api/businesses/:businessId/inspiration-references", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const references = await db.inspirationReference.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ inspirationReferences: references });
  });

  // --- Admin oversight read (spec section 88 baseline) ------------------------

  app.get("/api/creative-studio/campaigns", { preHandler: [requireAuth, requirePermission("Creative Studio", "VIEW")] }, async (request, reply) => {
    const { studentId, businessId, status } = request.query as { studentId?: string; businessId?: string; status?: string };
    const campaigns = await db.campaign.findMany({ where: { studentId: studentId || undefined, businessId: businessId || undefined, status: status || undefined }, orderBy: { createdAt: "desc" }, take: 200 });
    return reply.send({ campaigns });
  });
}

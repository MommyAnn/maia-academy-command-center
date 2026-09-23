// M.A.I.A. Website & Funnel Studio routes (Phase 13 spec sections 1-7,
// 28-39, 59-70). Every route enforces the same real server-side ownership/
// permission rules as every other module — a Student session only ever
// reaches their own Offers/WebsiteProjects/Funnels/Pages/Forms; a tampered
// id resolves to 403/404, never a cross-business leak. PUBLISHED only ever
// means the page is actually servable through this server's own real
// public read endpoint below — never a claim of external deployment.

import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission, assertBusinessOwnedByStudent } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateOfferDisplayId, generateWebsiteDisplayId, generateFunnelDisplayId, generatePageDisplayId, generateFormDisplayId } from "../sequence.js";
import { sectionsArraySchema, WEBSITE_TYPES, WEBSITE_STATUSES, FUNNEL_TYPES, FORM_TYPES, isSafeSlug, type PageSection } from "./sections.js";
import { validatePageForPublish } from "./validator.js";
import { generateWebsiteStructure, generateFunnelStrategy } from "./architect.js";
import { generateSectionCopy, applySectionCopyVariant, type CopyAction } from "./copy.js";
import { submitForm } from "./forms.js";

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

export async function websiteFunnelStudioRoutes(app: FastifyInstance) {
  // --- Offers (spec sections 26-27) ---------------------------------------

  const offerCreateSchema = z.object({ businessId: z.string().min(1), name: z.string().min(1), description: z.string().optional(), price: z.number().nonnegative().optional(), currency: z.string().optional(), details: z.array(z.string()).optional() });

  app.post("/api/students/:studentId/offers", { preHandler: [requireAuth, requireStudentSelfOrPermission("Website & Funnel Studio", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = offerCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid offer.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const offer = await db.offer.create({
      data: {
        offerDisplayId: await generateOfferDisplayId(),
        studentId,
        businessId: parsed.data.businessId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        price: parsed.data.price ?? null,
        currency: parsed.data.currency ?? "PHP",
        detailsJson: (parsed.data.details ?? []) as unknown as Prisma.InputJsonValue,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Offer Created", summary: `Offer "${offer.name}" created`, actorUserId: request.authContext!.userId, entityType: "Offer", entityId: offer.id });
    return reply.code(201).send({ offer });
  });

  app.get("/api/businesses/:businessId/offers", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const offers = await db.offer.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ offers });
  });

  app.get("/api/offers/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const offer = await db.offer.findUnique({ where: { id } });
    if (!offer) return reply.code(404).send({ error: "Offer not found." });
    if (!ownedByRequester(request, offer)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ offer });
  });

  app.post("/api/offers/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const offer = await db.offer.findUnique({ where: { id } });
    if (!offer) return reply.code(404).send({ error: "Offer not found." });
    if (!ownedByRequester(request, offer)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.enum(["DRAFT", "APPROVED", "ARCHIVED"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });
    const updated = await db.offer.update({ where: { id }, data: { status: parsed.data.status } });
    return reply.send({ offer: updated });
  });

  // --- Website Projects (spec sections 4-6) -------------------------------

  const websiteCreateSchema = z.object({
    businessId: z.string().min(1),
    name: z.string().min(1),
    purpose: z.string().optional(),
    type: z.enum(WEBSITE_TYPES),
    primaryAudience: z.string().optional(),
    primaryCta: z.string().optional(),
    journeyId: z.string().optional(),
    campaignId: z.string().optional(),
    offerId: z.string().optional(),
    creativePackageId: z.string().optional(),
    automationId: z.string().optional(),
  });

  app.post("/api/students/:studentId/website-projects", { preHandler: [requireAuth, requireStudentSelfOrPermission("Website & Funnel Studio", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = websiteCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid website project.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    if (parsed.data.offerId) {
      const offer = await db.offer.findUnique({ where: { id: parsed.data.offerId } });
      if (!offer || offer.businessId !== parsed.data.businessId) return reply.code(403).send({ error: "This offer does not belong to this business." });
    }

    const publishedDoc = await db.masterBrainDocument.findFirst({ where: { businessId: parsed.data.businessId, isCurrentPublished: true } });
    const project = await db.websiteProject.create({
      data: {
        websiteDisplayId: await generateWebsiteDisplayId(),
        studentId,
        businessId: parsed.data.businessId,
        name: parsed.data.name,
        purpose: parsed.data.purpose ?? null,
        type: parsed.data.type,
        primaryAudience: parsed.data.primaryAudience ?? null,
        primaryCta: parsed.data.primaryCta ?? null,
        masterBrainVersionAtCreation: publishedDoc?.documentVersion ?? null,
        journeyId: parsed.data.journeyId ?? null,
        campaignId: parsed.data.campaignId ?? null,
        offerId: parsed.data.offerId ?? null,
        creativePackageId: parsed.data.creativePackageId ?? null,
        automationId: parsed.data.automationId ?? null,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Website Project Created", summary: `Website project "${project.name}" created`, actorUserId: request.authContext!.userId, entityType: "WebsiteProject", entityId: project.id });
    return reply.code(201).send({ websiteProject: project });
  });

  app.get("/api/businesses/:businessId/website-projects", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const projects = await db.websiteProject.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ websiteProjects: projects });
  });

  app.get("/api/website-projects/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await db.websiteProject.findUnique({ where: { id }, include: { pages: true, domains: true, tracking: true } });
    if (!project) return reply.code(404).send({ error: "Website project not found." });
    if (!ownedByRequester(request, project)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ websiteProject: project });
  });

  app.post("/api/website-projects/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await db.websiteProject.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Website project not found." });
    if (!ownedByRequester(request, project)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.enum(WEBSITE_STATUSES) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });
    const updated = await db.websiteProject.update({ where: { id }, data: { status: parsed.data.status } });
    return reply.send({ websiteProject: updated });
  });

  // Website Architect (spec sections 12-14)
  app.post("/api/website-projects/:id/architect/generate", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await db.websiteProject.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Website project not found." });
    if (!ownedByRequester(request, project)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ objective: z.string().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const outcome = await generateWebsiteStructure({ studentId: project.studentId, businessId: project.businessId, websiteProjectId: id, websiteType: project.type, objective: parsed.data.objective, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    const page = await db.websitePage.findUniqueOrThrow({ where: { id: outcome.data.pageId } });
    return reply.code(201).send({ generationId: outcome.generationId, page });
  });

  // --- Pages (spec sections 13-16, 63-64) ---------------------------------

  const pageCreateSchema = z.object({ name: z.string().min(1), slug: z.string().min(1).refine(isSafeSlug, "Invalid slug — use lowercase letters, numbers, and hyphens only."), sections: sectionsArraySchema, seo: z.object({ title: z.string().optional(), metaDescription: z.string().optional(), canonicalUrl: z.string().optional(), ogImage: z.string().optional(), indexable: z.boolean().optional() }).optional() });

  app.post("/api/website-projects/:id/pages", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await db.websiteProject.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Website project not found." });
    if (!ownedByRequester(request, project)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = pageCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid page.", details: parsed.error.flatten() });

    const existing = await db.websitePage.findUnique({ where: { websiteProjectId_slug: { websiteProjectId: id, slug: parsed.data.slug } } });
    if (existing) return reply.code(409).send({ error: "A page with this slug already exists in this project." });

    const page = await db.websitePage.create({
      data: {
        pageDisplayId: await generatePageDisplayId(),
        websiteProjectId: id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        sectionsJson: parsed.data.sections as unknown as Prisma.InputJsonValue,
        seoJson: (parsed.data.seo as unknown as Prisma.InputJsonValue) ?? undefined,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Website Page Created", summary: `Page "${page.name}" created`, actorUserId: request.authContext!.userId, entityType: "WebsitePage", entityId: page.id });
    return reply.code(201).send({ page });
  });

  app.get("/api/website-projects/:id/pages", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await db.websiteProject.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Website project not found." });
    if (!ownedByRequester(request, project)) return reply.code(403).send({ error: "Forbidden." });
    const pages = await db.websitePage.findMany({ where: { websiteProjectId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ pages });
  });

  app.get("/api/pages/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const page = await db.websitePage.findUnique({ where: { id }, include: { websiteProject: true, forms: true } });
    if (!page) return reply.code(404).send({ error: "Page not found." });
    if (!ownedByRequester(request, page.websiteProject)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ page });
  });

  app.patch("/api/pages/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const page = await db.websitePage.findUnique({ where: { id }, include: { websiteProject: true } });
    if (!page) return reply.code(404).send({ error: "Page not found." });
    if (!ownedByRequester(request, page.websiteProject)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = pageCreateSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    if (parsed.data.slug && parsed.data.slug !== page.slug) {
      const existing = await db.websitePage.findUnique({ where: { websiteProjectId_slug: { websiteProjectId: page.websiteProjectId, slug: parsed.data.slug } } });
      if (existing) return reply.code(409).send({ error: "A page with this slug already exists in this project." });
    }

    const updated = await db.websitePage.update({
      where: { id },
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        sectionsJson: parsed.data.sections ? (parsed.data.sections as unknown as Prisma.InputJsonValue) : undefined,
        seoJson: parsed.data.seo ? (parsed.data.seo as unknown as Prisma.InputJsonValue) : undefined,
        version: { increment: 1 },
      },
    });
    return reply.send({ page: updated });
  });

  app.post("/api/pages/:id/validate", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const page = await db.websitePage.findUnique({ where: { id }, include: { websiteProject: true } });
    if (!page) return reply.code(404).send({ error: "Page not found." });
    if (!ownedByRequester(request, page.websiteProject)) return reply.code(403).send({ error: "Forbidden." });
    const validation = await validatePageForPublish(page);
    return reply.send({ validation });
  });

  app.post("/api/pages/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const page = await db.websitePage.findUnique({ where: { id }, include: { websiteProject: true } });
    if (!page) return reply.code(404).send({ error: "Page not found." });
    const parsed = z.object({ status: z.enum(["DRAFT", "GENERATING", "FOR_REVIEW", "REVISION_REQUESTED", "APPROVED", "READY_TO_PUBLISH", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });

    const ctx = request.authContext!;
    const isHumanApprovalTransition = ["APPROVED", "PUBLISHED"].includes(parsed.data.status);
    if (ctx.kind === "student") {
      if (ctx.studentId !== page.websiteProject.studentId) return reply.code(403).send({ error: "Forbidden." });
      if (isHumanApprovalTransition) return reply.code(403).send({ error: "Only staff may approve or publish a page." });
    } else {
      const { checkPermission } = await import("../../rbac/middleware.js");
      if (isHumanApprovalTransition && !(await checkPermission(ctx.userId, "Website & Funnel Studio", "VERIFY"))) {
        return reply.code(403).send({ error: "Forbidden: requires Website & Funnel Studio / VERIFY." });
      }
    }

    if (parsed.data.status === "PUBLISHED") {
      const validation = await validatePageForPublish(page);
      if (validation.blocking) return reply.code(422).send({ error: "This page has blocking validation issues and cannot be published.", validation });

      const maxVersion = await db.pageVersion.aggregate({ where: { pageId: id }, _max: { versionNumber: true } });
      const versionNumber = (maxVersion._max.versionNumber ?? 0) + 1;
      await db.pageVersion.create({
        data: { pageId: id, versionNumber, sectionsJson: page.sectionsJson as Prisma.InputJsonValue, seoJson: (page.seoJson as Prisma.InputJsonValue) ?? undefined, validationJson: validation as unknown as Prisma.InputJsonValue, publishedAt: new Date(), createdById: ctx.userId },
      });
      const updated = await db.websitePage.update({ where: { id }, data: { status: "PUBLISHED", publishedSnapshotJson: { sections: page.sectionsJson, seo: page.seoJson } as unknown as Prisma.InputJsonValue, publishedAt: new Date(), version: versionNumber } });
      await writeAuditLog({ action: "Website Published", summary: `Page "${page.name}" published (v${versionNumber})`, actorUserId: ctx.userId, entityType: "WebsitePage", entityId: id });
      return reply.send({ page: updated });
    }

    if (parsed.data.status === "UNPUBLISHED" && page.status === "PUBLISHED") {
      await writeAuditLog({ action: "Website Unpublished", summary: `Page "${page.name}" unpublished`, actorUserId: ctx.userId, entityType: "WebsitePage", entityId: id });
    }

    const updated = await db.websitePage.update({ where: { id }, data: { status: parsed.data.status } });
    return reply.send({ page: updated });
  });

  app.get("/api/pages/:id/versions", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const page = await db.websitePage.findUnique({ where: { id }, include: { websiteProject: true } });
    if (!page) return reply.code(404).send({ error: "Page not found." });
    if (!ownedByRequester(request, page.websiteProject)) return reply.code(403).send({ error: "Forbidden." });
    const versions = await db.pageVersion.findMany({ where: { pageId: id }, orderBy: { versionNumber: "desc" } });
    return reply.send({ versions });
  });

  // Rollback restores a prior version's content into the DRAFT working copy — it does not itself republish (spec section 85).
  app.post("/api/pages/:id/rollback", { preHandler: [requireAuth, requirePermission("Website & Funnel Studio", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const page = await db.websitePage.findUnique({ where: { id } });
    if (!page) return reply.code(404).send({ error: "Page not found." });
    const parsed = z.object({ versionNumber: z.number().int().positive() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const version = await db.pageVersion.findUnique({ where: { pageId_versionNumber: { pageId: id, versionNumber: parsed.data.versionNumber } } });
    if (!version) return reply.code(404).send({ error: "Version not found." });

    const updated = await db.websitePage.update({ where: { id }, data: { sectionsJson: version.sectionsJson as Prisma.InputJsonValue, seoJson: (version.seoJson as Prisma.InputJsonValue) ?? undefined, status: "DRAFT" } });
    await writeAuditLog({ action: "Website Rolled Back", summary: `Page "${page.name}" rolled back to v${parsed.data.versionNumber}`, actorUserId: request.authContext!.userId, entityType: "WebsitePage", entityId: id });
    return reply.send({ page: updated });
  });

  // --- Copy Studio (spec sections 19-21) ----------------------------------

  app.post("/api/pages/:id/sections/:sectionId/copy/generate", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id, sectionId } = request.params as { id: string; sectionId: string };
    const page = await db.websitePage.findUnique({ where: { id }, include: { websiteProject: true } });
    if (!page) return reply.code(404).send({ error: "Page not found." });
    if (!ownedByRequester(request, page.websiteProject)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ action: z.enum(["Generate", "Regenerate", "Shorten", "Expand", "ChangeTone", "Variation"]), tone: z.string().optional(), instructions: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const outcome = await generateSectionCopy({ studentId: page.websiteProject.studentId, businessId: page.websiteProject.businessId, pageId: id, sectionId, action: parsed.data.action as CopyAction, tone: parsed.data.tone, instructions: parsed.data.instructions, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus ?? 500).send({ error: outcome.reason });
    return reply.code(201).send(outcome);
  });

  app.post("/api/pages/:id/copy-variants/:variantId/apply", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id, variantId } = request.params as { id: string; variantId: string };
    const page = await db.websitePage.findUnique({ where: { id }, include: { websiteProject: true } });
    if (!page) return reply.code(404).send({ error: "Page not found." });
    if (!ownedByRequester(request, page.websiteProject)) return reply.code(403).send({ error: "Forbidden." });

    const outcome = await applySectionCopyVariant({ studentId: page.websiteProject.studentId, businessId: page.websiteProject.businessId, pageId: id, variantId, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus ?? 500).send({ error: outcome.reason });
    return reply.send(outcome);
  });

  // --- Funnels (spec sections 7-11) ---------------------------------------

  const funnelCreateSchema = z.object({ businessId: z.string().min(1), name: z.string().min(1), objective: z.string().optional(), audience: z.string().optional(), offerId: z.string().optional(), trafficSource: z.string().optional(), type: z.enum(FUNNEL_TYPES), stages: z.array(z.object({ stageName: z.string().min(1), purpose: z.string().optional(), touchpoint: z.string().optional(), ctaType: z.string().optional(), pageId: z.string().optional(), automationId: z.string().optional() })).default([]), journeyId: z.string().optional(), campaignId: z.string().optional() });

  app.post("/api/students/:studentId/funnels", { preHandler: [requireAuth, requireStudentSelfOrPermission("Website & Funnel Studio", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = funnelCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid funnel.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const publishedDoc = await db.masterBrainDocument.findFirst({ where: { businessId: parsed.data.businessId, isCurrentPublished: true } });
    const funnel = await db.funnel.create({
      data: {
        funnelDisplayId: await generateFunnelDisplayId(),
        studentId,
        businessId: parsed.data.businessId,
        name: parsed.data.name,
        objective: parsed.data.objective ?? null,
        audience: parsed.data.audience ?? null,
        offerId: parsed.data.offerId ?? null,
        trafficSource: parsed.data.trafficSource ?? null,
        type: parsed.data.type,
        stagesJson: parsed.data.stages as unknown as Prisma.InputJsonValue,
        masterBrainVersionAtCreation: publishedDoc?.documentVersion ?? null,
        journeyId: parsed.data.journeyId ?? null,
        campaignId: parsed.data.campaignId ?? null,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Funnel Created", summary: `Funnel "${funnel.name}" created`, actorUserId: request.authContext!.userId, entityType: "Funnel", entityId: funnel.id });
    return reply.code(201).send({ funnel });
  });

  app.post("/api/students/:studentId/funnels/architect", { preHandler: [requireAuth, requireStudentSelfOrPermission("Website & Funnel Studio", "CREATE")], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = z.object({ businessId: z.string().min(1), funnelType: z.enum(FUNNEL_TYPES), description: z.string().optional(), journeyId: z.string().optional(), campaignId: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const outcome = await generateFunnelStrategy({ studentId, businessId: parsed.data.businessId, funnelType: parsed.data.funnelType, description: parsed.data.description, journeyId: parsed.data.journeyId, campaignId: parsed.data.campaignId, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    const funnel = await db.funnel.findUniqueOrThrow({ where: { id: outcome.data.funnelId } });
    return reply.code(201).send({ generationId: outcome.generationId, funnel });
  });

  app.get("/api/businesses/:businessId/funnels", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const funnels = await db.funnel.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ funnels });
  });

  app.get("/api/funnels/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const funnel = await db.funnel.findUnique({ where: { id } });
    if (!funnel) return reply.code(404).send({ error: "Funnel not found." });
    if (!ownedByRequester(request, funnel)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ funnel });
  });

  app.patch("/api/funnels/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const funnel = await db.funnel.findUnique({ where: { id } });
    if (!funnel) return reply.code(404).send({ error: "Funnel not found." });
    if (!ownedByRequester(request, funnel)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = funnelCreateSchema.omit({ businessId: true, type: true }).partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });
    const { stages, ...rest } = parsed.data;
    const updated = await db.funnel.update({ where: { id }, data: { ...rest, stagesJson: stages ? (stages as unknown as Prisma.InputJsonValue) : undefined } });
    return reply.send({ funnel: updated });
  });

  app.post("/api/funnels/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const funnel = await db.funnel.findUnique({ where: { id } });
    if (!funnel) return reply.code(404).send({ error: "Funnel not found." });
    if (!ownedByRequester(request, funnel)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.enum(["DRAFT", "FOR_REVIEW", "APPROVED", "ACTIVE", "PAUSED", "ARCHIVED"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });
    const updated = await db.funnel.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAuditLog({ action: "Funnel Status Changed", summary: `Funnel "${funnel.name}" status changed ${funnel.status} -> ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "Funnel", entityId: id });
    return reply.send({ funnel: updated });
  });

  // --- Forms (spec sections 31-38) ----------------------------------------

  const formFieldSchema = z.object({ key: z.string().min(1), label: z.string().min(1), fieldType: z.string().min(1), required: z.boolean(), options: z.array(z.string()).optional() });
  const formCreateSchema = z.object({ businessId: z.string().min(1), pageId: z.string().optional(), name: z.string().min(1), type: z.enum(FORM_TYPES), fields: z.array(formFieldSchema).min(1), consentConfig: z.record(z.string(), z.unknown()).optional(), destinationConfig: z.record(z.string(), z.unknown()).optional(), thankYouPageId: z.string().optional() });

  app.post("/api/businesses/:businessId/forms", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const parsed = formCreateSchema.omit({ businessId: true }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid form.", details: parsed.error.flatten() });

    const form = await db.webForm.create({
      data: {
        formDisplayId: await generateFormDisplayId(),
        businessId,
        pageId: parsed.data.pageId ?? null,
        name: parsed.data.name,
        type: parsed.data.type,
        fieldsJson: parsed.data.fields as unknown as Prisma.InputJsonValue,
        consentConfigJson: (parsed.data.consentConfig as unknown as Prisma.InputJsonValue) ?? undefined,
        destinationConfigJson: (parsed.data.destinationConfig as unknown as Prisma.InputJsonValue) ?? undefined,
        thankYouPageId: parsed.data.thankYouPageId ?? null,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Form Created", summary: `Form "${form.name}" created`, actorUserId: request.authContext!.userId, entityType: "WebForm", entityId: form.id });
    return reply.code(201).send({ form });
  });

  app.get("/api/businesses/:businessId/forms", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const forms = await db.webForm.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ forms });
  });

  app.get("/api/forms/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const form = await db.webForm.findUnique({ where: { id } });
    if (!form) return reply.code(404).send({ error: "Form not found." });
    if (!(await assertBusinessAccessible(request, form.businessId))) return reply.code(403).send({ error: "Forbidden." });
    const submissions = await db.formSubmission.findMany({ where: { formId: id }, orderBy: { submittedAt: "desc" }, take: 200 });
    return reply.send({ form, submissions });
  });

  app.patch("/api/forms/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const form = await db.webForm.findUnique({ where: { id } });
    if (!form) return reply.code(404).send({ error: "Form not found." });
    if (!(await assertBusinessAccessible(request, form.businessId))) return reply.code(403).send({ error: "Forbidden." });
    const parsed = formCreateSchema.omit({ businessId: true, type: true }).partial().extend({ status: z.enum(["Draft", "Active", "Archived"]).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const destinationChanged = parsed.data.destinationConfig !== undefined;
    const { fields, consentConfig, destinationConfig, ...rest } = parsed.data;
    const updated = await db.webForm.update({
      where: { id },
      data: { ...rest, fieldsJson: fields ? (fields as unknown as Prisma.InputJsonValue) : undefined, consentConfigJson: consentConfig ? (consentConfig as unknown as Prisma.InputJsonValue) : undefined, destinationConfigJson: destinationConfig ? (destinationConfig as unknown as Prisma.InputJsonValue) : undefined },
    });
    if (destinationChanged) {
      await writeAuditLog({ action: "Form Destination Changed", summary: `Form "${form.name}" destination changed`, actorUserId: request.authContext!.userId, entityType: "WebForm", entityId: id });
    }
    return reply.send({ form: updated });
  });

  // Public, unauthenticated submission (spec sections 33, 38) — rate-limited against abuse, same convention as /api/webinar/register.
  app.post("/api/public/forms/:id/submit", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({ data: z.record(z.string(), z.unknown()), honeypot: z.string().optional(), utmSource: z.string().optional(), utmMedium: z.string().optional(), utmCampaign: z.string().optional(), utmContent: z.string().optional(), utmTerm: z.string().optional(), landingPage: z.string().optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid submission.", details: parsed.error.flatten() });

    const outcome = await submitForm({ formId: id, ...parsed.data });
    if (!outcome.ok) return reply.code(outcome.httpStatus ?? 500).send({ error: outcome.reason });
    return reply.code(201).send({ submissionId: outcome.submissionId, thankYouPageId: outcome.thankYouPageId });
  });

  // --- Domains (spec sections 59-62) --------------------------------------

  app.post("/api/website-projects/:id/domains", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await db.websiteProject.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Website project not found." });
    if (!ownedByRequester(request, project)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ domain: z.string().min(3) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid domain.", details: parsed.error.flatten() });

    // No real DNS/registrar API integration exists — this always stays at
    // PENDING_CONFIGURATION with exact instructions for a human to act on
    // manually (spec sections 60-61).
    const domain = await db.websiteDomain.create({
      data: {
        websiteProjectId: id,
        domain: parsed.data.domain,
        status: "PENDING_CONFIGURATION",
        dnsInstructionsJson: {
          records: [
            { type: "CNAME", host: parsed.data.domain, value: "pending-real-hosting-provider.example", note: "Placeholder — no real hosting/DNS provider is connected in this build." },
          ],
        } as unknown as Prisma.InputJsonValue,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Domain Configuration Changed", summary: `Domain "${domain.domain}" added to project`, actorUserId: request.authContext!.userId, entityType: "WebsiteDomain", entityId: domain.id });
    return reply.code(201).send({ domain });
  });

  app.get("/api/website-projects/:id/domains", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await db.websiteProject.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Website project not found." });
    if (!ownedByRequester(request, project)) return reply.code(403).send({ error: "Forbidden." });
    const domains = await db.websiteDomain.findMany({ where: { websiteProjectId: id } });
    return reply.send({ domains });
  });

  // --- Tracking (spec sections 73, 76-78) ---------------------------------

  app.get("/api/website-projects/:id/tracking", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await db.websiteProject.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Website project not found." });
    if (!ownedByRequester(request, project)) return reply.code(403).send({ error: "Forbidden." });
    const tracking = await db.trackingConfig.findUnique({ where: { websiteProjectId: id } });
    return reply.send({ tracking });
  });

  app.patch("/api/website-projects/:id/tracking", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await db.websiteProject.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Website project not found." });
    if (!ownedByRequester(request, project)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ metaPixelId: z.string().optional(), googleAnalyticsId: z.string().optional(), consentRequired: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid tracking config.", details: parsed.error.flatten() });

    const tracking = await db.trackingConfig.upsert({
      where: { websiteProjectId: id },
      update: {
        metaPixelId: parsed.data.metaPixelId,
        metaPixelStatus: parsed.data.metaPixelId ? "CONFIGURED" : "NOT_CONNECTED",
        googleAnalyticsId: parsed.data.googleAnalyticsId,
        googleAnalyticsStatus: parsed.data.googleAnalyticsId ? "CONFIGURED" : "NOT_CONNECTED",
        consentRequired: parsed.data.consentRequired,
        updatedById: request.authContext!.userId,
      },
      create: {
        websiteProjectId: id,
        metaPixelId: parsed.data.metaPixelId ?? null,
        metaPixelStatus: parsed.data.metaPixelId ? "CONFIGURED" : "NOT_CONNECTED",
        googleAnalyticsId: parsed.data.googleAnalyticsId ?? null,
        googleAnalyticsStatus: parsed.data.googleAnalyticsId ? "CONFIGURED" : "NOT_CONNECTED",
        consentRequired: parsed.data.consentRequired ?? true,
        updatedById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Tracking Configuration Changed", summary: `Tracking configuration changed for "${project.name}"`, actorUserId: request.authContext!.userId, entityType: "TrackingConfig", entityId: tracking.id });
    return reply.send({ tracking });
  });

  // --- Analytics (spec sections 79-82) — real events only, never fabricated.

  app.get("/api/website-projects/:id/analytics", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await db.websiteProject.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Website project not found." });
    if (!ownedByRequester(request, project)) return reply.code(403).send({ error: "Forbidden." });
    const { since, until } = request.query as { since?: string; until?: string };
    const range = { gte: since ? new Date(since) : undefined, lte: until ? new Date(until) : undefined };

    const counts = await db.websiteAnalyticsEvent.groupBy({ by: ["eventName"], where: { websiteProjectId: id, occurredAt: range }, _count: { _all: true } });
    const byEvent = Object.fromEntries(counts.map((c) => [c.eventName, c._count._all]));
    const pageViews = byEvent.PAGE_VIEW ?? 0;
    const formSubmits = byEvent.FORM_SUBMIT ?? 0;
    // Conversion rate only calculated when both numerator and denominator are valid (spec section 80) — never a divide-by-zero fabrication.
    const conversionRate = pageViews > 0 ? formSubmits / pageViews : null;

    return reply.send({ byEvent, conversionRate, dateRange: { since: since ?? null, until: until ?? null } });
  });

  // --- Public serve + real analytics recording (spec sections 63-64, 79) --

  app.get("/api/public/pages/:websiteProjectId/:slug", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { websiteProjectId, slug } = request.params as { websiteProjectId: string; slug: string };
    const { utm_source, utm_medium, utm_campaign, utm_content, utm_term } = request.query as Record<string, string | undefined>;
    const page = await db.websitePage.findUnique({ where: { websiteProjectId_slug: { websiteProjectId, slug } } });
    if (!page || page.status !== "PUBLISHED" || !page.publishedSnapshotJson) {
      return reply.code(404).send({ error: "Page not found." });
    }

    await db.websiteAnalyticsEvent.create({
      data: { websiteProjectId, pageId: page.id, eventName: "PAGE_VIEW", utmSource: utm_source ?? null, utmMedium: utm_medium ?? null, utmCampaign: utm_campaign ?? null, utmContent: utm_content ?? null, utmTerm: utm_term ?? null },
    });

    return reply.send({ page: { name: page.name, slug: page.slug, content: page.publishedSnapshotJson } });
  });

  app.post("/api/public/pages/:pageId/cta-click", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { pageId } = request.params as { pageId: string };
    const parsed = z.object({ ctaId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const page = await db.websitePage.findUnique({ where: { id: pageId } });
    if (!page || page.status !== "PUBLISHED") return reply.code(404).send({ error: "Page not found." });

    await db.websiteAnalyticsEvent.create({ data: { websiteProjectId: page.websiteProjectId, pageId, eventName: "CTA_CLICK", detailsJson: { ctaId: parsed.data.ctaId } as Prisma.InputJsonValue } });
    return reply.code(201).send({ ok: true });
  });

  // --- Admin oversight read --------------------------------------------

  app.get("/api/website-funnel-studio/projects", { preHandler: [requireAuth, requirePermission("Website & Funnel Studio", "VIEW")] }, async (request, reply) => {
    const { studentId, businessId, status } = request.query as { studentId?: string; businessId?: string; status?: string };
    const projects = await db.websiteProject.findMany({ where: { studentId: studentId || undefined, businessId: businessId || undefined, status: status || undefined }, orderBy: { createdAt: "desc" }, take: 200 });
    return reply.send({ websiteProjects: projects });
  });
}

export type { PageSection };

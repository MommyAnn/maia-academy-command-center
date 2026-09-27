// M.A.I.A. Business OS — Product/Service Catalog (spec sections 54-57).
// Connects to the EXISTING Offer model (Phase 13, server/src/modules/
// website/routes.ts) by reference only — Offer CRUD itself is not
// duplicated here; this module is Product only.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requireStudentSelfOrPermission, assertBusinessAccess, type AuthContext } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateProductDisplayId } from "../sequence.js";

export const PRODUCT_TYPES = ["PRODUCT", "SERVICE", "COURSE", "PACKAGE", "SUBSCRIPTION", "CUSTOM"] as const;
export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;

async function authorize(request: { authContext?: AuthContext }, businessId: string, level: "VIEW" | "EDIT"): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  return assertBusinessAccess(businessId, ctx, level);
}

export async function businessCatalogRoutes(app: FastifyInstance) {
  const createSchema = z.object({
    businessId: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(PRODUCT_TYPES),
    description: z.string().optional(),
    price: z.number().nonnegative().optional(),
    cost: z.number().nonnegative().optional(),
    category: z.string().optional(),
    offerId: z.string().optional(),
  });

  app.post("/api/students/:studentId/products", { preHandler: [requireAuth, requireStudentSelfOrPermission("Business OS", "CREATE")] }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    if (!(await authorize(request, parsed.data.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    if (parsed.data.offerId) {
      const offer = await db.offer.findUnique({ where: { id: parsed.data.offerId } });
      if (!offer || offer.businessId !== parsed.data.businessId) return reply.code(403).send({ error: "This offer does not belong to this business." });
    }

    const ctx = request.authContext!;
    const product = await db.product.create({
      data: {
        productDisplayId: await generateProductDisplayId(),
        businessId: parsed.data.businessId,
        name: parsed.data.name,
        type: parsed.data.type,
        description: parsed.data.description,
        price: parsed.data.price,
        cost: parsed.data.cost,
        category: parsed.data.category,
        offerId: parsed.data.offerId,
        createdById: ctx.userId,
      },
    });
    await writeAuditLog({ action: "Product Created", summary: `Product "${product.name}" created`, actorUserId: ctx.userId, entityType: "Product", entityId: product.id });
    return reply.code(201).send({ product });
  });

  app.get("/api/businesses/:businessId/products", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const { status } = request.query as { status?: string };
    const products = await db.product.findMany({ where: { businessId, status: status || undefined }, orderBy: { createdAt: "desc" } });
    return reply.send({ products });
  });

  const updateSchema = z.object({ status: z.enum(PRODUCT_STATUSES).optional(), price: z.number().nonnegative().optional(), description: z.string().optional() });

  app.patch("/api/products/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await db.product.findUnique({ where: { id } });
    if (!product) return reply.code(404).send({ error: "Product not found." });
    if (!(await authorize(request, product.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden." });
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    const updated = await db.product.update({ where: { id }, data: parsed.data });
    if (parsed.data.status) {
      await writeAuditLog({ action: "Product Status Changed", summary: `Product "${product.name}" status -> ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "Product", entityId: id });
    }
    return reply.send({ product: updated });
  });
}

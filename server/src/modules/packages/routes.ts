import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  defaultPrice: z.number().nonnegative(),
});

const updateSchema = z.object({
  description: z.string().optional(),
  defaultPrice: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

// Packages have no dedicated permission module in the frontend's existing
// matrix (they've always been configured inline, never their own nav item)
// — gated under "System Settings", matching that same convention.
export async function packageRoutes(app: FastifyInstance) {
  app.get("/api/packages", { preHandler: [requireAuth] }, async (_request, reply) => {
    const packages = await db.package.findMany({ orderBy: { createdAt: "asc" } });
    return reply.send({ packages: packages.map(serialize) });
  });

  app.post("/api/packages", { preHandler: [requireAuth, requirePermission("System Settings", "CREATE")] }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid package.", details: parsed.error.flatten() });

    const created = await db.package.create({ data: parsed.data });
    await writeAuditLog({
      action: "Integration Configuration Changed",
      summary: `Package "${created.name}" created (default price ${created.defaultPrice})`,
      actorUserId: request.authContext!.userId,
      entityType: "Package",
      entityId: created.id,
    });
    return reply.code(201).send({ package: serialize(created) });
  });

  // Changing a package's price NEVER touches any existing Enrollment's
  // packagePriceSnapshot (spec section 8) — that field is written once, at
  // enrollment time, and nothing in this route (or anywhere else) updates it.
  app.patch("/api/packages/:packageId", { preHandler: [requireAuth, requirePermission("System Settings", "EDIT")] }, async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const { packageId } = request.params as { packageId: string };
    const existing = await db.package.findUnique({ where: { id: packageId } });
    if (!existing) return reply.code(404).send({ error: "Package not found." });

    const updated = await db.package.update({ where: { id: packageId }, data: parsed.data });
    await writeAuditLog({
      action: "Integration Configuration Changed",
      summary: `Package "${updated.name}" updated`,
      actorUserId: request.authContext!.userId,
      entityType: "Package",
      entityId: updated.id,
    });
    return reply.send({ package: serialize(updated) });
  });
}

function serialize(p: { id: string; name: string; description: string | null; defaultPrice: import("@prisma/client").Prisma.Decimal | null; isActive: boolean; createdAt: Date; updatedAt: Date }) {
  return { ...p, defaultPrice: p.defaultPrice ? Number(p.defaultPrice) : null };
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";

const createSchema = z.object({ note: z.string().min(1) });

// Staff-only, both directions — a Student session can never reach this
// route at all (requirePermission rejects any non-staff context outright),
// matching spec section 32's "Students must not see private Admin Notes."
export async function studentNoteRoutes(app: FastifyInstance) {
  app.get("/api/students/:studentId/notes", { preHandler: [requireAuth, requirePermission("Students", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const notes = await db.studentNote.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } });
    return reply.send({ notes });
  });

  app.post("/api/students/:studentId/notes", { preHandler: [requireAuth, requirePermission("Students", "EDIT")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "A note is required." });

    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) return reply.code(404).send({ error: "Student not found." });

    const note = await db.studentNote.create({ data: { studentId, authorId: request.authContext!.userId, note: parsed.data.note } });
    await writeAuditLog({ action: "Student Updated", summary: "Admin note added", actorUserId: request.authContext!.userId, entityType: "Student", entityId: studentId });
    return reply.code(201).send({ note });
  });
}

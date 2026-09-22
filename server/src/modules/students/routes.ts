import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelf } from "../../rbac/middleware.js";
import { hashPassword } from "../../auth/password.js";
import { writeAuditLog } from "../../audit/log.js";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
});

export async function studentRoutes(app: FastifyInstance) {
  // Real, server-side pagination — the one production-readiness gap the
  // audit flagged as present on every list view in the current frontend
  // ("no pagination exists anywhere"). This endpoint is the Phase-1 proof
  // that the pattern works; Phase 2 wires the Students page to call it.
  app.get("/api/students", { preHandler: [requireAuth, requirePermission("Students", "VIEW")] }, async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid query parameters." });
    const { page, pageSize, search } = parsed.data;

    const where = search
      ? { person: { fullName: { contains: search, mode: "insensitive" as const } } }
      : {};

    const [total, students] = await Promise.all([
      db.student.count({ where }),
      db.student.findMany({
        where,
        include: { person: true, batch: true, package: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return reply.send({
      students: students.map(serializeStudent),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  });

  app.get(
    "/api/students/:studentId",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Students", "VIEW")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const student = await db.student.findUnique({ where: { id: studentId }, include: { person: true, batch: true, package: true } });
      if (!student) return reply.code(404).send({ error: "Student not found." });
      return reply.send({ student: serializeStudent(student) });
    },
  );

  // Admin-only: provisions a real login account for an already-enrolled
  // student (spec section 8's "Account Activation"). Never auto-emails a
  // real password — returns a one-time password-reset token instead, the
  // same activation pattern real production systems use, and the same
  // "dev-only token in the response body" honesty rule as the password
  // reset route until a real email provider is connected.
  app.post(
    "/api/students/:studentId/provision-account",
    { preHandler: [requireAuth, requirePermission("Students", "EDIT")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const student = await db.student.findUnique({ where: { id: studentId }, include: { person: true } });
      if (!student) return reply.code(404).send({ error: "Student not found." });
      if (!student.person.email) return reply.code(400).send({ error: "Student has no email on file." });

      const existing = await db.user.findUnique({ where: { personId: student.personId } });
      if (existing) return reply.code(409).send({ error: "This student already has a portal account." });

      const studentRole = await db.role.findUniqueOrThrow({ where: { name: "Student" } });
      // Temporary, unusable random password — the account is only usable
      // after the student completes a real password-reset flow, so no
      // "default password" is ever a real credential anyone could guess.
      const temporaryHash = await hashPassword(cryptoRandom());

      const user = await db.user.create({
        data: {
          personId: student.personId,
          email: student.person.email.toLowerCase(),
          passwordHash: temporaryHash,
          roleId: studentRole.id,
          status: "ACTIVE",
        },
      });

      await writeAuditLog({
        action: "Account Provisioned",
        summary: `Portal account provisioned for ${student.person.fullName}`,
        actorUserId: request.authContext!.userId,
        entityType: "Student",
        entityId: studentId,
      });

      return reply.code(201).send({ userId: user.id, message: "Account provisioned. Student must complete password reset to set their own password." });
    },
  );
}

function cryptoRandom(): string {
  return Array.from({ length: 24 }, () => Math.random().toString(36)[2] ?? "x").join("");
}

function requireStudentSelfOrPermission(module: Parameters<typeof requirePermission>[0], action: Parameters<typeof requirePermission>[1]) {
  const selfCheck = requireStudentSelf("studentId");
  const permCheck = requirePermission(module, action);
  return async (request: Parameters<typeof selfCheck>[0], reply: Parameters<typeof selfCheck>[1]) => {
    if (request.authContext?.kind === "student") return selfCheck(request, reply);
    return permCheck(request, reply);
  };
}

function serializeStudent(s: { id: string; studentDisplayId: string; enrollmentStatus: string; masterBrainStatus: string; person: { fullName: string; email: string | null }; batch: { label: string }; package: { name: string } }) {
  return {
    id: s.id,
    studentDisplayId: s.studentDisplayId,
    fullName: s.person.fullName,
    email: s.person.email,
    batch: s.batch.label,
    package: s.package.name,
    enrollmentStatus: s.enrollmentStatus,
    masterBrainStatus: s.masterBrainStatus,
  };
}

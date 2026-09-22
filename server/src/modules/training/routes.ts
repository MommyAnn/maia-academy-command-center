import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { recordDomainEvent } from "../events.js";
import { generateTrainingSessionDisplayId } from "../sequence.js";

const createSessionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string().min(1),
  batchId: z.string().optional(),
  program: z.string().optional(),
  date: z.string().datetime(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  venue: z.string().optional(),
  platform: z.string().optional(),
  meetingLink: z.string().optional(),
  meetingId: z.string().optional(),
  passcode: z.string().optional(),
  trainer: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

const updateSessionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  date: z.string().datetime().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  venue: z.string().optional(),
  platform: z.string().optional(),
  meetingLink: z.string().optional(),
  meetingId: z.string().optional(),
  passcode: z.string().optional(),
  trainer: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

const rosterSchema = z.object({
  studentId: z.string().min(1),
  eligibility: z.string().default("Eligible"),
});

const attendanceSchema = z.object({
  studentId: z.string().min(1),
  status: z.string().min(1),
  method: z.string().optional(),
  notes: z.string().optional(),
  checkInTime: z.string().datetime().optional(),
  checkOutTime: z.string().datetime().optional(),
});

const ATTENDED_STATUSES = new Set(["Present", "Late", "Online Attended"]);

export async function trainingRoutes(app: FastifyInstance) {
  app.get("/api/training/sessions", { preHandler: [requireAuth, requirePermission("Training", "VIEW")] }, async (request, reply) => {
    const { batchId, status } = request.query as { batchId?: string; status?: string };
    const sessions = await db.trainingSession.findMany({
      where: { batchId: batchId || undefined, status: status || undefined },
      orderBy: { date: "desc" },
    });
    return reply.send({ sessions });
  });

  app.post("/api/training/sessions", { preHandler: [requireAuth, requirePermission("Training", "CREATE")] }, async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid training session.", details: parsed.error.flatten() });

    const batch = parsed.data.batchId ? await db.batch.findUnique({ where: { id: parsed.data.batchId } }) : null;
    if (parsed.data.batchId && !batch) return reply.code(404).send({ error: "Batch not found." });

    const sessionDisplayId = await generateTrainingSessionDisplayId(batch?.code ?? "GEN");
    const created = await db.trainingSession.create({
      data: {
        sessionDisplayId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        type: parsed.data.type,
        batchId: parsed.data.batchId ?? null,
        program: parsed.data.program ?? null,
        date: new Date(parsed.data.date),
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        venue: parsed.data.venue ?? null,
        platform: parsed.data.platform ?? null,
        meetingLink: parsed.data.meetingLink ?? null,
        meetingId: parsed.data.meetingId ?? null,
        passcode: parsed.data.passcode ?? null,
        trainer: parsed.data.trainer ?? null,
        capacity: parsed.data.capacity ?? null,
        notes: parsed.data.notes ?? null,
        createdById: request.authContext!.userId,
      },
    });

    await writeAuditLog({ action: "Training Created", summary: `Training session "${created.title}" created`, actorUserId: request.authContext!.userId, entityType: "TrainingSession", entityId: created.id });
    return reply.code(201).send({ session: created });
  });

  app.patch("/api/training/sessions/:sessionId", { preHandler: [requireAuth, requirePermission("Training", "EDIT")] }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const parsed = updateSessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const existing = await db.trainingSession.findUnique({ where: { id: sessionId } });
    if (!existing) return reply.code(404).send({ error: "Training session not found." });

    const updated = await db.trainingSession.update({
      where: { id: sessionId },
      data: { ...parsed.data, date: parsed.data.date ? new Date(parsed.data.date) : undefined },
    });

    await writeAuditLog({ action: "Training Updated", summary: `Training session "${updated.title}" updated`, actorUserId: request.authContext!.userId, entityType: "TrainingSession", entityId: sessionId });

    // A session that just moved to "Completed" is the natural trigger point
    // for a future feedback-request/certificate-eligibility automation
    // (spec sections 51, 65) — recorded once per session, not dispatched
    // anywhere external.
    if (parsed.data.status === "Completed" && existing.status !== "Completed") {
      await recordDomainEvent("TRAINING_COMPLETED", { sessionId });
    }

    return reply.send({ session: updated });
  });

  // Roster / eligibility (spec section 4) — upserted, so adding the same
  // student to the same session twice only ever updates their eligibility,
  // never creates a duplicate row (the @@unique([sessionId, studentId])
  // constraint on TrainingAttendance makes a duplicate structurally
  // impossible either way).
  app.get("/api/training/sessions/:sessionId/roster", { preHandler: [requireAuth, requirePermission("Training", "VIEW")] }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const roster = await db.trainingAttendance.findMany({
      where: { sessionId },
      include: { student: { include: { person: true } } },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ roster });
  });

  app.post("/api/training/sessions/:sessionId/roster", { preHandler: [requireAuth, requirePermission("Training", "EDIT")] }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const parsed = rosterSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid roster entry.", details: parsed.error.flatten() });

    const session = await db.trainingSession.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Training session not found." });
    const student = await db.student.findUnique({ where: { id: parsed.data.studentId } });
    if (!student) return reply.code(404).send({ error: "Student not found." });

    const wasAlreadyOnRoster = !!(await db.trainingAttendance.findUnique({ where: { sessionId_studentId: { sessionId, studentId: parsed.data.studentId } } }));

    const entry = await db.trainingAttendance.upsert({
      where: { sessionId_studentId: { sessionId, studentId: parsed.data.studentId } },
      update: { eligibility: parsed.data.eligibility },
      create: { sessionId, studentId: parsed.data.studentId, eligibility: parsed.data.eligibility, status: "Registered" },
    });

    if (!wasAlreadyOnRoster) {
      await recordDomainEvent("TRAINING_REGISTERED", { studentId: parsed.data.studentId, sessionId });
    }

    return reply.code(201).send({ entry });
  });

  // Quick Attendance (spec section 8): search+select is the existing
  // GET /api/students endpoint from Phase 1; this route is the mark/update
  // step, restricted to staff holding Training/EDIT — an unauthorized staff
  // member cannot alter attendance (spec section 8's explicit requirement).
  app.post("/api/training/sessions/:sessionId/attendance", { preHandler: [requireAuth, requirePermission("Training", "EDIT")] }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const parsed = attendanceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid attendance record.", details: parsed.error.flatten() });

    const session = await db.trainingSession.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Training session not found." });

    const wasAlreadyOnRoster = !!(await db.trainingAttendance.findUnique({ where: { sessionId_studentId: { sessionId, studentId: parsed.data.studentId } } }));

    const entry = await db.trainingAttendance.upsert({
      where: { sessionId_studentId: { sessionId, studentId: parsed.data.studentId } },
      update: {
        status: parsed.data.status,
        method: parsed.data.method ?? "Quick Attendance",
        notes: parsed.data.notes,
        checkInTime: parsed.data.checkInTime ? new Date(parsed.data.checkInTime) : undefined,
        checkOutTime: parsed.data.checkOutTime ? new Date(parsed.data.checkOutTime) : undefined,
        recordedById: request.authContext!.userId,
        recordedAt: new Date(),
      },
      create: {
        sessionId,
        studentId: parsed.data.studentId,
        status: parsed.data.status,
        method: parsed.data.method ?? "Quick Attendance",
        notes: parsed.data.notes ?? null,
        checkInTime: parsed.data.checkInTime ? new Date(parsed.data.checkInTime) : null,
        checkOutTime: parsed.data.checkOutTime ? new Date(parsed.data.checkOutTime) : null,
        recordedById: request.authContext!.userId,
        recordedAt: new Date(),
      },
    });

    await writeAuditLog({
      action: wasAlreadyOnRoster ? "Attendance Updated" : "Attendance Marked",
      summary: `Attendance for session "${session.title}" set to ${parsed.data.status}`,
      actorUserId: request.authContext!.userId,
      entityType: "TrainingAttendance",
      entityId: entry.id,
    });

    if (ATTENDED_STATUSES.has(parsed.data.status)) {
      await recordDomainEvent("TRAINING_ATTENDED", { studentId: parsed.data.studentId, sessionId });
    } else if (parsed.data.status === "Absent") {
      await recordDomainEvent("TRAINING_ABSENT", { studentId: parsed.data.studentId, sessionId });
    }

    return reply.send({ entry });
  });

  // Student Portal "My Training" (spec section 10) — only sessions the
  // authenticated student is actually on the roster for, split into
  // Upcoming/Completed by the session's own date/status.
  app.get(
    "/api/students/:studentId/training",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Training", "VIEW")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const entries = await db.trainingAttendance.findMany({
        where: { studentId },
        include: { session: true },
        orderBy: { session: { date: "desc" } },
      });
      return reply.send({ training: entries });
    },
  );
}

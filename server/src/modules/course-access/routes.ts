import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { recordDomainEvent } from "../events.js";
import { resolveCourseAccess } from "../courses/access.js";

const grantSchema = z.object({
  courseId: z.string().min(1),
  source: z.string().min(1),
  sourceReference: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const packageMappingSchema = z.object({ packageId: z.string().min(1), courseId: z.string().min(1) });

export async function courseAccessRoutes(app: FastifyInstance) {
  // Grant is an upsert on the [studentId, courseId] unique key — regranting
  // the same course to the same student never creates a second row; it
  // reactivates/updates the existing one (mirrors the training-roster
  // upsert pattern from spec section 7's duplicate-protection intent).
  app.post("/api/students/:studentId/course-access", { preHandler: [requireAuth, requirePermission("Courses", "EDIT")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = grantSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid access grant.", details: parsed.error.flatten() });

    const [student, course] = await Promise.all([
      db.student.findUnique({ where: { id: studentId } }),
      db.course.findUnique({ where: { id: parsed.data.courseId } }),
    ]);
    if (!student) return reply.code(404).send({ error: "Student not found." });
    if (!course) return reply.code(404).send({ error: "Course not found." });

    const grant = await db.courseAccessGrant.upsert({
      where: { studentId_courseId: { studentId, courseId: parsed.data.courseId } },
      update: {
        source: parsed.data.source,
        sourceReference: parsed.data.sourceReference ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        notes: parsed.data.notes ?? null,
        status: "Active",
        revokedAt: null,
        revokedById: null,
      },
      create: {
        studentId,
        courseId: parsed.data.courseId,
        source: parsed.data.source,
        sourceReference: parsed.data.sourceReference ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        notes: parsed.data.notes ?? null,
        grantedById: request.authContext!.userId,
      },
    });

    await writeAuditLog({ action: "Course Access Granted", summary: `Course "${course.title}" access granted (${parsed.data.source})`, actorUserId: request.authContext!.userId, entityType: "CourseAccessGrant", entityId: grant.id });
    await recordDomainEvent("COURSE_ACCESS_GRANTED", { studentId, courseId: parsed.data.courseId, source: parsed.data.source });

    return reply.code(201).send({ grant });
  });

  app.post("/api/course-access/:grantId/revoke", { preHandler: [requireAuth, requirePermission("Courses", "EDIT")] }, async (request, reply) => {
    const { grantId } = request.params as { grantId: string };
    const grant = await db.courseAccessGrant.findUnique({ where: { id: grantId } });
    if (!grant) return reply.code(404).send({ error: "Access grant not found." });
    if (grant.status === "Revoked") return reply.code(409).send({ error: "This access grant is already revoked." });

    const updated = await db.courseAccessGrant.update({ where: { id: grantId }, data: { status: "Revoked", revokedAt: new Date(), revokedById: request.authContext!.userId } });

    await writeAuditLog({ action: "Course Access Revoked", summary: `Course access revoked`, actorUserId: request.authContext!.userId, entityType: "CourseAccessGrant", entityId: grantId });
    await recordDomainEvent("COURSE_ACCESS_REVOKED", { studentId: grant.studentId, courseId: grant.courseId });

    return reply.send({ grant: updated });
  });

  // The configurable PACKAGE/PROGRAM -> COURSE ACCESS mapping (spec section
  // 20) — a real table an Admin edits, never a hard-coded matrix.
  app.get("/api/package-course-access", { preHandler: [requireAuth, requirePermission("Courses", "VIEW")] }, async (_request, reply) => {
    const mappings = await db.packageCourseAccess.findMany({ include: { package: true, course: true } });
    return reply.send({ mappings });
  });

  app.post("/api/package-course-access", { preHandler: [requireAuth, requirePermission("Courses", "EDIT")] }, async (request, reply) => {
    const parsed = packageMappingSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid mapping.", details: parsed.error.flatten() });

    const mapping = await db.packageCourseAccess.upsert({
      where: { packageId_courseId: { packageId: parsed.data.packageId, courseId: parsed.data.courseId } },
      update: {},
      create: parsed.data,
    });
    return reply.code(201).send({ mapping });
  });

  app.delete("/api/package-course-access/:mappingId", { preHandler: [requireAuth, requirePermission("Courses", "EDIT")] }, async (request, reply) => {
    const { mappingId } = request.params as { mappingId: string };
    await db.packageCourseAccess.delete({ where: { id: mappingId } }).catch(() => null);
    return reply.code(204).send();
  });

  // "My Courses" (spec section 23) — every PUBLISHED course, each annotated
  // with the SAME server-resolved access status a security check would use
  // (never a client-computed unlock state).
  app.get(
    "/api/students/:studentId/courses",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Courses", "VIEW")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const student = await db.student.findUnique({ where: { id: studentId } });
      if (!student) return reply.code(404).send({ error: "Student not found." });

      const courses = await db.course.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ displayOrder: "asc" }] });
      const withAccess = await Promise.all(
        courses.map(async (course) => ({ course, access: await resolveCourseAccess(studentId, course.id) })),
      );
      return reply.send({ courses: withAccess });
    },
  );

  // Full course detail — the actual security boundary (spec section 22):
  // a Student manually entering another course's URL without entitlement
  // gets 403, never the modules/lessons payload.
  app.get(
    "/api/students/:studentId/courses/:courseId",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Courses", "VIEW")] },
    async (request, reply) => {
      const { studentId, courseId } = request.params as { studentId: string; courseId: string };
      const ctx = request.authContext!;
      const access = await resolveCourseAccess(studentId, courseId);
      if (ctx.kind === "student" && (access.status === "Locked" || access.status === "Revoked" || access.status === "Expired")) {
        return reply.code(403).send({ error: "ACCESS DENIED", reason: access.reason });
      }

      const course = await db.course.findUnique({
        where: { id: courseId },
        include: { modules: { orderBy: { order: "asc" }, include: { lessons: { where: { status: "Published" }, orderBy: { order: "asc" } } } } },
      });
      if (!course) return reply.code(404).send({ error: "Course not found." });

      return reply.send({ course, access });
    },
  );

  // Single lesson, entitlement-checked via its parent course (spec section
  // 24, 69) — resources are returned as ids only; the caller fetches each
  // one's signed URL from the existing /api/documents/:id/signed-url route,
  // which is extended (see documents/routes.ts) to authorize a
  // course-entitled student against a COURSE_RESTRICTED document.
  app.get(
    "/api/students/:studentId/lessons/:lessonId",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Courses", "VIEW")] },
    async (request, reply) => {
      const { studentId, lessonId } = request.params as { studentId: string; lessonId: string };
      const ctx = request.authContext!;
      const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { module: true, resources: true } });
      if (!lesson) return reply.code(404).send({ error: "Lesson not found." });
      if (ctx.kind === "student" && lesson.status !== "Published") return reply.code(404).send({ error: "Lesson not found." });

      const access = await resolveCourseAccess(studentId, lesson.module.courseId);
      if (ctx.kind === "student" && (access.status === "Locked" || access.status === "Revoked" || access.status === "Expired")) {
        return reply.code(403).send({ error: "ACCESS DENIED", reason: access.reason });
      }

      return reply.send({ lesson });
    },
  );
}

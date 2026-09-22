import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requireStudentSelfOrPermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { recordDomainEvent } from "../events.js";
import { resolveCourseAccess } from "../courses/access.js";

const progressSchema = z.object({ status: z.enum(["In Progress", "Completed"]) });

export async function progressRoutes(app: FastifyInstance) {
  // Resume Learning (spec section 27): every touch — start, revisit, or
  // complete — updates lastAccessedAt, so "Continue Learning" always knows
  // the real last-touched lesson. No claim of exact video-timestamp resume
  // is made anywhere here (spec section 27's explicit honesty carve-out) —
  // only lesson-level position is persisted.
  app.patch(
    "/api/students/:studentId/lessons/:lessonId/progress",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Courses", "EDIT")] },
    async (request, reply) => {
      const { studentId, lessonId } = request.params as { studentId: string; lessonId: string };
      const parsed = progressSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid progress update.", details: parsed.error.flatten() });

      const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
      if (!lesson) return reply.code(404).send({ error: "Lesson not found." });

      const access = await resolveCourseAccess(studentId, lesson.module.courseId);
      if (access.status === "Locked" || access.status === "Revoked" || access.status === "Expired") {
        return reply.code(403).send({ error: "ACCESS DENIED", reason: access.reason });
      }

      const existing = await db.lessonProgress.findUnique({ where: { studentId_lessonId: { studentId, lessonId } } });
      const wasCompleted = existing?.status === "Completed";

      const progress = await db.lessonProgress.upsert({
        where: { studentId_lessonId: { studentId, lessonId } },
        update: {
          status: parsed.data.status,
          startedAt: existing?.startedAt ?? new Date(),
          completedAt: parsed.data.status === "Completed" ? new Date() : existing?.completedAt ?? null,
          lastAccessedAt: new Date(),
        },
        create: {
          studentId,
          lessonId,
          status: parsed.data.status,
          startedAt: new Date(),
          completedAt: parsed.data.status === "Completed" ? new Date() : null,
        },
      });

      const isFirstLessonTouch = !existing;
      if (isFirstLessonTouch) {
        const priorLessons = await db.lessonProgress.count({ where: { studentId, lesson: { module: { courseId: lesson.module.courseId } } } });
        if (priorLessons === 0) await recordDomainEvent("COURSE_STARTED", { studentId, courseId: lesson.module.courseId });
      }

      if (parsed.data.status === "Completed" && !wasCompleted) {
        await recordDomainEvent("LESSON_COMPLETED", { studentId, lessonId, courseId: lesson.module.courseId });
        await writeAuditLog({ action: "Lesson Completed", summary: `Lesson "${lesson.title}" completed`, actorStudentId: request.authContext!.kind === "student" ? studentId : null, actorUserId: request.authContext!.kind === "staff" ? request.authContext!.userId : null, entityType: "Lesson", entityId: lessonId });

        const publishedLessons = await db.lesson.findMany({ where: { module: { courseId: lesson.module.courseId }, status: "Published" }, select: { id: true } });
        const completedCount = await db.lessonProgress.count({ where: { studentId, status: "Completed", lessonId: { in: publishedLessons.map((l) => l.id) } } });
        if (publishedLessons.length > 0 && completedCount >= publishedLessons.length) {
          await recordDomainEvent("COURSE_COMPLETED", { studentId, courseId: lesson.module.courseId });
          await writeAuditLog({ action: "Course Completed", summary: `Course completed`, actorStudentId: request.authContext!.kind === "student" ? studentId : null, actorUserId: request.authContext!.kind === "staff" ? request.authContext!.userId : null, entityType: "Course", entityId: lesson.module.courseId });
        }
      }

      return reply.send({ progress });
    },
  );

  // Course progress is DERIVED from real LessonProgress rows on every read
  // — never a stored/fake percentage (spec section 26).
  app.get(
    "/api/students/:studentId/courses/:courseId/progress",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Courses", "VIEW")] },
    async (request, reply) => {
      const { studentId, courseId } = request.params as { studentId: string; courseId: string };
      const publishedLessons = await db.lesson.findMany({ where: { module: { courseId }, status: "Published" }, select: { id: true } });
      const progressRows = await db.lessonProgress.findMany({ where: { studentId, lessonId: { in: publishedLessons.map((l) => l.id) } } });
      const completed = progressRows.filter((p) => p.status === "Completed").length;
      const totalLessons = publishedLessons.length;
      const percent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
      const status = totalLessons === 0 ? "Not Started" : completed >= totalLessons ? "Completed" : progressRows.length > 0 ? "In Progress" : "Not Started";
      const lastAccessedAt = progressRows.reduce<Date | null>((latest, p) => (!latest || p.lastAccessedAt > latest ? p.lastAccessedAt : latest), null);

      return reply.send({ progress: { studentId, courseId, lessonsCompleted: completed, totalLessons, percent, status, lastAccessedAt } });
    },
  );
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateCourseDisplayId, generateLessonDisplayId } from "../sequence.js";
import { validateUpload } from "../../storage/index.js";
import { localDriver, buildStorageKey } from "../../storage/localDriver.js";

const COURSE_STATUSES = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const;

const createCourseSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  category: z.string().min(1),
  instructor: z.string().optional(),
  thumbnailLabel: z.string().optional(),
  estimatedDuration: z.string().optional(),
  accessType: z.enum(["PACKAGE", "MANUAL", "OPEN"]).default("PACKAGE"),
  certificateEligible: z.boolean().default(false),
});

const updateCourseSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  instructor: z.string().optional(),
  thumbnailLabel: z.string().optional(),
  estimatedDuration: z.string().optional(),
  accessType: z.enum(["PACKAGE", "MANUAL", "OPEN"]).optional(),
  certificateEligible: z.boolean().optional(),
  status: z.enum(COURSE_STATUSES).optional(),
  displayOrder: z.number().int().optional(),
});

const moduleSchema = z.object({ title: z.string().min(1), description: z.string().optional(), order: z.number().int().default(0) });
const lessonSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string().min(1),
  videoEmbedRef: z.string().optional(),
  textContent: z.string().optional(),
  duration: z.string().optional(),
  order: z.number().int().default(0),
  completionRule: z.enum(["View", "Manual Mark Complete"]).default("View"),
});
const lessonUpdateSchema = lessonSchema.partial().extend({ status: z.enum(["Draft", "Published"]).optional() });

const linkResourceSchema = z.object({ type: z.string().min(1), label: z.string().min(1), url: z.string().url() });
const uploadResourceSchema = z.object({
  type: z.string().min(1),
  label: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  contentBase64: z.string().min(1),
});

export async function courseRoutes(app: FastifyInstance) {
  // Staff catalog view — every status visible. Student-facing "My Courses"
  // (with entitlement resolution) lives in course-access/routes.ts instead.
  app.get("/api/courses", { preHandler: [requireAuth, requirePermission("Courses", "VIEW")] }, async (_request, reply) => {
    const courses = await db.course.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] });
    return reply.send({ courses });
  });

  app.get("/api/courses/:courseId", { preHandler: [requireAuth, requirePermission("Courses", "VIEW")] }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const course = await db.course.findUnique({
      where: { id: courseId },
      include: { modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" }, include: { resources: true } } } } },
    });
    if (!course) return reply.code(404).send({ error: "Course not found." });
    return reply.send({ course });
  });

  app.post("/api/courses", { preHandler: [requireAuth, requirePermission("Courses", "CREATE")] }, async (request, reply) => {
    const parsed = createCourseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid course.", details: parsed.error.flatten() });

    const courseDisplayId = await generateCourseDisplayId();
    const created = await db.course.create({
      data: { ...parsed.data, courseDisplayId, createdById: request.authContext!.userId },
    });

    await writeAuditLog({ action: "Course Created", summary: `Course "${created.title}" created`, actorUserId: request.authContext!.userId, entityType: "Course", entityId: created.id });
    return reply.code(201).send({ course: created });
  });

  // Publishing is just a status transition through this same route — a
  // Student can never see a non-PUBLISHED course regardless of accessType
  // (enforced in resolveCourseAccess, spec section 12).
  app.patch("/api/courses/:courseId", { preHandler: [requireAuth, requirePermission("Courses", "EDIT")] }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const parsed = updateCourseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const existing = await db.course.findUnique({ where: { id: courseId } });
    if (!existing) return reply.code(404).send({ error: "Course not found." });

    const updated = await db.course.update({ where: { id: courseId }, data: parsed.data });

    await writeAuditLog({ action: "Course Updated", summary: `Course "${updated.title}" updated`, actorUserId: request.authContext!.userId, entityType: "Course", entityId: courseId });
    if (parsed.data.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
      await writeAuditLog({ action: "Course Published", summary: `Course "${updated.title}" published`, actorUserId: request.authContext!.userId, entityType: "Course", entityId: courseId });
    }

    return reply.send({ course: updated });
  });

  app.post("/api/courses/:courseId/modules", { preHandler: [requireAuth, requirePermission("Courses", "EDIT")] }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const parsed = moduleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid module.", details: parsed.error.flatten() });

    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course) return reply.code(404).send({ error: "Course not found." });

    const created = await db.courseModule.create({ data: { courseId, ...parsed.data } });
    return reply.code(201).send({ module: created });
  });

  app.patch("/api/courses/:courseId/modules/:moduleId", { preHandler: [requireAuth, requirePermission("Courses", "EDIT")] }, async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const parsed = moduleSchema.partial().extend({ status: z.enum(["Active", "Archived"]).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const updated = await db.courseModule.update({ where: { id: moduleId }, data: parsed.data }).catch(() => null);
    if (!updated) return reply.code(404).send({ error: "Module not found." });
    return reply.send({ module: updated });
  });

  app.post("/api/courses/:courseId/modules/:moduleId/lessons", { preHandler: [requireAuth, requirePermission("Courses", "EDIT")] }, async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const parsed = lessonSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid lesson.", details: parsed.error.flatten() });

    const module_ = await db.courseModule.findUnique({ where: { id: moduleId } });
    if (!module_) return reply.code(404).send({ error: "Module not found." });

    const lessonDisplayId = await generateLessonDisplayId();
    const created = await db.lesson.create({ data: { moduleId, lessonDisplayId, ...parsed.data } });
    return reply.code(201).send({ lesson: created });
  });

  app.patch("/api/lessons/:lessonId", { preHandler: [requireAuth, requirePermission("Courses", "EDIT")] }, async (request, reply) => {
    const { lessonId } = request.params as { lessonId: string };
    const parsed = lessonUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const updated = await db.lesson.update({ where: { id: lessonId }, data: parsed.data }).catch(() => null);
    if (!updated) return reply.code(404).send({ error: "Lesson not found." });
    return reply.send({ lesson: updated });
  });

  // Attaches an "External Link" resource — no private storage involved,
  // since the destination is already public by the admin's own choice.
  app.post("/api/lessons/:lessonId/resources/link", { preHandler: [requireAuth, requirePermission("Courses", "EDIT")] }, async (request, reply) => {
    const { lessonId } = request.params as { lessonId: string };
    const parsed = linkResourceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid resource.", details: parsed.error.flatten() });

    const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return reply.code(404).send({ error: "Lesson not found." });

    const created = await db.lessonResource.create({ data: { lessonId, type: parsed.data.type, label: parsed.data.label, url: parsed.data.url, createdById: request.authContext!.userId } });
    return reply.code(201).send({ resource: created });
  });

  // Attaches a resource backed by real private storage (spec section 17) —
  // reuses the exact same storage driver + ownership-checked signed-URL
  // path Phase 1 built for student documents (see documents/routes.ts's
  // signed-url endpoint, extended to also authorize a course-entitled
  // student). The Document is intentionally ownerless (ownerStudentId
  // null) — it belongs to the course, not any one student.
  app.post("/api/lessons/:lessonId/resources/upload", { preHandler: [requireAuth, requirePermission("Courses", "EDIT")] }, async (request, reply) => {
    const { lessonId } = request.params as { lessonId: string };
    const parsed = uploadResourceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid resource upload.", details: parsed.error.flatten() });

    const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return reply.code(404).send({ error: "Lesson not found." });

    const buffer = Buffer.from(parsed.data.contentBase64, "base64");
    const validationError = validateUpload(parsed.data.mimeType, buffer.byteLength);
    if (validationError) return reply.code(422).send({ error: validationError });

    const storageKey = buildStorageKey(`course-resources/${lessonId}`, "CourseResource", parsed.data.filename);
    await localDriver.save(storageKey, buffer);

    const document = await db.document.create({
      data: {
        ownerStudentId: null,
        documentType: "CourseResource",
        originalFilename: parsed.data.filename,
        storageKey,
        mimeType: parsed.data.mimeType,
        sizeBytes: buffer.byteLength,
        status: "VERIFIED",
        accessClassification: "COURSE_RESTRICTED",
        uploadedById: request.authContext!.userId,
      },
    });

    const resource = await db.lessonResource.create({
      data: { lessonId, type: parsed.data.type, label: parsed.data.label, documentId: document.id, createdById: request.authContext!.userId },
    });

    return reply.code(201).send({ resource });
  });
}

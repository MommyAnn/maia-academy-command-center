import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requireStudentSelf } from "../../rbac/middleware.js";
import { validateUpload } from "../../storage/index.js";
import { localDriver, buildStorageKey } from "../../storage/localDriver.js";
import { signDownloadToken, verifyDownloadToken } from "../../storage/signedUrl.js";
import { resolveCourseAccess } from "../courses/access.js";

const uploadSchema = z.object({
  documentType: z.enum(["ValidId", "PaymentProof", "FeedbackVideo", "CourseResource", "AiAsset"]),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  // Base64-encoded file contents. A production frontend would send
  // multipart/form-data instead — Phase 1 keeps this endpoint framework-
  // agnostic and dependency-light since its purpose is to prove the
  // storage+ownership+classification pattern, not to be the final upload API.
  contentBase64: z.string().min(1),
});

const CLASSIFICATION_BY_TYPE: Record<string, string> = {
  ValidId: "PRIVATE_STUDENT",
  PaymentProof: "FINANCE_SENSITIVE",
  FeedbackVideo: "PRIVATE_STUDENT",
  CourseResource: "COURSE_RESTRICTED",
  AiAsset: "PRIVATE_STUDENT",
};

export async function documentRoutes(app: FastifyInstance) {
  app.post(
    "/api/students/:studentId/documents",
    { preHandler: [requireAuth, requireStudentSelf("studentId")] },
    async (request, reply) => {
      const parsed = uploadSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid upload.", details: parsed.error.flatten() });

      const { studentId } = request.params as { studentId: string };
      const buffer = Buffer.from(parsed.data.contentBase64, "base64");

      // Server-side validation — never trust the browser's claimed type/size
      // (spec section 20).
      const validationError = validateUpload(parsed.data.mimeType, buffer.byteLength);
      if (validationError) return reply.code(422).send({ error: validationError });

      const storageKey = buildStorageKey(studentId, parsed.data.documentType, parsed.data.filename);
      await localDriver.save(storageKey, buffer);

      const document = await db.document.create({
        data: {
          ownerStudentId: studentId,
          documentType: parsed.data.documentType,
          originalFilename: parsed.data.filename,
          storageKey,
          mimeType: parsed.data.mimeType,
          sizeBytes: buffer.byteLength,
          status: "PENDING",
          accessClassification: CLASSIFICATION_BY_TYPE[parsed.data.documentType] as never,
          uploadedById: request.authContext!.userId,
        },
      });

      return reply.code(201).send({ document: { id: document.id, documentType: document.documentType, status: document.status } });
    },
  );

  // Issues a short-lived signed link rather than a permanent public URL
  // (spec section 19).
  app.get(
    "/api/documents/:documentId/signed-url",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { documentId } = request.params as { documentId: string };
      const document = await db.document.findUnique({ where: { id: documentId } });
      if (!document) return reply.code(404).send({ error: "Document not found." });

      const ctx = request.authContext!;
      let authorized = ctx.kind === "staff" || (ctx.kind === "student" && ctx.studentId === document.ownerStudentId);

      // A course resource has no student owner (it belongs to the course,
      // not any one student) — a Student is authorized only if they
      // currently have real, server-resolved access to the course that
      // resource's lesson belongs to (spec section 22). Never authorized by
      // classification alone.
      if (!authorized && ctx.kind === "student" && document.accessClassification === "COURSE_RESTRICTED") {
        const resource = await db.lessonResource.findFirst({ where: { documentId: document.id }, include: { lesson: { include: { module: true } } } });
        if (resource) {
          const access = await resolveCourseAccess(ctx.studentId!, resource.lesson.module.courseId);
          authorized = access.status !== "Locked" && access.status !== "Revoked" && access.status !== "Expired";
        }
      }

      if (!authorized) return reply.code(403).send({ error: "Forbidden: you do not have access to this document." });

      const token = signDownloadToken(documentId);
      return reply.send({ url: `/api/documents/download?token=${token}`, expiresInSeconds: 300 });
    },
  );

  app.get("/api/documents/download", async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.code(400).send({ error: "Missing token." });

    const verified = verifyDownloadToken(token);
    if (!verified) return reply.code(403).send({ error: "This download link is invalid or has expired." });

    const document = await db.document.findUnique({ where: { id: verified.documentId } });
    if (!document) return reply.code(404).send({ error: "Document not found." });

    const bytes = await localDriver.read(document.storageKey);
    reply.header("Content-Type", document.mimeType);
    reply.header("Content-Disposition", `attachment; filename="${document.originalFilename}"`);
    return reply.send(bytes);
  });
}

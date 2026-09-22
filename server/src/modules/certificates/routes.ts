import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { recordDomainEvent } from "../events.js";
import { generateCertificateDisplayId } from "../sequence.js";
import { computeStudentFinanceSummary, resolveNetAmountDue } from "../finance/calc.js";

// Configurable eligibility rule (spec section 31) — Owner/Admin editable at
// call time via the request body, never one permanently hard-coded rule;
// defaults mirror the frontend's DEFAULT_ELIGIBILITY_SETTINGS exactly
// (src/types/training.ts).
const evaluateSchema = z.object({
  certificateType: z.string().default("Program Completion"),
  requireConfirmedEnrollment: z.boolean().default(true),
  requireRequirementsVerified: z.boolean().default(true),
  minAttendancePercent: z.number().min(0).max(100).default(80),
  requireFullyPaid: z.boolean().default(false),
});

const CONFIRMED_STATUSES = new Set(["Confirmed Student", "Active Student"]);

async function evaluateEligibility(studentId: string, settings: z.infer<typeof evaluateSchema>): Promise<{ eligible: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) return { eligible: false, reasons: ["Student not found."] };

  if (settings.requireConfirmedEnrollment && !CONFIRMED_STATUSES.has(student.enrollmentStatus)) {
    reasons.push("Enrollment is not yet confirmed.");
  }

  if (settings.requireRequirementsVerified) {
    const requirements = await db.requirement.findMany({ where: { studentId } });
    if (requirements.length === 0 || requirements.some((r) => r.status !== "VERIFIED")) {
      reasons.push("Not all requirements are verified.");
    }
  }

  if (settings.minAttendancePercent > 0) {
    const roster = await db.trainingAttendance.findMany({ where: { studentId } });
    const attended = roster.filter((r) => r.status === "Present" || r.status === "Late" || r.status === "Online Attended").length;
    const percent = roster.length > 0 ? (attended / roster.length) * 100 : 0;
    if (percent < settings.minAttendancePercent) reasons.push(`Attendance is ${Math.round(percent)}%, below the required ${settings.minAttendancePercent}%.`);
  }

  if (settings.requireFullyPaid) {
    const netAmountDue = await resolveNetAmountDue(studentId);
    const summary = await computeStudentFinanceSummary(studentId, netAmountDue);
    if (summary.status !== "Fully Paid") reasons.push("Balance is not yet fully paid.");
  }

  return { eligible: reasons.length === 0, reasons };
}

export async function certificateRoutes(app: FastifyInstance) {
  app.get(
    "/api/students/:studentId/certificates",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Certificates", "VIEW")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const certificates = await db.certificate.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } });
      return reply.send({ certificates });
    },
  );

  // Evaluates the configured rule against REAL data (enrollment status,
  // Requirement verification, TrainingAttendance percentage, live finance
  // summary) — never a UI-only checkbox. Advances (or creates) the ONE
  // active Certificate row for this student+type; never creates a second
  // row for the same type (that only happens via /reissue, and only after
  // Issued).
  app.post(
    "/api/students/:studentId/certificates/evaluate",
    { preHandler: [requireAuth, requirePermission("Certificates", "EDIT")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const parsed = evaluateSchema.safeParse(request.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: "Invalid eligibility settings.", details: parsed.error.flatten() });

      const student = await db.student.findUnique({ where: { id: studentId } });
      if (!student) return reply.code(404).send({ error: "Student not found." });

      const { eligible, reasons } = await evaluateEligibility(studentId, parsed.data);

      let certificate = await db.certificate.findFirst({
        where: { studentId, certificateType: parsed.data.certificateType, reissueOfId: null },
        orderBy: { createdAt: "desc" },
      });

      const wasEligible = certificate?.status === "Eligible" || certificate?.status === "For Preparation" || certificate?.status === "Ready" || certificate?.status === "Issued";

      if (!certificate) {
        const batch = await db.batch.findUniqueOrThrow({ where: { id: student.batchId } });
        const certificateDisplayId = await generateCertificateDisplayId(batch.code);
        certificate = await db.certificate.create({
          data: { certificateDisplayId, studentId, batchId: student.batchId, certificateType: parsed.data.certificateType, status: eligible ? "Eligible" : "Not Eligible" },
        });
      } else if (certificate.status === "Not Eligible" && eligible) {
        certificate = await db.certificate.update({ where: { id: certificate.id }, data: { status: "Eligible" } });
      } else if (certificate.status === "Eligible" && !eligible) {
        certificate = await db.certificate.update({ where: { id: certificate.id }, data: { status: "Not Eligible" } });
      }

      if (eligible && !wasEligible) {
        await recordDomainEvent("CERTIFICATE_ELIGIBLE", { studentId, certificateId: certificate.id, certificateType: parsed.data.certificateType });
        await writeAuditLog({ action: "Certificate Eligible", summary: `${parsed.data.certificateType} certificate now eligible`, actorUserId: request.authContext!.userId, entityType: "Certificate", entityId: certificate.id });
      }

      return reply.send({ certificate, eligible, reasons });
    },
  );

  // Not Eligible -> Eligible -> For Preparation -> Ready -> Issued. Real
  // PDF generation does NOT exist in this build (spec section 32) — moving
  // to "Ready"/"Issued" never fabricates a file; fileDocumentId stays null
  // unless staff supplies an id for a file they generated/uploaded outside
  // this flow. A double-issue attempt on the same row is blocked (409),
  // the same guard pattern as payment verification.
  app.patch("/api/certificates/:certificateId", { preHandler: [requireAuth, requirePermission("Certificates", "EDIT")] }, async (request, reply) => {
    const { certificateId } = request.params as { certificateId: string };
    const parsed = z
      .object({ status: z.enum(["Eligible", "For Preparation", "Ready", "Issued"]), fileDocumentId: z.string().optional(), notes: z.string().optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const certificate = await db.certificate.findUnique({ where: { id: certificateId } });
    if (!certificate) return reply.code(404).send({ error: "Certificate not found." });
    if (certificate.status === "Issued" && parsed.data.status === "Issued") return reply.code(409).send({ error: "This certificate has already been issued." });

    const updated = await db.certificate.update({
      where: { id: certificateId },
      data: {
        status: parsed.data.status,
        notes: parsed.data.notes ?? certificate.notes,
        fileDocumentId: parsed.data.fileDocumentId ?? certificate.fileDocumentId,
        preparedById: parsed.data.status === "For Preparation" ? request.authContext!.userId : certificate.preparedById,
        preparedAt: parsed.data.status === "For Preparation" ? new Date() : certificate.preparedAt,
        issuedById: parsed.data.status === "Issued" ? request.authContext!.userId : certificate.issuedById,
        issuedAt: parsed.data.status === "Issued" ? new Date() : certificate.issuedAt,
        completionDate: parsed.data.status === "Issued" ? (certificate.completionDate ?? new Date()) : certificate.completionDate,
      },
    });

    if (parsed.data.status === "Ready") {
      await recordDomainEvent("CERTIFICATE_READY", { studentId: certificate.studentId, certificateId });
    }
    if (parsed.data.status === "Issued") {
      await recordDomainEvent("CERTIFICATE_ISSUED", { studentId: certificate.studentId, certificateId });
      await writeAuditLog({ action: "Certificate Issued", summary: `${certificate.certificateType} certificate issued`, actorUserId: request.authContext!.userId, entityType: "Certificate", entityId: certificateId });
    }

    return reply.send({ certificate: updated });
  });

  // Reissue creates a NEW row — the original stays exactly as it was
  // (spec section 34: never overwrite issuance history).
  app.post("/api/certificates/:certificateId/reissue", { preHandler: [requireAuth, requirePermission("Certificates", "EDIT")] }, async (request, reply) => {
    const { certificateId } = request.params as { certificateId: string };
    const original = await db.certificate.findUnique({ where: { id: certificateId } });
    if (!original) return reply.code(404).send({ error: "Certificate not found." });
    if (original.status !== "Issued" && original.status !== "Reissued") {
      return reply.code(409).send({ error: "Only an already-issued certificate can be reissued." });
    }

    const student = await db.student.findUniqueOrThrow({ where: { id: original.studentId } });
    const batch = await db.batch.findUniqueOrThrow({ where: { id: student.batchId } });
    const certificateDisplayId = await generateCertificateDisplayId(batch.code);

    const reissued = await db.certificate.create({
      data: {
        certificateDisplayId,
        studentId: original.studentId,
        batchId: original.batchId,
        program: original.program,
        certificateType: original.certificateType,
        status: "Reissued",
        completionDate: original.completionDate,
        issuedAt: new Date(),
        issuedById: request.authContext!.userId,
        reissueOfId: original.id,
      },
    });

    await writeAuditLog({ action: "Certificate Reissued", summary: `${original.certificateType} certificate reissued`, actorUserId: request.authContext!.userId, entityType: "Certificate", entityId: reissued.id });
    return reply.code(201).send({ certificate: reissued });
  });
}

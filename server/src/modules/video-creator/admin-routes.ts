// AI Video Creator admin API. Staff-only, gated by the "AI Video Creator"
// permission module (VIEW to read, EDIT to change anything). Every change is
// written to the audit log with the acting admin.

import type { FastifyInstance } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { hashPassword, validatePasswordStrength } from "../../auth/password.js";
import { revokeAllSessionsForUser } from "../../auth/session.js";
import { generateStudentDisplayId } from "../sequence.js";
import { isVeoConfigured, listVeoModels } from "../../ai/veo.js";
import { env } from "../../env.js";
import { adminAdjustCredits, getOrCreateAccount, InsufficientCreditsError, refundJobCredits } from "./credits.js";
import { ACTIVE_STATUSES, runVideoWorkerTick } from "./jobs.js";
import { isEmailConfigured, resetLink } from "./mailer.js";
import { mediaUrl, serializeJobForCustomer } from "./routes.js";
import { activeModelOf, getVideoCreatorSettings, KNOWN_DURATIONS, KNOWN_RESOLUTIONS } from "./settings.js";

const VIEW = [requireAuth, requirePermission("AI Video Creator", "VIEW")];
const EDIT = [requireAuth, requirePermission("AI Video Creator", "EDIT")];

const CUSTOMER_PACKAGE = "AI Video Creator";
const CUSTOMER_BATCH_CODE = "AIVC";

function generatePassword(): string {
  // 14 chars, guaranteed upper/lower/digit, no ambiguous characters.
  const pick = (set: string) => set[randomBytes(1)[0]! % set.length]!;
  const all = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const chars = [pick("ABCDEFGHJKLMNPQRSTUVWXYZ"), pick("abcdefghijkmnpqrstuvwxyz"), pick("23456789")];
  while (chars.length < 14) chars.push(pick(all));
  return chars.sort(() => randomBytes(1)[0]! - 128).join("");
}

async function issueResetToken(userId: string, hours: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.passwordResetToken.create({ data: { userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + hours * 3600_000) } });
  return token;
}

export async function videoCreatorAdminRoutes(app: FastifyInstance) {
  // ---- Overview / usage --------------------------------------------------
  app.get("/api/video-creator/admin/overview", { preHandler: VIEW }, async (_request, reply) => {
    const since30 = new Date(Date.now() - 30 * 86400_000);
    const where = { source: "VIDEO_CREATOR" };
    const [settings, byStatus, activeCustomers, totalCustomers, completedJobs, cost30, costAll, creditsByType, recentFailures, perDay] = await Promise.all([
      getVideoCreatorSettings(),
      db.videoGenerationJob.groupBy({ by: ["status"], where, _count: true }),
      db.videoCreatorAccount.count({ where: { accessStatus: "ACTIVE" } }),
      db.videoCreatorAccount.count(),
      db.videoGenerationJob.findMany({ where: { ...where, status: "COMPLETED", submittedAt: { not: null }, completedAt: { not: null } }, select: { submittedAt: true, createdAt: true, completedAt: true }, orderBy: { completedAt: "desc" }, take: 200 }),
      db.videoGenerationJob.aggregate({ where: { ...where, status: "COMPLETED", createdAt: { gte: since30 } }, _sum: { estimatedCostUsd: true, durationSeconds: true } }),
      db.videoGenerationJob.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { estimatedCostUsd: true, durationSeconds: true } }),
      db.videoCreditTransaction.groupBy({ by: ["type"], _sum: { amount: true }, _count: true }),
      db.videoGenerationJob.findMany({ where: { ...where, status: "FAILED" }, orderBy: { createdAt: "desc" }, take: 5, include: { student: { include: { person: true } } } }),
      db.$queryRaw<{ day: Date; completed: bigint; failed: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS day,
               COUNT(*) FILTER (WHERE "status" = 'COMPLETED') AS completed,
               COUNT(*) FILTER (WHERE "status" = 'FAILED') AS failed
        FROM "VideoGenerationJob" WHERE "source" = 'VIDEO_CREATOR' AND "createdAt" >= ${since30}
        GROUP BY 1 ORDER BY 1`,
    ]);
    const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
    const total = byStatus.reduce((n, s) => n + s._count, 0);
    const finished = (counts.COMPLETED ?? 0) + (counts.FAILED ?? 0);
    const durations = completedJobs.map((j) => (j.completedAt!.getTime() - j.createdAt.getTime()) / 1000).sort((a, b) => a - b);
    const pct = (p: number) => (durations.length ? Math.round(durations[Math.min(durations.length - 1, Math.floor(p * durations.length))]!) : null);
    return reply.send({
      provider: { connected: isVeoConfigured(), activeModel: activeModelOf(settings), generationEnabled: settings.generationEnabled },
      customers: { active: activeCustomers, total: totalCustomers },
      jobs: {
        total,
        completed: counts.COMPLETED ?? 0,
        failed: counts.FAILED ?? 0,
        inProgress: ACTIVE_STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0),
        successRate: finished ? Math.round(((counts.COMPLETED ?? 0) / finished) * 1000) / 10 : null,
      },
      timing: { medianSeconds: pct(0.5), p90Seconds: pct(0.9), sampleSize: durations.length },
      usage: {
        secondsGeneratedLast30Days: cost30._sum.durationSeconds ?? 0,
        estimatedCostUsdLast30Days: Number(cost30._sum.estimatedCostUsd ?? 0),
        secondsGeneratedAllTime: costAll._sum.durationSeconds ?? 0,
        estimatedCostUsdAllTime: Number(costAll._sum.estimatedCostUsd ?? 0),
      },
      credits: Object.fromEntries(creditsByType.map((c) => [c.type, { total: c._sum.amount ?? 0, count: c._count }])),
      perDay: perDay.map((d) => ({ day: d.day, completed: Number(d.completed), failed: Number(d.failed) })),
      recentFailures: recentFailures.map((j) => ({ id: j.id, displayId: j.jobDisplayId, customer: j.student.person.fullName, errorCategory: j.errorCategory, errorMessage: j.errorMessage, createdAt: j.createdAt })),
    });
  });

  // ---- Customers ---------------------------------------------------------
  app.get("/api/video-creator/admin/customers", { preHandler: VIEW }, async (request, reply) => {
    const { search } = request.query as { search?: string };
    const s = search?.trim();
    const accounts = await db.videoCreatorAccount.findMany({
      where: s ? { student: { OR: [{ person: { fullName: { contains: s, mode: "insensitive" } } }, { person: { email: { contains: s, mode: "insensitive" } } }, { studentDisplayId: { contains: s, mode: "insensitive" } }] } } : {},
      include: { student: { include: { person: { include: { user: { select: { id: true, email: true, status: true, lastLoginAt: true } } } } } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const stats = await db.videoGenerationJob.groupBy({ by: ["studentId", "status"], where: { source: "VIDEO_CREATOR", studentId: { in: accounts.map((a) => a.studentId) } }, _count: true });
    const byStudent = new Map<string, Record<string, number>>();
    for (const r of stats) byStudent.set(r.studentId, { ...(byStudent.get(r.studentId) ?? {}), [r.status]: r._count });
    return reply.send({
      customers: accounts.map((a) => ({
        studentId: a.studentId,
        displayId: a.student.studentDisplayId,
        fullName: a.student.person.fullName,
        email: a.student.person.user?.email ?? a.student.person.email,
        loginStatus: a.student.person.user?.status ?? "NO_LOGIN",
        lastLoginAt: a.student.person.user?.lastLoginAt ?? null,
        accessStatus: a.accessStatus,
        creditBalance: a.creditBalance,
        purchaseReference: a.purchaseReference,
        notes: a.notes,
        activatedAt: a.activatedAt,
        videos: { completed: byStudent.get(a.studentId)?.COMPLETED ?? 0, failed: byStudent.get(a.studentId)?.FAILED ?? 0 },
        createdAt: a.createdAt,
      })),
    });
  });

  // Creates a login for a customer whose purchase was verified OUTSIDE this
  // app (e.g. by the enrollment team). Returns a one-time temporary password.
  app.post("/api/video-creator/admin/customers", { preHandler: EDIT }, async (request, reply) => {
    const parsed = z
      .object({
        fullName: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(200),
        initialCredits: z.number().int().min(0).max(10000).optional(),
        purchaseReference: z.string().trim().max(200).optional(),
        notes: z.string().trim().max(1000).optional(),
        password: z.string().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Please enter a full name and a valid email." });
    const d = parsed.data;
    const email = d.email.toLowerCase();
    const ctx = request.authContext!;

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      const student = await db.student.findUnique({ where: { personId: existingUser.personId } });
      if (!student) return reply.code(409).send({ error: "This email belongs to a staff account." });
      return reply.code(409).send({ error: "A customer with this email already exists. Use Activate / Add credits on their row instead.", studentId: student.id });
    }
    const password = d.password || generatePassword();
    const weak = validatePasswordStrength(password);
    if (weak) return reply.code(400).send({ error: weak });

    const settings = await getVideoCreatorSettings();
    const credits = d.initialCredits ?? settings.defaultStartingCredits;
    const [pkg, batch, studentRole] = await Promise.all([
      db.package.upsert({ where: { name: CUSTOMER_PACKAGE }, update: {}, create: { name: CUSTOMER_PACKAGE, description: "M.A.I.A. AI Video Creator founding package", defaultPrice: 5000 } }),
      db.batch.upsert({ where: { code: CUSTOMER_BATCH_CODE }, update: {}, create: { code: CUSTOMER_BATCH_CODE, label: "AI Video Creator Customers", status: "ACTIVE" } }),
      db.role.upsert({ where: { name: "Student" }, update: {}, create: { name: "Student" } }),
    ]);
    const studentDisplayId = await generateStudentDisplayId(CUSTOMER_BATCH_CODE);
    const passwordHash = await hashPassword(password);

    const { student, account } = await db.$transaction(async (tx) => {
      const person = await tx.person.create({ data: { fullName: d.fullName, email } });
      await tx.user.create({ data: { personId: person.id, email, passwordHash, roleId: studentRole.id, status: "ACTIVE" } });
      const student = await tx.student.create({ data: { studentDisplayId, personId: person.id, batchId: batch.id, packageId: pkg.id, enrollmentStatus: "Active Student" } });
      await tx.business.create({ data: { studentId: student.id, name: `${d.fullName}'s Business` } });
      const account = await tx.videoCreatorAccount.create({
        data: { studentId: student.id, accessStatus: "ACTIVE", creditBalance: 0, activatedAt: new Date(), activatedById: ctx.userId, purchaseReference: d.purchaseReference || null, notes: d.notes || null },
      });
      return { student, account };
    });
    if (credits > 0) {
      await adminAdjustCredits({ studentId: student.id, amount: credits, reason: `Starting credits${d.purchaseReference ? ` (purchase ${d.purchaseReference})` : ""}`, actorUserId: ctx.userId, idempotencyKey: `grant:initial:${account.id}` });
    }
    await writeAuditLog({ action: "Video Creator Customer Created", summary: `${ctx.fullName} created customer ${d.fullName} <${email}> with ${credits} credit(s)`, actorUserId: ctx.userId, entityType: "Student", entityId: student.id });
    return reply.code(201).send({ studentId: student.id, email, temporaryPassword: password, creditBalance: credits, loginUrl: `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/studio/login` });
  });

  // Enables the Video Creator for an EXISTING academy student (no new login).
  app.post("/api/video-creator/admin/customers/:studentId/activate", { preHandler: EDIT }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const body = z.object({ purchaseReference: z.string().max(200).optional() }).safeParse(request.body ?? {});
    const student = await db.student.findUnique({ where: { id: studentId }, include: { person: true } });
    if (!student) return reply.code(404).send({ error: "Customer not found." });
    await getOrCreateAccount(studentId);
    const ctx = request.authContext!;
    await db.videoCreatorAccount.update({ where: { studentId }, data: { accessStatus: "ACTIVE", activatedAt: new Date(), activatedById: ctx.userId, deactivatedAt: null, ...(body.success && body.data.purchaseReference ? { purchaseReference: body.data.purchaseReference } : {}) } });
    await writeAuditLog({ action: "Video Creator Access Activated", summary: `${ctx.fullName} activated AI Video Creator access for ${student.person.fullName}`, actorUserId: ctx.userId, entityType: "Student", entityId: studentId });
    return reply.send({ ok: true });
  });

  app.post("/api/video-creator/admin/customers/:studentId/suspend", { preHandler: EDIT }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const student = await db.student.findUnique({ where: { id: studentId }, include: { person: true } });
    if (!student) return reply.code(404).send({ error: "Customer not found." });
    await getOrCreateAccount(studentId);
    const ctx = request.authContext!;
    await db.videoCreatorAccount.update({ where: { studentId }, data: { accessStatus: "SUSPENDED", deactivatedAt: new Date() } });
    await writeAuditLog({ action: "Video Creator Access Suspended", summary: `${ctx.fullName} suspended AI Video Creator access for ${student.person.fullName}`, actorUserId: ctx.userId, entityType: "Student", entityId: studentId });
    return reply.send({ ok: true });
  });

  app.post("/api/video-creator/admin/customers/:studentId/credits", { preHandler: EDIT }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = z.object({ amount: z.number().int().min(-10000).max(10000).refine((n) => n !== 0, "Amount cannot be zero"), reason: z.string().trim().min(3).max(300), idempotencyKey: z.string().min(8).max(100).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Enter a non-zero whole number of credits and a reason." });
    const student = await db.student.findUnique({ where: { id: studentId }, include: { person: true } });
    if (!student) return reply.code(404).send({ error: "Customer not found." });
    const ctx = request.authContext!;
    try {
      const { transaction, applied } = await adminAdjustCredits({ studentId, amount: parsed.data.amount, reason: parsed.data.reason, actorUserId: ctx.userId, idempotencyKey: `admin:${parsed.data.idempotencyKey ?? randomUUID()}` });
      if (applied) await writeAuditLog({ action: "Video Credits Adjusted", summary: `${ctx.fullName} ${parsed.data.amount > 0 ? "added" : "removed"} ${Math.abs(parsed.data.amount)} credit(s) for ${student.person.fullName}: ${parsed.data.reason}`, actorUserId: ctx.userId, entityType: "Student", entityId: studentId });
      return reply.send({ balance: transaction.balanceAfter, applied });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) return reply.code(400).send({ error: `This customer only has ${err.balance} credit(s); you cannot remove ${err.required}.` });
      throw err;
    }
  });

  app.get("/api/video-creator/admin/customers/:studentId/transactions", { preHandler: VIEW }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const account = await db.videoCreatorAccount.findUnique({ where: { studentId } });
    if (!account) return reply.send({ transactions: [] });
    const rows = await db.videoCreditTransaction.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "desc" }, take: 300 });
    return reply.send({ balance: account.creditBalance, transactions: rows });
  });

  // For customers who forgot their password when no email provider is set
  // up: the admin sends this link through Messenger/SMS/etc. Valid 24h.
  app.post("/api/video-creator/admin/customers/:studentId/reset-link", { preHandler: EDIT }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const student = await db.student.findUnique({ where: { id: studentId }, include: { person: { include: { user: true } } } });
    const user = student?.person.user;
    if (!student || !user) return reply.code(404).send({ error: "This customer has no login." });
    const token = await issueResetToken(user.id, 24);
    const ctx = request.authContext!;
    await writeAuditLog({ action: "Password Reset Link Issued", summary: `${ctx.fullName} issued a password reset link for ${student.person.fullName}`, actorUserId: ctx.userId, entityType: "User", entityId: user.id });
    return reply.send({ url: resetLink(token), expiresInHours: 24 });
  });

  app.post("/api/video-creator/admin/customers/:studentId/login", { preHandler: EDIT }, async (request, reply) => {
    // Enable/disable the login itself (separate from Video Creator access).
    const { studentId } = request.params as { studentId: string };
    const parsed = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status." });
    const student = await db.student.findUnique({ where: { id: studentId }, include: { person: { include: { user: true } } } });
    const user = student?.person.user;
    if (!student || !user) return reply.code(404).send({ error: "This customer has no login." });
    await db.user.update({ where: { id: user.id }, data: { status: parsed.data.status } });
    if (parsed.data.status !== "ACTIVE") await revokeAllSessionsForUser(user.id);
    const ctx = request.authContext!;
    await writeAuditLog({ action: parsed.data.status === "ACTIVE" ? "Video Creator Access Activated" : "Video Creator Access Suspended", summary: `${ctx.fullName} set login for ${student.person.fullName} to ${parsed.data.status}`, actorUserId: ctx.userId, entityType: "User", entityId: user.id });
    return reply.send({ ok: true });
  });

  // ---- Jobs --------------------------------------------------------------
  app.get("/api/video-creator/admin/jobs", { preHandler: VIEW }, async (request, reply) => {
    const q = z.object({ status: z.string().optional(), studentId: z.string().optional(), search: z.string().max(100).optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }).safeParse(request.query);
    if (!q.success) return reply.code(400).send({ error: "Invalid filter." });
    const { status, studentId, search, limit } = q.data;
    const jobs = await db.videoGenerationJob.findMany({
      where: {
        source: "VIDEO_CREATOR",
        ...(status === "IN_PROGRESS" ? { status: { in: [...ACTIVE_STATUSES] } } : status && status !== "ALL" ? { status } : {}),
        ...(studentId ? { studentId } : {}),
        ...(search ? { OR: [{ jobDisplayId: { contains: search, mode: "insensitive" as const } }, { student: { person: { fullName: { contains: search, mode: "insensitive" as const } } } }] } : {}),
      },
      include: { student: { include: { person: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return reply.send({
      jobs: jobs.map((j) => ({
        ...serializeJobForCustomer(j),
        customer: { studentId: j.studentId, fullName: j.student.person.fullName },
        model: j.model,
        errorCategory: j.errorCategory,
        errorMessage: j.errorMessage,
        submitAttempts: j.submitAttempts,
        estimatedCostUsd: j.estimatedCostUsd === null ? null : Number(j.estimatedCostUsd),
        deletedAt: j.deletedAt,
      })),
    });
  });

  app.get("/api/video-creator/admin/jobs/:id", { preHandler: VIEW }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await db.videoGenerationJob.findUnique({ where: { id }, include: { student: { include: { person: true } } } });
    if (!job || job.source !== "VIDEO_CREATOR") return reply.code(404).send({ error: "Job not found." });
    const ledger = await db.videoCreditTransaction.findMany({ where: { jobId: id }, orderBy: { createdAt: "asc" } });
    return reply.send({
      job: {
        ...serializeJobForCustomer(job),
        customer: { studentId: job.studentId, fullName: job.student.person.fullName },
        model: job.model,
        prompt: job.prompt,
        negativePrompt: job.negativePrompt,
        operationName: job.operationName,
        errorCategory: job.errorCategory,
        errorMessage: job.errorMessage,
        submitAttempts: job.submitAttempts,
        pollFailures: job.pollFailures,
        estimatedCostUsd: job.estimatedCostUsd === null ? null : Number(job.estimatedCostUsd),
        firstFrameUrl: mediaUrl(job.firstFrameDocumentId, job.id, "inline"),
        deletedAt: job.deletedAt,
      },
      ledger,
    });
  });

  // Free re-run of a FAILED job on the customer's behalf (no new charge —
  // the original charge was already refunded).
  app.post("/api/video-creator/admin/jobs/:id/retry", { preHandler: EDIT }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await db.videoGenerationJob.findUnique({ where: { id } });
    if (!job || job.source !== "VIDEO_CREATOR") return reply.code(404).send({ error: "Job not found." });
    if (job.status !== "FAILED") return reply.code(409).send({ error: "Only failed jobs can be retried." });
    await db.videoGenerationJob.update({
      where: { id },
      data: { status: "QUEUED", operationName: null, submittedAt: null, completedAt: null, submitAttempts: 0, pollFailures: 0, nextAttemptAt: null, lockedUntil: null, errorCategory: null, errorMessage: null, statusMessage: "Retry requested by support. Waiting to start…", deletedAt: null },
    });
    const ctx = request.authContext!;
    await writeAuditLog({ action: "Video Creator Job Retried", summary: `${ctx.fullName} retried ${job.jobDisplayId} at no charge`, actorUserId: ctx.userId, entityType: "VideoGenerationJob", entityId: id });
    return reply.send({ ok: true });
  });

  // Goodwill refund (e.g. a completed video the customer is unhappy with).
  app.post("/api/video-creator/admin/jobs/:id/refund", { preHandler: EDIT }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ reason: z.string().trim().min(3).max(300) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Please give a reason." });
    const job = await db.videoGenerationJob.findUnique({ where: { id } });
    if (!job || job.source !== "VIDEO_CREATOR") return reply.code(404).send({ error: "Job not found." });
    if ((ACTIVE_STATUSES as readonly string[]).includes(job.status)) return reply.code(409).send({ error: "Wait for this job to finish first." });
    const ctx = request.authContext!;
    const refunded = await refundJobCredits(id, `Admin refund: ${parsed.data.reason}`, ctx.userId);
    if (!refunded) return reply.code(409).send({ error: "This job's credits were already returned." });
    await writeAuditLog({ action: "Video Credits Refunded", summary: `${ctx.fullName} refunded ${job.creditsCharged} credit(s) for ${job.jobDisplayId}: ${parsed.data.reason}`, actorUserId: ctx.userId, entityType: "VideoGenerationJob", entityId: id });
    return reply.send({ ok: true });
  });

  // ---- Settings + provider -----------------------------------------------
  app.get("/api/video-creator/admin/settings", { preHandler: VIEW }, async (_request, reply) => {
    const settings = await getVideoCreatorSettings();
    return reply.send({ settings, effectiveModel: activeModelOf(settings), envDefaultModel: env.GOOGLE_VEO_MODEL, knownDurations: KNOWN_DURATIONS, knownResolutions: KNOWN_RESOLUTIONS, providerConnected: isVeoConfigured(), emailConfigured: isEmailConfigured() });
  });

  app.put("/api/video-creator/admin/settings", { preHandler: EDIT }, async (request, reply) => {
    const priceMap = z.record(z.string().regex(/^[a-zA-Z0-9._-]+$/), z.object({ "720p": z.number().min(0).max(100).optional(), "1080p": z.number().min(0).max(100).optional() }));
    const parsed = z
      .object({
        generationEnabled: z.boolean(),
        activeModel: z.string().trim().regex(/^[a-zA-Z0-9._-]*$/).max(100).nullable(),
        creditsPerVideo: z.number().int().min(1).max(1000),
        extraCreditsFor1080p: z.number().int().min(0).max(1000),
        defaultStartingCredits: z.number().int().min(0).max(10000),
        maxActiveJobsPerUser: z.number().int().min(1).max(20),
        maxActiveJobsGlobal: z.number().int().min(1).max(200),
        allowedDurations: z.array(z.union([z.literal(4), z.literal(6), z.literal(8)])).min(1),
        allowedResolutions: z.array(z.enum(KNOWN_RESOLUTIONS)).min(1),
        modelPricing: priceMap,
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Some settings are invalid.", details: parsed.error.flatten() });
    const ctx = request.authContext!;
    const before = await getVideoCreatorSettings();
    const d = parsed.data;
    const updated = await db.videoCreatorSettings.update({
      where: { id: "singleton" },
      data: { ...d, activeModel: d.activeModel || null, allowedDurations: [...new Set(d.allowedDurations)].sort(), allowedResolutions: [...new Set(d.allowedResolutions)], modelPricing: d.modelPricing as Prisma.InputJsonValue, updatedById: ctx.userId },
    });
    const changed = (Object.keys(d) as (keyof typeof d)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(updated[k]));
    await writeAuditLog({ action: "Video Creator Settings Changed", summary: `${ctx.fullName} changed: ${changed.join(", ") || "nothing"}${changed.includes("activeModel") ? ` (model → ${activeModelOf(updated)})` : ""}${changed.includes("creditsPerVideo") ? ` (credits/video ${before.creditsPerVideo} → ${updated.creditsPerVideo})` : ""}`, actorUserId: ctx.userId, entityType: "VideoCreatorSettings", entityId: "singleton" });
    return reply.send({ settings: updated, effectiveModel: activeModelOf(updated) });
  });

  // Asks Google directly which Veo models this API key can use.
  app.post("/api/video-creator/admin/provider/check", { preHandler: VIEW, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (_request, reply) => {
    const settings = await getVideoCreatorSettings();
    const result = await listVeoModels();
    if (!result.ok) return reply.send({ connected: false, errorCategory: result.errorCategory, message: result.message });
    const active = activeModelOf(settings);
    return reply.send({
      connected: true,
      activeModel: active,
      activeModelAvailable: result.data.some((m) => m.id === active),
      models: result.data.map((m) => ({ ...m, supportsVideoGeneration: m.supportedGenerationMethods.includes("predictLongRunning") })),
    });
  });

  // Runs one worker pass immediately (useful right after fixing a provider problem).
  app.post("/api/video-creator/admin/worker/run", { preHandler: EDIT }, async (_request, reply) => {
    const processed = await runVideoWorkerTick();
    return reply.send({ processed });
  });

  // ---- Audit -------------------------------------------------------------
  app.get("/api/video-creator/admin/audit", { preHandler: VIEW }, async (_request, reply) => {
    const rows = await db.activityLog.findMany({
      where: { OR: [{ action: { startsWith: "Video" } }, { action: { in: ["Password Reset Link Issued", "Password Changed", "Login Failed"] } }] },
      orderBy: { occurredAt: "desc" },
      take: 300,
    });
    return reply.send({ entries: rows.map((r) => ({ id: r.id, action: r.action, summary: r.summary, actorUserId: r.actorUserId, entityType: r.entityType, entityId: r.entityId, createdAt: r.occurredAt })) });
  });
}

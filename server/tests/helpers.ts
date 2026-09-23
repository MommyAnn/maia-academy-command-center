// NODE_ENV=test is set via vitest.config.ts's `test.env` (applied before any
// test file's imports run), which is what makes src/env.ts load .env.test.

import type { FastifyInstance } from "fastify";
import { db } from "../src/db.js";
import { runDevSeed } from "../prisma/seed.js";
import { AI_TOOL_SEED_DEFS } from "../src/modules/ai-tools/seed-data.js";

/** Wipes every table this test suite might have written to, then reseeds baseline roles/packages/batch/dev users. Keeps each test file's assertions deterministic regardless of run order. */
const FIXED_PERSON_IDS = ["seed-owner-person", "seed-finance-person", "seed-student-a-person", "seed-student-b-person"];
const FIXED_STUDENT_DISPLAY_IDS = ["MAIA-B14-DEV-A", "MAIA-B14-DEV-B"];

/**
 * Also deletes every Student/Person/User this suite created beyond the four
 * fixed dev-seed identities (e.g. via /api/enroll or a Lead conversion) —
 * not just the dev-seed Users themselves. Without this, the Counter table
 * reset below would restart a scope like `student:14` back at 1 while an
 * OLD Student row from a previous test file's run still occupies
 * "MAIA-B14-0001", producing a real unique-constraint collision that has
 * nothing to do with the concurrency-safety logic under test.
 */
export async function resetDb() {
  await db.$transaction([
    // Phase 7 (Data Migration Framework) — ImportRecord cascades from
    // ImportBatch, but PaymentTransaction.importBatchId has no hard FK
    // (it's a soft provenance reference), so clearing ImportBatch is safe
    // before or after PaymentTransaction. Cleared first regardless, since
    // it must go before Student/Person/Batch below.
    db.importBatch.deleteMany(),
    // Phase 10 (M.A.I.A. Intelligence) — IntelligenceSignal has a hard FK to
    // IntelligenceRule, so it must clear first; rules themselves are reset
    // and reseeded every run too (same "always reset even seed-managed
    // rows" principle already used for PromptVersion/AiTool above).
    db.intelligenceSignal.deleteMany(),
    db.intelligenceRule.deleteMany(),
    db.requirementReview.deleteMany(),
    db.requirement.deleteMany(),
    db.studentNote.deleteMany(),
    // Phase 5 (GHL / Communications) — IntegrationOutboxEvent has a real
    // (RESTRICT) FK to DomainEvent, so it must be cleared first; the rest
    // of these have no hard FK to Person/Student/DomainEvent but are reset
    // every run anyway so their own unique constraints (eventKey,
    // maiaField, the singleton config id) never collide across test files.
    db.integrationOutboxEvent.deleteMany(),
    db.ghlWebhookEvent.deleteMany(),
    db.communicationLog.deleteMany(),
    db.ghlContactMap.deleteMany(),
    db.automationExecution.deleteMany(),
    db.automationRule.deleteMany(),
    db.messageTemplate.deleteMany(),
    db.ghlTagMapping.deleteMany(),
    db.ghlCustomFieldMapping.deleteMany(),
    db.ghlWorkflowMapping.deleteMany(),
    db.ghlIntegrationConfig.deleteMany(),
    // Phase 6 (Brand Master Brain / AI Business Tools) — AiHandoff has real
    // FKs to AiGeneration (x2) and AiTool; AiGeneration/AiProject/
    // AiManualGrant/MasterBrainSubmission all reference Student, so all of
    // this must clear before the Student/Person cleanup below.
    // PromptVersion is cleared and always re-seeded (not just upserted) so
    // a test-created DRAFT/version number never collides with another test
    // file's — matches the same "reset even what's normally seed-managed"
    // principle already used for GhlTagMapping etc. above.
    db.aiHandoff.deleteMany(),
    db.aiGeneration.deleteMany(),
    db.aiProject.deleteMany(),
    db.aiUsageLimit.deleteMany(),
    db.aiManualGrant.deleteMany(),
    db.promptVersion.deleteMany(),
    // Also removes an ad-hoc AiTool a test file created directly (e.g. a
    // "no access" fixture) — the 18 real seeded tools are matched by key
    // and always survive, exactly like the Batch/Package cleanup below.
    // Runs only after every table with a hard FK to AiTool is cleared above.
    db.aiTool.deleteMany({ where: { toolKey: { notIn: AI_TOOL_SEED_DEFS.map((d) => d.toolKey) } } }),
    db.masterBrainDocument.deleteMany(),
    db.masterBrainRevisionRequest.deleteMany(),
    db.masterBrainSubmission.deleteMany(),
    db.business.deleteMany(),
    db.domainEvent.deleteMany(),
    db.activityLog.deleteMany(),
    db.paymentTransaction.deleteMany(),
    db.enrollment.deleteMany(),
    db.leadStudentConversion.deleteMany(),
    db.leadActivity.deleteMany(),
    // Phase 4 (Free Webinar / Lead / Pipeline / Follow-Up) — WebinarRegistration
    // and FollowUp both have a plain (non-cascading) FK to Lead, so they
    // must be cleared before Lead itself; LeadPipelineHistory/LeadNote/
    // LeadConsentEvent all cascade automatically when their Lead row goes.
    // Task has no real FK to FollowUp (just a soft taskId string), so order
    // relative to FollowUp doesn't matter.
    db.webinarRegistration.deleteMany(),
    db.followUp.deleteMany(),
    db.task.deleteMany(),
    db.lead.deleteMany(),
    db.document.deleteMany(),
    db.session.deleteMany(),
    db.passwordResetToken.deleteMany(),
    db.user.deleteMany(),
    // Phase 3 (Training/LMS/Certificates/Feedback) — deleted in dependency
    // order: IncentiveRedemption/MarketingConsent before the
    // FeedbackSubmission they reference; LessonProgress/CourseAccessGrant/
    // PackageCourseAccess before Course (whose own delete cascades
    // CourseModule -> Lesson -> LessonResource); TrainingAttendance before
    // TrainingSession. All of this must run before the Student cleanup
    // below, since none of these FKs are ON DELETE CASCADE from Student.
    db.incentiveRedemption.deleteMany(),
    db.marketingConsent.deleteMany(),
    db.feedbackSubmission.deleteMany(),
    db.feedbackRequest.deleteMany(),
    db.incentive.deleteMany(),
    db.lessonProgress.deleteMany(),
    db.courseAccessGrant.deleteMany(),
    db.packageCourseAccess.deleteMany(),
    db.course.deleteMany(),
    db.trainingAttendance.deleteMany(),
    db.trainingSession.deleteMany(),
    db.certificate.deleteMany(),
    // Staff has a plain (RESTRICT) FK to Person — the dev-seed Owner/
    // Finance/Student accounts never have a Staff row (only the frontend's
    // own demo data model implies staff, not the Phase 1 seed), so it is
    // always safe to clear every Staff row here.
    db.staff.deleteMany(),
    db.student.deleteMany({ where: { studentDisplayId: { notIn: FIXED_STUDENT_DISPLAY_IDS } } }),
    db.person.deleteMany({ where: { id: { notIn: FIXED_PERSON_IDS } } }),
    // Also cleans up Batches/Packages a Phase 2 test file created (e.g. a
    // uniquely-coded/-named CRUD fixture) — otherwise a re-run collides on
    // that same unique code/name exactly like the Student case above.
    db.batch.deleteMany({ where: { code: { not: "14" } } }),
    db.package.deleteMany({ where: { name: { notIn: ["Premium", "VIP", "Dual VIP"] } } }),
    db.webinarSession.deleteMany(),
    db.counter.deleteMany(),
  ]);
  await runDevSeed();
}

export async function loginAs(app: FastifyInstance, email: string, password: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`Login failed for ${email}: ${res.statusCode} ${res.body}`);
  const setCookie = res.headers["set-cookie"];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!cookieHeader) throw new Error("Login succeeded but no session cookie was set.");
  return cookieHeader.split(";")[0]!; // "maia_session=<token>"
}

export const DEV_USERS = {
  owner: { email: "owner-dev@maiaacademy.local", password: "DevSeedOwner123!" },
  finance: { email: "finance-dev@maiaacademy.local", password: "DevSeedFinance123!" },
  studentA: { email: "student-a-dev@maiaacademy.local", password: "DevSeedStudentA123!" },
  studentB: { email: "student-b-dev@maiaacademy.local", password: "DevSeedStudentB123!" },
};

import { db } from "../db.js";

// Concurrency-safe sequence generation (spec section 29). An atomic
// upsert-increment is race-free under Postgres's row-level locking on the
// UPDATE — two concurrent enrollments for the same batch can never receive
// the same number, unlike a naive "count existing rows + 1" approach.
export async function nextSequence(scope: string): Promise<number> {
  const row = await db.counter.upsert({
    where: { scope },
    update: { value: { increment: 1 } },
    create: { scope, value: 1 },
  });
  return row.value;
}

export async function generateStudentDisplayId(batchCode: string): Promise<string> {
  const n = await nextSequence(`student:${batchCode}`);
  return `MAIA-B${batchCode}-${String(n).padStart(4, "0")}`;
}

export async function generateEnrollmentDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`enrollment:${year}`);
  return `ENR-${year}-${String(n).padStart(6, "0")}`;
}

export async function generatePaymentDisplayId(batchCode: string): Promise<string> {
  const n = await nextSequence(`payment:${batchCode}`);
  return `PAY-B${batchCode}-${String(n).padStart(6, "0")}`;
}

export async function generateLeadDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`lead:${year}`);
  return `LEAD-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateTrainingSessionDisplayId(batchCode: string): Promise<string> {
  const n = await nextSequence(`training:${batchCode}`);
  return `TRN-B${batchCode}-${String(n).padStart(4, "0")}`;
}

export async function generateCourseDisplayId(): Promise<string> {
  const n = await nextSequence("course");
  return `CRS-${String(n).padStart(4, "0")}`;
}

export async function generateLessonDisplayId(): Promise<string> {
  const n = await nextSequence("lesson");
  return `LSN-${String(n).padStart(6, "0")}`;
}

export async function generateCertificateDisplayId(batchCode: string): Promise<string> {
  const n = await nextSequence(`certificate:${batchCode}`);
  return `CERT-B${batchCode}-${String(n).padStart(6, "0")}`;
}

export async function generateFeedbackRequestDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`feedback-request:${year}`);
  return `FREQ-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateFeedbackSubmissionDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`feedback-submission:${year}`);
  return `FDBK-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateWebinarSessionDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`webinar:${year}`);
  return `WEB-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAiProjectDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ai-project:${year}`);
  return `PROJ-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAiGenerationDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ai-generation:${year}`);
  return `GEN-${year}-${String(n).padStart(6, "0")}`;
}

/** Distinct prefix from generatePaymentDisplayId — a legacy-imported payment must never look like a normally-recorded one. */
export async function generateLegacyPaymentDisplayId(batchCode: string): Promise<string> {
  const n = await nextSequence(`legacy-payment:${batchCode}`);
  return `LEGACY-B${batchCode}-${String(n).padStart(6, "0")}`;
}

export async function generateCampaignDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`campaign:${year}`);
  return `CAMP-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateCreativePackageDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`creative-package:${year}`);
  return `CRPKG-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateJourneyDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`journey:${year}`);
  return `JRNY-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAutomationDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`automation:${year}`);
  return `AUTO-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAutomationRunDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`automation-run:${year}`);
  return `RUN-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateOfferDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`offer:${year}`);
  return `OFFER-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateWebsiteDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`website:${year}`);
  return `WEB-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateFunnelDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`funnel:${year}`);
  return `FNL-${year}-${String(n).padStart(6, "0")}`;
}

export async function generatePageDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`page:${year}`);
  return `PAGE-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateFormDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`form:${year}`);
  return `FORM-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAdConnectionDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ad-connection:${year}`);
  return `ADCONN-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAdAccountDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ad-account:${year}`);
  return `ADACC-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAdCampaignDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ad-campaign:${year}`);
  return `ADCMP-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAdSetDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ad-set:${year}`);
  return `ADSET-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAdDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ad:${year}`);
  return `AD-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAdRecommendationDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ad-recommendation:${year}`);
  return `ADREC-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAdOptimizationActionDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ad-optimization-action:${year}`);
  return `ADACT-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAdTestPlanDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ad-test-plan:${year}`);
  return `ADTEST-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAdCampaignPlanDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ad-campaign-plan:${year}`);
  return `ADPLAN-${year}-${String(n).padStart(6, "0")}`;
}

export async function generateAdImportBatchDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequence(`ad-import-batch:${year}`);
  return `ADIMP-${year}-${String(n).padStart(6, "0")}`;
}

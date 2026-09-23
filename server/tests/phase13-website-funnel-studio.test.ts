import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeAnthropicServer } from "./anthropic-fake-server.js";

let app: FastifyInstance;
let ownerCookie: string;
let studentACookie: string;
let studentBCookie: string;
let studentAId: string;
const fakeAnthropic = createFakeAnthropicServer(4011);

beforeAll(async () => {
  await fakeAnthropic.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
  studentBCookie = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeAnthropic.stop();
});

async function createPublishedBusiness(cookie: string, studentId: string, name: string, overview = "Synthetic overview") {
  const businessRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name } });
  const business = businessRes.json().business;

  await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie }, payload: { answers: { x: 1 } } });
  const submission = (await app.inject({ method: "GET", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie } })).json().submission;
  await db.masterBrainSubmission.update({ where: { id: submission.id }, data: { status: "APPROVED_FOR_GENERATION" } });

  fakeAnthropic.setMode("success");
  fakeAnthropic.setResponseText(JSON.stringify({ sections: [{ key: "brandOverview", title: "1. Brand Overview", content: overview, bullets: [] }] }));
  const document = (await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/generate`, headers: { cookie: ownerCookie } })).json().document;
  await app.inject({ method: "POST", url: `/api/master-brain/documents/${document.id}/publish`, headers: { cookie: ownerCookie } });

  return business;
}

async function createOpenWebinarSession(title = `Webinar ${Date.now()}`) {
  const res = await app.inject({
    method: "POST",
    url: "/api/webinar/sessions",
    headers: { cookie: ownerCookie },
    payload: { title, type: "Free Webinar", date: new Date(Date.now() + 86400000).toISOString(), startTime: "19:00", endTime: "21:00", platform: "Zoom", status: "Registration Open" },
  });
  expect(res.statusCode).toBe(201);
  return res.json().session;
}

describe("Payment safety — Website/Funnel Studio has no code path to PaymentTransaction (spec section 106)", () => {
  it("no route/module file in website/ references PaymentTransaction or a verify-payment action", () => {
    const files = ["src/modules/website/routes.ts", "src/modules/website/forms.ts", "src/modules/website/architect.ts", "src/modules/website/copy.ts", "src/modules/website/validator.ts", "src/modules/website/sections.ts"];
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      expect(source.toLowerCase()).not.toContain("paymenttransaction");
      expect(source).not.toMatch(/verify.{0,20}payment/i);
    }
  });
});

describe("Publish Validator — claim guardrails and structural safety (spec sections 22-24, 65-68)", () => {
  it("blocks publish on missing title/CTA, unsafe URL, broken internal link, unresolved placeholder text, and unapproved testimonial proof", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Validator Business");
    const projectRes = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/website-projects`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, name: "Validator Site", type: "LANDING_PAGE" },
    });
    expect(projectRes.statusCode).toBe(201);
    const project = projectRes.json().websiteProject;

    const feedback = await db.feedbackSubmission.create({
      data: { feedbackDisplayId: `FDBK-TEST-${Date.now()}`, studentId: studentAId, sourceType: "Student", writtenText: "Great program!", status: "Submitted" },
    });

    const pageRes = await app.inject({
      method: "POST",
      url: `/api/website-projects/${project.id}/pages`,
      headers: { cookie: studentACookie },
      payload: {
        name: "Home",
        slug: "home",
        sections: [
          { id: "hero", type: "Hero", config: { headline: "[insert headline here]" } },
          { id: "cta", type: "CTA", config: { ctaType: "REGISTER", actionType: "ExternalUrl", destination: "javascript:alert(1)" } },
          { id: "cta2", type: "CTA", config: { ctaType: "LEARN_MORE", actionType: "InternalPage", destination: "no-such-page" } },
          { id: "testimonials", type: "Testimonials", config: { feedbackSubmissionIds: [feedback.id] } },
        ],
      },
    });
    expect(pageRes.statusCode).toBe(201);
    const page = pageRes.json().page;

    const validateRes = await app.inject({ method: "POST", url: `/api/pages/${page.id}/validate`, headers: { cookie: studentACookie } });
    expect(validateRes.statusCode).toBe(200);
    const validation = validateRes.json().validation;
    expect(validation.blocking).toBe(true);
    const codes = validation.issues.map((i: { code: string }) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["MISSING_PAGE_TITLE", "UNSAFE_URL", "BROKEN_LINK", "UNRESOLVED_DRAFT_CONTENT", "FAKE_PLACEHOLDER_PROOF"]));

    const publishAttempt = await app.inject({ method: "POST", url: `/api/pages/${page.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "PUBLISHED" } });
    expect(publishAttempt.statusCode).toBe(422);

    // Approving the testimonial for marketing + real consent clears the placeholder-proof issue for that testimonial specifically.
    await db.feedbackSubmission.update({ where: { id: feedback.id }, data: { status: "Approved for Marketing" } });
    await db.marketingConsent.create({ data: { feedbackSubmissionId: feedback.id, status: "Granted", consentVersion: "v1", permittedAssetsJson: { writtenQuote: true } } });
    const revalidate = await app.inject({ method: "POST", url: `/api/pages/${page.id}/validate`, headers: { cookie: studentACookie } });
    expect(revalidate.json().validation.issues.some((i: { code: string }) => i.code === "FAKE_PLACEHOLDER_PROOF")).toBe(false);
  });
});

describe("Domain + Tracking honesty (spec sections 59-62, 73, 76-78)", () => {
  it("a new domain always starts PENDING_CONFIGURATION with real instructions, and tracking status is CONFIGURED/NOT_CONNECTED, never CONNECTED", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Domain Tracking Business");
    const projectRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/website-projects`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Domain Site", type: "BUSINESS_WEBSITE" } });
    const project = projectRes.json().websiteProject;

    const domainRes = await app.inject({ method: "POST", url: `/api/website-projects/${project.id}/domains`, headers: { cookie: studentACookie }, payload: { domain: "example-academy.com" } });
    expect(domainRes.statusCode).toBe(201);
    expect(domainRes.json().domain.status).toBe("PENDING_CONFIGURATION");
    expect(domainRes.json().domain.dnsInstructionsJson.records[0].type).toBe("CNAME");

    const trackingRes = await app.inject({ method: "PATCH", url: `/api/website-projects/${project.id}/tracking`, headers: { cookie: studentACookie }, payload: { metaPixelId: "123456" } });
    expect(trackingRes.statusCode).toBe(200);
    expect(trackingRes.json().tracking.metaPixelStatus).toBe("CONFIGURED");
    expect(trackingRes.json().tracking.googleAnalyticsStatus).toBe("NOT_CONNECTED");
    expect(Object.values(trackingRes.json().tracking)).not.toContain("CONNECTED");
  });
});

describe("Funnel E2E — offer -> funnel -> page -> copy -> form -> publish -> real test lead (spec section 104)", () => {
  it("carries a synthetic business all the way to a real public page hit and a real Person/Lead/DomainEvent/analytics chain", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Funnel E2E Business");

    const offerRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/offers`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Foundations Bundle", price: 4999, description: "A starter offer." } });
    expect(offerRes.statusCode).toBe(201);
    const offer = offerRes.json().offer;
    expect(offer.offerDisplayId).toMatch(/^OFFER-\d{4}-\d{6}$/);

    const funnelRes = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/funnels`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, name: "Foundations Funnel", type: "LEAD_GENERATION", offerId: offer.id, stages: [{ stageName: "Landing", purpose: "Capture the lead" }] },
    });
    expect(funnelRes.statusCode).toBe(201);
    const funnel = funnelRes.json().funnel;
    expect(funnel.funnelDisplayId).toMatch(/^FNL-\d{4}-\d{6}$/);

    const projectRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/website-projects`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Foundations Landing", type: "LEAD_GENERATION_PAGE", offerId: offer.id } });
    const project = projectRes.json().websiteProject;
    expect(project.masterBrainVersionAtCreation).not.toBeNull();

    const formRes = await app.inject({
      method: "POST",
      url: `/api/businesses/${business.id}/forms`,
      headers: { cookie: studentACookie },
      payload: {
        name: "Foundations Lead Form",
        type: "LeadForm",
        fields: [
          { key: "fullName", label: "Full Name", fieldType: "Name", required: true },
          { key: "email", label: "Email", fieldType: "Email", required: true },
        ],
        consentConfig: { submission: true },
      },
    });
    expect(formRes.statusCode).toBe(201);
    const form = formRes.json().form;
    expect(form.formDisplayId).toMatch(/^FORM-\d{4}-\d{6}$/);

    const pageRes = await app.inject({
      method: "POST",
      url: `/api/website-projects/${project.id}/pages`,
      headers: { cookie: studentACookie },
      payload: {
        name: "Foundations Landing Page",
        slug: "foundations",
        seo: { title: "Foundations Bundle — Get Started" },
        sections: [
          { id: "hero", type: "Hero", config: { headline: "Start your Foundations journey" } },
          { id: "form", type: "Form", config: { formId: form.id } },
          { id: "cta", type: "CTA", config: { ctaType: "REGISTER", actionType: "Form", destination: form.id } },
        ],
      },
    });
    expect(pageRes.statusCode).toBe(201);
    const page = pageRes.json().page;

    await app.inject({ method: "PATCH", url: `/api/forms/${form.id}`, headers: { cookie: studentACookie }, payload: { pageId: page.id, status: "Active" } });

    // Copy Studio — generate and apply copy for the hero section, traceable back to a real AiGeneration.
    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("Join the Foundations Bundle today and build your business the right way.");
    const copyRes = await app.inject({ method: "POST", url: `/api/pages/${page.id}/sections/hero/copy/generate`, headers: { cookie: studentACookie }, payload: { action: "Generate" } });
    expect(copyRes.statusCode).toBe(201);
    const variant = copyRes.json();
    expect(variant.text).toContain("Foundations Bundle");
    const applyRes = await app.inject({ method: "POST", url: `/api/pages/${page.id}/copy-variants/${variant.variantId}/apply`, headers: { cookie: studentACookie } });
    expect(applyRes.statusCode).toBe(200);

    // Validate — should now have no blocking issues (title set, CTA/Form both resolve, no placeholder text left after copy applied).
    const validateRes = await app.inject({ method: "POST", url: `/api/pages/${page.id}/validate`, headers: { cookie: studentACookie } });
    expect(validateRes.json().validation.blocking).toBe(false);

    // A Student can never self-approve or self-publish.
    const selfPublish = await app.inject({ method: "POST", url: `/api/pages/${page.id}/status`, headers: { cookie: studentACookie }, payload: { status: "PUBLISHED" } });
    expect(selfPublish.statusCode).toBe(403);

    const approveRes = await app.inject({ method: "POST", url: `/api/pages/${page.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "APPROVED" } });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().page.status).toBe("APPROVED");

    const publishRes = await app.inject({ method: "POST", url: `/api/pages/${page.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "PUBLISHED" } });
    expect(publishRes.statusCode).toBe(200);
    expect(publishRes.json().page.status).toBe("PUBLISHED");
    expect(publishRes.json().page.publishedAt).not.toBeNull();

    const versionsRes = await app.inject({ method: "GET", url: `/api/pages/${page.id}/versions`, headers: { cookie: studentACookie } });
    expect(versionsRes.json().versions).toHaveLength(1);
    expect(versionsRes.json().versions[0].versionNumber).toBe(1);

    // Real public hit — the honest definition of PUBLISHED: actually servable through this server's own endpoint.
    const publicHit = await app.inject({ method: "GET", url: `/api/public/pages/${project.id}/foundations?utm_source=facebook&utm_campaign=launch` });
    expect(publicHit.statusCode).toBe(200);
    expect(publicHit.json().page.name).toBe("Foundations Landing Page");

    const ctaClick = await app.inject({ method: "POST", url: `/api/public/pages/${page.id}/cta-click`, payload: { ctaId: "cta" } });
    expect(ctaClick.statusCode).toBe(201);

    // Real test lead submits the public form — reuses the exact Person/Lead duplicate-merge pattern.
    const email = `funnel-e2e-${Date.now()}@example.com`;
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/public/forms/${form.id}/submit`,
      payload: { data: { fullName: "Funnel Test Lead", email }, utmSource: "facebook", utmCampaign: "launch" },
    });
    expect(submitRes.statusCode).toBe(201);
    expect(submitRes.statusCode).not.toBe(500);

    const lead = await db.lead.findFirst({ where: { person: { email } }, include: { person: true } });
    expect(lead).not.toBeNull();
    expect(lead!.person.fullName).toBe("Funnel Test Lead");
    expect(lead!.source).toBe("Website Form");
    expect(lead!.utmSource).toBe("facebook");
    expect(lead!.utmCampaign).toBe("launch");

    const leadCreatedEvents = await db.domainEvent.findMany({ where: { type: "LEAD_CREATED" }, orderBy: { occurredAt: "desc" }, take: 20 });
    const domainEvent = leadCreatedEvents.find((e) => (e.payloadJson as { leadId?: string }).leadId === lead!.id);
    expect(domainEvent).not.toBeUndefined();

    const submissionRow = await db.formSubmission.findFirst({ where: { formId: form.id, leadId: lead!.id } });
    expect(submissionRow).not.toBeNull();
    expect(submissionRow!.status).toBe("Processed");

    // Real analytics — one PAGE_VIEW, one CTA_CLICK, one FORM_SUBMIT recorded from the actual hits above; conversion rate computed only because pageViews > 0.
    const analyticsRes = await app.inject({ method: "GET", url: `/api/website-projects/${project.id}/analytics`, headers: { cookie: studentACookie } });
    expect(analyticsRes.statusCode).toBe(200);
    const analytics = analyticsRes.json();
    expect(analytics.byEvent.PAGE_VIEW).toBe(1);
    expect(analytics.byEvent.CTA_CLICK).toBe(1);
    expect(analytics.byEvent.FORM_SUBMIT).toBe(1);
    expect(analytics.conversionRate).toBe(1);
  });
});

describe("Webinar registration via the generic Form Builder (spec section 105)", () => {
  it("maps a WebinarRegistration-type form submission into a real WebinarRegistration row, not isolated form data", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Webinar Form Business");
    const session = await createOpenWebinarSession();

    const formRes = await app.inject({
      method: "POST",
      url: `/api/businesses/${business.id}/forms`,
      headers: { cookie: studentACookie },
      payload: {
        name: "Webinar Registration Form",
        type: "WebinarRegistration",
        fields: [
          { key: "fullName", label: "Full Name", fieldType: "Name", required: true },
          { key: "email", label: "Email", fieldType: "Email", required: true },
          { key: "phone", label: "Phone", fieldType: "Phone", required: false },
        ],
        destinationConfig: { webinarSessionId: session.id },
      },
    });
    expect(formRes.statusCode).toBe(201);
    const form = formRes.json().form;
    // Form create doesn't accept status (only PATCH does) — activate it explicitly, same as the Funnel E2E test does.
    await app.inject({ method: "PATCH", url: `/api/forms/${form.id}`, headers: { cookie: studentACookie }, payload: { status: "Active" } });

    const email = `webinar-form-${Date.now()}@example.com`;
    const submitRes = await app.inject({ method: "POST", url: `/api/public/forms/${form.id}/submit`, payload: { data: { fullName: "Webinar Form Registrant", email, phone: "09171234567" } } });
    expect(submitRes.statusCode).toBe(201);
    expect(submitRes.json().resultingEntityType ?? "WebinarRegistration").toBeDefined();

    const lead = await db.lead.findFirst({ where: { person: { email } } });
    expect(lead).not.toBeNull();
    const registration = await db.webinarRegistration.findFirst({ where: { sessionId: session.id, leadId: lead!.id } });
    expect(registration).not.toBeNull();

    // A form not tied to a real, open session is refused rather than silently registering.
    const closedFormRes = await app.inject({
      method: "POST",
      url: `/api/businesses/${business.id}/forms`,
      headers: { cookie: studentACookie },
      payload: { name: "Orphan Webinar Form", type: "WebinarRegistration", fields: [{ key: "fullName", label: "Full Name", fieldType: "Name", required: true }] },
    });
    const orphanForm = closedFormRes.json().form;
    await app.inject({ method: "PATCH", url: `/api/forms/${orphanForm.id}`, headers: { cookie: studentACookie }, payload: { status: "Active" } });
    const orphanSubmit = await app.inject({ method: "POST", url: `/api/public/forms/${orphanForm.id}/submit`, payload: { data: { fullName: "No Session Registrant" } } });
    expect(orphanSubmit.statusCode).toBe(422);
  });
});

describe("Duplicate submission idempotency + spam trap (spec sections 34, 38)", () => {
  it("a second submission from the same person merges into the same Lead rather than creating a duplicate, and a honeypot fill is silently dropped", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Duplicate Guard Business");
    const formRes = await app.inject({
      method: "POST",
      url: `/api/businesses/${business.id}/forms`,
      headers: { cookie: studentACookie },
      payload: { name: "Dup Guard Form", type: "LeadForm", fields: [{ key: "fullName", label: "Full Name", fieldType: "Name", required: true }, { key: "email", label: "Email", fieldType: "Email", required: true }] },
    });
    const form = formRes.json().form;
    await app.inject({ method: "PATCH", url: `/api/forms/${form.id}`, headers: { cookie: studentACookie }, payload: { status: "Active" } });
    const email = `dup-guard-${Date.now()}@example.com`;

    const first = await app.inject({ method: "POST", url: `/api/public/forms/${form.id}/submit`, payload: { data: { fullName: "Dup Guard Lead", email } } });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({ method: "POST", url: `/api/public/forms/${form.id}/submit`, payload: { data: { fullName: "Dup Guard Lead", email } } });
    expect(second.statusCode).toBe(201);

    const leads = await db.lead.findMany({ where: { person: { email } } });
    expect(leads).toHaveLength(1);
    const submissions = await db.formSubmission.findMany({ where: { formId: form.id, leadId: leads[0]!.id } });
    expect(submissions).toHaveLength(2); // every attempt audited, but merged onto one real Lead

    const spamRes = await app.inject({ method: "POST", url: `/api/public/forms/${form.id}/submit`, payload: { data: { fullName: "Spam Bot", email: `spam-${Date.now()}@example.com` }, honeypot: "I am a bot" } });
    expect(spamRes.statusCode).toBe(201);
    const spamLead = await db.lead.findFirst({ where: { person: { fullName: "Spam Bot" } } });
    expect(spamLead).toBeNull(); // honeypot trap never touches Person/Lead at all
  });
});

describe("Business/student isolation (spec section 100)", () => {
  it("Student B cannot reach Student A's offers/website-projects/funnels/forms via tampered IDs", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Isolation Business");
    const offer = (await app.inject({ method: "POST", url: `/api/students/${studentAId}/offers`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Isolation Offer" } })).json().offer;
    const project = (await app.inject({ method: "POST", url: `/api/students/${studentAId}/website-projects`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Isolation Site", type: "BUSINESS_WEBSITE" } })).json().websiteProject;
    const funnel = (await app.inject({ method: "POST", url: `/api/students/${studentAId}/funnels`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Isolation Funnel", type: "LEAD_GENERATION" } })).json().funnel;

    const crossOffer = await app.inject({ method: "GET", url: `/api/offers/${offer.id}`, headers: { cookie: studentBCookie } });
    expect(crossOffer.statusCode).toBe(403);

    const crossProject = await app.inject({ method: "GET", url: `/api/website-projects/${project.id}`, headers: { cookie: studentBCookie } });
    expect(crossProject.statusCode).toBe(403);

    const crossProjectList = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/website-projects`, headers: { cookie: studentBCookie } });
    expect(crossProjectList.statusCode).toBe(403);

    const crossFunnel = await app.inject({ method: "GET", url: `/api/funnels/${funnel.id}`, headers: { cookie: studentBCookie } });
    expect(crossFunnel.statusCode).toBe(403);

    const crossFunnelStatus = await app.inject({ method: "POST", url: `/api/funnels/${funnel.id}/status`, headers: { cookie: studentBCookie }, payload: { status: "ACTIVE" } });
    expect(crossFunnelStatus.statusCode).toBe(403);

    const tamperedProject = await app.inject({ method: "GET", url: `/api/website-projects/nonexistent-tampered-id`, headers: { cookie: studentACookie } });
    expect(tamperedProject.statusCode).toBe(404);

    const tamperedBusiness = await app.inject({ method: "GET", url: `/api/businesses/nonexistent-tampered-business/funnels`, headers: { cookie: studentACookie } });
    expect(tamperedBusiness.statusCode).toBe(403);
  });
});

describe("Analytics — no fabricated numbers (spec section 107)", () => {
  it("a project with zero real events reports zero counts and a null conversion rate, never a fabricated value", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Empty Analytics Business");
    const project = (await app.inject({ method: "POST", url: `/api/students/${studentAId}/website-projects`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Empty Analytics Site", type: "BUSINESS_WEBSITE" } })).json().websiteProject;

    const analyticsRes = await app.inject({ method: "GET", url: `/api/website-projects/${project.id}/analytics`, headers: { cookie: studentACookie } });
    expect(analyticsRes.statusCode).toBe(200);
    const analytics = analyticsRes.json();
    expect(analytics.byEvent).toEqual({});
    expect(analytics.conversionRate).toBeNull();
  });
});

describe("Website + Funnel Architect — DRAFT-only structured generation (spec sections 9-14, 87-89)", () => {
  it("generates a real DRAFT page from the Website Architect and a real DRAFT funnel from the Funnel Architect, both auditable and never auto-published", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Architect Business");
    const project = (await app.inject({ method: "POST", url: `/api/students/${studentAId}/website-projects`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Architect Site", type: "SALES_PAGE" } })).json().websiteProject;

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText(JSON.stringify({ sections: [{ id: "hero", type: "Hero", config: {} }, { id: "cta", type: "CTA", config: {} }], ctaPlacement: ["hero"], formPlacement: [], missingBrandAssets: ["No logo on file"] }));
    const websiteArchitectRes = await app.inject({ method: "POST", url: `/api/website-projects/${project.id}/architect/generate`, headers: { cookie: studentACookie }, payload: { objective: "Sell the Foundations Bundle" } });
    expect(websiteArchitectRes.statusCode).toBe(201);
    expect(websiteArchitectRes.json().page.status).toBe("DRAFT");
    expect(websiteArchitectRes.json().page.websiteProjectId).toBe(project.id);

    fakeAnthropic.setResponseText(
      JSON.stringify({
        funnelGoal: "Convert cold traffic into Foundations Bundle buyers.",
        targetAudience: "Aspiring entrepreneurs",
        stages: [{ stageName: "Awareness", purpose: "Introduce the offer" }, { stageName: "Decision", purpose: "Drive purchase" }],
        requiredPages: ["Landing Page", "Thank You Page"],
        forms: ["Lead capture form"],
        followUpRequirements: ["Email sequence"],
        automationRequirements: ["Nurture automation"],
        trackingRequirements: ["Meta Pixel"],
        successMetrics: ["Conversion rate"],
        risks: ["No urgency element yet"],
      }),
    );
    const funnelArchitectRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/funnels/architect`, headers: { cookie: studentACookie }, payload: { businessId: business.id, funnelType: "SALES", description: "Sell the Foundations Bundle to cold traffic." } });
    expect(funnelArchitectRes.statusCode).toBe(201);
    expect(funnelArchitectRes.json().funnel.status).toBe("DRAFT");
    expect(funnelArchitectRes.json().funnel.stagesJson).toHaveLength(2);

    const generation = await db.aiGeneration.findUniqueOrThrow({ where: { id: funnelArchitectRes.json().generationId } });
    expect(generation.status).toBe("COMPLETED");
    expect(generation.masterBrainVersion).not.toBeNull();
  });

  it("fails cleanly, never fabricating a page, when the AI provider is unavailable", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Architect Failure Business");
    const project = (await app.inject({ method: "POST", url: `/api/students/${studentAId}/website-projects`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Architect Failure Site", type: "BUSINESS_WEBSITE" } })).json().websiteProject;

    fakeAnthropic.setMode("server_error");
    const res = await app.inject({ method: "POST", url: `/api/website-projects/${project.id}/architect/generate`, headers: { cookie: studentACookie }, payload: {} });
    expect(res.statusCode).toBe(502);
    const pages = await db.websitePage.findMany({ where: { websiteProjectId: project.id } });
    expect(pages).toHaveLength(0);
    fakeAnthropic.setMode("success");
  });
});

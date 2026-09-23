// Public Form Submission engine (spec sections 31-38, 68-69). Reuses the
// EXACT same duplicate-avoidance merge pattern the real public webinar
// registration endpoint already established (webinar/routes.ts's
// /api/webinar/register): findPersonDuplicates -> reuse a matched Person
// -> find-or-create Lead -> record first/latest-touch attribution -> record
// consent -> record the correct real DomainEvent, which Phase 12's
// dispatcher already consumes automatically (spec section 69) — no new
// trigger-matching code was needed for that connection to work.
//
// Never creates isolated form data when a proper domain entity already
// exists (spec section 33): a WebinarRegistration-type form additionally
// creates a real WebinarRegistration row, respecting the same session
// capacity/closed-status rules the dedicated route enforces.

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { findPersonDuplicates } from "../duplicates.js";
import { recordDomainEvent } from "../events.js";
import { generateLeadDisplayId } from "../sequence.js";
import { writeAuditLog } from "../../audit/log.js";
import type { PageSection } from "./sections.js";

interface FormField {
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  options?: string[];
}

export interface SubmitFormOutcome {
  ok: boolean;
  httpStatus?: number;
  reason?: string;
  submissionId?: string;
  leadId?: string;
  personId?: string;
  isNewLead?: boolean;
  resultingEntityType?: string | null;
  thankYouPageId?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLOSED_STATUSES = new Set(["Closed", "Cancelled", "Completed"]);

function validateFields(fields: FormField[], data: Record<string, unknown>): string | null {
  for (const field of fields) {
    const value = data[field.key];
    if (field.required && (value === undefined || value === null || value === "")) {
      return `Missing required field: ${field.label}`;
    }
    if (value === undefined || value === null || value === "") continue;
    if (field.fieldType === "Email" && typeof value === "string" && !EMAIL_RE.test(value)) {
      return `Invalid email for field: ${field.label}`;
    }
    if ((field.fieldType === "Select" || field.fieldType === "Radio") && field.options && typeof value === "string" && !field.options.includes(value)) {
      return `Invalid selection for field: ${field.label}`;
    }
  }
  return null;
}

function extractString(data: Record<string, unknown>, fields: FormField[], fieldType: string): string | undefined {
  const field = fields.find((f) => f.fieldType === fieldType);
  if (!field) return undefined;
  const value = data[field.key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export interface SubmitFormInput {
  formId: string;
  data: Record<string, unknown>;
  honeypot?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPage?: string;
}

export async function submitForm(input: SubmitFormInput): Promise<SubmitFormOutcome> {
  const form = await db.webForm.findUnique({ where: { id: input.formId } });
  if (!form) return { ok: false, httpStatus: 404, reason: "Form not found." };
  if (form.status !== "Active") return { ok: false, httpStatus: 422, reason: "This form is not currently accepting submissions." };

  const fields = (form.fieldsJson as unknown as FormField[]) ?? [];

  // Honeypot spam trap (spec section 38) — never revealed to the submitter;
  // recorded and dropped before any Person/Lead is ever touched.
  if (input.honeypot && input.honeypot.trim().length > 0) {
    const rejected = await db.formSubmission.create({
      data: { formId: form.id, dataJson: {} as Prisma.InputJsonValue, status: "Rejected", rejectionReason: "Spam suspected (honeypot)." },
    });
    return { ok: true, submissionId: rejected.id, resultingEntityType: null, thankYouPageId: form.thankYouPageId };
  }

  const validationError = validateFields(fields, input.data);
  if (validationError) return { ok: false, httpStatus: 400, reason: validationError };

  const fullName = extractString(input.data, fields, "Name");
  const email = extractString(input.data, fields, "Email");
  const phone = extractString(input.data, fields, "Phone");
  const facebookName = extractString(input.data, fields, "FacebookName");
  const city = extractString(input.data, fields, "City");
  if (!fullName) return { ok: false, httpStatus: 400, reason: "A Name field is required for this form." };

  const destinationConfig = (form.destinationConfigJson as { webinarSessionId?: string } | null) ?? null;
  let session: Awaited<ReturnType<typeof db.webinarSession.findUnique>> = null;
  if (form.type === "WebinarRegistration") {
    if (!destinationConfig?.webinarSessionId) return { ok: false, httpStatus: 422, reason: "This webinar registration form has no linked session configured." };
    session = await db.webinarSession.findUnique({ where: { id: destinationConfig.webinarSessionId } });
    if (!session) return { ok: false, httpStatus: 404, reason: "Linked webinar session not found." };
    if (CLOSED_STATUSES.has(session.status)) return { ok: false, httpStatus: 422, reason: "WEBINAR CLOSED" };
    const now = new Date();
    if (session.registrationOpenDate && now < session.registrationOpenDate) return { ok: false, httpStatus: 422, reason: "WEBINAR CLOSED" };
    if (session.registrationCloseDate && now > session.registrationCloseDate) return { ok: false, httpStatus: 422, reason: "WEBINAR CLOSED" };
    if (session.capacity !== null) {
      const registeredCount = await db.webinarRegistration.count({ where: { sessionId: session.id, registrationStatus: "Registered" } });
      if (registeredCount >= session.capacity) return { ok: false, httpStatus: 422, reason: "WEBINAR FULL" };
    }
  }

  const duplicates = await findPersonDuplicates(email, phone);
  const existingMatch = duplicates[0] ?? null;

  const consentInput = input.data.consent as { canEmail?: boolean; canSms?: boolean; canWhatsapp?: boolean; consentVersion?: string } | undefined;

  let result: { leadId: string; personId: string; isNewLead: boolean };
  try {
    result = await db.$transaction(async (tx) => {
      let personId: string;
      if (existingMatch) {
        personId = existingMatch.personId;
      } else {
        const person = await tx.person.create({ data: { fullName, email: email ?? null, contactNumber: phone ?? null, facebookName: facebookName ?? null, city: city ?? null } });
        personId = person.id;
      }

      let lead = await tx.lead.findUnique({ where: { personId } });
      let isNewLead = false;
      if (!lead) {
        isNewLead = true;
        lead = await tx.lead.create({
          data: {
            leadDisplayId: await generateLeadDisplayId(),
            personId,
            source: "Website Form",
            campaign: form.name,
            utmSource: input.utmSource ?? null,
            utmMedium: input.utmMedium ?? null,
            utmCampaign: input.utmCampaign ?? null,
            utmContent: input.utmContent ?? null,
            utmTerm: input.utmTerm ?? null,
            landingPage: input.landingPage ?? null,
            firstRegistrationDate: new Date(),
            pipelineStage: "NOT_CONTACTED",
          },
        });
      }

      if (consentInput) {
        await tx.lead.update({
          where: { id: lead.id },
          data: { canEmail: !!consentInput.canEmail, canSms: !!consentInput.canSms, canWhatsapp: !!consentInput.canWhatsapp, consentVersion: consentInput.consentVersion ?? null, consentSource: `Form: ${form.name}`, consentDate: new Date() },
        });
        await tx.leadConsentEvent.create({
          data: { leadId: lead.id, action: "Granted", canEmail: !!consentInput.canEmail, canSms: !!consentInput.canSms, canWhatsapp: !!consentInput.canWhatsapp, optedOut: false, consentVersion: consentInput.consentVersion ?? null, source: `Form: ${form.name}` },
        });
      }

      if (form.type === "WebinarRegistration" && session) {
        await tx.webinarRegistration.create({
          data: { sessionId: session.id, leadId: lead.id, source: "Website Form", campaign: form.name, utmSource: input.utmSource ?? null, utmMedium: input.utmMedium ?? null, utmCampaign: input.utmCampaign ?? null, utmContent: input.utmContent ?? null, utmTerm: input.utmTerm ?? null, landingPage: input.landingPage ?? null },
        });
      }

      await tx.leadActivity.create({ data: { leadId: lead.id, action: `Submitted form "${form.name}"`, userLabel: "Public Form Submission" } });

      return { leadId: lead.id, personId, isNewLead };
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return { ok: false, httpStatus: 409, reason: "DUPLICATE SUBMISSION" };
    }
    throw err;
  }

  if (result.isNewLead) {
    await recordDomainEvent("LEAD_CREATED", { leadId: result.leadId });
    await writeAuditLog({ action: "Lead Created", summary: `Lead created via form "${form.name}"`, entityType: "Lead", entityId: result.leadId });
  }
  if (form.type === "WebinarRegistration" && session) {
    await recordDomainEvent("WEBINAR_REGISTERED", { leadId: result.leadId, sessionId: session.id });
  }

  const submission = await db.formSubmission.create({
    data: {
      formId: form.id,
      dataJson: input.data as Prisma.InputJsonValue,
      personId: result.personId,
      leadId: result.leadId,
      resultingEntityType: form.type === "WebinarRegistration" ? "WebinarRegistration" : "Lead",
      resultingEntityId: result.leadId,
      status: "Processed",
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmContent: input.utmContent ?? null,
      utmTerm: input.utmTerm ?? null,
    },
  });
  await writeAuditLog({ action: "Form Submission Received", summary: `Form "${form.name}" submitted`, entityType: "FormSubmission", entityId: submission.id });

  if (form.pageId) {
    await db.websiteAnalyticsEvent.create({
      data: { websiteProjectId: (await db.websitePage.findUniqueOrThrow({ where: { id: form.pageId } })).websiteProjectId, pageId: form.pageId, eventName: "FORM_SUBMIT", detailsJson: { formId: form.id } as Prisma.InputJsonValue, utmSource: input.utmSource ?? null, utmMedium: input.utmMedium ?? null, utmCampaign: input.utmCampaign ?? null },
    });
  }

  return { ok: true, submissionId: submission.id, leadId: result.leadId, personId: result.personId, isNewLead: result.isNewLead, resultingEntityType: form.type === "WebinarRegistration" ? "WebinarRegistration" : "Lead", thankYouPageId: form.thankYouPageId };
}

export type { PageSection };

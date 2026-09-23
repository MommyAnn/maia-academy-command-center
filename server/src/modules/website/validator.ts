// The Publish Validator (spec sections 65-68) — real checks that must pass
// (or be explicitly, non-blockingly disclosed) before a WebsitePage may
// move to PUBLISHED. AI cannot independently publish (spec section 65) —
// this validator's blocking/non-blocking split is what a human approval
// route reads before allowing that final step.

import { db } from "../../db.js";
import { SECTION_TYPES, CTA_TYPES, isSafeUrl, type PageSection } from "./sections.js";

export type IssueSeverity = "BLOCKING" | "WARNING";

export interface PublishIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  sectionId?: string;
}

export interface PublishValidationResult {
  issues: PublishIssue[];
  blocking: boolean;
}

const PLACEHOLDER_PATTERNS = [/lorem ipsum/i, /\[customer testimonial/i, /\[insert/i, /\[placeholder/i, /todo:/i, /tbd\b/i, /\[testimonial to be added\]/i];

function hasPlaceholderText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(value));
}

function collectStrings(config: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const v of Object.values(config)) {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const item of v) if (typeof item === "string") out.push(item);
  }
  return out;
}

export async function validatePageForPublish(page: { id: string; websiteProjectId: string; sectionsJson: unknown; seoJson: unknown }): Promise<PublishValidationResult> {
  const issues: PublishIssue[] = [];
  const sections = (page.sectionsJson as PageSection[]) ?? [];
  const seo = (page.seoJson as { title?: string } | null) ?? null;

  if (!seo?.title || seo.title.trim().length === 0) {
    issues.push({ severity: "BLOCKING", code: "MISSING_PAGE_TITLE", message: "This page has no title configured for SEO/social sharing." });
  }

  const hasCta = sections.some((s) => s.type === "CTA" || (s.config as { ctaType?: string })?.ctaType);
  if (!hasCta) {
    issues.push({ severity: "BLOCKING", code: "MISSING_CTA", message: "This page has no CTA section — every page must define a primary call to action." });
  }

  const internalSlugs = new Set(
    (await db.websitePage.findMany({ where: { websiteProjectId: page.websiteProjectId }, select: { slug: true } })).map((p) => p.slug),
  );

  for (const section of sections) {
    if (!(SECTION_TYPES as readonly string[]).includes(section.type)) {
      issues.push({ severity: "BLOCKING", code: "UNSUPPORTED_SECTION", message: `Section "${section.label ?? section.id}" has an unsupported type.`, sectionId: section.id });
    }

    if (section.type === "CTA") {
      const config = section.config as { ctaType?: string; actionType?: string; destination?: string };
      if (!config.ctaType || !(CTA_TYPES as readonly string[]).includes(config.ctaType)) {
        issues.push({ severity: "BLOCKING", code: "MISSING_CTA", message: `CTA section "${section.label ?? section.id}" has no valid CTA type.`, sectionId: section.id });
      }
      if (!config.actionType || !config.destination) {
        issues.push({ severity: "BLOCKING", code: "MISSING_CTA", message: `CTA section "${section.label ?? section.id}" has no destination configured.`, sectionId: section.id });
      } else if (config.actionType === "ExternalUrl" && !isSafeUrl(config.destination)) {
        issues.push({ severity: "BLOCKING", code: "UNSAFE_URL", message: `CTA section "${section.label ?? section.id}" has an unsafe or invalid destination URL.`, sectionId: section.id });
      } else if (config.actionType === "InternalPage" && !internalSlugs.has(config.destination)) {
        issues.push({ severity: "BLOCKING", code: "BROKEN_LINK", message: `CTA section "${section.label ?? section.id}" links to a page that doesn't exist in this project.`, sectionId: section.id });
      } else if (config.actionType === "Form") {
        const form = await db.webForm.findUnique({ where: { id: config.destination } });
        if (!form) {
          issues.push({ severity: "BLOCKING", code: "MISSING_FORM_DESTINATION", message: `CTA section "${section.label ?? section.id}" references a form that doesn't exist.`, sectionId: section.id });
        }
      }
    }

    if (section.type === "Form") {
      const config = section.config as { formId?: string };
      if (!config.formId) {
        issues.push({ severity: "BLOCKING", code: "MISSING_FORM_DESTINATION", message: `Form section "${section.label ?? section.id}" has no form selected.`, sectionId: section.id });
      } else {
        const form = await db.webForm.findUnique({ where: { id: config.formId } });
        if (!form) {
          issues.push({ severity: "BLOCKING", code: "MISSING_FORM_DESTINATION", message: `Form section "${section.label ?? section.id}" references a form that no longer exists.`, sectionId: section.id });
        } else {
          if (!form.consentConfigJson) {
            issues.push({ severity: "WARNING", code: "MISSING_CONSENT_CONFIG", message: `Form "${form.name}" has no consent configuration.`, sectionId: section.id });
          }
          if (form.type === "WebinarRegistration") {
            const destinationConfig = form.destinationConfigJson as { webinarSessionId?: string } | null;
            if (!destinationConfig?.webinarSessionId) {
              issues.push({ severity: "BLOCKING", code: "DISCONNECTED_REQUIRED_INTEGRATION", message: `Form "${form.name}" is a Webinar Registration form with no linked webinar session.`, sectionId: section.id });
            } else {
              const session = await db.webinarSession.findUnique({ where: { id: destinationConfig.webinarSessionId } });
              if (!session) {
                issues.push({ severity: "BLOCKING", code: "DISCONNECTED_REQUIRED_INTEGRATION", message: `Form "${form.name}" references a webinar session that no longer exists.`, sectionId: section.id });
              }
            }
          }
        }
      }
    }

    if (section.type === "Testimonials" || section.type === "CaseStudies") {
      const ids = ((section.config as { feedbackSubmissionIds?: string[] }).feedbackSubmissionIds ?? []) as string[];
      if (ids.length === 0) {
        issues.push({ severity: "WARNING", code: "NO_SOCIAL_PROOF", message: `${section.type} section "${section.label ?? section.id}" has no approved testimonials referenced — consider omitting the section if no real proof is available.`, sectionId: section.id });
      } else {
        const approved = await db.feedbackSubmission.findMany({
          where: { id: { in: ids }, status: { in: ["Approved for Marketing", "Featured"] } },
          include: { marketingConsent: true },
        });
        const approvedIds = new Set(approved.filter((f) => f.marketingConsent).map((f) => f.id));
        const unapproved = ids.filter((id) => !approvedIds.has(id));
        if (unapproved.length > 0) {
          issues.push({ severity: "BLOCKING", code: "FAKE_PLACEHOLDER_PROOF", message: `${section.type} section "${section.label ?? section.id}" references ${unapproved.length} testimonial(s) without approved-for-marketing status and consent on file.`, sectionId: section.id });
        }
      }
    }

    const strings = collectStrings(section.config as Record<string, unknown>);
    if (strings.some(hasPlaceholderText)) {
      issues.push({ severity: "BLOCKING", code: "UNRESOLVED_DRAFT_CONTENT", message: `Section "${section.label ?? section.id}" still contains placeholder/draft text.`, sectionId: section.id });
    }
  }

  const blocking = issues.some((i) => i.severity === "BLOCKING");
  return { issues, blocking };
}

// Section Library + type vocabulary (spec sections 5, 8, 14, 28, 32) — the
// shared shape a page/funnel/form/CTA/domain must match. Kept as plain
// enums + a light zod shape check on the page structure itself, since a
// section's own config varies by type and is interpreted, not rigidly
// schema'd — same "structured but interpreted" pattern as Phase 11's
// Script.sectionsJson and Phase 12's flow.ts.

import { z } from "zod";

export const WEBSITE_TYPES = [
  "BUSINESS_WEBSITE",
  "LANDING_PAGE",
  "SALES_PAGE",
  "LEAD_GENERATION_PAGE",
  "WEBINAR_REGISTRATION_PAGE",
  "COURSE_SALES_PAGE",
  "PRODUCT_PAGE",
  "SERVICE_PAGE",
  "BOOKING_PAGE",
  "WAITLIST_PAGE",
  "COMING_SOON_PAGE",
  "THANK_YOU_PAGE",
  "LINK_IN_BIO",
  "CUSTOM",
] as const;

export const WEBSITE_STATUSES = ["DRAFT", "GENERATING", "FOR_REVIEW", "REVISION_REQUESTED", "APPROVED", "READY_TO_PUBLISH", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const;

export const FUNNEL_TYPES = ["LEAD_GENERATION", "WEBINAR", "SALES", "ENROLLMENT", "COURSE", "SERVICE_BOOKING", "PRODUCT", "E_COMMERCE", "WAITLIST", "APPLICATION", "CONSULTATION", "CUSTOM"] as const;

export const SECTION_TYPES = [
  "Hero",
  "Problem",
  "Solution",
  "Benefits",
  "Features",
  "HowItWorks",
  "About",
  "Founder",
  "Products",
  "Services",
  "Offer",
  "Pricing",
  "Comparison",
  "FAQ",
  "Testimonials",
  "CaseStudies",
  "Gallery",
  "Video",
  "CTA",
  "Form",
  "Booking",
  "Countdown",
  "LogoStrip",
  "Statistics",
  "Contact",
  "Map",
  "Footer",
  "Custom",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const CTA_TYPES = ["REGISTER", "ENROLL", "BUY", "RESERVE", "BOOK", "MESSAGE", "CALL", "DOWNLOAD", "JOIN_WAITLIST", "LEARN_MORE", "CUSTOM"] as const;

export const CTA_ACTION_TYPES = ["Form", "ExternalUrl", "InternalPage", "Checkout", "Booking", "Messenger", "WhatsApp", "Phone", "Email", "Automation"] as const;

export const FORM_TYPES = ["LeadForm", "WebinarRegistration", "Enrollment", "Application", "Contact", "BookingInquiry", "Waitlist", "Survey", "Custom"] as const;

export const FORM_FIELD_TYPES = ["Name", "FacebookName", "Email", "Phone", "City", "Business", "ProductInterest", "Package", "Batch", "CustomText", "Select", "Checkbox", "Radio", "Consent", "FileUpload"] as const;

export const DOMAIN_STATUSES = ["NOT_CONNECTED", "PENDING_CONFIGURATION", "VERIFYING", "VERIFIED", "ACTIVE", "ERROR"] as const;

const sectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(SECTION_TYPES),
  label: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const sectionsArraySchema = z.array(sectionSchema).min(1);
export type PageSection = z.infer<typeof sectionSchema>;

export interface SeoConfig {
  title?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogImage?: string;
  indexable?: boolean;
}

/** Safe URL check (spec section 30) — never allows script injection via an unsafe protocol. */
export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return true; // internal path
  try {
    const parsed = new URL(trimmed);
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/** A slug that is safe for a URL path segment — lowercase letters, numbers, hyphens only. */
export function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

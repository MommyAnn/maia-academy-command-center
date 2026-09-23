// UTM Builder + Tracking Validator + Pre-Launch Checklist (spec sections
// 74-77). UTM generation is deterministic string building — never AI. The
// validator/checklist only ever report real, currently-true facts about
// this campaign's own structure; nothing here approves or launches
// anything on its own.

import { db } from "../../db.js";

function slugify(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export interface UtmSet {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}

/** Default naming convention BUSINESS_OBJECTIVE_OFFER_AUDIENCE_DATE (spec section 74), fully configurable by passing an explicit campaign value. */
export function buildUtmCampaignSlug(input: { business: string; objective: string; offer?: string; audience?: string; date?: Date }): string {
  const parts = [input.business, input.objective, input.offer, input.audience, (input.date ?? new Date()).toISOString().slice(0, 10)].filter((p): p is string => !!p && p.length > 0);
  return parts.map(slugify).join("_");
}

export function buildUtmUrl(baseUrl: string, utm: UtmSet): string {
  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", utm.source);
  url.searchParams.set("utm_medium", utm.medium);
  url.searchParams.set("utm_campaign", utm.campaign);
  if (utm.content) url.searchParams.set("utm_content", utm.content);
  return url.toString();
}

export interface TrackingIssue {
  severity: "BLOCKING" | "WARNING";
  code: string;
  message: string;
}

/** Checks a campaign's own tracking readiness — destination URL safety, UTM presence, form/landing page connection (spec section 76). */
export async function validateCampaignTracking(adCampaignId: string): Promise<TrackingIssue[]> {
  const campaign = await db.adCampaign.findUniqueOrThrow({ where: { id: adCampaignId } });
  const issues: TrackingIssue[] = [];

  if (!campaign.utmCampaign) issues.push({ severity: "WARNING", code: "MISSING_UTM", message: "This campaign has no utmCampaign value — attribution matching will not work until one is set." });

  const adSets = await db.adSet.findMany({ where: { campaignId: adCampaignId }, include: { ads: true } });
  const ads = adSets.flatMap((s) => s.ads);
  if (ads.length === 0) {
    issues.push({ severity: "WARNING", code: "NO_ADS", message: "This campaign has no ads yet." });
    return issues;
  }

  for (const ad of ads) {
    if (!ad.landingPageId) {
      issues.push({ severity: "BLOCKING", code: "MISSING_DESTINATION", message: `Ad "${ad.name}" has no landing page configured.`, });
      continue;
    }
    const page = await db.websitePage.findUnique({ where: { id: ad.landingPageId } });
    if (!page) {
      issues.push({ severity: "BLOCKING", code: "BROKEN_LINK", message: `Ad "${ad.name}" references a landing page that no longer exists.` });
      continue;
    }
    if (page.status !== "PUBLISHED") {
      issues.push({ severity: "BLOCKING", code: "LANDING_PAGE_NOT_PUBLISHED", message: `Ad "${ad.name}"'s landing page is not PUBLISHED yet.` });
    }
    const forms = await db.webForm.findMany({ where: { pageId: page.id, status: "Active" } });
    if (forms.length === 0) {
      issues.push({ severity: "WARNING", code: "NO_ACTIVE_FORM", message: `Ad "${ad.name}"'s landing page has no active form — lead capture may not work.` });
    }
  }

  return issues;
}

export interface PreLaunchChecklist {
  campaignStrategyApproved: boolean;
  creativeApproved: boolean;
  copyApproved: boolean;
  landingPagePublished: boolean;
  formTested: boolean;
  automationTested: boolean;
  trackingTested: boolean;
  budgetApproved: boolean;
  connectionValid: boolean;
}

export async function getPreLaunchChecklist(adCampaignId: string): Promise<PreLaunchChecklist> {
  const campaign = await db.adCampaign.findUniqueOrThrow({ where: { id: adCampaignId }, include: { adAccount: { include: { connection: true } } } });
  const ads = await db.ad.findMany({ where: { adSet: { campaignId: adCampaignId } }, include: { creativeLink: true } });
  const creativeApproved = ads.some((a) => a.creativeLink !== null);

  const landingPageIds = [...new Set(ads.map((a) => a.landingPageId).filter((id): id is string => !!id))];
  const pages = landingPageIds.length > 0 ? await db.websitePage.findMany({ where: { id: { in: landingPageIds } } }) : [];
  const landingPagePublished = pages.length > 0 && pages.every((p) => p.status === "PUBLISHED");
  const copyApproved = pages.length > 0 && pages.every((p) => (p.seoJson as { title?: string } | null)?.title);

  const forms = landingPageIds.length > 0 ? await db.webForm.findMany({ where: { pageId: { in: landingPageIds }, status: "Active" } }) : [];
  const formTested = forms.length > 0;

  return {
    campaignStrategyApproved: !!campaign.utmCampaign,
    creativeApproved,
    copyApproved: !!copyApproved,
    landingPagePublished,
    formTested,
    automationTested: !!campaign.journeyId,
    trackingTested: !!campaign.utmCampaign,
    budgetApproved: campaign.dailyBudget !== null || campaign.lifetimeBudget !== null,
    connectionValid: campaign.adAccount.connection.provider === "MANUAL" || campaign.adAccount.connection.status === "CONNECTED",
  };
}

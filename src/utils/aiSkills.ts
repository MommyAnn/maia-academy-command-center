import type {
  AiMasterclass,
  AiSkillIcon,
  AiSkillsCatalog,
  AiSkillsProduct,
  AiSkillsFunnelSettings,
} from "@/types/aiSkills";
import { AI_SKILLS_TAGS, DEFAULT_AI_SKILLS_CATALOG } from "@/data/aiSkillsConfig";

export const ALL_ACCESS_KEY = "all-access";

const ICONS: AiSkillIcon[] = [
  "digital-twin", "interview", "ugc", "photography", "music", "website",
  "content-system", "video", "design", "marketing", "automation", "writing",
];

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

/** Only absolute http(s) URLs are ever used as links — blocks javascript: etc. */
export function isHttpUrl(value: string | undefined | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function tagFromTitle(value: string): string {
  const core = value
    .toUpperCase()
    .replace(/\bMASTERCLASS\b|\bCREATION\b/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^AI-/, "");
  return `MAIA-AI-${core || "COURSE"}`;
}

export function sortedMasterclasses(catalog: AiSkillsCatalog): AiMasterclass[] {
  return [...catalog.masterclasses].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** What visitors see: enabled masterclasses, in admin order. */
export function publicMasterclasses(catalog: AiSkillsCatalog): AiMasterclass[] {
  return sortedMasterclasses(catalog).filter((c) => c.enabled);
}

/** Masterclasses currently included in All-Access (enabled + flagged). */
export function bundleMasterclasses(catalog: AiSkillsCatalog): AiMasterclass[] {
  return publicMasterclasses(catalog).filter((c) => c.includedInBundle);
}

/** Lowest enabled single-masterclass price, for "START WITH ONE — ₱499" CTAs. */
export function startingPrice(catalog: AiSkillsCatalog): number {
  const prices = publicMasterclasses(catalog).map((c) => c.price);
  return prices.length ? Math.min(...prices) : 499;
}

export function resolveProduct(catalog: AiSkillsCatalog, key: string | undefined): AiSkillsProduct | null {
  if (!key) return null;
  if (key === ALL_ACCESS_KEY) {
    return {
      kind: "bundle",
      key: ALL_ACCESS_KEY,
      name: catalog.bundle.name,
      price: catalog.bundle.regularPrice,
      checkoutUrl: catalog.bundle.ghlCheckoutUrl,
      tags: [AI_SKILLS_TAGS.customer, AI_SKILLS_TAGS.allAccess],
    };
  }
  const course = catalog.masterclasses.find((c) => c.slug === key && c.enabled);
  if (!course) return null;
  return {
    kind: "single",
    key: course.slug,
    name: course.title,
    price: course.price,
    checkoutUrl: course.ghlCheckoutUrl,
    tags: [AI_SKILLS_TAGS.customer, AI_SKILLS_TAGS.single, course.ghlTag].filter(Boolean),
    course,
  };
}

export interface BuyerDetails {
  fullName: string;
  email: string;
  phone: string;
  facebookName: string;
}

/**
 * Builds the GHL order form URL with pre-fill query params. Nothing here
 * sets a price or discount — GHL computes the amount due from the product
 * and any coupon the buyer applies on the secure payment step.
 */
export function buildCheckoutUrl(
  baseUrl: string,
  settings: AiSkillsFunnelSettings,
  buyer: BuyerDetails | null,
  promoCode: string,
): string | null {
  if (!isHttpUrl(baseUrl)) return null;
  const url = new URL(baseUrl);
  const p = settings.prefillParams;
  const set = (param: string, value: string) => {
    if (param.trim() && value.trim()) url.searchParams.set(param.trim(), value.trim());
  };
  if (buyer) {
    set(p.fullName, buyer.fullName);
    set(p.email, buyer.email);
    set(p.phone, buyer.phone);
    set(p.facebookName, buyer.facebookName);
  }
  set(p.promoCode, promoCode);
  return url.toString();
}

export interface SetupIssue {
  severity: "blocking" | "recommended";
  area: string;
  message: string;
}

/** Admin-facing readiness check: which GHL connections are still missing. */
export function getSetupIssues(catalog: AiSkillsCatalog): SetupIssue[] {
  const issues: SetupIssue[] = [];
  for (const c of publicMasterclasses(catalog)) {
    if (!isHttpUrl(c.ghlCheckoutUrl))
      issues.push({ severity: "blocking", area: c.shortTitle, message: "No GHL checkout URL — buyers see “checkout being set up” instead of paying." });
    if (!isHttpUrl(c.accessUrl) && !isHttpUrl(catalog.settings.memberPortalUrl))
      issues.push({ severity: "recommended", area: c.shortTitle, message: "No course access URL (and no member portal URL) for the post-purchase access button." });
    if (!c.ghlTag.trim())
      issues.push({ severity: "recommended", area: c.shortTitle, message: "No course-specific CRM tag." });
  }
  if (!isHttpUrl(catalog.bundle.ghlCheckoutUrl))
    issues.push({ severity: "blocking", area: "All-Access Bundle", message: "No GHL checkout URL for the ₱5,000 All-Access product." });
  if (!isHttpUrl(catalog.settings.memberPortalUrl))
    issues.push({ severity: "recommended", area: "Course Access", message: "No GHL member portal / dashboard URL for “GO TO MY AI SKILLS DASHBOARD”." });
  if (!isHttpUrl(catalog.settings.supportUrl))
    issues.push({ severity: "recommended", area: "Support", message: "No support/Messenger link for buyers who need help." });
  if (bundleMasterclasses(catalog).length === 0)
    issues.push({ severity: "blocking", area: "All-Access Bundle", message: "No enabled masterclass is marked as included in the bundle." });
  return issues;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
}

/**
 * Accepts an untrusted catalog JSON (the published file or an admin import)
 * and returns a complete, well-typed catalog. Unknown/malformed fields fall
 * back to defaults instead of crashing the public sales page.
 */
export function normalizeCatalog(raw: unknown): AiSkillsCatalog {
  const d = DEFAULT_AI_SKILLS_CATALOG;
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const rawCourses = Array.isArray(r.masterclasses) ? r.masterclasses : d.masterclasses;
  const seen = new Set<string>();
  const masterclasses: AiMasterclass[] = [];
  rawCourses.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const c = item as Record<string, unknown>;
    const title = str(c.title, "").trim();
    if (!title) return;
    let slug = slugify(str(c.slug, "") || title);
    while (seen.has(slug)) slug = `${slug}-${index}`;
    seen.add(slug);
    const icon = ICONS.includes(c.icon as AiSkillIcon) ? (c.icon as AiSkillIcon) : "video";
    masterclasses.push({
      id: str(c.id, "") || `mc-${slug}`,
      slug,
      title,
      shortTitle: str(c.shortTitle, "").trim() || title,
      description: str(c.description, ""),
      learnPoints: strList(c.learnPoints),
      modules: strList(c.modules),
      coverImageUrl: str(c.coverImageUrl, ""),
      icon,
      price: num(c.price, 499),
      ghlCheckoutUrl: str(c.ghlCheckoutUrl, ""),
      ghlProductRef: str(c.ghlProductRef, ""),
      ghlTag: str(c.ghlTag, ""),
      accessUrl: str(c.accessUrl, ""),
      includedInBundle: bool(c.includedInBundle, true),
      enabled: bool(c.enabled, true),
      sortOrder: num(c.sortOrder, index + 1),
    });
  });

  const b = (r.bundle && typeof r.bundle === "object" ? r.bundle : {}) as Record<string, unknown>;
  const camp = (b.campaign && typeof b.campaign === "object" ? b.campaign : {}) as Record<string, unknown>;
  const s = (r.settings && typeof r.settings === "object" ? r.settings : {}) as Record<string, unknown>;
  const pp = (s.prefillParams && typeof s.prefillParams === "object" ? s.prefillParams : {}) as Record<string, unknown>;
  const ds = d.settings;

  return {
    version: num(r.version, 1),
    updatedAt: str(r.updatedAt, d.updatedAt),
    masterclasses,
    bundle: {
      name: str(b.name, d.bundle.name) || d.bundle.name,
      regularPrice: num(b.regularPrice, d.bundle.regularPrice),
      ghlCheckoutUrl: str(b.ghlCheckoutUrl, ""),
      ghlProductRef: str(b.ghlProductRef, ""),
      extraIncludedNote: str(b.extraIncludedNote, ""),
      campaign: {
        enabled: bool(camp.enabled, false),
        label: str(camp.label, ""),
        message: str(camp.message, ""),
      },
    },
    settings: {
      checkoutMode: s.checkoutMode === "embed" ? "embed" : "redirect",
      requireFacebookName: bool(s.requireFacebookName, ds.requireFacebookName),
      prefillParams: {
        fullName: str(pp.fullName, ds.prefillParams.fullName),
        email: str(pp.email, ds.prefillParams.email),
        phone: str(pp.phone, ds.prefillParams.phone),
        facebookName: str(pp.facebookName, ds.prefillParams.facebookName),
        promoCode: str(pp.promoCode, ds.prefillParams.promoCode),
      },
      memberPortalUrl: str(s.memberPortalUrl, ""),
      upgradeCheckoutUrl: str(s.upgradeCheckoutUrl, ""),
      upgradeOfferNote: str(s.upgradeOfferNote, ""),
      leadWebhookUrl: str(s.leadWebhookUrl, ""),
      supportUrl: str(s.supportUrl, ""),
      supportLabel: str(s.supportLabel, ds.supportLabel) || ds.supportLabel,
    },
  };
}

// M.A.I.A. Feature Catalog (Production Phase 16, spec sections 8-9) —
// stable, machine-readable Feature IDs. These are fixed in code (like
// PERMISSION_MODULES/AUDIT_ACTIONS) precisely so authorization never
// depends on a UI label an Admin might rename; the Feature DB table
// (server/prisma/schema.prisma) carries only display metadata (name,
// description, category) for the Product Catalog admin UI, upserted from
// this exact list at seed time — it never introduces new feature keys of
// its own.

export const FEATURE_KEYS = [
  "COURSE_ACCESS",
  "AI_BUSINESS_STRATEGIST",
  "AI_COPYWRITER",
  "VIDEO_DIRECTOR",
  "CREATIVE_STUDIO",
  "AUTOMATION_STUDIO",
  "WEBSITE_BUILDER",
  "FUNNEL_BUILDER",
  "ADS_INTELLIGENCE",
  "BUSINESS_OS",
  "ADVANCED_ANALYTICS",
  "MULTIPLE_BUSINESSES",
  "BUILD_WITH_YOU",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

export const FEATURE_CATALOG_SEED: { featureKey: FeatureKey; name: string; description: string; category: string }[] = [
  { featureKey: "COURSE_ACCESS", name: "Course Access", description: "Access to enrolled courses — governed by the existing CourseAccessGrant system, never duplicated here.", category: "Learning" },
  { featureKey: "AI_BUSINESS_STRATEGIST", name: "AI Business Strategist", description: "The Business Strategist AI tool.", category: "AI" },
  { featureKey: "AI_COPYWRITER", name: "AI Copywriter", description: "The Copywriter AI tool.", category: "AI" },
  { featureKey: "VIDEO_DIRECTOR", name: "M.A.I.A. Video Director", description: "Real Google Veo video generation.", category: "AI" },
  { featureKey: "CREATIVE_STUDIO", name: "Creative Studio", description: "Campaign, angle, hook, script, and storyboard generation.", category: "Marketing" },
  { featureKey: "AUTOMATION_STUDIO", name: "Automation Studio", description: "Customer Journey Builder and Automation Architect.", category: "Automation" },
  { featureKey: "WEBSITE_BUILDER", name: "Website Builder", description: "Website & Funnel Studio's website projects.", category: "Website" },
  { featureKey: "FUNNEL_BUILDER", name: "Funnel Builder", description: "Website & Funnel Studio's funnels.", category: "Website" },
  { featureKey: "ADS_INTELLIGENCE", name: "Ads Intelligence", description: "M.A.I.A. Ads Command Center.", category: "Marketing" },
  { featureKey: "BUSINESS_OS", name: "Business OS", description: "M.A.I.A. Business OS unified command center.", category: "Business OS" },
  { featureKey: "ADVANCED_ANALYTICS", name: "Advanced Analytics", description: "Deeper reporting across modules.", category: "Analytics" },
  { featureKey: "MULTIPLE_BUSINESSES", name: "Multiple Businesses", description: "How many businesses a Student may create; usageLimit on the granting Entitlement is the real cap.", category: "Business OS" },
  { featureKey: "BUILD_WITH_YOU", name: "Build With You", description: "The MAIA-team-assisted implementation service — a SERVICE entitlement, distinct from software feature entitlements (spec section 25).", category: "Service" },
];

// ---------------------------------------------------------------------------
// M.A.I.A. AI SKILLS ACADEMY™ — SALES FUNNEL DOMAIN MODEL
// ---------------------------------------------------------------------------
// A SKILLS-BASED offer, deliberately separate from the M.A.I.A. Business
// Solutions Academy Level 1 / Level 2 / Level 3 (Build With You) programs.
// Students do not need an existing business to enroll.
//
// Payment, discounts, and course access are owned by GoHighLevel (GHL):
// this funnel never computes a charged amount, never validates a coupon,
// and never grants course access itself. Every GHL-owned value below is a
// PLACEHOLDER until the admin pastes the real one in the Funnel Manager —
// see AI_SKILLS_FUNNEL_SETUP.md.
// ---------------------------------------------------------------------------

/** Icon used on a masterclass's generated cover when no cover image is set. */
export type AiSkillIcon =
  | "digital-twin"
  | "interview"
  | "ugc"
  | "photography"
  | "music"
  | "website"
  | "content-system"
  | "video"
  | "design"
  | "marketing"
  | "automation"
  | "writing";

export interface AiMasterclass {
  /** Stable internal ID — never shown to buyers, never reused. */
  id: string;
  /** URL segment: /ai-skills/masterclass/:slug */
  slug: string;
  title: string;
  /** Short name used in the All-Access checklist, e.g. "AI Photography". */
  shortTitle: string;
  description: string;
  /** "What you will learn" bullets on the card and detail page. */
  learnPoints: string[];
  /** Course content outline (module titles) shown on the detail page. */
  modules: string[];
  /** Optional hosted image URL. Empty = branded generated cover. */
  coverImageUrl: string;
  icon: AiSkillIcon;
  /** Display price in PHP. The CHARGED price always comes from the GHL product. */
  price: number;
  /** GHL order form / checkout page URL for this masterclass (single purchase). */
  ghlCheckoutUrl: string;
  /** Reference only — the GHL product/price ID, so the admin can match records. */
  ghlProductRef: string;
  /** Course-specific CRM tag, e.g. MAIA-AI-PHOTOGRAPHY. */
  ghlTag: string;
  /** Where a buyer of THIS masterclass goes to open it (GHL course / offer URL). */
  accessUrl: string;
  includedInBundle: boolean;
  enabled: boolean;
  sortOrder: number;
}

export interface AiSkillsBundle {
  name: string;
  regularPrice: number;
  ghlCheckoutUrl: string;
  ghlProductRef: string;
  /** Optional: a text line for bundle items that are not individual masterclasses. */
  extraIncludedNote: string;
  /**
   * Public campaign display. OFF by default — a promotional price is never
   * shown publicly unless the admin explicitly turns a campaign on.
   */
  campaign: {
    enabled: boolean;
    label: string;
    message: string;
  };
}

export type CheckoutMode = "redirect" | "embed";

export interface AiSkillsFunnelSettings {
  /**
   * redirect: our checkout page collects details, then sends the buyer to the
   * GHL order form. embed: the GHL order form is shown inside our checkout page.
   */
  checkoutMode: CheckoutMode;
  requireFacebookName: boolean;
  /**
   * URL query-parameter names used to pre-fill the GHL order form. GHL maps
   * query params to form fields by field key; verify these in your form.
   * Leave any blank to skip pre-filling that field.
   */
  prefillParams: {
    fullName: string;
    email: string;
    phone: string;
    facebookName: string;
    /** Blank by default: only set this if your GHL checkout accepts a coupon via URL. */
    promoCode: string;
  };
  /** GHL membership / Client Portal login ("GO TO MY AI SKILLS DASHBOARD"). */
  memberPortalUrl: string;
  /** Checkout for the optional post-purchase upgrade. Blank = upsell hidden. */
  upgradeCheckoutUrl: string;
  /** Optional admin-written upgrade offer line (no price is ever invented). */
  upgradeOfferNote: string;
  /**
   * OPTIONAL GHL Inbound Webhook URL. When set, the details a buyer enters on
   * our checkout page are sent to it before they reach payment, so a GHL
   * workflow can create/update the contact and follow up on unfinished
   * checkouts. Blank = nothing is sent anywhere by this page.
   */
  leadWebhookUrl: string;
  /** Messenger / contact link shown when a checkout is not configured yet. */
  supportUrl: string;
  supportLabel: string;
}

export interface AiSkillsCatalog {
  version: number;
  updatedAt: string;
  masterclasses: AiMasterclass[];
  bundle: AiSkillsBundle;
  settings: AiSkillsFunnelSettings;
}

/** A purchasable product in this funnel: one masterclass, or the bundle. */
export type AiSkillsProduct =
  | { kind: "single"; key: string; name: string; price: number; checkoutUrl: string; tags: string[]; course: AiMasterclass }
  | { kind: "bundle"; key: "all-access"; name: string; price: number; checkoutUrl: string; tags: string[] };

import type { AiSkillsCatalog } from "@/types/aiSkills";

// ---------------------------------------------------------------------------
// M.A.I.A. AI SKILLS ACADEMY™ — DEFAULT (BUNDLED) CATALOG
// ---------------------------------------------------------------------------
// This is the fallback catalog compiled into the app. The LIVE catalog is
// loaded at runtime from AI_SKILLS_CATALOG_URL (default:
// /ai-skills-catalog.json in public/), so the admin can add, edit, disable,
// or reprice masterclasses by replacing that one JSON file — exported from
// the Funnel Manager — without touching code or redesigning the funnel.
//
// Every ghl* / accessUrl / memberPortalUrl value is intentionally BLANK.
// They are GHL-owned values that only the admin can supply; the funnel shows
// an honest "checkout is being set up" state until they are filled in.
// "What you'll learn" bullets and module outlines are DRAFTS — confirm them
// against each masterclass's actual content before going live.
// ---------------------------------------------------------------------------

export const AI_SKILLS_CATALOG_URL: string =
  (import.meta.env.VITE_AI_SKILLS_CATALOG_URL as string | undefined) || "/ai-skills-catalog.json";

export const AI_SKILLS_DRAFT_STORAGE_KEY = "maia.aiSkills.catalogDraft.v1";

/** sessionStorage: first name + product, only to personalise the confirmation page. */
export const PENDING_ORDER_KEY = "maia.aiSkills.pendingOrder";

/** CRM tags applied by GHL workflows — see AI_SKILLS_FUNNEL_SETUP.md. */
export const AI_SKILLS_TAGS = {
  customer: "MAIA-AI-SKILLS-CUSTOMER",
  single: "MAIA-AI-SINGLE-COURSE",
  allAccess: "MAIA-AI-ALL-ACCESS",
} as const;

export const CORE_MESSAGE = ["LEARN AI SKILLS.", "USE THEM.", "OFFER THEM.", "EARN FROM THEM."] as const;

export const DEFAULT_AI_SKILLS_CATALOG: AiSkillsCatalog = {
  version: 1,
  updatedAt: "2026-09-29T00:00:00.000Z",
  masterclasses: [
    {
      id: "mc-digital-twin",
      slug: "ai-digital-twin-video",
      title: "AI Digital Twin Video Creation Masterclass",
      shortTitle: "AI Digital Twin",
      description: "Learn how to create consistent AI digital twin content and videos.",
      learnPoints: [
        "Set up a consistent AI digital twin of yourself or a brand persona",
        "Write and structure scripts your digital twin can deliver",
        "Produce talking-head style videos for content and marketing",
        "Keep your look, voice and style consistent across videos",
      ],
      modules: [
        "Understanding AI digital twins and responsible use",
        "Preparing your reference photos, video and voice",
        "Creating your digital twin",
        "Scripting for digital twin videos",
        "Producing, editing and exporting your videos",
        "Using digital twin videos for your business or as a service",
      ],
      coverImageUrl: "",
      icon: "digital-twin",
      price: 499,
      ghlCheckoutUrl: "",
      ghlProductRef: "",
      ghlTag: "MAIA-AI-DIGITAL-TWIN",
      accessUrl: "",
      includedInBundle: true,
      enabled: true,
      sortOrder: 1,
    },
    {
      id: "mc-interview",
      slug: "ai-interview-video",
      title: "AI Interview Video Creation Masterclass",
      shortTitle: "AI Interview Video",
      description: "Learn how to create AI-powered interview and podcast-style videos.",
      learnPoints: [
        "Plan interview and podcast-style video formats",
        "Create AI hosts, guests and conversation flows",
        "Generate natural-sounding dialogue and voices",
        "Assemble polished interview videos for social media",
      ],
      modules: [
        "Interview & podcast video formats that work",
        "Planning topics, questions and conversation flow",
        "Creating AI characters and voices",
        "Building the interview scene",
        "Editing, captions and exporting",
        "Turning interview videos into a content or client service",
      ],
      coverImageUrl: "",
      icon: "interview",
      price: 499,
      ghlCheckoutUrl: "",
      ghlProductRef: "",
      ghlTag: "MAIA-AI-INTERVIEW",
      accessUrl: "",
      includedInBundle: true,
      enabled: true,
      sortOrder: 2,
    },
    {
      id: "mc-ugc",
      slug: "ai-ugc-video",
      title: "AI UGC Video Creation Masterclass",
      shortTitle: "AI UGC",
      description: "Learn how to create AI-generated UGC-style marketing content.",
      learnPoints: [
        "Understand what makes UGC-style content persuasive",
        "Write hooks and scripts for product-focused UGC",
        "Create AI-generated UGC-style videos",
        "Prepare versions for ads, reels and product pages",
      ],
      modules: [
        "UGC-style marketing explained",
        "Hooks, angles and scripts",
        "Creating AI UGC creators and scenes",
        "Producing UGC-style product videos",
        "Editing for ads, reels and short-form platforms",
        "Offering UGC-style content creation as a service",
      ],
      coverImageUrl: "",
      icon: "ugc",
      price: 499,
      ghlCheckoutUrl: "",
      ghlProductRef: "",
      ghlTag: "MAIA-AI-UGC",
      accessUrl: "",
      includedInBundle: true,
      enabled: true,
      sortOrder: 3,
    },
    {
      id: "mc-photography",
      slug: "ai-photography",
      title: "AI Photography Masterclass",
      shortTitle: "AI Photography",
      description: "Learn how to create professional AI-powered product and brand photography.",
      learnPoints: [
        "Create studio-quality product photos with AI",
        "Build lifestyle and brand scenes around your products",
        "Keep lighting, style and brand look consistent",
        "Prepare images for listings, ads and social media",
      ],
      modules: [
        "AI photography foundations",
        "Preparing your product photos",
        "Studio and white-background product shots",
        "Lifestyle and brand scenes",
        "Consistency, retouching and export",
        "Using AI photography for your products or clients",
      ],
      coverImageUrl: "",
      icon: "photography",
      price: 499,
      ghlCheckoutUrl: "",
      ghlProductRef: "",
      ghlTag: "MAIA-AI-PHOTOGRAPHY",
      accessUrl: "",
      includedInBundle: true,
      enabled: true,
      sortOrder: 4,
    },
    {
      id: "mc-music",
      slug: "ai-music-creation",
      title: "AI Music Creation Masterclass",
      shortTitle: "AI Music",
      description: "Learn how to create AI-assisted music and audio assets.",
      learnPoints: [
        "Create AI-assisted songs, jingles and background music",
        "Write prompts and lyrics that fit a brand or mood",
        "Produce audio assets for videos and campaigns",
        "Understand responsible use and usage rights basics",
      ],
      modules: [
        "AI music tools and responsible use",
        "Prompting for genre, mood and style",
        "Writing lyrics and brand jingles",
        "Producing background music and audio assets",
        "Pairing music with your video content",
        "Using AI music for your projects or clients",
      ],
      coverImageUrl: "",
      icon: "music",
      price: 499,
      ghlCheckoutUrl: "",
      ghlProductRef: "",
      ghlTag: "MAIA-AI-MUSIC",
      accessUrl: "",
      includedInBundle: true,
      enabled: true,
      sortOrder: 5,
    },
    {
      id: "mc-website",
      slug: "ai-website-creation",
      title: "AI Website Creation Masterclass",
      shortTitle: "AI Website",
      description: "Learn how to use AI tools to create websites and digital pages.",
      learnPoints: [
        "Plan a website or landing page structure",
        "Generate page copy and layouts with AI",
        "Build and publish a working page step by step",
        "Create simple pages for your business or for clients",
      ],
      modules: [
        "Website and landing page basics",
        "Planning pages, sections and messaging",
        "Generating copy and design with AI",
        "Building your page with AI tools",
        "Publishing, testing and updating",
        "Offering AI website creation as a service",
      ],
      coverImageUrl: "",
      icon: "website",
      price: 499,
      ghlCheckoutUrl: "",
      ghlProductRef: "",
      ghlTag: "MAIA-AI-WEBSITE",
      accessUrl: "",
      includedInBundle: true,
      enabled: true,
      sortOrder: 6,
    },
    {
      id: "mc-30day-content",
      slug: "30-day-ai-content-system",
      title: "30-Day AI Content System",
      shortTitle: "30-Day AI Content System",
      description: "Learn how to plan and create a structured 30-day content system using AI.",
      learnPoints: [
        "Plan 30 days of content around clear content pillars",
        "Use AI to draft captions, hooks and post ideas",
        "Batch-create content efficiently",
        "Build a repeatable monthly content workflow",
      ],
      modules: [
        "Content pillars and planning foundations",
        "Building your 30-day content calendar",
        "AI-assisted captions, hooks and scripts",
        "Batch-creating visuals and videos",
        "Scheduling and staying consistent",
        "Running content systems for yourself or clients",
      ],
      coverImageUrl: "",
      icon: "content-system",
      price: 499,
      ghlCheckoutUrl: "",
      ghlProductRef: "",
      ghlTag: "MAIA-AI-30DAY-CONTENT",
      accessUrl: "",
      includedInBundle: true,
      enabled: true,
      sortOrder: 7,
    },
  ],
  bundle: {
    name: "M.A.I.A. AI Skills All-Access Bundle",
    regularPrice: 5000,
    ghlCheckoutUrl: "",
    ghlProductRef: "",
    extraIncludedNote: "",
    campaign: {
      enabled: false,
      label: "",
      message: "",
    },
  },
  settings: {
    checkoutMode: "redirect",
    requireFacebookName: false,
    prefillParams: {
      fullName: "full_name",
      email: "email",
      phone: "phone",
      facebookName: "",
      promoCode: "",
    },
    memberPortalUrl: "",
    upgradeCheckoutUrl: "",
    upgradeOfferNote: "",
    leadWebhookUrl: "",
    supportUrl: "",
    supportLabel: "Message M.A.I.A. Support",
  },
};

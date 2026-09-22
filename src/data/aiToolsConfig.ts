// Configuration + demo seed data for the M.A.I.A. AI Business Tools Hub
// (Step 12). Every tool below is DEMO/LOCAL data — see
// src/data/aiToolsStore.tsx for the full disclosure. No real AI provider is
// connected (see DEMO_AI_PROVIDER.connectionStatus).

import type {
  AiGoalOption,
  AiManualGrant,
  AiPackageAccessMatrix,
  AiProvider,
  AiToolDefinition,
  AiUsageSettings,
  AiWorkflowRecipe,
  PromptVersion,
} from "@/types/aiTools";

export const CURRENT_DEMO_USER = "Mommy Ann";
const SEED_DATE = "2026-09-20T09:00:00+08:00";

// ---------------------------------------------------------------------------
// Tool Library (spec sections 6-7) — 18 specialized tools across 13
// categories, all connected to the SAME Master Brain context.
// ---------------------------------------------------------------------------

export const DEMO_AI_TOOLS: AiToolDefinition[] = [
  {
    id: "business-strategist",
    name: "M.A.I.A. Business Strategist",
    description: "Strategic thinking support for business direction, growth, and priorities.",
    category: "Strategy",
    icon: "Compass",
    displayOrder: 1,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "focusArea", label: "What do you want to focus on?", type: "select", required: true, options: ["Business Direction", "Growth Strategy", "Product Strategy", "Market Opportunities", "Customer Strategy", "Marketing Priorities", "Sales Improvement", "Business Challenge", "Action Planning"] },
      { key: "specificQuestion", label: "Anything specific you want addressed?", type: "textarea", required: false, placeholder: "Optional — describe your specific question" },
    ],
  },
  {
    id: "market-intelligence",
    name: "M.A.I.A. Market Intelligence",
    description: "Turns your Master Brain's customer data into insights, angles, and opportunities.",
    category: "Market Research",
    icon: "Radar",
    displayOrder: 2,
    status: "Active",
    providerId: null,
    inputFields: [{ key: "additionalContext", label: "Any specific objection or question to explore?", type: "textarea", required: false }],
  },
  {
    id: "content-strategist",
    name: "M.A.I.A. Content Strategist",
    description: "Builds a content strategy — pillars, platforms, and objectives.",
    category: "Content",
    icon: "LayoutTemplate",
    displayOrder: 3,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "primaryGoal", label: "Primary Content Goal", type: "select", required: true, options: ["Educate", "Build Authority", "Engage", "Build Trust", "Convert", "Promote"] },
      { key: "platforms", label: "Platforms", type: "text", required: false, placeholder: "e.g. Facebook, TikTok" },
    ],
  },
  {
    id: "content-planner",
    name: "M.A.I.A. Content Planner",
    description: "Generates a day-by-day content calendar.",
    category: "Content",
    icon: "CalendarDays",
    displayOrder: 4,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "duration", label: "Duration (days)", type: "select", required: true, options: ["7", "14", "30"] },
      { key: "platforms", label: "Platform", type: "text", required: false, placeholder: "e.g. Facebook" },
      { key: "product", label: "Product/Service to Feature", type: "text", required: false },
    ],
  },
  {
    id: "creative-strategist",
    name: "M.A.I.A. Creative Strategist",
    description: "Strategic creative concepts for ads, reels, and organic content.",
    category: "Creative",
    icon: "Sparkles",
    displayOrder: 5,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "campaignType", label: "Campaign Type", type: "select", required: true, options: ["Facebook Ads", "Organic Social", "Reels", "TikTok", "UGC", "Product Ad", "Promotion", "Product Launch", "Brand Awareness"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
      { key: "objective", label: "Objective", type: "text", required: false },
      { key: "assetType", label: "Uploaded Media Is...", type: "select", required: false, options: ["Reference / Inspiration", "Use as Asset"] },
    ],
  },
  {
    id: "video-director",
    name: "M.A.I.A. Video Director",
    description: "Full video strategy, hook, and scene-by-scene plan — not just a script.",
    category: "Video",
    icon: "Clapperboard",
    displayOrder: 6,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "videoType", label: "Video Type", type: "select", required: true, options: ["UGC", "Product Commercial", "Talking Head", "Problem-Solution", "Educational", "Testimonial Style", "Product Demo", "Storytelling", "Reels", "TikTok", "Facebook Ad", "AI Avatar", "AI Product Video", "Vlog Style", "Podcast Style", "Cinematic", "Other"] },
      { key: "platform", label: "Platform", type: "text", required: false, placeholder: "e.g. TikTok" },
      { key: "goal", label: "Goal", type: "text", required: false },
      { key: "product", label: "Product/Service", type: "text", required: false },
      { key: "cta", label: "Call To Action", type: "text", required: false },
    ],
  },
  {
    id: "copywriter",
    name: "M.A.I.A. Copywriter",
    description: "Captions, ad copy, headlines, hooks, and more — in your real brand voice.",
    category: "Copywriting",
    icon: "PenLine",
    displayOrder: 7,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "copyType", label: "Copy Type", type: "select", required: true, options: ["Facebook Caption", "Ad Copy", "Headline", "Hook", "CTA", "Product Description", "Sales Copy", "Promotional Copy", "Messenger Script", "SMS Draft", "Email Copy", "Landing Page Copy"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
      { key: "keyMessage", label: "Key Message (optional)", type: "textarea", required: false },
    ],
  },
  {
    id: "facebook-ads-strategist",
    name: "M.A.I.A. Facebook Ads Strategist",
    description: "Campaign structure, audience strategy, and creative testing plan.",
    category: "Advertising",
    icon: "Megaphone",
    displayOrder: 8,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "campaignGoal", label: "Campaign Goal", type: "text", required: true, placeholder: "e.g. Leads, Messages, Sales" },
      { key: "product", label: "Product/Service", type: "text", required: false },
      { key: "budget", label: "Budget", type: "text", required: false, placeholder: "e.g. ₱500/day" },
      { key: "audienceNotes", label: "Audience/Location Notes", type: "textarea", required: false },
    ],
  },
  {
    id: "ads-analyzer",
    name: "M.A.I.A. Ads Analyzer",
    description: "Analyzes the metrics you enter — never invents missing numbers.",
    category: "Advertising",
    icon: "ChartNoAxesCombined",
    displayOrder: 9,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "spend", label: "Spend", type: "number", required: false },
      { key: "impressions", label: "Impressions", type: "number", required: false },
      { key: "reach", label: "Reach", type: "number", required: false },
      { key: "clicks", label: "Clicks", type: "number", required: false },
      { key: "ctr", label: "CTR (%)", type: "number", required: false },
      { key: "cpc", label: "CPC", type: "number", required: false },
      { key: "cpm", label: "CPM", type: "number", required: false },
      { key: "messages", label: "Messages", type: "number", required: false },
      { key: "leads", label: "Leads", type: "number", required: false },
      { key: "purchases", label: "Purchases", type: "number", required: false },
      { key: "revenue", label: "Revenue", type: "number", required: false },
      { key: "roas", label: "ROAS", type: "number", required: false },
    ],
  },
  {
    id: "offer-builder",
    name: "M.A.I.A. Offer Builder",
    description: "Builds a core offer, value proposition, and offer stack.",
    category: "Sales",
    icon: "Gift",
    displayOrder: 10,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "product", label: "Product/Service", type: "text", required: true },
      { key: "price", label: "Price", type: "text", required: false },
    ],
  },
  {
    id: "sales-script-builder",
    name: "M.A.I.A. Sales Script Builder",
    description: "Messenger, phone, follow-up, and closing scripts using your real offers.",
    category: "Sales",
    icon: "MessageCircle",
    displayOrder: 11,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "scriptType", label: "Script Type", type: "select", required: true, options: ["Messenger Sales Script", "Inquiry Script", "Phone Sales Script", "Follow-Up Script", "Objection Handling", "Closing Script", "Payment Follow-Up", "Customer Reactivation"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
    ],
  },
  {
    id: "chatbot-flow-builder",
    name: "M.A.I.A. Chatbot Flow Builder",
    description: "Business-specific chatbot flows for Messenger, WhatsApp, and more.",
    category: "Automation",
    icon: "Bot",
    displayOrder: 12,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "platform", label: "Platform", type: "select", required: false, options: ["Pancake", "Botcake", "Messenger", "WhatsApp", "GHL", "Other"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
    ],
  },
  {
    id: "automation-architect",
    name: "M.A.I.A. Automation Architect",
    description: "Designs automation blueprints — never auto-activated in a live system.",
    category: "Automation",
    icon: "Workflow",
    displayOrder: 13,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "goal", label: "Goal", type: "text", required: true },
      { key: "channels", label: "Channels", type: "text", required: false, placeholder: "e.g. Messenger, SMS" },
    ],
  },
  {
    id: "customer-journey-builder",
    name: "M.A.I.A. Customer Journey Builder",
    description: "Maps Awareness through Advocacy with messages and CTAs per stage.",
    category: "Customer Journey",
    icon: "Route",
    displayOrder: 14,
    status: "Active",
    providerId: null,
    inputFields: [{ key: "product", label: "Product/Service", type: "text", required: false }],
  },
  {
    id: "funnel-builder",
    name: "M.A.I.A. Funnel Builder",
    description: "Blueprints for lead generation, webinar, and product sales funnels.",
    category: "Funnels",
    icon: "Filter",
    displayOrder: 15,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "funnelType", label: "Funnel Type", type: "select", required: true, options: ["Lead Generation Funnel", "Webinar Funnel", "Product Sales Funnel", "Course Funnel", "Service Funnel", "Appointment Funnel", "Ecommerce Funnel"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
    ],
  },
  {
    id: "website-copy-builder",
    name: "M.A.I.A. Website Copy Builder",
    description: "Homepage, About, FAQ, and sales page copy in your brand voice.",
    category: "Website",
    icon: "Globe",
    displayOrder: 16,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "pageType", label: "Page", type: "select", required: true, options: ["Homepage", "About", "Products / Services", "Benefits", "Why Choose Us", "FAQ", "Contact", "Landing Page", "Sales Page"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
    ],
  },
  {
    id: "email-marketing-builder",
    name: "M.A.I.A. Email Marketing Builder",
    description: "Welcome series, nurture, launch, and post-purchase email sequences.",
    category: "Funnels",
    icon: "Mail",
    displayOrder: 17,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "sequenceType", label: "Sequence Type", type: "select", required: true, options: ["Welcome Series", "Lead Nurture", "Webinar Follow-Up", "Product Launch", "Promotion", "Abandoned Inquiry", "Reactivation", "Post-Purchase", "Feedback Request"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
      { key: "numberOfEmails", label: "Number of Emails", type: "number", required: false, placeholder: "e.g. 3" },
    ],
  },
  {
    id: "business-systems-advisor",
    name: "M.A.I.A. Business Systems Advisor",
    description: "Identifies manual processes and recommends systems/automation.",
    category: "Business Systems",
    icon: "Settings2",
    displayOrder: 18,
    status: "Active",
    providerId: null,
    inputFields: [
      { key: "processArea", label: "Process Area", type: "select", required: true, options: ["Customer Service", "Lead Management", "Sales Follow-Up", "Inventory Workflow", "Team Workflow", "Other"] },
      { key: "currentProcessDescription", label: "Describe the current process", type: "textarea", required: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// Goal-based start (spec section 8)
// ---------------------------------------------------------------------------

export const AI_GOAL_OPTIONS: AiGoalOption[] = [
  { id: "plan-business", label: "Plan My Business", recommendedToolIds: ["business-strategist", "market-intelligence"] },
  { id: "create-content", label: "Create Content", recommendedToolIds: ["content-strategist", "content-planner"] },
  { id: "create-ad", label: "Create an Ad", recommendedToolIds: ["facebook-ads-strategist", "creative-strategist"] },
  { id: "create-video", label: "Create a Video", recommendedToolIds: ["video-director"] },
  { id: "build-offer", label: "Build an Offer", recommendedToolIds: ["offer-builder"] },
  { id: "improve-sales", label: "Improve My Sales", recommendedToolIds: ["sales-script-builder", "offer-builder"] },
  { id: "build-automation", label: "Build an Automation", recommendedToolIds: ["automation-architect", "chatbot-flow-builder"] },
  { id: "customer-journey", label: "Create a Customer Journey", recommendedToolIds: ["customer-journey-builder"] },
  { id: "build-funnel", label: "Build a Funnel", recommendedToolIds: ["funnel-builder"] },
  { id: "website-copy", label: "Write Website Copy", recommendedToolIds: ["website-copy-builder"] },
  { id: "email-marketing", label: "Create Email Marketing", recommendedToolIds: ["email-marketing-builder"] },
  { id: "analyze-ads", label: "Analyze My Ads", recommendedToolIds: ["ads-analyzer"] },
];

// ---------------------------------------------------------------------------
// Workflow recipes (spec sections 31, 65)
// ---------------------------------------------------------------------------

export const DEMO_WORKFLOW_RECIPES: AiWorkflowRecipe[] = [
  {
    id: "recipe-product-launch",
    name: "Product Launch",
    description: "Strategist → Offer → Content → Creative → Video → Copy → Ads",
    steps: ["business-strategist", "offer-builder", "content-strategist", "creative-strategist", "video-director", "copywriter", "facebook-ads-strategist"],
  },
  {
    id: "recipe-30-day-content",
    name: "30-Day Content",
    description: "Content Strategist → Content Planner → Creative Strategist → Video Director",
    steps: ["content-strategist", "content-planner", "creative-strategist", "video-director"],
  },
  {
    id: "recipe-sales-funnel",
    name: "Sales Funnel",
    description: "Offer → Funnel → Website Copy → Email Marketing → Automation",
    steps: ["offer-builder", "funnel-builder", "website-copy-builder", "email-marketing-builder", "automation-architect"],
  },
];

// ---------------------------------------------------------------------------
// Prompt / Instruction Manager seed (spec sections 41-42) — internal only.
// ---------------------------------------------------------------------------

export const DEMO_PROMPT_VERSIONS: PromptVersion[] = DEMO_AI_TOOLS.map((tool, i) => ({
  id: `prompt-${tool.id}`,
  toolId: tool.id,
  version: 1,
  systemInstruction: `You are ${tool.name}, a specialized business expert for M.A.I.A. Academy students. Always ground your response in the student's Published Brand Master Brain context provided to you. Never invent prices, certifications, guarantees, or claims not present in the provided context.`,
  toolObjective: tool.description,
  requiredContext: ["Business Foundation", "Target Market", "Positioning", "Brand Voice", "Offers"],
  outputStructure: "See the tool's structured output sections.",
  guardrails: "Never fabricate business facts. Flag unsupported marketing claims. Label AI hypotheses separately from Master Brain facts where relevant.",
  status: "Active",
  createdAt: SEED_DATE,
  updatedAt: SEED_DATE,
  updatedBy: CURRENT_DEMO_USER,
  changeNotes: i === 0 ? "Initial version." : "Initial version.",
}));

// ---------------------------------------------------------------------------
// AI Provider (spec sections 38-40, 68, 72) — honestly Not Connected. No
// real API key field exists anywhere in this frontend.
// ---------------------------------------------------------------------------

export const DEMO_AI_PROVIDER: AiProvider = {
  id: "provider-demo",
  name: "Demo Simulated Provider",
  connectionStatus: "Not Connected",
  selectedModel: "(none — no real provider connected)",
  lastHealthCheck: null,
  status: "Active",
};

// ---------------------------------------------------------------------------
// Package access matrix (spec sections 46-47) — admin-editable, not a
// permanent hard-coded rule; this is just a sensible starting point.
// ---------------------------------------------------------------------------

const CORE_TOOLS: (typeof DEMO_AI_TOOLS)[number]["id"][] = ["business-strategist", "content-strategist", "content-planner", "copywriter", "offer-builder"];
const VIP_TOOLS: (typeof DEMO_AI_TOOLS)[number]["id"][] = [...CORE_TOOLS, "creative-strategist", "facebook-ads-strategist", "sales-script-builder", "market-intelligence"];

export const DEFAULT_AI_PACKAGE_ACCESS: AiPackageAccessMatrix = {
  Premium: CORE_TOOLS,
  VIP: VIP_TOOLS,
  "Dual VIP": DEMO_AI_TOOLS.map((t) => t.id),
};

export const DEMO_MANUAL_GRANTS: AiManualGrant[] = [];

// ---------------------------------------------------------------------------
// Usage settings (spec sections 48-49) — Unlimited by default; billing never
// activated, credit costs are reference-only placeholders.
// ---------------------------------------------------------------------------

export const DEFAULT_AI_USAGE_SETTINGS: AiUsageSettings = {
  mode: "Unlimited",
  dailyLimit: 20,
  monthlyLimit: 200,
  packageDailyLimitOverrides: {},
  creditsEnabled: false,
  textCreditCost: 1,
  imageCreditCost: 5,
  videoCreditCost: 10,
};

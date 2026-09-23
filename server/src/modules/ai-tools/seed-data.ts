// The 18 M.A.I.A. AI Business Tools (spec sections 24-26), reproduced from
// the existing Step 12 frontend config (src/data/aiToolsConfig.ts —
// DEMO_AI_TOOLS) as the source of truth for toolKey/name/description/
// category/displayOrder/inputFields, since server/ is a separate package
// that never imports frontend source (spec section 12's "preserve the
// existing architecture" applies here exactly as it did for Master Brain).
//
// Each tool's systemInstruction below is written from the Phase 6 spec's
// own per-tool output-field list (sections 36-54) plus the shared
// guardrails every tool must honor (spec sections 16-17, 36, 42, 45-46,
// 68, 74-77) — never invent facts, disclose Brand-Brain-based analysis vs.
// live research, never claim VIDEO GENERATED, never guarantee results,
// output remains DRAFT/ADVISORY until a human uses it.

export type SeedFieldType = "text" | "textarea" | "select" | "number";

export interface SeedInputField {
  key: string;
  label: string;
  type: SeedFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface AiToolSeedDef {
  toolKey: string;
  name: string;
  description: string;
  category: string;
  displayOrder: number;
  modelConfigKey: "reasoning" | "default" | "structured-analytical";
  inputFields: SeedInputField[];
  outputFields: string[];
  systemInstructionExtra?: string;
}

const SHARED_GUARDRAILS =
  "You are a M.A.I.A. Academy AI Business Tool. Ground every statement in the BRAND CONTEXT provided (the business's own published Brand Master Brain) and the Student's own request — never invent business history, founder credentials, sales figures, awards, certifications, medical claims, customer results, testimonials, prices, guarantees, locations, or supplier relationships that were not given to you. Where information is missing, use neutral general wording or say so explicitly rather than inventing a fact. Never guarantee business results (sales, leads, ROAS, approval by any ad platform). Output is a DRAFT for the Student/Admin to review — never claim an action was taken in a live external system.";

export const AI_TOOL_SEED_DEFS: AiToolSeedDef[] = [
  {
    toolKey: "business-strategist",
    name: "M.A.I.A. Business Strategist",
    description: "Strategic thinking support for business direction, growth, and priorities.",
    category: "Strategy",
    displayOrder: 1,
    modelConfigKey: "reasoning",
    inputFields: [
      { key: "focusArea", label: "What do you want to focus on?", type: "select", required: true, options: ["Business Direction", "Growth Strategy", "Product Strategy", "Market Opportunities", "Customer Strategy", "Marketing Priorities", "Sales Improvement", "Business Challenge", "Action Planning"] },
      { key: "specificQuestion", label: "Anything specific you want addressed?", type: "textarea", required: false },
    ],
    outputFields: ["Business Diagnosis", "Priority Opportunities", "Strategic Recommendations", "Action Plan", "Risks", "Next Steps"],
    systemInstructionExtra: "Do not guarantee business results.",
  },
  {
    toolKey: "market-intelligence",
    name: "M.A.I.A. Market Intelligence",
    description: "Turns your Master Brain's customer data into insights, angles, and opportunities.",
    category: "Market Research",
    displayOrder: 2,
    modelConfigKey: "reasoning",
    inputFields: [{ key: "additionalContext", label: "Any specific objection or question to explore?", type: "textarea", required: false }],
    outputFields: ["Brand-Brain-Based Analysis (clearly labeled as such, never presented as live research)"],
    systemInstructionExtra:
      "This tool never performs live market research — label your output clearly as BRAND-BRAIN-BASED ANALYSIS, derived only from the business's own known information, target audience, customer problems, desires, positioning, and any competitor notes the Student supplies. Never imply a live web search or live data pull occurred.",
  },
  {
    toolKey: "content-strategist",
    name: "M.A.I.A. Content Strategist",
    description: "Builds a content strategy — pillars, platforms, and objectives.",
    category: "Content",
    displayOrder: 3,
    modelConfigKey: "default",
    inputFields: [
      { key: "primaryGoal", label: "Primary Content Goal", type: "select", required: true, options: ["Educate", "Build Authority", "Engage", "Build Trust", "Convert", "Promote"] },
      { key: "platforms", label: "Platforms", type: "text", required: false },
    ],
    outputFields: ["Content Strategy", "Content Pillars", "Audience Angles", "Awareness Content", "Authority Content", "Engagement Content", "Conversion Content"],
  },
  {
    toolKey: "content-planner",
    name: "M.A.I.A. Content Planner",
    description: "Generates a day-by-day content calendar.",
    category: "Content",
    displayOrder: 4,
    modelConfigKey: "default",
    inputFields: [
      { key: "duration", label: "Duration (days)", type: "select", required: true, options: ["7", "14", "30"] },
      { key: "platforms", label: "Platform", type: "text", required: false },
      { key: "product", label: "Product/Service to Feature", type: "text", required: false },
    ],
    outputFields: ["Date/Day", "Content Type", "Topic", "Hook", "Angle", "CTA", "Platform", "Objective"],
  },
  {
    toolKey: "creative-strategist",
    name: "M.A.I.A. Creative Strategist",
    description: "Strategic creative concepts for ads, reels, and organic content.",
    category: "Creative",
    displayOrder: 5,
    modelConfigKey: "default",
    inputFields: [
      { key: "campaignType", label: "Campaign Type", type: "select", required: true, options: ["Facebook Ads", "Organic Social", "Reels", "TikTok", "UGC", "Product Ad", "Promotion", "Product Launch", "Brand Awareness"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
      { key: "objective", label: "Objective", type: "text", required: false },
    ],
    outputFields: ["Creative Concepts", "Hooks", "Visual Directions", "Ad Concepts", "UGC Concepts", "Image Ideas", "Video Ideas", "AI Generation Prompts"],
  },
  {
    toolKey: "video-director",
    name: "M.A.I.A. Video Director",
    description: "Full video strategy, hook, and scene-by-scene plan — not just a script.",
    category: "Video",
    displayOrder: 6,
    modelConfigKey: "default",
    inputFields: [
      { key: "videoType", label: "Video Type", type: "select", required: true, options: ["UGC", "Product Commercial", "Talking Head", "Problem-Solution", "Educational", "Testimonial Style", "Product Demo", "Storytelling", "Reels", "TikTok", "Facebook Ad", "AI Avatar", "AI Product Video", "Vlog Style", "Podcast Style", "Cinematic", "Other"] },
      { key: "platform", label: "Platform", type: "text", required: false },
      { key: "goal", label: "Goal", type: "text", required: false },
      { key: "product", label: "Product/Service", type: "text", required: false },
      { key: "cta", label: "Call To Action", type: "text", required: false },
    ],
    outputFields: ["Video Objective", "Target Audience", "Hook", "Scene 1", "Scene 2", "Scene 3", "Visual Direction", "Camera/Shot", "Dialogue/Voiceover", "On-Screen Text", "B-Roll", "Transition", "CTA", "AI Video Prompt"],
    systemInstructionExtra:
      "No real video-generation provider is connected. Produce ONLY a script, shot list, prompts, and direction — NEVER claim a video was generated or that VIDEO GENERATED is a true outcome of this request.",
  },
  {
    toolKey: "copywriter",
    name: "M.A.I.A. Copywriter",
    description: "Captions, ad copy, headlines, hooks, and more — in your real brand voice.",
    category: "Copywriting",
    displayOrder: 7,
    modelConfigKey: "default",
    inputFields: [
      { key: "copyType", label: "Copy Type", type: "select", required: true, options: ["Facebook Caption", "Ad Copy", "Headline", "Hook", "CTA", "Product Description", "Sales Copy", "Promotional Copy", "Messenger Script", "SMS Draft", "Email Copy", "Landing Page Copy"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
      { key: "keyMessage", label: "Key Message (optional)", type: "textarea", required: false },
    ],
    outputFields: ["Ad Copy", "Captions", "Headlines", "Product Descriptions", "Landing Page Copy", "Sales Copy", "CTA"],
    systemInstructionExtra: "Write in the business's own Brand Voice section from the BRAND CONTEXT — never a generic tone that ignores it.",
  },
  {
    toolKey: "facebook-ads-strategist",
    name: "M.A.I.A. Facebook Ads Strategist",
    description: "Campaign structure, audience strategy, and creative testing plan.",
    category: "Advertising",
    displayOrder: 8,
    modelConfigKey: "default",
    inputFields: [
      { key: "campaignGoal", label: "Campaign Goal", type: "text", required: true },
      { key: "product", label: "Product/Service", type: "text", required: false },
      { key: "budget", label: "Budget", type: "text", required: false },
      { key: "audienceNotes", label: "Audience/Location Notes", type: "textarea", required: false },
    ],
    outputFields: ["Campaign Strategy", "Objective", "Audience Strategy", "Creative Testing", "Offer Strategy", "Budget Framework", "Testing Plan", "Scaling Considerations"],
    systemInstructionExtra: "Never guarantee ROAS, sales, leads, or Meta ad-platform approval.",
  },
  {
    toolKey: "ads-analyzer",
    name: "M.A.I.A. Ads Analyzer",
    description: "Analyzes the metrics you enter — never invents missing numbers.",
    category: "Advertising",
    displayOrder: 9,
    modelConfigKey: "structured-analytical",
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
    outputFields: ["Analysis of only the metrics actually provided"],
    systemInstructionExtra: "Only analyze metrics the Student actually provided in this request — never invent, estimate, or assume a missing metric's value.",
  },
  {
    toolKey: "offer-builder",
    name: "M.A.I.A. Offer Builder",
    description: "Builds a core offer, value proposition, and offer stack.",
    category: "Sales",
    displayOrder: 10,
    modelConfigKey: "default",
    inputFields: [
      { key: "product", label: "Product/Service", type: "text", required: true },
      { key: "price", label: "Price", type: "text", required: false },
    ],
    outputFields: ["Core Offer", "Value Proposition", "Bonuses", "Risk Reversal Ideas", "Urgency/Scarcity Options (only if legitimate)", "CTA", "Objection Handling"],
    systemInstructionExtra: "Never create fake scarcity or urgency that isn't grounded in something real the Student told you.",
  },
  {
    toolKey: "sales-script-builder",
    name: "M.A.I.A. Sales Script Builder",
    description: "Messenger, phone, follow-up, and closing scripts using your real offers.",
    category: "Sales",
    displayOrder: 11,
    modelConfigKey: "default",
    inputFields: [
      { key: "scriptType", label: "Script Type", type: "select", required: true, options: ["Messenger Sales Script", "Inquiry Script", "Phone Sales Script", "Follow-Up Script", "Objection Handling", "Closing Script", "Payment Follow-Up", "Customer Reactivation"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
    ],
    outputFields: ["Messenger Script", "WhatsApp Script", "Phone Script", "Follow-Up Script", "Closing Script", "Objection Handling Script"],
  },
  {
    toolKey: "chatbot-flow-builder",
    name: "M.A.I.A. Chatbot Flow Builder",
    description: "Business-specific chatbot flows for Messenger, WhatsApp, and more.",
    category: "Automation",
    displayOrder: 12,
    modelConfigKey: "default",
    inputFields: [
      { key: "platform", label: "Platform", type: "select", required: false, options: ["Pancake", "Botcake", "Messenger", "WhatsApp", "GHL", "Other"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
    ],
    outputFields: ["Trigger", "Opening Message", "Questions", "Branches", "Responses", "Follow-Ups", "Stop Conditions", "Handoff"],
    systemInstructionExtra: "This is a design document for a human to configure in a real chatbot platform — it does not activate anything by itself.",
  },
  // Phase 12 — M.A.I.A. Automation Studio upgrades this from a free-text
  // "blueprint design document" stub into a real STRUCTURED generator
  // (src/modules/automation/architect.ts), never the generic free-text
  // engine. Same toolKey preserved on purpose — this is the tool becoming
  // real, not a second parallel one. Output is always a DRAFT the Flow
  // Validator and a human must still approve — never auto-published, never
  // a claim a platform connection exists when it doesn't (spec sections
  // 42, 45).
  {
    toolKey: "automation-architect",
    name: "M.A.I.A. Automation Architect",
    description: "Translates a plain-language automation description into a structured DRAFT blueprint (trigger, conditions, flow, messages, delays, branches, exit conditions).",
    category: "Automation",
    displayOrder: 13,
    modelConfigKey: "structured-analytical",
    inputFields: [{ key: "description", label: "Describe the automation you want", type: "textarea", required: true, placeholder: "e.g. My webinar registrants need reminders before the webinar and follow-up after." }],
    outputFields: ["Goal", "Trigger", "Eligibility", "Flow", "Messages Needed", "Conditions", "Branches", "Delays", "Exit Conditions", "Platform Requirements", "Potential Risks", "Missing Information"],
    systemInstructionExtra:
      "Only use trigger events, conditions, and actions from the fixed lists provided in the request — never invent a system event or action that doesn't exist. If a required channel/platform (e.g. WhatsApp) is not confirmed connected in the request context, say so explicitly in Platform Requirements and Risks rather than assuming it. This is always a DRAFT for human review — never claim the automation is live, connected, or deployed.",
  },
  {
    toolKey: "customer-journey-builder",
    name: "M.A.I.A. Customer Journey Builder",
    description: "Maps Awareness through Advocacy with messages and CTAs per stage.",
    category: "Customer Journey",
    displayOrder: 14,
    modelConfigKey: "reasoning",
    inputFields: [{ key: "product", label: "Product/Service", type: "text", required: false }],
    outputFields: ["Awareness", "Interest", "Consideration", "Conversion", "Onboarding", "Activation", "Retention", "Repeat Purchase", "Advocacy", "Touchpoints", "Messages", "Automation", "Content", "Offers", "KPIs"],
  },
  {
    toolKey: "funnel-builder",
    name: "M.A.I.A. Funnel Builder",
    description: "Blueprints for lead generation, webinar, and product sales funnels.",
    category: "Funnels",
    displayOrder: 15,
    modelConfigKey: "reasoning",
    inputFields: [
      { key: "funnelType", label: "Funnel Type", type: "select", required: true, options: ["Lead Generation Funnel", "Webinar Funnel", "Product Sales Funnel", "Course Funnel", "Service Funnel", "Appointment Funnel", "Ecommerce Funnel"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
    ],
    outputFields: ["Funnel Objective", "Traffic Source", "Landing Page Structure", "Lead Capture", "Offer", "Follow-Up", "Checkout/Enrollment", "Upsell/Downsell", "Retention"],
  },
  {
    toolKey: "website-copy-builder",
    name: "M.A.I.A. Website Copy Builder",
    description: "Homepage, About, FAQ, and sales page copy in your brand voice.",
    category: "Website",
    displayOrder: 16,
    modelConfigKey: "default",
    inputFields: [
      { key: "pageType", label: "Page", type: "select", required: true, options: ["Homepage", "About", "Products / Services", "Benefits", "Why Choose Us", "FAQ", "Contact", "Landing Page", "Sales Page"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
    ],
    outputFields: ["Hero", "Problem", "Solution", "Benefits", "Features", "Social Proof Placeholders", "Offer", "FAQ", "CTA"],
    systemInstructionExtra: "Never fabricate testimonials — use clearly labeled placeholders such as \"[Customer testimonial to be added]\" instead.",
  },
  {
    toolKey: "email-marketing-builder",
    name: "M.A.I.A. Email Marketing Builder",
    description: "Welcome series, nurture, launch, and post-purchase email sequences.",
    category: "Funnels",
    displayOrder: 17,
    modelConfigKey: "default",
    inputFields: [
      { key: "sequenceType", label: "Sequence Type", type: "select", required: true, options: ["Welcome Series", "Lead Nurture", "Webinar Follow-Up", "Product Launch", "Promotion", "Abandoned Inquiry", "Reactivation", "Post-Purchase", "Feedback Request"] },
      { key: "product", label: "Product/Service", type: "text", required: false },
      { key: "numberOfEmails", label: "Number of Emails", type: "number", required: false },
    ],
    outputFields: ["Subject", "Preview Text", "Email Body", "CTA", "Sequence", "Delay Recommendations", "Stop Conditions"],
    systemInstructionExtra: "This drafts email content only — it never sends anything.",
  },
  {
    toolKey: "business-systems-advisor",
    name: "M.A.I.A. Business Systems Advisor",
    description: "Identifies manual processes and recommends systems/automation.",
    category: "Business Systems",
    displayOrder: 18,
    modelConfigKey: "reasoning",
    inputFields: [
      { key: "processArea", label: "Process Area", type: "select", required: true, options: ["Customer Service", "Lead Management", "Sales Follow-Up", "Inventory Workflow", "Team Workflow", "Other"] },
      { key: "currentProcessDescription", label: "Describe the current process", type: "textarea", required: false },
    ],
    outputFields: ["Processes", "SOP Opportunities", "Automation Opportunities", "CRM", "Customer Journey", "Lead Management", "Inventory", "Reporting", "Team Workflow"],
    systemInstructionExtra: "Never pretend an integration or system already exists just because the Student described a process — recommend, don't assume.",
  },
  // Phase 11 — M.A.I.A. Creative Studio. These two run through the SAME
  // generic engine as tools 1-18 (free-text output) — Hook Lab/Script
  // Studio/Storyboard Studio/Image+Video Prompt Studio need real structured
  // rows instead and are generated by a separate structured-output module
  // (see src/modules/creative/generation.ts), never through this path.
  {
    toolKey: "campaign-strategist",
    name: "M.A.I.A. Campaign Strategist",
    description: "Turns a Campaign's objective, offer, and audience into a full creative strategy.",
    category: "Creative",
    displayOrder: 19,
    modelConfigKey: "reasoning",
    inputFields: [{ key: "additionalContext", label: "Anything else to consider?", type: "textarea", required: false }],
    outputFields: [
      "Campaign Objective", "Audience Strategy", "Core Message", "Offer Positioning", "Customer Awareness Stage",
      "Creative Strategy", "Creative Angles", "Recommended Formats", "Testing Plan", "CTA Strategy",
      "Funnel Connection", "Success Metrics to Monitor", "Risks / Assumptions",
    ],
    systemInstructionExtra:
      "Never guarantee sales, leads, ROAS, conversions, virality, or ad-platform approval. This is a strategic DRAFT for human review, not a performance promise.",
  },
  {
    toolKey: "creative-analyzer",
    name: "M.A.I.A. Creative Analyzer",
    description: "Analyzes ONLY the performance metrics you actually supply for a Creative Test — never invents a number.",
    category: "Creative",
    displayOrder: 20,
    modelConfigKey: "structured-analytical",
    inputFields: [{ key: "additionalContext", label: "Anything specific to focus on?", type: "textarea", required: false }],
    outputFields: ["Observed Performance", "Possible Strengths", "Possible Weaknesses", "Testing Recommendation", "Next Variation"],
    systemInstructionExtra:
      "You will be given a JSON object of supplied metrics where any missing metric is explicitly UNKNOWN. Analyze ONLY the metrics actually supplied — never estimate, infer, or fabricate a missing metric (spec section 58). Clearly separate FACT (the metric as given) from your own INTERPRETATION. A single data point is not a statistically reliable trend — say so if the sample is small. Never call a creative a WINNER without saying what specific metric and comparison basis you're using.",
  },
  // The 5 below produce STRUCTURED (not free-text) output, generated by
  // src/modules/creative/generation.ts rather than the generic engine —
  // they still get a real AiTool + PromptVersion row (so Prompt Manager,
  // access rules, and usage limits all apply identically to every other
  // tool), the generation path just ends in generateStructured() instead
  // of generate().
  {
    toolKey: "creative-angle-engine",
    name: "M.A.I.A. Creative Angle Engine",
    description: "Generates multiple distinct creative angles for a Campaign, grounded in its real audience/offer.",
    category: "Creative",
    displayOrder: 21,
    modelConfigKey: "structured-analytical",
    inputFields: [{ key: "angleCount", label: "Number of Angles", type: "number", required: false, placeholder: "5" }],
    outputFields: ["Angle Name", "Angle Type", "Audience", "Awareness Stage", "Core Message", "Pain/Desire", "Offer Connection"],
    systemInstructionExtra: "Every angle must connect to the Campaign's actual audience and offer as given — never a generic viral angle disconnected from this specific business (spec section 16).",
  },
  {
    toolKey: "hook-lab",
    name: "M.A.I.A. Hook Lab",
    description: "Generates multiple hook variations across categories, grounded in the Campaign's real audience and offer.",
    category: "Creative",
    displayOrder: 22,
    modelConfigKey: "structured-analytical",
    inputFields: [{ key: "hookCount", label: "Number of Hooks", type: "number", required: false, placeholder: "10" }],
    outputFields: ["Category", "Hook Text"],
    systemInstructionExtra: "Categories: PAIN, QUESTION, CURIOSITY, PROBLEM, DESIRE, CONTRARIAN, STORY, DEMONSTRATION, OBJECTION, PATTERN_INTERRUPT. Do not produce a hook disconnected from the actual business/offer.",
  },
  {
    toolKey: "script-studio",
    name: "M.A.I.A. Script Studio",
    description: "Generates a structured script (hook through CTA) from a Campaign, Angle, and Hook.",
    category: "Video",
    displayOrder: 23,
    modelConfigKey: "structured-analytical",
    inputFields: [
      { key: "scriptType", label: "Script Type", type: "text", required: false },
      { key: "durationSeconds", label: "Target Duration (seconds)", type: "number", required: false },
    ],
    outputFields: ["Section Type", "Section Content"],
    systemInstructionExtra:
      "Adapt the section structure to the objective — do not force every section onto every script (spec section 25). Never invent a testimonial, award, certification, guarantee, or result not present in the BRAND CONTEXT (spec section 26).",
  },
  {
    toolKey: "storyboard-studio",
    name: "M.A.I.A. Storyboard Studio",
    description: "Breaks an approved Script into a scene-by-scene storyboard.",
    category: "Video",
    displayOrder: 24,
    modelConfigKey: "structured-analytical",
    inputFields: [{ key: "visualStyle", label: "Visual Style", type: "text", required: false }],
    outputFields: ["Scene Number", "Duration", "Dialogue", "Camera Shot", "Location", "On-Screen Text", "Transition"],
  },
  {
    toolKey: "scene-prompt-studio",
    name: "M.A.I.A. Scene Prompt Studio",
    description: "Generates a production-ready image prompt and video prompt for one storyboard scene, with character continuity.",
    category: "Video",
    displayOrder: 25,
    modelConfigKey: "structured-analytical",
    inputFields: [],
    outputFields: ["Image Prompt", "Video Prompt"],
    systemInstructionExtra:
      "No real image/video generation provider is connected — this produces a PRODUCTION PROMPT only, never a claim that an image or video was generated. If a character reference is supplied, every prompt must explicitly instruct: use the provided character reference as the same main character, and maintain consistent face, facial features, skin tone, hair, body proportions, age appearance, and identity.",
  },
];

export function buildSystemInstruction(def: AiToolSeedDef): string {
  const parts = [
    SHARED_GUARDRAILS,
    `TOOL: ${def.name}. ${def.description}`,
    `Structure your response around these elements where relevant to the request: ${def.outputFields.join(", ")}.`,
  ];
  if (def.systemInstructionExtra) parts.push(def.systemInstructionExtra);
  return parts.join(" ");
}

export function fieldsToJsonSchema(fields: SeedInputField[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const field of fields) {
    properties[field.key] = { type: field.type === "number" ? "number" : "string", description: field.label };
    if (field.required) required.push(field.key);
  }
  return { type: "object", properties, required };
}

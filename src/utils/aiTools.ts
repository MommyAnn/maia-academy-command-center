// M.A.I.A. AI Business Tools Hub calculation/generation helpers — Step 12.
//
// generateToolOutput() is a deterministic, template-based transform over
// real Master Brain data + the student's task-specific input — the same
// "not a real AI call" honesty rule Step 8's document generator follows.
// No network call, no external model, nothing invented that the student
// didn't provide or that isn't already in their own Master Brain.

import type { MasterBrainDocument, MasterBrainSubmission } from "@/types/masterBrain";
import type { StudentRecord } from "@/types/student";
import type {
  AiBusinessContext,
  AiGeneration,
  AiOutputItem,
  AiOutputSection,
  AiProject,
  AiToolId,
  AiToolOutput,
} from "@/types/aiTools";
import { FLAGGED_CLAIM_PATTERNS } from "@/types/aiTools";

function currentYear(): string {
  return String(new Date().getFullYear());
}

export function generateProjectId(existing: AiProject[]): string {
  const year = currentYear();
  const prefix = `PROJ-${year}-`;
  const count = existing.filter((p) => p.projectId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

export function generateGenerationId(existing: AiGeneration[]): string {
  const year = currentYear();
  const prefix = `GEN-${year}-`;
  const count = existing.filter((g) => g.generationId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Context extraction (spec sections 3-5) — reads live from the student's own
// Master Brain submission/document, never a stored duplicate.
// ---------------------------------------------------------------------------

export function extractBusinessContext(
  student: StudentRecord,
  submission: MasterBrainSubmission | undefined,
  document: MasterBrainDocument | undefined,
): AiBusinessContext {
  const businessId = document?.businessId ?? submission?.businessId ?? student.id;
  return {
    studentId: student.id,
    businessId,
    businessName: submission?.businessFoundation.businessName || submission?.businessFoundation.brandName || "Your Business",
    masterBrainDocumentId: document?.id ?? null,
    masterBrainVersion: document?.documentVersion ?? null,
    masterBrainPublished: Boolean(document?.isCurrentPublished),
    masterBrainLastUpdated: document?.publishedAt ?? null,
    batch: student.batch,
    package: student.package,
    targetMarketSummary: submission?.avatars[0]?.description || submission?.businessFoundation.description || "",
    avatarNames: (submission?.avatars ?? []).map((a) => a.name).filter(Boolean),
    painPoints: (submission?.painPoints ?? []).map((p) => p.painPoint).filter(Boolean),
    desires: submission?.desires.ultimateWant || submission?.desires.transformation || "",
    positioning: submission?.positioning.uniqueValueProposition || submission?.positioning.whatMakesDifferent || "",
    brandVoiceTraits: submission?.personalityVoice.traits ?? [],
    offers: (submission?.offers ?? []).filter((o) => o.isCurrent).map((o) => ({ name: o.name, price: o.price })),
    goals: {
      threeMonths: submission?.goals.threeMonths ?? "",
      sixMonths: submission?.goals.sixMonths ?? "",
      twelveMonths: submission?.goals.twelveMonths ?? "",
    },
  };
}

// ---------------------------------------------------------------------------
// Marketing claim safety (spec sections 43-44)
// ---------------------------------------------------------------------------

export function flagUnsupportedClaims(text: string): string[] {
  const lower = text.toLowerCase();
  return FLAGGED_CLAIM_PATTERNS.filter((pattern) => lower.includes(pattern));
}

function scanSectionsForClaims(sections: AiOutputSection[]): string[] {
  const found = new Set<string>();
  for (const s of sections) {
    for (const claim of flagUnsupportedClaims(s.content)) found.add(claim);
    for (const item of s.items) {
      for (const value of Object.values(item)) {
        for (const claim of flagUnsupportedClaims(value)) found.add(claim);
      }
    }
  }
  return Array.from(found);
}

// ---------------------------------------------------------------------------
// The generation "engine" (spec sections 9-29) — one section builder + a
// per-tool switch. Every tool reads ctx (Master Brain) + input (task-
// specific, never re-asking what Master Brain already answered).
// ---------------------------------------------------------------------------

function section(key: string, title: string, content: string, items: AiOutputItem[] = [], provenance?: AiOutputSection["provenance"]): AiOutputSection {
  return { key, title, content, items, provenance };
}

function readyOrFallback(value: string, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

function firstN(list: string[], n: number): string {
  return list.slice(0, n).join("; ") || "Not yet captured in your Master Brain — consider adding this in your Business Assessment.";
}

/** Rotates through a fixed set of framings so "Regenerate" / "Create Variation" (spec sections 12, 35) visibly differ instead of repeating the same deterministic text every time. */
const VARIATION_FRAMES = ["outcome-focused", "pain-point-focused", "curiosity-driven"] as const;

function pick<T>(list: T[], seed: number, fallback: T): T {
  if (!list.length) return fallback;
  return list[((seed % list.length) + list.length) % list.length];
}

export function generateToolOutput(toolId: AiToolId, ctx: AiBusinessContext, input: Record<string, string>, variationSeed = 0): AiToolOutput {
  const businessName = ctx.businessName;
  const avatars = firstN(ctx.avatarNames, 3);
  const painPoints = firstN(ctx.painPoints, 3);
  const leadPainPoint = pick(ctx.painPoints, variationSeed, "a common customer pain point (add pain points to your Master Brain)");
  const frame = pick([...VARIATION_FRAMES], variationSeed, "outcome-focused");
  const positioning = readyOrFallback(ctx.positioning, "a clear point of difference has not yet been captured in your Master Brain");
  const desires = readyOrFallback(ctx.desires, "the transformation your customers want has not yet been captured");
  const voice = ctx.brandVoiceTraits.length ? ctx.brandVoiceTraits.join(", ") : "not yet defined";
  const offerNames = ctx.offers.length ? ctx.offers.map((o) => o.name).join(", ") : "no current offers found in your Master Brain";
  const product = readyOrFallback(input.product, ctx.offers[0]?.name ?? "your product/service");

  let sections: AiOutputSection[] = [];

  switch (toolId) {
    case "business-strategist": {
      const focus = input.focusArea || "Business Direction";
      sections = [
        section("currentSituation", "Current Situation", `${businessName} is currently focused on ${focus.toLowerCase()}. Target customers: ${avatars}.`, [], "Master Brain Data"),
        section("strategicOpportunity", "Strategic Opportunity", `Given ${positioning}, the clearest opportunity (${frame} angle) is to double down on ${focus.toLowerCase()} while addressing: ${painPoints}.`, [], "AI Hypothesis"),
        section("priorities", "Priorities", input.specificQuestion ? `Regarding "${input.specificQuestion}": prioritize the actions below.` : "Prioritize the actions below.", [], "AI Recommendation"),
        section("recommendedActions", "Recommended Actions", "", [
          { action: `Clarify messaging around ${focus.toLowerCase()}`, why: "Aligns communication with current strategic focus" },
          { action: `Address top pain point: ${ctx.painPoints[0] ?? "(add pain points to your Master Brain)"}`, why: "Removes the biggest objection to buying" },
          { action: `Reinforce positioning: ${positioning}`, why: "Strengthens differentiation" },
        ]),
        section("thirtyDayPlan", "30-Day Action Plan", "Week 1-2: Implement top recommended action. Week 3: Measure early response. Week 4: Adjust messaging based on results.", [], "AI Recommendation"),
        section("ninetyDayDirection", "90-Day Direction", readyOrFallback(ctx.goals.threeMonths, "No 3-month goal captured yet — add one in your Master Brain for a sharper 90-day direction."), [], "Student-Provided Data"),
      ];
      break;
    }
    case "market-intelligence": {
      sections = [
        section("customerInsights", "Customer Insights", `Known avatars: ${avatars}. Top pain points: ${painPoints}.`, [], "Master Brain Data"),
        section("marketOpportunities", "Market Opportunities", `Since customers want "${desires}", there is an opportunity to lead with ${frame} messaging rather than feature lists.`, [], "AI Hypothesis"),
        section("messagingAngles", "Messaging Angles", "", [
          { angle: "Outcome-first", example: `"${desires}" — lead with the transformation, not the process.` },
          { angle: "Pain-first", example: `"${ctx.painPoints[0] ?? "Struggling with this?"}" — open with the problem.` },
        ]),
        section("objectionInsights", "Objection Insights", input.additionalContext ? `Considering: ${input.additionalContext}` : "No additional objection context provided this session.", [], "Student-Provided Data"),
        section("positioningOpportunities", "Positioning Opportunities", positioning, [], "Master Brain Data"),
      ];
      break;
    }
    case "content-strategist": {
      const goal = input.primaryGoal || "Build Authority";
      sections = [
        section("contentObjectives", "Content Objectives", `Primary goal: ${goal}. Audience: ${avatars}.`),
        section("contentPillars", "Content Pillars", "", [
          { pillar: "Educational", focus: `Teach around: ${ctx.painPoints[0] ?? "a common customer question"}` },
          { pillar: "Authority", focus: `Showcase: ${positioning}` },
          { pillar: "Trust", focus: "Behind-the-scenes / founder story" },
          { pillar: "Conversion", focus: `Feature: ${offerNames}` },
        ]),
        section("platformStrategy", "Platform Strategy", input.platforms ? `Focus platforms: ${input.platforms}` : "No platforms specified — defaulting to Facebook + TikTok based on common Academy student channels."),
        section("brandVoiceReminder", "Brand Voice", `Write in a ${voice} tone.`, [], "Master Brain Data"),
      ];
      break;
    }
    case "content-planner": {
      const days = Number(input.duration) || 7;
      const platform = input.platforms || "Facebook";
      const items: AiOutputItem[] = Array.from({ length: Math.min(days, 30) }).map((_, i) => ({
        day: String(i + 1),
        platform,
        pillar: ["Educational", "Authority", "Trust", "Conversion"][i % 4],
        format: ["Post", "Reel", "Carousel", "Story"][i % 4],
        topic: `${["Tip", "Myth vs Fact", "Behind the scenes", "Customer win"][i % 4]} about ${product}`,
        hook: `Did you know...`,
        cta: "Message us to learn more",
        status: "Draft",
      }));
      sections = [section("calendar", `${days}-Day Content Calendar`, `Generated for ${product}.`, items)];
      break;
    }
    case "creative-strategist": {
      const campaignType = input.campaignType || "Facebook Ads";
      sections = [
        section("concept", "Creative Concept", `A ${campaignType} concept for ${product}, speaking to ${avatars}.`),
        section("details", "Concept Details", "", [
          { field: "Objective", value: readyOrFallback(input.objective, "Drive inquiries") },
          { field: "Target Audience", value: avatars },
          { field: "Hook", value: `"${ctx.painPoints[0] ?? "Tired of the same problem?"}"` },
          { field: "Visual Direction", value: `Show ${product} in real use, ${voice} tone` },
          { field: "Headline", value: `${product} — ${positioning}` },
          { field: "CTA", value: "Message us now" },
          { field: "Why This Fits", value: `Aligned with your positioning: ${positioning}` },
        ]),
        section("assetNote", "Reference vs Asset", input.assetType === "Use as Asset" ? "Marked as an ASSET — intended for use in future generation." : "Marked as REFERENCE ONLY — used to understand style/direction, not copied directly."),
      ];
      break;
    }
    case "video-director": {
      const videoType = input.videoType || "UGC";
      const scenes: AiOutputItem[] = [
        { scene: "1", duration: "0-3s", visual: "Hook shot of the problem", dialogue: `"${ctx.painPoints[0] ?? "Struggling with this?"}"`, onScreenText: "STOP SCROLLING", direction: "Close-up, high energy" },
        { scene: "2", duration: "3-10s", visual: `Introduce ${product}`, dialogue: `"Here's ${product}..."`, onScreenText: product, direction: "Product in hand / in use" },
        { scene: "3", duration: "10-20s", visual: "Show transformation", dialogue: `"${desires}"`, onScreenText: "RESULTS", direction: "Before/after or benefit visual" },
        { scene: "4", duration: "20-30s", visual: "Call to action", dialogue: readyOrFallback(input.cta, "Message us to order"), onScreenText: "MESSAGE US NOW", direction: "Text overlay + logo" },
      ];
      sections = [
        section("strategy", "Video Strategy", `${videoType} video for ${input.platform || "Facebook/TikTok"}, goal: ${readyOrFallback(input.goal, "drive inquiries")}.`),
        section("hook", "Hook", `"${ctx.painPoints[0] ?? "Struggling with this?"}"`),
        section("scenePlan", "Scene-by-Scene Plan", "", scenes),
        section("wrapUp", "Wrap-Up", `CTA: ${readyOrFallback(input.cta, "Message us to order")} · Caption idea: "${positioning}" · Thumbnail idea: close-up of ${product} with bold text.`),
      ];
      break;
    }
    case "copywriter": {
      const copyType = input.copyType || "Facebook Caption";
      sections = [
        section("copy", copyType, `${product} — ${positioning}. ${desires !== "" ? `Because you deserve: ${desires}.` : ""} (${frame} angle) Message us now!`),
        section("altVersions", "Alternate Angles", "", [
          { angle: "Pain-led", copy: `${leadPainPoint}. ${product} can help.` },
          { angle: "Benefit-led", copy: `${desires || "Get real results"} with ${product}.` },
        ]),
        section("voiceNote", "Brand Voice Used", `Tone: ${voice}.`, [], "Master Brain Data"),
      ];
      break;
    }
    case "facebook-ads-strategist": {
      sections = [
        section("objective", "Campaign Objective Recommendation", `Based on goal "${readyOrFallback(input.campaignGoal, "Leads")}", recommend Messages or Leads objective.`),
        section("structure", "Campaign Structure", "1 Campaign → 2-3 Ad Sets (audience variations) → 3+ Ad creatives per set for testing."),
        section("audienceStrategy", "Audience Strategy", `Primary: ${avatars}. Location: ${readyOrFallback(input.audienceNotes, "not specified")}.`),
        section("creativeStrategy", "Creative Strategy", `Lead with pain point: ${ctx.painPoints[0] ?? "(add pain points to Master Brain)"}; highlight offer: ${offerNames}.`),
        section("testingPlan", "Testing Plan", "Test 2-3 hooks and 2 audiences in week 1; scale the winning combination in week 2."),
        section("budget", "Budget Allocation Concept", `Suggested starting budget: ${readyOrFallback(input.budget, "₱500/day")}, split evenly across ad sets during testing.`),
        section("optimizationChecklist", "Optimization Checklist", "", [
          { item: "Check CTR after 3 days", action: "Pause ads below 1% CTR" },
          { item: "Check cost per message", action: "Reallocate budget to best performer" },
        ]),
      ];
      break;
    }
    case "ads-analyzer": {
      const metrics = ["spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm", "messages", "leads", "purchases", "revenue", "roas"];
      const provided = metrics.filter((m) => input[m] && input[m].trim());
      const summaryItems: AiOutputItem[] = provided.map((m) => ({ metric: m.toUpperCase(), value: input[m] }));
      sections = [
        section("performanceSummary", "Performance Summary", provided.length ? `Metrics analyzed: ${provided.join(", ").toUpperCase()}.` : "No metrics were entered — enter at least spend and one outcome metric for analysis.", summaryItems),
        section("workingWell", "What Appears to Be Working", provided.includes("ctr") ? `CTR of ${input.ctr} — ${Number(input.ctr) > 1 ? "above 1%, generally a healthy signal" : "consider testing new hooks"}.` : "Not enough data to assess — CTR not provided."),
        section("possibleIssues", "Possible Issues", provided.includes("cpc") ? `CPC of ${input.cpc} — compare against your typical customer value.` : "Not enough data to assess — CPC not provided."),
        section("nextActions", "Recommended Next Actions", "Only metrics you entered were used — nothing was invented for missing fields.", [
          { action: "Review creative performance", note: "Rotate underperforming ads" },
          { action: "Confirm offer clarity", note: `Ensure ad matches offer: ${offerNames}` },
        ]),
      ];
      break;
    }
    case "offer-builder": {
      sections = [
        section("coreOffer", "Core Offer", `${product} at ${readyOrFallback(input.price, ctx.offers[0]?.price ?? "TBD")}.`),
        section("valueProposition", "Value Proposition", `${desires || "Achieve your desired outcome"} through ${product}.`),
        section("offerStack", "Offer Stack", "", [
          { component: "Core Product", detail: product },
          { component: "Bonus Idea", detail: "Add a quick-start guide or free consultation" },
        ]),
        section("riskReversal", "Risk-Reversal Ideas", "Consider a satisfaction guarantee if your fulfillment process supports it — never promise something you can't honor."),
        section("urgencyScarcity", "Urgency / Scarcity Options", "Use only REAL constraints (limited batch, limited slots) — never fabricate fake scarcity."),
        section("cta", "Call To Action", "Message us now to claim this offer."),
      ];
      break;
    }
    case "sales-script-builder": {
      const scriptType = input.scriptType || "Messenger Sales Script";
      sections = [
        section("script", scriptType, `Hi! Thanks for your interest in ${product}. ${positioning ? `We're known for ${positioning}.` : ""} How can I help you today?`),
        section("objectionHandling", "Objection Handling", "", [
          { objection: "It's too expensive", response: `Here's the value you get: ${desires || "the outcome you're looking for"}.` },
          { objection: "I need to think about it", response: "Totally understand — what specific concern can I address right now?" },
        ]),
        section("closing", "Closing Script", `Ready to move forward with ${product}? I can process that for you now.`),
      ];
      break;
    }
    case "chatbot-flow-builder": {
      sections = [
        section("trigger", "Trigger", `Any message containing "${product}" or a comment on a ${product} post.`),
        section("welcome", "Welcome Message", `Hi! 👋 Thanks for reaching out about ${product}. Let me help you.`),
        section("flow", "Flow", "", [
          { step: "1. Welcome", content: "Greet + acknowledge interest" },
          { step: "2. Qualification", content: `Ask: "What are you looking for — ${offerNames}?"` },
          { step: "3. Product Info", content: `Share ${product} details + price` },
          { step: "4. FAQ / Objection", content: "Answer common questions" },
          { step: "5. CTA", content: "Invite to order/book" },
          { step: "6. Human Handoff", content: "If unresolved after 2 exchanges, route to a staff member" },
        ]),
        section("platformNote", "Platform", `Designed for: ${readyOrFallback(input.platform, "Messenger")}.`),
      ];
      break;
    }
    case "automation-architect": {
      sections = [
        section("automationMap", "Automation Map", `Goal: ${readyOrFallback(input.goal, "convert new inquiries")}.`, [
          { step: "New Inquiry", action: "Auto-reply welcome message", channel: readyOrFallback(input.channels, "Messenger") },
          { step: "Qualification", action: "Ask what they're interested in", channel: "Chatbot" },
          { step: "Product Info", action: `Send ${product} details`, channel: "Chatbot" },
          { step: "Follow-Up", action: "Send reminder after 24h if no response", channel: "SMS/Email" },
          { step: "Purchase", action: "Send order confirmation", channel: "Email" },
          { step: "Post-Purchase", action: "Request feedback after 7 days", channel: "Email" },
        ]),
        section("implementationNote", "Implementation Note", "This is a DRAFT blueprint only — it is never automatically activated in GHL or any live system. An authorized staff member must implement it manually (see Step 11's Communications module)."),
      ];
      break;
    }
    case "customer-journey-builder": {
      const stages = ["Awareness", "Interest", "Consideration", "Purchase", "Onboarding", "Retention", "Repeat Purchase", "Advocacy"];
      const items: AiOutputItem[] = stages.map((stage) => ({
        stage,
        customerGoal: stage === "Awareness" ? "Discover a solution exists" : stage === "Purchase" ? "Feel confident buying" : "Progress toward their desired outcome",
        painPoint: ctx.painPoints[0] ?? "Uncertainty about the right solution",
        brandMessage: positioning,
        cta: stage === "Purchase" ? "Order now" : "Learn more",
      }));
      sections = [section("journey", "Customer Journey", `Mapped for ${product}.`, items)];
      break;
    }
    case "funnel-builder": {
      const funnelType = input.funnelType || "Lead Generation Funnel";
      sections = [
        section("funnelOverview", `${funnelType}`, `For ${product}.`, [
          { stage: "Traffic Source", detail: "Facebook/TikTok Ads or Organic" },
          { stage: "Landing Page", detail: `Highlight: ${positioning}` },
          { stage: "Lead Capture", detail: "Name + contact number" },
          { stage: "Offer", detail: offerNames },
          { stage: "Follow-Up", detail: "Messenger/SMS sequence" },
          { stage: "Checkout", detail: "Manual order confirmation (no live checkout integration in this build)" },
        ]),
        section("note", "Note", "No page builder or checkout is connected in this build — this is a strategic blueprint only, not a live/deployed funnel."),
      ];
      break;
    }
    case "website-copy-builder": {
      const pageType = input.pageType || "Homepage";
      sections = [
        section(pageType.toLowerCase().replace(/\s+/g, "-"), pageType, `${businessName}: ${positioning}. ${product} — ${desires || "built for you"}.`),
        section("cta", "Call To Action", "Get Started Today"),
        section("voiceNote", "Brand Voice Used", `Tone: ${voice}.`, [], "Master Brain Data"),
      ];
      break;
    }
    case "email-marketing-builder": {
      const sequenceType = input.sequenceType || "Welcome Series";
      const count = Math.max(1, Math.min(Number(input.numberOfEmails) || 3, 7));
      const items: AiOutputItem[] = Array.from({ length: count }).map((_, i) => ({
        emailNumber: String(i + 1),
        timing: i === 0 ? "Immediately" : `Day ${i + 2}`,
        subject: i === 0 ? `Welcome to ${businessName}!` : `${product} — ${["More about us", "Customer favorite", "Special offer"][i % 3]}`,
        purpose: i === 0 ? "Introduce the brand" : "Nurture toward purchase",
        cta: "Message us / Shop now",
      }));
      sections = [section("sequence", sequenceType, `${count}-email sequence for ${product}.`, items)];
      break;
    }
    case "business-systems-advisor": {
      sections = [
        section("currentProcess", "Current Process", readyOrFallback(input.currentProcessDescription, "No process description provided this session.")),
        section("problem", "Problem", "Manual, ad-hoc handling likely causes delays and inconsistent customer experience."),
        section("recommendedSystem", "Recommended System", `A simple ${readyOrFallback(input.processArea, "lead management")} checklist or chatbot flow (see Chatbot Flow Builder / Automation Architect).`),
        section("priority", "Priority", "Medium — implement once current campaigns are stable."),
        section("implementationPlan", "Implementation Plan", "1) Document the current steps. 2) Identify the repetitive part. 3) Build a simple automation or template. 4) Test with a small batch before full rollout."),
      ];
      break;
    }
    default:
      sections = [section("output", "Output", "No template defined for this tool yet.")];
  }

  return {
    toolId,
    sections,
    flaggedClaims: scanSectionsForClaims(sections),
    simulated: true,
  };
}

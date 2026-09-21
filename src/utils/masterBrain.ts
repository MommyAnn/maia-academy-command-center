// Brand Master Brain calculation + generation helpers — Step 8.
//
// generateMasterBrainDraft() below is a DETERMINISTIC TEMPLATE TRANSFORM, not
// an AI call. It rearranges what the student already typed into the 19-
// section document shape so an admin has a real starting point to edit —
// see spec section 32/52: "If no AI API/backend is connected, DO NOT pretend
// AI generation is actually occurring." Nothing here invents facts about the
// student's business; sections built from empty answers say so plainly
// instead of fabricating content.

import { QUESTIONNAIRE_STEP_LABELS, MASTER_BRAIN_SECTION_DEFS } from "@/types/masterBrain";
import type { MasterBrainDocumentSection, MasterBrainSubmission } from "@/types/masterBrain";

export const CURRENT_DEMO_USER = "Mommy Ann";

const NEEDS_INFO = "Needs clarification from the student — not enough information was provided yet.";

function joinNonEmpty(parts: (string | null | undefined)[], sep = " "): string {
  return parts.filter((p) => p && p.trim().length > 0).join(sep);
}

function bulletOrEmpty(label: string, value: string): string | null {
  return value.trim() ? `${label}: ${value.trim()}` : null;
}

/** Required fields the Final Review step checks before allowing submission (spec section 24). */
export function getMissingRequiredFields(submission: MasterBrainSubmission): string[] {
  const missing: string[] = [];
  const bf = submission.businessFoundation;
  if (!bf.businessName.trim()) missing.push("Business Name (Step 1)");
  if (!bf.description.trim()) missing.push("Describe your business (Step 1)");
  if (!submission.founder.founderName.trim()) missing.push("Founder / Owner Name (Step 2)");
  if (submission.offers.length === 0) missing.push("At least one Product/Service (Step 3)");
  if (submission.avatars.length === 0) missing.push("At least one Customer Avatar (Step 4)");
  if (!submission.problemsNarrative.biggestProblems.trim()) missing.push("Customer's biggest problems (Step 5)");
  if (!submission.desires.ultimateWant.trim()) missing.push("What your customer ultimately wants (Step 6)");
  if (!submission.positioning.uniqueValueProposition.trim()) missing.push("Unique Value Proposition (Step 7)");
  if (submission.personalityVoice.traits.length === 0) missing.push("At least one Brand Personality trait (Step 8)");
  if (submission.priorities.length === 0) missing.push("At least one Strategic Priority (Step 11)");
  return missing;
}

/** Live completion % for the Final Review step — independent of the coarser per-step progressPercent saved while moving through the wizard. */
export function computeCompletionPercent(submission: MasterBrainSubmission): number {
  const totalChecks = 10;
  const missing = getMissingRequiredFields(submission);
  const completed = totalChecks - missing.length;
  return Math.max(0, Math.min(100, Math.round((completed / totalChecks) * 100)));
}

export function stepPath(step: number): string {
  return `/portal/master-brain/questionnaire?step=${step}`;
}

export function stepLabel(step: number): string {
  return QUESTIONNAIRE_STEP_LABELS[step - 1] ?? `Step ${step}`;
}

function makeSection(key: string, title: string, content: string, bullets: string[] = []): MasterBrainDocumentSection {
  return {
    key,
    title,
    content: content.trim() ? content.trim() : NEEDS_INFO,
    bullets: bullets.filter((b) => b.trim().length > 0),
    approved: false,
    lastEditedBy: null,
    lastEditedAt: null,
  };
}

/**
 * Transforms a questionnaire submission into a first-draft MasterBrainDocument
 * section list. Called from masterBrainStore's generateDraft() action after
 * an admin clicks "Approve for Generation" — see spec sections 32-33.
 */
export function generateMasterBrainDraft(submission: MasterBrainSubmission): MasterBrainDocumentSection[] {
  const bf = submission.businessFoundation;
  const founder = submission.founder;
  const primary = submission.offers.find((o) => o.id === submission.primaryOffer.primaryOfferId) ?? submission.offers[0];
  const positioning = submission.positioning;
  const voice = submission.personalityVoice;

  const sections: MasterBrainDocumentSection[] = [];

  sections.push(
    makeSection(
      "brandOverview",
      "brandOverview",
      joinNonEmpty([
        bf.businessName && `${bf.businessName}${bf.brandName && bf.brandName !== bf.businessName ? ` (brand name: ${bf.brandName})` : ""} is a ${bf.category || "business"} based in ${bf.location || "the Philippines"}.`,
        bf.description,
      ]),
      [bulletOrEmpty("Business Model", bf.businessType), bulletOrEmpty("Areas Served", bf.areasServed), bulletOrEmpty("Stage", bf.stage)].filter(
        (x): x is string => Boolean(x),
      ),
    ),
  );

  sections.push(
    makeSection(
      "brandFoundation",
      "brandFoundation",
      joinNonEmpty([bf.whyStarted, bf.problemSolved]),
      [bulletOrEmpty("Why It Matters To The Founder", bf.whyItMatters)].filter((x): x is string => Boolean(x)),
    ),
  );

  sections.push(
    makeSection(
      "founderStory",
      "founderStory",
      joinNonEmpty([founder.founderName && `Founded by ${founder.founderName}${founder.role ? ` (${founder.role})` : ""}.`, founder.founderStory]),
      [bulletOrEmpty("Experience", founder.experience), bulletOrEmpty("Why Customers Should Trust Them", founder.whyTrustYou)].filter(
        (x): x is string => Boolean(x),
      ),
    ),
  );

  sections.push(
    makeSection(
      "productsServices",
      "productsServices",
      primary
        ? `Primary Offer: ${primary.name} — ${primary.description || "no description provided."}`
        : "",
      [
        primary && bulletOrEmpty("Transformation", submission.primaryOffer.transformation),
        primary && bulletOrEmpty("Price", primary.price ? `₱${primary.price}` : ""),
        ...submission.offers.filter((o) => o.id !== primary?.id).map((o) => `Supporting Offer: ${o.name} — ${o.mainBenefit || o.description}`),
      ].filter((x): x is string => Boolean(x)),
    ),
  );

  sections.push(
    makeSection(
      "targetMarket",
      "targetMarket",
      submission.avatars.length > 0
        ? `Primary market: ${submission.avatars[0].name || "an unnamed customer segment"} — ${submission.avatars[0].description || ""}`
        : "",
      submission.avatars.slice(1).map((a) => `Secondary segment: ${a.name}`),
    ),
  );

  sections.push(
    makeSection(
      "customerAvatars",
      "customerAvatars",
      "",
      submission.avatars.map((a) =>
        joinNonEmpty([a.name, "—", a.description || a.problems, a.ageRange && `(${a.ageRange})`]),
      ),
    ),
  );

  sections.push(
    makeSection(
      "painPoints",
      "painPoints",
      joinNonEmpty([submission.problemsNarrative.biggestProblems, submission.problemsNarrative.frustrations]),
      submission.painPoints.map((p) => `${p.painPoint}${p.severity ? ` (${p.severity} severity)` : ""}`),
    ),
  );

  sections.push(
    makeSection(
      "customerDesires",
      "customerDesires",
      joinNonEmpty([submission.desires.ultimateWant, submission.desires.transformation]),
      [
        bulletOrEmpty("Dream Outcome", submission.desires.dreamOutcomes),
        bulletOrEmpty("Emotional Desire", submission.desires.emotionalDesires),
        bulletOrEmpty("Functional Desire", submission.desires.functionalDesires),
      ].filter((x): x is string => Boolean(x)),
    ),
  );

  sections.push(
    makeSection(
      "brandPositioning",
      "brandPositioning",
      joinNonEmpty([positioning.knownFor, positioning.whyChooseUs]),
      [
        bulletOrEmpty("Unique Value Proposition", positioning.uniqueValueProposition),
        bulletOrEmpty("Primary Differentiator", positioning.primaryDifferentiator),
        bulletOrEmpty("Competitive Advantage", positioning.competitiveAdvantage),
      ].filter((x): x is string => Boolean(x)),
    ),
  );

  sections.push(makeSection("brandPersonality", "brandPersonality", voice.traits.join(", "), voice.customTraits ? [voice.customTraits] : []));

  sections.push(
    makeSection(
      "brandVoice",
      "brandVoice",
      joinNonEmpty([voice.voiceStyles.join(", "), voice.preferredLanguage && `Preferred language: ${voice.preferredLanguage}.`]),
      [bulletOrEmpty("Words We Like", voice.wordsWeLike), bulletOrEmpty("Words We Avoid", voice.wordsWeAvoid)].filter(
        (x): x is string => Boolean(x),
      ),
    ),
  );

  sections.push(
    makeSection(
      "coreMessaging",
      "coreMessaging",
      positioning.brandPromise || positioning.uniqueValueProposition,
      [bulletOrEmpty("Immediate Understanding", positioning.immediateUnderstanding)].filter((x): x is string => Boolean(x)),
    ),
  );

  sections.push(
    makeSection(
      "contentPillars",
      "contentPillars",
      submission.marketingSales.topicsCanTeach
        ? `Topics this brand can confidently teach: ${submission.marketingSales.topicsCanTeach}`
        : "",
      [bulletOrEmpty("Best Performing Content So Far", submission.marketingSales.bestPerformingContent)].filter(
        (x): x is string => Boolean(x),
      ),
    ),
  );

  sections.push(
    makeSection(
      "marketingStrategy",
      "marketingStrategy",
      submission.marketingSales.currentChannels.length > 0
        ? `Primary channels: ${submission.marketingSales.currentChannels.join(", ")}.`
        : "",
      [bulletOrEmpty("Customer Journey", submission.marketingSales.customerJourney)].filter((x): x is string => Boolean(x)),
    ),
  );

  sections.push(
    makeSection(
      "salesFoundation",
      "salesFoundation",
      submission.marketingSales.customerJourney,
      [
        bulletOrEmpty("Common Objections", submission.primaryOffer.commonObjections),
        bulletOrEmpty("Buying Triggers", submission.avatars[0]?.buyingTriggers ?? ""),
      ].filter((x): x is string => Boolean(x)),
    ),
  );

  sections.push(
    makeSection(
      "competitiveDifferentiation",
      "competitiveDifferentiation",
      positioning.whatMakesDifferent,
      submission.competitors.map((c) => `${c.name}: ${joinNonEmpty([bulletOrEmpty("customers like", c.whatCustomersLike)])}`),
    ),
  );

  sections.push(
    makeSection(
      "businessGoals",
      "businessGoals",
      "",
      [
        bulletOrEmpty("3 Months", submission.goals.threeMonths),
        bulletOrEmpty("6 Months", submission.goals.sixMonths),
        bulletOrEmpty("12 Months", submission.goals.twelveMonths),
        bulletOrEmpty("3 Years", submission.goals.threeYears),
      ].filter((x): x is string => Boolean(x)),
    ),
  );

  sections.push(makeSection("strategicPriorities", "strategicPriorities", submission.priorities.join(", ")));

  sections.push(
    makeSection(
      "aiBrandInstructions",
      "aiBrandInstructions",
      joinNonEmpty([
        bf.businessName ? `Use this Brand Master Brain as the source of truth for ${bf.businessName}.` : null,
        voice.voiceStyles.length > 0
          ? `Speak in a ${voice.voiceStyles.join(", ").toLowerCase()} tone${voice.preferredLanguage ? ` in ${voice.preferredLanguage}` : ""}.`
          : null,
      ]),
      [
        bulletOrEmpty("Audience", submission.avatars[0]?.name ?? ""),
        bulletOrEmpty("Emphasize", positioning.uniqueValueProposition),
        bulletOrEmpty("Avoid", voice.wordsWeAvoid),
      ].filter((x): x is string => Boolean(x)),
    ),
  );

  // Attach the real, spec-numbered titles from MASTER_BRAIN_SECTION_DEFS.
  return sections.map((s) => ({
    ...s,
    title: MASTER_BRAIN_SECTION_DEFS.find((d) => d.key === s.key)?.title ?? s.title,
  }));
}

/**
 * Builds the "Copy My AI Brand Context" clipboard text (spec section 39) —
 * a concise, structured summary meant to be pasted into an external AI tool.
 */
export function buildAiBrandContext(sections: MasterBrainDocumentSection[]): string {
  const lines: string[] = [
    "Use the following Brand Master Brain as the source of truth for my business:",
    "",
  ];
  for (const section of sections) {
    lines.push(`## ${section.title}`);
    if (section.content) lines.push(section.content);
    for (const bullet of section.bullets) lines.push(`- ${bullet}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

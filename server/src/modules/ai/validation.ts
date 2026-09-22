// Output quality / factual-claim guardrails (spec sections 16-17, 74-77).
// Nothing here calls an AI provider — these are pure, deterministic checks
// applied to whatever the provider returned, before it is ever saved or
// shown as a successful generation.

// The existing Step 8 frontend's own 19-section structure
// (src/types/masterBrain.ts MASTER_BRAIN_SECTION_DEFS) — reproduced here
// verbatim as the source of truth (spec section 15: "use the existing Step
// 8 structure"), since server/ is a separate package that never imports
// frontend source. A MasterBrainDocument.sectionsJson is an ARRAY of
// { key, title, content, bullets, approved, lastEditedBy, lastEditedAt }
// objects in this exact key order, matching what the frontend already
// renders — never a keyed dictionary.
export const MASTER_BRAIN_SECTION_DEFS = [
  { key: "brandOverview", title: "1. Brand Overview" },
  { key: "brandFoundation", title: "2. Brand Foundation" },
  { key: "founderStory", title: "3. Founder / Brand Story" },
  { key: "productsServices", title: "4. Products & Services" },
  { key: "targetMarket", title: "5. Target Market" },
  { key: "customerAvatars", title: "6. Customer Avatars" },
  { key: "painPoints", title: "7. Customer Pain Points" },
  { key: "customerDesires", title: "8. Customer Desires" },
  { key: "brandPositioning", title: "9. Brand Positioning" },
  { key: "brandPersonality", title: "10. Brand Personality" },
  { key: "brandVoice", title: "11. Brand Voice" },
  { key: "coreMessaging", title: "12. Core Messaging" },
  { key: "contentPillars", title: "13. Content Pillars" },
  { key: "marketingStrategy", title: "14. Marketing Strategy Foundation" },
  { key: "salesFoundation", title: "15. Sales Foundation" },
  { key: "competitiveDifferentiation", title: "16. Competitive Differentiation" },
  { key: "businessGoals", title: "17. Business Goals" },
  { key: "strategicPriorities", title: "18. Strategic Priorities" },
  { key: "aiBrandInstructions", title: "19. AI Brand Instructions" },
] as const;

export const REQUIRED_MASTER_BRAIN_SECTIONS = MASTER_BRAIN_SECTION_DEFS.map((s) => s.key);

export interface MasterBrainDocumentSection {
  key: string;
  title: string;
  content: string;
  bullets: string[];
  approved: boolean;
  lastEditedBy: string | null;
  lastEditedAt: string | null;
}

export function findMissingMasterBrainSections(sections: MasterBrainDocumentSection[] | null | undefined): string[] {
  const byKey = new Map((sections ?? []).map((s) => [s.key, s]));
  return REQUIRED_MASTER_BRAIN_SECTIONS.filter((key) => {
    const section = byKey.get(key);
    return !section || (!section.content?.trim() && (!section.bullets || section.bullets.length === 0));
  });
}

// Spec section 75's own example list — flagged whenever it appears in AI
// OUTPUT but was never present anywhere in the business's own verified
// source material (the Master Brain sections or the questionnaire answers
// that fed this generation). A claim the Student themselves typed in is
// their own factual assertion, not an AI invention, so it is never flagged.
const UNSUPPORTED_CLAIM_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "#1 claim", pattern: /#\s?1\b(?!\d)/i },
  { label: "Best in Philippines", pattern: /best in (the )?philippines/i },
  { label: "Guaranteed", pattern: /\bguarantee(d)?\b/i },
  { label: "FDA Approved", pattern: /fda[- ]approved/i },
  { label: "Clinically Proven", pattern: /clinically proven/i },
  { label: "Award-Winning", pattern: /award[- ]winning/i },
  { label: "Millions Sold", pattern: /millions? (of (units|customers))?\s*sold/i },
  { label: "100% Success", pattern: /100%\s*(success|guarantee|results?)/i },
];

export interface UnsupportedClaimFlag {
  label: string;
  matchedText: string;
}

export function flagUnsupportedClaims(outputText: string, verifiedSourceText: string): UnsupportedClaimFlag[] {
  const flags: UnsupportedClaimFlag[] = [];
  const sourceLower = verifiedSourceText.toLowerCase();
  for (const { label, pattern } of UNSUPPORTED_CLAIM_PATTERNS) {
    const match = outputText.match(pattern);
    if (match && !sourceLower.includes(match[0].toLowerCase())) {
      flags.push({ label, matchedText: match[0] });
    }
  }
  return flags;
}

export interface OutputValidationResult {
  missingSections: string[];
  unsupportedClaims: UnsupportedClaimFlag[];
  isClean: boolean;
}

/** Runs both checks together — the shape every AiGeneration.validationJson / MasterBrainDocument.validationJson stores (spec sections 74-75). */
export function validateGeneratedOutput(outputText: string, verifiedSourceText: string, sections?: MasterBrainDocumentSection[] | null): OutputValidationResult {
  const missingSections = sections !== undefined ? findMissingMasterBrainSections(sections) : [];
  const unsupportedClaims = flagUnsupportedClaims(outputText, verifiedSourceText);
  return { missingSections, unsupportedClaims, isClean: missingSections.length === 0 && unsupportedClaims.length === 0 };
}

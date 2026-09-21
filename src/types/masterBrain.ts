// M.A.I.A. Brand Master Brain Builder domain types — Step 8.
//
// TWO SEPARATE RECORDS, ON PURPOSE (spec section: "IMPORTANT" at the top of
// Step 8): a student's questionnaire ANSWERS (MasterBrainSubmission) and the
// FINAL generated/edited Brand Master Brain (MasterBrainDocument) are never
// the same object. Generating or editing the document never overwrites the
// submission, and requesting a revision never overwrites either — it just
// asks the student to update specific answers. See masterBrainStore.tsx for
// the actions that move data between them.
//
// Backed by demo/local state for now — see src/data/masterBrainStore.tsx.
// The same "future-ready, not built" rule applies here as everywhere else in
// this app: fields exist so the shape is right, but nothing here is a real
// AI call, a real file export, or a real backend.

import type { Batch, MasterBrainStatus, PackageType } from "@/types/student";

export type BusinessStage = "Idea Stage" | "Starting" | "Operating" | "Growing" | "Scaling" | "Rebranding";

export const BUSINESS_STAGES: BusinessStage[] = [
  "Idea Stage",
  "Starting",
  "Operating",
  "Growing",
  "Scaling",
  "Rebranding",
];

// ---------------------------------------------------------------------------
// Step 1 — Business Foundation
// ---------------------------------------------------------------------------
export interface BusinessFoundation {
  businessName: string;
  brandName: string;
  category: string;
  businessType: string;
  location: string;
  areasServed: string;
  website: string;
  facebookPage: string;
  instagram: string;
  tiktok: string;
  shopee: string;
  lazada: string;
  otherChannels: string;
  yearsInBusiness: string;
  stage: BusinessStage | "";
  description: string;
  whyStarted: string;
  problemSolved: string;
  whyItMatters: string;
}

// ---------------------------------------------------------------------------
// Step 2 — Founder / Business Owner
// ---------------------------------------------------------------------------
export interface FounderProfile {
  founderName: string;
  role: string;
  founderStory: string;
  experience: string;
  skills: string;
  expertise: string;
  whyTrustYou: string;
  inspiration: string;
  personalValues: string;
  wantToBeKnownFor: string;
  photoReference: string; // optional label/URL only — no real upload pipeline yet
}

// ---------------------------------------------------------------------------
// Step 3 — Products & Services
// ---------------------------------------------------------------------------
export interface OfferRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  cost: string;
  targetCustomer: string;
  mainBenefit: string;
  problemSolved: string;
  features: string;
  outcome: string;
  uniqueSellingPoint: string;
  isBestSeller: boolean;
  isCurrent: boolean; // false = "planned"
}

export interface PrimaryOfferInfo {
  primaryOfferId: string | null;
  why: string;
  transformation: string;
  whyCustomersChoose: string;
  commonObjections: string;
  commonQuestions: string;
}

// ---------------------------------------------------------------------------
// Step 4 — Target Market
// ---------------------------------------------------------------------------
export interface CustomerAvatar {
  id: string;
  name: string;
  description: string;
  ageRange: string;
  gender: string;
  location: string;
  occupation: string;
  businessType: string; // B2B only
  incomeRange: string;
  lifestyle: string;
  interests: string;
  buyingBehavior: string;
  onlineChannels: string[];
  triggers: string;
  problems: string;
  goals: string;
  fears: string;
  objections: string;
  buyingTriggers: string;
  desiredOutcome: string;
  preferredChannels: string;
}

// ---------------------------------------------------------------------------
// Step 5 — Customer Problems
// ---------------------------------------------------------------------------
export interface PainPointEntry {
  id: string;
  painPoint: string;
  severity: "Low" | "Medium" | "High" | "";
  customerSegment: string;
  currentSolution: string;
  whySolutionFails: string;
  emotionalImpact: string;
  businessImpact: string;
}

export interface CustomerProblemsNarrative {
  biggestProblems: string;
  frustrations: string;
  triedBefore: string;
  whyDidntWork: string;
  fearsIfUnresolved: string;
  costMoney: string;
  costTime: string;
  costStress: string;
  costOpportunities: string;
  costConfidence: string;
  costGrowth: string;
}

// ---------------------------------------------------------------------------
// Step 6 — Customer Desires
// ---------------------------------------------------------------------------
export interface CustomerDesires {
  ultimateWant: string;
  resultLookingFor: string;
  successLooksLike: string;
  wouldMakeLifeEasier: string;
  emotionalOutcome: string;
  transformation: string;
  goals: string;
  desires: string;
  dreamOutcomes: string;
  emotionalDesires: string;
  functionalDesires: string;
}

// ---------------------------------------------------------------------------
// Step 7 — Brand Positioning
// ---------------------------------------------------------------------------
export interface BrandPositioning {
  howDescribed: string;
  knownFor: string;
  whyChooseUs: string;
  whatMakesDifferent: string;
  brandPromise: string;
  immediateUnderstanding: string;
  brandCategory: string;
  marketPosition: string;
  uniqueValueProposition: string;
  corePromise: string;
  primaryDifferentiator: string;
  competitiveAdvantage: string;
  reasonToBelieve: string;
  proofCredibility: string;
  desiredPerception: string;
}

// ---------------------------------------------------------------------------
// Step 8 — Brand Personality & Voice
// ---------------------------------------------------------------------------
export const PERSONALITY_TRAITS = [
  "Professional",
  "Friendly",
  "Premium",
  "Bold",
  "Educational",
  "Warm",
  "Strategic",
  "Innovative",
  "Simple",
  "Trustworthy",
  "Energetic",
  "Empowering",
  "Practical",
  "Modern",
] as const;

export const VOICE_STYLES = [
  "Professional",
  "Conversational",
  "Taglish",
  "English",
  "Filipino",
  "Educational",
  "Inspirational",
  "Direct",
  "Friendly",
  "Premium",
  "Expert",
  "Humorous",
  "Formal",
] as const;

export interface BrandPersonalityVoice {
  traits: string[];
  customTraits: string;
  voiceStyles: string[];
  preferredLanguage: string;
  wordsWeLike: string;
  wordsWeAvoid: string;
  howWeAddressCustomers: string;
  communicationStyle: string;
}

// ---------------------------------------------------------------------------
// Step 9 — Marketing & Sales
// ---------------------------------------------------------------------------
export const SALES_CHANNELS = [
  "Messenger",
  "Website",
  "Landing Page",
  "Physical Store",
  "Shopee",
  "Lazada",
  "TikTok Shop",
  "Sales Call",
  "Other",
] as const;

export const MARKETING_CHANNELS = [
  "Facebook Organic",
  "Facebook Ads",
  "TikTok",
  "Instagram",
  "Live Selling",
  "Influencers",
  "Email",
  "SMS",
  "Chatbot",
  "Other",
] as const;

export const CONTENT_TYPES = [
  "Social Posts",
  "Reels",
  "Video Scripts",
  "Ad Copy",
  "Captions",
  "Email",
  "Chatbot",
  "Sales Scripts",
  "Landing Pages",
  "Product Descriptions",
  "Websites",
  "Webinar Content",
  "Other",
] as const;

export interface MarketingSales {
  whereCustomersFindYou: string;
  howYouGetLeads: string;
  howCustomersBuy: string[];
  currentChannels: string[];
  customerJourney: string;
  whereCustomersDropOff: string;
  biggestSalesChallenge: string;
  biggestMarketingChallenge: string;
  currentContent: string;
  bestPerformingContent: string;
  topicsCanTeach: string;
  repeatedQuestions: string;
  misconceptions: string;
  contentWantAiToHelp: string[];
}

// ---------------------------------------------------------------------------
// Step 10 — Competitors
// ---------------------------------------------------------------------------
export interface CompetitorRecord {
  id: string;
  name: string;
  websiteOrPage: string;
  productsServices: string;
  priceRange: string;
  strengths: string;
  weaknesses: string;
  whatCustomersLike: string;
  whatMakesUsDifferent: string;
}

// ---------------------------------------------------------------------------
// Step 11 — Business Goals & Growth
// ---------------------------------------------------------------------------
export interface BusinessGoals {
  threeMonths: string;
  sixMonths: string;
  twelveMonths: string;
  threeYears: string;
}

export const BUSINESS_CHALLENGE_OPTIONS = [
  "Capital",
  "Product",
  "Supplier",
  "Pricing",
  "Branding",
  "Marketing",
  "Content",
  "Facebook Ads",
  "Sales",
  "Automation",
  "Team",
  "Inventory",
  "Operations",
  "Customer Retention",
  "Strategy",
  "Confidence / Knowledge",
  "Other",
] as const;

export const STRATEGIC_PRIORITY_OPTIONS = [
  "Increase Sales",
  "Generate Leads",
  "Improve Branding",
  "Launch New Product",
  "Import Directly",
  "Build Online Presence",
  "Improve Ads",
  "Build Automation",
  "Improve Customer Retention",
  "Create Systems",
  "Build Team",
  "Scale Business",
] as const;

export interface BusinessChallenges {
  selected: string[];
  explanation: string;
}

// ---------------------------------------------------------------------------
// The full questionnaire — one MasterBrainSubmission per student/business.
// ---------------------------------------------------------------------------

export const QUESTIONNAIRE_STEP_LABELS = [
  "Business Foundation",
  "Founder / Business Owner",
  "Products & Services",
  "Target Market",
  "Customer Problems",
  "Customer Desires & Goals",
  "Brand Positioning",
  "Brand Personality & Voice",
  "Marketing & Sales",
  "Competitors & Differentiation",
  "Business Goals & Growth",
  "Final Review & Submission",
] as const;

export const QUESTIONNAIRE_VERSION = "v1.0";

/**
 * A single revision the Academy asked the student to make — never edits the
 * submission itself, just points at what needs another look (spec section
 * 30). `resolved` flips true once the student resubmits.
 */
export interface MasterBrainRevisionRequest {
  id: string;
  section: string; // one of QUESTIONNAIRE_STEP_LABELS
  question: string; // human-readable label of the specific field, optional
  reason: string;
  requestedBy: string;
  requestedAt: string;
  resolved: boolean;
  resolvedAt: string | null;
}

/**
 * One point-in-time snapshot of a submission, kept forever once the student
 * submits/resubmits — see spec section 31 "never destroy previous
 * submissions". The live, editable copy lives on MasterBrainSubmission
 * itself; this is the read-only trail.
 */
export interface MasterBrainSubmissionSnapshot {
  id: string;
  submissionVersion: number;
  submittedAt: string;
  submittedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  statusAtSnapshot: MasterBrainStatus;
}

export interface MasterBrainSubmission {
  id: string;
  studentId: string;
  /** Future-ready for one student having more than one business (spec section 42) — always a single implicit business for now. */
  businessId: string;
  questionnaireVersion: string;
  submissionVersion: number;
  status: MasterBrainStatus;
  currentStep: number; // 1-12
  progressPercent: number;

  businessFoundation: BusinessFoundation;
  founder: FounderProfile;
  offers: OfferRecord[];
  primaryOffer: PrimaryOfferInfo;
  avatars: CustomerAvatar[];
  painPoints: PainPointEntry[];
  problemsNarrative: CustomerProblemsNarrative;
  desires: CustomerDesires;
  positioning: BrandPositioning;
  personalityVoice: BrandPersonalityVoice;
  marketingSales: MarketingSales;
  competitors: CompetitorRecord[];
  goals: BusinessGoals;
  challenges: BusinessChallenges;
  priorities: string[];

  startedAt: string | null;
  lastSaved: string | null;
  submittedAt: string | null;

  assignedReviewerId: string | null;
  reviewDueDate: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminNotes: { id: string; text: string; author: string; timestamp: string }[];

  revisionRequests: MasterBrainRevisionRequest[];
  submissionHistory: MasterBrainSubmissionSnapshot[];
}

// ---------------------------------------------------------------------------
// The FINAL Brand Master Brain document — spec section 33's 19 sections.
// Every section shares one shape so the generator, the admin editor, and the
// student-facing document viewer can all stay generic instead of needing 19
// bespoke components.
// ---------------------------------------------------------------------------

export interface MasterBrainDocumentSection {
  key: string;
  title: string;
  content: string;
  bullets: string[];
  approved: boolean;
  lastEditedBy: string | null;
  lastEditedAt: string | null;
}

export const MASTER_BRAIN_SECTION_DEFS: { key: string; title: string }[] = [
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
];

export interface MasterBrainDocument {
  id: string;
  submissionId: string;
  studentId: string;
  businessId: string;
  documentVersion: number;
  /** submissionVersion this draft was generated from — proves it isn't stale once the student resubmits. */
  generatedFromSubmissionVersion: number;
  generatedAt: string;
  sections: MasterBrainDocumentSection[];
  isCurrentPublished: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
}

export const REVIEW_CHECKLIST_ITEMS = [
  "Business Information Reviewed",
  "Offers Reviewed",
  "Target Market Reviewed",
  "Customer Avatars Reviewed",
  "Positioning Reviewed",
  "Brand Voice Reviewed",
  "Marketing Strategy Reviewed",
  "AI Instructions Reviewed",
] as const;

export type ReviewChecklistItem = (typeof REVIEW_CHECKLIST_ITEMS)[number];

/** Lightweight row shape the admin Submissions table renders — joins a submission with its student for display. */
export interface MasterBrainSubmissionRow {
  submission: MasterBrainSubmission;
  studentId: string;
  studentDisplayId: string;
  studentName: string;
  businessName: string;
  batch: Batch;
  package: PackageType;
}

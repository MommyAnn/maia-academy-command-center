// Configuration + demo seed data for the Brand Master Brain Builder (Step 8).
// Seed submissions are looked up by a student's stable display ID
// (StudentRecord.studentId, e.g. "MAIA-B14-0002") rather than their internal
// id, since DEMO_STUDENTS assigns internal ids with crypto.randomUUID() on
// every module load — see src/data/demoFinance.ts for the same pattern.

import type { MasterBrainSubmission, MasterBrainDocument } from "@/types/masterBrain";
import { MASTER_BRAIN_SECTION_DEFS, QUESTIONNAIRE_VERSION } from "@/types/masterBrain";
import { DEMO_STUDENTS } from "@/data/demoStudents";

export const CURRENT_DEMO_USER = "Mommy Ann";

function findStudentId(studentDisplayId: string): string {
  const student = DEMO_STUDENTS.find((s) => s.studentId === studentDisplayId);
  if (!student) throw new Error(`Demo student not found: ${studentDisplayId}`);
  return student.id;
}

/** A brand-new, empty submission for a student who hasn't started yet. */
export function createEmptySubmission(studentId: string): MasterBrainSubmission {
  return {
    id: crypto.randomUUID(),
    studentId,
    businessId: crypto.randomUUID(),
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    submissionVersion: 1,
    status: "Not Started",
    currentStep: 1,
    progressPercent: 0,

    businessFoundation: {
      businessName: "",
      brandName: "",
      category: "",
      businessType: "",
      location: "",
      areasServed: "",
      website: "",
      facebookPage: "",
      instagram: "",
      tiktok: "",
      shopee: "",
      lazada: "",
      otherChannels: "",
      yearsInBusiness: "",
      stage: "",
      description: "",
      whyStarted: "",
      problemSolved: "",
      whyItMatters: "",
    },
    founder: {
      founderName: "",
      role: "",
      founderStory: "",
      experience: "",
      skills: "",
      expertise: "",
      whyTrustYou: "",
      inspiration: "",
      personalValues: "",
      wantToBeKnownFor: "",
      photoReference: "",
    },
    offers: [],
    primaryOffer: {
      primaryOfferId: null,
      why: "",
      transformation: "",
      whyCustomersChoose: "",
      commonObjections: "",
      commonQuestions: "",
    },
    avatars: [],
    painPoints: [],
    problemsNarrative: {
      biggestProblems: "",
      frustrations: "",
      triedBefore: "",
      whyDidntWork: "",
      fearsIfUnresolved: "",
      costMoney: "",
      costTime: "",
      costStress: "",
      costOpportunities: "",
      costConfidence: "",
      costGrowth: "",
    },
    desires: {
      ultimateWant: "",
      resultLookingFor: "",
      successLooksLike: "",
      wouldMakeLifeEasier: "",
      emotionalOutcome: "",
      transformation: "",
      goals: "",
      desires: "",
      dreamOutcomes: "",
      emotionalDesires: "",
      functionalDesires: "",
    },
    positioning: {
      howDescribed: "",
      knownFor: "",
      whyChooseUs: "",
      whatMakesDifferent: "",
      brandPromise: "",
      immediateUnderstanding: "",
      brandCategory: "",
      marketPosition: "",
      uniqueValueProposition: "",
      corePromise: "",
      primaryDifferentiator: "",
      competitiveAdvantage: "",
      reasonToBelieve: "",
      proofCredibility: "",
      desiredPerception: "",
    },
    personalityVoice: {
      traits: [],
      customTraits: "",
      voiceStyles: [],
      preferredLanguage: "",
      wordsWeLike: "",
      wordsWeAvoid: "",
      howWeAddressCustomers: "",
      communicationStyle: "",
    },
    marketingSales: {
      whereCustomersFindYou: "",
      howYouGetLeads: "",
      howCustomersBuy: [],
      currentChannels: [],
      customerJourney: "",
      whereCustomersDropOff: "",
      biggestSalesChallenge: "",
      biggestMarketingChallenge: "",
      currentContent: "",
      bestPerformingContent: "",
      topicsCanTeach: "",
      repeatedQuestions: "",
      misconceptions: "",
      contentWantAiToHelp: [],
    },
    competitors: [],
    goals: {
      threeMonths: "",
      sixMonths: "",
      twelveMonths: "",
      threeYears: "",
    },
    challenges: {
      selected: [],
      explanation: "",
    },
    priorities: [],

    startedAt: null,
    lastSaved: null,
    submittedAt: null,

    assignedReviewerId: null,
    reviewDueDate: null,
    reviewedBy: null,
    reviewedAt: null,
    adminNotes: [],

    revisionRequests: [],
    submissionHistory: [],
  };
}

// ---------------------------------------------------------------------------
// DEMO SEED DATA — three example submissions in different stages so the
// Admin Master Brain Dashboard and Student Portal both have something
// realistic to show out of the box.
// ---------------------------------------------------------------------------

function mariaSantosSubmission(): MasterBrainSubmission {
  const base = createEmptySubmission(findStudentId("MAIA-B14-0001"));
  return {
    ...base,
    status: "In Progress",
    currentStep: 5,
    progressPercent: 38,
    startedAt: "2026-09-05T09:00:00+08:00",
    lastSaved: "2026-09-10T14:20:00+08:00",
    businessFoundation: {
      ...base.businessFoundation,
      businessName: "Maria's Home Finds",
      brandName: "Maria Home Finds PH",
      category: "Home & Living Import",
      businessType: "Sole Proprietor",
      location: "Quezon City",
      areasServed: "Metro Manila, Luzon-wide shipping",
      facebookPage: "facebook.com/mariahomefindsph",
      instagram: "@mariahomefindsph",
      yearsInBusiness: "1",
      stage: "Starting",
      description: "A curated home organization and kitchen finds shop sourced directly from Taobao suppliers.",
      whyStarted: "Wanted a flexible income source while managing a young family.",
      problemSolved: "Filipino households want affordable, good-quality home organizers without the local markup.",
      whyItMatters: "It's my first real business and I want to build something my kids can be proud of.",
    },
    founder: {
      ...base.founder,
      founderName: "Maria Santos",
      role: "Founder / Owner",
      founderStory: "Started reselling to friends and family, now ready to grow beyond Messenger orders.",
    },
    offers: [
      {
        id: crypto.randomUUID(),
        name: "Stackable Kitchen Organizer Set",
        category: "Kitchen",
        description: "5-piece stackable organizer set for pantry and cabinets.",
        price: "899",
        cost: "",
        targetCustomer: "Young homeowners and condo dwellers",
        mainBenefit: "Maximizes small kitchen space",
        problemSolved: "Cluttered, disorganized cabinets",
        features: "Stackable, BPA-free, space-saving",
        outcome: "A cabinet that finally looks organized",
        uniqueSellingPoint: "Direct-from-factory pricing, same quality as mall brands",
        isBestSeller: true,
        isCurrent: true,
      },
    ],
    primaryOffer: {
      primaryOfferId: null,
      why: "It's our best seller and easiest to explain in one photo.",
      transformation: "From cluttered cabinet to Pinterest-worthy pantry.",
      whyCustomersChoose: "Price and the before/after photos we post.",
      commonObjections: "\"Is it really BPA-free?\" and shipping time concerns.",
      commonQuestions: "How many pieces come in the set? Does it fit a standard cabinet?",
    },
  };
}

function miguelTorresSubmission(): MasterBrainSubmission {
  const base = createEmptySubmission(findStudentId("MAIA-B13-0007"));
  return {
    ...base,
    status: "Under Review",
    currentStep: 12,
    progressPercent: 100,
    startedAt: "2026-06-20T09:00:00+08:00",
    lastSaved: "2026-07-01T16:00:00+08:00",
    submittedAt: "2026-07-02T10:00:00+08:00",
    assignedReviewerId: null,
    reviewDueDate: "2026-07-05",
    businessFoundation: {
      ...base.businessFoundation,
      businessName: "Torres Trading Co.",
      brandName: "Torres Trading Co.",
      category: "Electronics Accessories Import",
      businessType: "Sole Proprietor",
      location: "San Fernando, Pampanga",
      areasServed: "Central Luzon, nationwide via Shopee/Lazada",
      shopee: "shopee.ph/torrestradingco",
      lazada: "lazada.com.ph/shop/torres-trading",
      yearsInBusiness: "2",
      stage: "Operating",
      description: "Imports and resells phone accessories and small electronics gadgets.",
      whyStarted: "Side income that grew into a full-time shop during the pandemic.",
      problemSolved: "Affordable, reliable phone accessories without waiting weeks for overseas shipping.",
      whyItMatters: "It now supports my whole household.",
    },
    founder: {
      ...base.founder,
      founderName: "Miguel Torres",
      role: "Founder / Owner",
      founderStory: "Former call center agent who started reselling gadgets to officemates.",
      experience: "2 years running an online electronics accessories shop.",
      whyTrustYou: "500+ completed Shopee orders with a 4.9 rating.",
    },
    offers: [
      {
        id: crypto.randomUUID(),
        name: "MagSafe-Compatible Wireless Charger",
        category: "Charging Accessories",
        description: "15W fast wireless charger compatible with MagSafe cases.",
        price: "690",
        cost: "",
        targetCustomer: "iPhone users who want a clutter-free desk",
        mainBenefit: "Fast, snap-on charging without cable clutter",
        problemSolved: "Slow or incompatible generic wireless chargers",
        features: "15W output, magnetic alignment, LED indicator",
        outcome: "A tidy desk and a phone that's always charged",
        uniqueSellingPoint: "Tested for true MagSafe alignment, not just \"compatible\" in the listing",
        isBestSeller: true,
        isCurrent: true,
      },
      {
        id: crypto.randomUUID(),
        name: "Tempered Glass Screen Protector (2-Pack)",
        category: "Phone Protection",
        description: "9H hardness tempered glass with easy-install tray.",
        price: "199",
        cost: "",
        targetCustomer: "Budget-conscious phone owners",
        mainBenefit: "Drop and scratch protection",
        problemSolved: "Cracked screens from accidental drops",
        features: "9H hardness, bubble-free install tray",
        outcome: "Peace of mind carrying their phone daily",
        uniqueSellingPoint: "Bundled install tray removes the usual bubble frustration",
        isBestSeller: false,
        isCurrent: true,
      },
    ],
    primaryOffer: {
      primaryOfferId: null,
      why: "Highest margin and repeat-purchase item.",
      transformation: "From tangled charging cables to a clean, modern desk setup.",
      whyCustomersChoose: "Reviews proving true MagSafe alignment, unlike cheaper alternatives.",
      commonObjections: "\"Is this a real MagSafe charger or just compatible?\"",
      commonQuestions: "Does this work with a case on? How fast does it actually charge?",
    },
    avatars: [
      {
        id: crypto.randomUUID(),
        name: "Young Professional Upgrader",
        description: "25-35 year old office worker upgrading their phone setup.",
        ageRange: "25-35",
        gender: "Any",
        location: "Metro Manila & Central Luzon",
        occupation: "Office employee / BPO",
        businessType: "",
        incomeRange: "₱25,000-₱45,000/month",
        lifestyle: "Busy, values convenience and aesthetics",
        interests: "Tech gadgets, minimalism, productivity",
        buyingBehavior: "Researches reviews before buying, buys via Shopee",
        onlineChannels: ["Facebook", "TikTok", "Shopee"],
        triggers: "New phone purchase, cable finally frays",
        problems: "Slow, unreliable generic chargers",
        goals: "A clean, modern desk setup",
        fears: "Buying another charger that doesn't actually work with MagSafe",
        objections: "Price vs. mall brands",
        buyingTriggers: "Seeing a satisfied customer's unboxing video",
        desiredOutcome: "Fast, reliable charging without cable clutter",
        preferredChannels: "Shopee, TikTok",
      },
    ],
    painPoints: [
      {
        id: crypto.randomUUID(),
        painPoint: "Generic wireless chargers that don't actually align with MagSafe",
        severity: "High",
        customerSegment: "Young Professional Upgrader",
        currentSolution: "Buying cheap chargers on marketplace apps",
        whySolutionFails: "Poor magnet alignment causes slow/interrupted charging",
        emotionalImpact: "Frustration and buyer's regret",
        businessImpact: "Repeat purchases and negative reviews for the whole category",
      },
    ],
    positioning: {
      ...base.positioning,
      howDescribed: "Reliable, tested gadgets that actually do what the listing says.",
      knownFor: "Honest, tested phone accessories.",
      whyChooseUs: "We test every charger for true MagSafe alignment before listing it.",
      uniqueValueProposition: "Accessories that are tested, not just labeled 'compatible'.",
    },
    personalityVoice: {
      ...base.personalityVoice,
      traits: ["Trustworthy", "Practical", "Modern"],
      voiceStyles: ["Direct", "Friendly", "Taglish"],
      preferredLanguage: "Taglish",
    },
    goals: {
      threeMonths: "Launch 3 new accessory SKUs",
      sixMonths: "Reach 1,000 five-star Shopee ratings",
      twelveMonths: "Open a TikTok Shop storefront",
      threeYears: "Move into a small retail kiosk",
    },
    challenges: {
      selected: ["Facebook Ads", "Branding", "Automation"],
      explanation: "We rely on marketplace traffic and haven't built our own branded audience yet.",
    },
    priorities: ["Build Online Presence", "Improve Ads", "Build Automation"],
    submissionHistory: [
      {
        id: crypto.randomUUID(),
        submissionVersion: 1,
        submittedAt: "2026-07-02T10:00:00+08:00",
        submittedBy: "Miguel Torres",
        reviewedBy: null,
        reviewedAt: null,
        statusAtSnapshot: "Submitted",
      },
    ],
  };
}

function carlosDizonSubmission(): MasterBrainSubmission {
  const base = createEmptySubmission(findStudentId("MAIA-B14-0002"));
  return {
    ...base,
    status: "Published",
    currentStep: 12,
    progressPercent: 100,
    startedAt: "2026-09-12T09:00:00+08:00",
    lastSaved: "2026-09-16T11:00:00+08:00",
    submittedAt: "2026-09-16T11:30:00+08:00",
    reviewedBy: "Jane Villareal",
    reviewedAt: "2026-09-17T10:00:00+08:00",
    businessFoundation: {
      ...base.businessFoundation,
      businessName: "Dizon Global Imports",
      brandName: "Dizon Global",
      category: "General Merchandise Import",
      businessType: "Sole Proprietor",
      location: "Makati City",
      areasServed: "Nationwide via Lazada, Shopee, and reseller network",
      lazada: "lazada.com.ph/shop/dizon-global",
      shopee: "shopee.ph/dizonglobal",
      yearsInBusiness: "3",
      stage: "Growing",
      description: "A multi-category import business selling household gadgets, bags, and seasonal items sourced directly from Chinese suppliers.",
      whyStarted: "Saw an opportunity to cut out local middlemen and pass savings to Filipino resellers.",
      problemSolved: "Small resellers overpay local wholesalers for the same items available directly from source.",
      whyItMatters: "Built a reseller network of 40+ people who depend on this business for income.",
    },
    founder: {
      ...base.founder,
      founderName: "Carlos Dizon",
      role: "Founder / Owner",
      founderStory: "Left a corporate logistics job to build a direct-import business full-time.",
      experience: "3 years importing, 8 years in logistics/supply chain before that.",
      whyTrustYou: "Verified supplier relationships and a 40-person active reseller network.",
    },
    offers: [
      {
        id: crypto.randomUUID(),
        name: "Reseller Starter Bundle",
        category: "Wholesale Bundle",
        description: "A curated bundle of best-selling items at wholesale pricing for new resellers.",
        price: "3500",
        cost: "",
        targetCustomer: "Aspiring online resellers",
        mainBenefit: "Everything a new reseller needs to launch in one order",
        problemSolved: "Not knowing what to sell or where to source it",
        features: "Curated best-sellers, reseller price sheet included",
        outcome: "A ready-to-sell inventory on day one",
        uniqueSellingPoint: "Direct factory sourcing passed on as reseller pricing",
        isBestSeller: true,
        isCurrent: true,
      },
    ],
    primaryOffer: {
      primaryOfferId: null,
      why: "It's the entry point for our entire reseller network.",
      transformation: "From zero inventory to a ready online shop in one order.",
      whyCustomersChoose: "Lower entry cost than sourcing individually.",
      commonObjections: "Concern about which items will actually sell.",
      commonQuestions: "Can I customize the bundle? Is there a minimum order?",
    },
    positioning: {
      ...base.positioning,
      knownFor: "Reliable direct-import sourcing for Filipino resellers.",
      uniqueValueProposition: "Factory-direct pricing with a built-in reseller support network.",
      competitiveAdvantage: "Verified supplier relationships built over 3 years.",
    },
    personalityVoice: {
      ...base.personalityVoice,
      traits: ["Professional", "Trustworthy", "Strategic"],
      voiceStyles: ["Professional", "Direct", "Expert"],
      preferredLanguage: "English",
    },
    goals: {
      threeMonths: "Grow reseller network to 60 active members",
      sixMonths: "Add a second warehouse location",
      twelveMonths: "Launch a branded reseller mobile app",
      threeYears: "Become the top direct-import supplier for Luzon resellers",
    },
    priorities: ["Scale Business", "Build Team", "Create Systems"],
    submissionHistory: [
      {
        id: crypto.randomUUID(),
        submissionVersion: 1,
        submittedAt: "2026-09-16T11:30:00+08:00",
        submittedBy: "Carlos Dizon",
        reviewedBy: "Jane Villareal",
        reviewedAt: "2026-09-17T10:00:00+08:00",
        statusAtSnapshot: "Completed",
      },
    ],
  };
}

export const DEMO_MASTER_BRAIN_SUBMISSIONS: MasterBrainSubmission[] = [
  mariaSantosSubmission(),
  miguelTorresSubmission(),
  carlosDizonSubmission(),
];

function emptySection(key: string, title: string): MasterBrainDocument["sections"][number] {
  return { key, title, content: "", bullets: [], approved: false, lastEditedBy: null, lastEditedAt: null };
}

function carlosDizonDocument(submission: MasterBrainSubmission): MasterBrainDocument {
  const sections = MASTER_BRAIN_SECTION_DEFS.map((def) => emptySection(def.key, def.title));
  const set = (key: string, content: string, bullets: string[] = []) => {
    const s = sections.find((x) => x.key === key)!;
    s.content = content;
    s.bullets = bullets;
    s.approved = true;
    s.lastEditedBy = "Jane Villareal";
    s.lastEditedAt = "2026-09-18T09:00:00+08:00";
  };

  set(
    "brandOverview",
    "Dizon Global Imports (brand name: Dizon Global) is a general merchandise import business based in Makati City, operating nationwide through Lazada, Shopee, and a reseller network.",
    ["Business Model: Direct import + reseller wholesale", "Market: Filipino online resellers and end consumers"],
  );
  set(
    "brandFoundation",
    "Dizon Global exists to make factory-direct sourcing accessible to Filipino resellers, cutting out unnecessary middlemen.",
    [
      "Mission: Give every Filipino reseller access to factory-direct pricing.",
      "Vision: Become the most trusted direct-import partner for Luzon resellers.",
      "Core Values: Reliability, transparency, partnership.",
    ],
  );
  set(
    "founderStory",
    "Founded by Carlos Dizon, who left an 8-year logistics career to build a direct-import business from the ground up.",
    ["3 years importing, 8 years in logistics/supply chain", "Verified supplier relationships and a 40-person active reseller network"],
  );
  set(
    "productsServices",
    "Primary Offer: Reseller Starter Bundle — a curated set of best-selling items at wholesale pricing for new resellers.",
    ["Transformation: from zero inventory to a ready online shop in one order", "Price: ₱3,500 per bundle"],
  );
  set("targetMarket", "Primary market: aspiring and active online resellers across the Philippines seeking factory-direct pricing.");
  set("customerAvatars", "Reseller Starter — a new or aspiring online seller looking for a low-risk way to launch an online shop.");
  set(
    "painPoints",
    "Resellers don't know what to sell or where to source reliably, and often overpay local wholesalers for the same items available direct from source.",
  );
  set(
    "customerDesires",
    "A ready-to-sell inventory with clear reseller pricing, and the confidence that their supplier relationship is reliable long-term.",
  );
  set(
    "brandPositioning",
    "Dizon Global is positioned as the reliable direct-import partner for Filipino resellers, known for verified supplier relationships built over 3 years.",
    ["Unique Value Proposition: Factory-direct pricing with a built-in reseller support network"],
  );
  set("brandPersonality", "Professional, trustworthy, and strategic.");
  set("brandVoice", "Professional, direct, expert tone in English.");
  set(
    "coreMessaging",
    "Elevator Pitch: Dizon Global gives Filipino resellers factory-direct pricing and a ready-made support network to launch and grow their own online shop.",
  );
  set("contentPillars", "Reseller success stories, sourcing transparency, and starter-bundle spotlights.");
  set("marketingStrategy", "Primary channels: Lazada, Shopee, and referral growth through the existing reseller network.");
  set("salesFoundation", "Sales process: inquiry → bundle selection → payment → fulfillment → reseller onboarding support.");
  set("competitiveDifferentiation", "Differentiated by 3 years of verified supplier relationships and an active reseller support network, not just lower prices.");
  set(
    "businessGoals",
    "Grow reseller network to 60 active members in 3 months, add a second warehouse in 6 months, launch a branded reseller app within 12 months.",
  );
  set("strategicPriorities", "Scale the business, build a team, and create repeatable systems.");
  set(
    "aiBrandInstructions",
    "Use this Brand Master Brain as the source of truth for Dizon Global Imports. Speak in a professional, direct, expert English tone. Always foreground the reseller support network and verified supplier relationships as the key differentiator — never claim lowest price as the primary appeal.",
    ["Audience: aspiring and active Filipino online resellers", "Avoid: hype language, unverifiable claims, casual/joke tone"],
  );

  return {
    id: crypto.randomUUID(),
    submissionId: submission.id,
    studentId: submission.studentId,
    businessId: submission.businessId,
    documentVersion: 1,
    generatedFromSubmissionVersion: submission.submissionVersion,
    generatedAt: "2026-09-17T14:00:00+08:00",
    sections,
    isCurrentPublished: true,
    publishedAt: "2026-09-18T09:30:00+08:00",
    publishedBy: "Jane Villareal",
  };
}

export const DEMO_MASTER_BRAIN_DOCUMENTS: MasterBrainDocument[] = [
  carlosDizonDocument(DEMO_MASTER_BRAIN_SUBMISSIONS.find((s) => s.status === "Published")!),
];

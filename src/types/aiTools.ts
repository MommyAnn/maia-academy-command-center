// M.A.I.A. AI Business Tools Hub domain types — Step 12.
//
// CORE PRINCIPLE: the student's own PUBLISHED Brand Master Brain (Step 8) is
// the shared business-intelligence layer every tool reads from — never a
// duplicated or re-typed copy of it. Nothing here stores a second copy of
// target market/pain points/positioning/etc.; see extractBusinessContext()
// in src/utils/aiTools.ts, which reads live from masterBrainStore.
//
// NO REAL AI PROVIDER EXISTS. Every "generation" in this build is a
// deterministic, template-based transform over the student's real Master
// Brain data + their task-specific input — the exact same honesty pattern
// Step 8 used for its own document generator ("not a real AI call"). See
// AiProvider.connectionStatus, always "Not Connected" in this build, and
// AiToolOutput.simulated, always true.

import type { Batch, PackageType } from "@/types/student";

// ---------------------------------------------------------------------------
// Tool Library (spec sections 6-7)
// ---------------------------------------------------------------------------

export type AiToolCategory =
  | "Strategy"
  | "Market Research"
  | "Content"
  | "Creative"
  | "Video"
  | "Copywriting"
  | "Advertising"
  | "Sales"
  | "Automation"
  | "Funnels"
  | "Website"
  | "Customer Journey"
  | "Business Systems";

export const AI_TOOL_CATEGORIES: AiToolCategory[] = [
  "Strategy",
  "Market Research",
  "Content",
  "Creative",
  "Video",
  "Copywriting",
  "Advertising",
  "Sales",
  "Automation",
  "Funnels",
  "Website",
  "Customer Journey",
  "Business Systems",
];

export type AiToolId =
  | "business-strategist"
  | "market-intelligence"
  | "content-strategist"
  | "content-planner"
  | "creative-strategist"
  | "video-director"
  | "copywriter"
  | "facebook-ads-strategist"
  | "ads-analyzer"
  | "offer-builder"
  | "sales-script-builder"
  | "chatbot-flow-builder"
  | "automation-architect"
  | "customer-journey-builder"
  | "funnel-builder"
  | "website-copy-builder"
  | "email-marketing-builder"
  | "business-systems-advisor";

export const AI_TOOL_IDS: AiToolId[] = [
  "business-strategist",
  "market-intelligence",
  "content-strategist",
  "content-planner",
  "creative-strategist",
  "video-director",
  "copywriter",
  "facebook-ads-strategist",
  "ads-analyzer",
  "offer-builder",
  "sales-script-builder",
  "chatbot-flow-builder",
  "automation-architect",
  "customer-journey-builder",
  "funnel-builder",
  "website-copy-builder",
  "email-marketing-builder",
  "business-systems-advisor",
];

export type AiToolStatus = "Active" | "Inactive" | "Coming Soon";

export const AI_TOOL_STATUSES: AiToolStatus[] = ["Active", "Inactive", "Coming Soon"];

export type AiInputFieldType = "text" | "textarea" | "select" | "number" | "multiselect";

export interface AiToolInputField {
  key: string;
  label: string;
  type: AiInputFieldType;
  options?: string[];
  required: boolean;
  placeholder?: string;
}

export interface AiToolDefinition {
  id: AiToolId;
  name: string;
  description: string;
  category: AiToolCategory;
  /** A lucide-react icon name, resolved by the tool card component — never a hard-coded per-tool component. */
  icon: string;
  displayOrder: number;
  status: AiToolStatus;
  /** Which AiProvider this tool is configured to use — null means "unassigned / uses default". */
  providerId: string | null;
  inputFields: AiToolInputField[];
}

// ---------------------------------------------------------------------------
// Goal-based start (spec section 8)
// ---------------------------------------------------------------------------

export interface AiGoalOption {
  id: string;
  label: string;
  recommendedToolIds: AiToolId[];
}

// ---------------------------------------------------------------------------
// Workflow recipes (spec sections 31, 65)
// ---------------------------------------------------------------------------

export interface AiWorkflowRecipe {
  id: string;
  name: string;
  description: string;
  steps: AiToolId[];
}

// ---------------------------------------------------------------------------
// Projects (spec section 30)
// ---------------------------------------------------------------------------

export type AiProjectType = "Campaign" | "Content Calendar" | "Product Launch" | "Funnel" | "Automation" | "Other";

export const AI_PROJECT_TYPES: AiProjectType[] = ["Campaign", "Content Calendar", "Product Launch", "Funnel", "Automation", "Other"];

export interface AiProject {
  id: string;
  projectId: string; // e.g. PROJ-2026-000001
  studentId: string;
  businessId: string;
  name: string;
  type: AiProjectType;
  /** The Master Brain document version active when the project was created — informational only, each generation records its own version too. */
  masterBrainVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Generation output — one generic shape covers all 18 tools (spec section
// 12/37's "smart inputs", never 18 bespoke result types). `items` renders as
// a table when present (Content Planner's days, Video Director's scenes,
// Automation Architect's steps, Customer Journey's stages, Funnel stages,
// Email sequence entries); `content` renders as prose otherwise.
// ---------------------------------------------------------------------------

export interface AiOutputItem {
  [field: string]: string;
}

export type AiDataProvenance = "Master Brain Data" | "Student-Provided Data" | "AI Hypothesis" | "AI Recommendation" | "Assumption";

export interface AiOutputSection {
  key: string;
  title: string;
  content: string;
  items: AiOutputItem[];
  /** Only populated by tools spec sections 9-10 explicitly require to distinguish fact from hypothesis (Business Strategist, Market Intelligence). */
  provenance?: AiDataProvenance;
}

export interface AiToolOutput {
  toolId: AiToolId;
  sections: AiOutputSection[];
  /** Unsupported/risky marketing claims detected in the generated text (spec section 44) — never auto-removed, just flagged for human review. */
  flaggedClaims: string[];
  /** Always true in this build — no real AI provider exists (spec section 68). */
  simulated: true;
}

export type AiGenerationStatus = "Completed" | "Failed";

export interface AiGeneration {
  id: string;
  generationId: string; // e.g. GEN-2026-000001
  studentId: string;
  businessId: string;
  projectId: string | null;
  toolId: AiToolId;
  /** The exact Master Brain document this generation read from — never re-pointed after the fact, even if the student later republishes (spec section 37). */
  masterBrainDocumentId: string | null;
  masterBrainVersion: number | null;
  userInput: Record<string, string>;
  output: AiToolOutput;
  status: AiGenerationStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  archived: boolean;
  /** Set when this generation was produced by "Send to Another Tool" from a prior generation — preserves the cross-tool chain (spec section 32). */
  sourceGenerationId: string | null;
}

export interface GenerateOutputInput {
  studentId: string;
  businessId: string;
  toolId: AiToolId;
  projectId: string | null;
  userInput: Record<string, string>;
  sourceGenerationId?: string | null;
}

// ---------------------------------------------------------------------------
// AI Provider architecture (spec sections 38-40) — provider-agnostic, never
// a real secret anywhere in this frontend.
// ---------------------------------------------------------------------------

export type AiConnectionStatus = "Connected" | "Not Connected" | "Error";

export interface AiProvider {
  id: string;
  name: string;
  connectionStatus: AiConnectionStatus;
  selectedModel: string;
  lastHealthCheck: string | null;
  status: "Active" | "Inactive";
}

// ---------------------------------------------------------------------------
// Prompt / Instruction Manager (spec sections 41-42) — internal only, never
// shown to students.
// ---------------------------------------------------------------------------

export type PromptVersionStatus = "Draft" | "Active" | "Archived";

export const PROMPT_VERSION_STATUSES: PromptVersionStatus[] = ["Draft", "Active", "Archived"];

export interface PromptVersion {
  id: string;
  toolId: AiToolId;
  version: number;
  systemInstruction: string;
  toolObjective: string;
  requiredContext: string[];
  outputStructure: string;
  guardrails: string;
  status: PromptVersionStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  changeNotes: string;
}

// ---------------------------------------------------------------------------
// Access control (spec sections 46-47) — never every-student-every-tool.
// ---------------------------------------------------------------------------

/** Package → tool ids the package includes. Admin-editable, never a permanent hard-coded rule (spec section 47). */
export type AiPackageAccessMatrix = Record<PackageType, AiToolId[]>;

export interface AiManualGrant {
  id: string;
  studentId: string;
  toolId: AiToolId;
  grantedBy: string;
  grantedAt: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Usage limits + credit preparation (spec sections 48-49) — never billing,
// never invented pricing.
// ---------------------------------------------------------------------------

export type AiUsageLimitMode = "Unlimited" | "Daily Limit" | "Monthly Limit" | "Credits";

export const AI_USAGE_LIMIT_MODES: AiUsageLimitMode[] = ["Unlimited", "Daily Limit", "Monthly Limit", "Credits"];

export interface AiUsageSettings {
  mode: AiUsageLimitMode;
  dailyLimit: number;
  monthlyLimit: number;
  /** Package-specific daily-limit override — only meaningful when mode is "Daily Limit" (spec section 48's "Package-Based Limit"). */
  packageDailyLimitOverrides: Partial<Record<PackageType, number>>;
  creditsEnabled: boolean;
  textCreditCost: number;
  imageCreditCost: number;
  videoCreditCost: number;
}

// ---------------------------------------------------------------------------
// Activity Log (spec section 57)
// ---------------------------------------------------------------------------

export type AiActivityAction =
  | "Tool Opened"
  | "Project Created"
  | "Generation Requested"
  | "Generation Completed"
  | "Generation Failed"
  | "Output Saved"
  | "Output Edited"
  | "Output Sent to Another Tool"
  | "Business Created";

export interface AiActivityLogEntry {
  id: string;
  studentId: string;
  businessId: string | null;
  action: AiActivityAction;
  toolId: AiToolId | null;
  promptVersionId: string | null;
  providerId: string | null;
  masterBrainVersion: number | null;
  summary: string;
  occurredAt: string;
}

// ---------------------------------------------------------------------------
// Marketing claim safety (spec sections 43-44) — a fixed reference list,
// not admin-editable business logic (these are safety guardrails).
// ---------------------------------------------------------------------------

export const FLAGGED_CLAIM_PATTERNS: string[] = [
  "#1 in the philippines",
  "guaranteed results",
  "100% effective",
  "best in the market",
  "fda approved",
  "guaranteed income",
  "no risk",
  "instant results",
  "clinically proven",
];

// ---------------------------------------------------------------------------
// Business context snapshot passed into every generation — assembled fresh
// each time from the live Master Brain, never cached/duplicated (spec
// sections 3-5, 58-59).
// ---------------------------------------------------------------------------

export interface AiBusinessContext {
  studentId: string;
  businessId: string;
  businessName: string;
  masterBrainDocumentId: string | null;
  masterBrainVersion: number | null;
  masterBrainPublished: boolean;
  masterBrainLastUpdated: string | null;
  batch: Batch | null;
  package: PackageType | null;
  targetMarketSummary: string;
  avatarNames: string[];
  painPoints: string[];
  desires: string;
  positioning: string;
  brandVoiceTraits: string[];
  offers: { name: string; price: string }[];
  goals: { threeMonths: string; sixMonths: string; twelveMonths: string };
}

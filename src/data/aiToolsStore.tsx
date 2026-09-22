import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  AiActivityAction,
  AiActivityLogEntry,
  AiBusinessContext,
  AiGeneration,
  AiManualGrant,
  AiPackageAccessMatrix,
  AiProject,
  AiProjectType,
  AiProvider,
  AiToolDefinition,
  AiToolId,
  AiToolStatus,
  AiUsageSettings,
  GenerateOutputInput,
  PromptVersion,
  PromptVersionStatus,
} from "@/types/aiTools";
import {
  CURRENT_DEMO_USER,
  DEFAULT_AI_PACKAGE_ACCESS,
  DEFAULT_AI_USAGE_SETTINGS,
  DEMO_AI_PROVIDER,
  DEMO_AI_TOOLS,
  DEMO_MANUAL_GRANTS,
  DEMO_PROMPT_VERSIONS,
  DEMO_WORKFLOW_RECIPES,
} from "@/data/aiToolsConfig";
import { extractBusinessContext, generateGenerationId, generateProjectId, generateToolOutput } from "@/utils/aiTools";
import { useStudentStore } from "@/data/studentStore";
import { useMasterBrainStore } from "@/data/masterBrainStore";
import type { PackageType } from "@/types/student";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY — NO REAL AI PROVIDER
// ---------------------------------------------------------------------------
// Same caveats as every other store in this build: everything here lives in
// React state mirrored to this browser's localStorage. There is no server,
// no real AI API call. Every "generation" is a deterministic, template-based
// transform over the student's real Master Brain data (read live via
// useMasterBrainStore — never duplicated here) — see generateToolOutput() in
// src/utils/aiTools.ts. AiProvider.connectionStatus starts "Not Connected"
// and nothing in this store can make it genuinely connect to a real model.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_ai_tools_v1";

interface AiToolsState {
  tools: AiToolDefinition[];
  promptVersions: PromptVersion[];
  provider: AiProvider;
  packageAccess: AiPackageAccessMatrix;
  manualGrants: AiManualGrant[];
  usageSettings: AiUsageSettings;
  projects: AiProject[];
  generations: AiGeneration[];
  activityLog: AiActivityLogEntry[];
}

function loadInitialState(): AiToolsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AiToolsState;
      if (parsed && Array.isArray(parsed.tools)) {
        return {
          tools: parsed.tools,
          promptVersions: parsed.promptVersions ?? DEMO_PROMPT_VERSIONS,
          provider: parsed.provider ?? DEMO_AI_PROVIDER,
          packageAccess: parsed.packageAccess ?? DEFAULT_AI_PACKAGE_ACCESS,
          manualGrants: parsed.manualGrants ?? DEMO_MANUAL_GRANTS,
          usageSettings: parsed.usageSettings ?? DEFAULT_AI_USAGE_SETTINGS,
          projects: parsed.projects ?? [],
          generations: parsed.generations ?? [],
          activityLog: parsed.activityLog ?? [],
        };
      }
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  return {
    tools: DEMO_AI_TOOLS,
    promptVersions: DEMO_PROMPT_VERSIONS,
    provider: DEMO_AI_PROVIDER,
    packageAccess: DEFAULT_AI_PACKAGE_ACCESS,
    manualGrants: DEMO_MANUAL_GRANTS,
    usageSettings: DEFAULT_AI_USAGE_SETTINGS,
    projects: [],
    generations: [],
    activityLog: [],
  };
}

function persist(state: AiToolsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Demo-only persistence — safe to ignore quota/availability errors.
  }
}

function nowIso() {
  return new Date().toISOString();
}

function isSameUtcDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function isSameUtcMonth(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
}

/** Spec sections 48, 63 — "Daily Limit" / "Monthly Limit" are the only two enforced here; "Credits" is prepared architecture only (never activated billing), "Unlimited" never blocks. */
function exceedsUsageLimit(state: AiToolsState, studentId: string, nowIsoStr: string, pkg: PackageType | undefined): boolean {
  const { usageSettings, generations } = state;
  if (usageSettings.mode === "Daily Limit") {
    const limit = (pkg && usageSettings.packageDailyLimitOverrides[pkg]) ?? usageSettings.dailyLimit;
    const count = generations.filter((g) => g.studentId === studentId && g.status === "Completed" && isSameUtcDay(g.createdAt, nowIsoStr)).length;
    return count >= limit;
  }
  if (usageSettings.mode === "Monthly Limit") {
    const count = generations.filter((g) => g.studentId === studentId && g.status === "Completed" && isSameUtcMonth(g.createdAt, nowIsoStr)).length;
    return count >= usageSettings.monthlyLimit;
  }
  return false;
}

export interface CreateProjectInput {
  studentId: string;
  businessId: string;
  name: string;
  type: AiProjectType;
  masterBrainVersion: number | null;
}

export interface UpdatePromptVersionInput {
  systemInstruction: string;
  toolObjective: string;
  requiredContext: string[];
  outputStructure: string;
  guardrails: string;
  changeNotes: string;
}

interface AiToolsStoreValue {
  tools: AiToolDefinition[];
  promptVersions: PromptVersion[];
  provider: AiProvider;
  packageAccess: AiPackageAccessMatrix;
  manualGrants: AiManualGrant[];
  usageSettings: AiUsageSettings;
  projects: AiProject[];
  generations: AiGeneration[];
  activityLog: AiActivityLogEntry[];
  workflowRecipes: typeof DEMO_WORKFLOW_RECIPES;

  getToolById: (id: AiToolId) => AiToolDefinition | undefined;
  hasToolAccess: (studentId: string, toolId: AiToolId) => boolean;
  getBusinessContext: (studentId: string) => AiBusinessContext | null;
  getStudentBusinesses: (studentId: string) => { businessId: string; businessName: string }[];

  logActivity: (input: { studentId: string; businessId: string | null; action: AiActivityAction; toolId?: AiToolId | null; summary: string; masterBrainVersion?: number | null }) => void;
  generate: (input: GenerateOutputInput) => AiGeneration;
  regenerate: (generationId: string) => AiGeneration | null;

  createProject: (input: CreateProjectInput) => AiProject;
  addOutputToProject: (generationId: string, projectId: string | null) => void;
  toggleFavorite: (generationId: string) => void;
  archiveGeneration: (generationId: string) => void;
  editGenerationSection: (generationId: string, sectionKey: string, content: string) => void;

  setToolStatus: (toolId: AiToolId, status: AiToolStatus) => void;
  updateToolDefinition: (toolId: AiToolId, patch: Partial<Pick<AiToolDefinition, "name" | "description" | "category" | "icon" | "displayOrder">>) => void;
  savePromptVersion: (toolId: AiToolId, input: UpdatePromptVersionInput) => PromptVersion;
  setPromptVersionStatus: (id: string, status: PromptVersionStatus) => void;
  setPackageAccess: (pkg: PackageType, toolIds: AiToolId[]) => void;
  addManualGrant: (studentId: string, toolId: AiToolId, reason: string) => void;
  removeManualGrant: (id: string) => void;
  setUsageSettings: (patch: Partial<AiUsageSettings>) => void;
  setProviderConfig: (patch: Partial<Pick<AiProvider, "connectionStatus" | "selectedModel" | "status">>) => void;
}

const AiToolsStoreContext = createContext<AiToolsStoreValue | undefined>(undefined);

export function AiToolsStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AiToolsState>(() => loadInitialState());
  const { students, getStudentById } = useStudentStore();
  const { getSubmissionForStudent, getPublishedDocument } = useMasterBrainStore();

  const updateState = useCallback((updater: (prev: AiToolsState) => AiToolsState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const getToolById = useCallback((id: AiToolId) => state.tools.find((t) => t.id === id), [state.tools]);

  // -------------------------------------------------------------------
  // Master Brain Context Engine (spec sections 3-5) — always reads live
  // from masterBrainStore, never a cached/duplicated copy.
  // -------------------------------------------------------------------
  const getBusinessContext = useCallback(
    (studentId: string): AiBusinessContext | null => {
      const student = getStudentById(studentId);
      if (!student) return null;
      const submission = getSubmissionForStudent(studentId);
      const document = getPublishedDocument(studentId);
      return extractBusinessContext(student, submission, document);
    },
    [getStudentById, getSubmissionForStudent, getPublishedDocument],
  );

  const getStudentBusinesses = useCallback(
    (studentId: string): { businessId: string; businessName: string }[] => {
      const ctx = getBusinessContext(studentId);
      if (!ctx) return [];
      // Future-ready for multiple businesses (spec section 5) — Master Brain
      // already carries a businessId per submission/document (Step 8), so
      // this naturally extends once a student can start a second one.
      return [{ businessId: ctx.businessId, businessName: ctx.businessName }];
    },
    [getBusinessContext],
  );

  // -------------------------------------------------------------------
  // Access control (spec sections 46-47)
  // -------------------------------------------------------------------
  const hasToolAccess = useCallback(
    (studentId: string, toolId: AiToolId): boolean => {
      const tool = state.tools.find((t) => t.id === toolId);
      if (!tool || tool.status !== "Active") return false;
      const student = students.find((s) => s.id === studentId);
      if (!student) return false;
      const manualGrant = state.manualGrants.some((g) => g.studentId === studentId && g.toolId === toolId);
      if (manualGrant) return true;
      const packageTools = state.packageAccess[student.package] ?? [];
      return packageTools.includes(toolId);
    },
    [state.tools, state.manualGrants, state.packageAccess, students],
  );

  // -------------------------------------------------------------------
  // Activity Log (spec section 57)
  // -------------------------------------------------------------------
  const logActivity = useCallback(
    (input: { studentId: string; businessId: string | null; action: AiActivityAction; toolId?: AiToolId | null; summary: string; masterBrainVersion?: number | null }) => {
      updateState((prev) => ({
        ...prev,
        activityLog: [
          {
            id: crypto.randomUUID(),
            studentId: input.studentId,
            businessId: input.businessId,
            action: input.action,
            toolId: input.toolId ?? null,
            promptVersionId: input.toolId ? (prev.promptVersions.find((p) => p.toolId === input.toolId && p.status === "Active")?.id ?? null) : null,
            providerId: prev.provider.id,
            masterBrainVersion: input.masterBrainVersion ?? null,
            summary: input.summary,
            occurredAt: nowIso(),
          },
          ...prev.activityLog,
        ],
      }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Generation (spec sections 9-29, 36-37, 39)
  // -------------------------------------------------------------------
  const generate = useCallback(
    (input: GenerateOutputInput): AiGeneration => {
      const ctx = getBusinessContext(input.studentId);
      const iso = nowIso();
      let created!: AiGeneration;

      updateState((prev) => {
        const tool = prev.tools.find((t) => t.id === input.toolId);
        const sameToolCount = prev.generations.filter((g) => g.studentId === input.studentId && g.toolId === input.toolId).length;

        let output;
        let status: AiGeneration["status"] = "Completed";
        let failureReason: string | null = null;

        if (!ctx) {
          status = "Failed";
          failureReason = "MASTER BRAIN NOT FOUND";
          output = { toolId: input.toolId, sections: [], flaggedClaims: [], simulated: true as const };
        } else if (!ctx.masterBrainPublished) {
          status = "Failed";
          failureReason = "MASTER BRAIN NOT PUBLISHED";
          output = { toolId: input.toolId, sections: [], flaggedClaims: [], simulated: true as const };
        } else if (!tool || tool.status !== "Active") {
          status = "Failed";
          failureReason = "TOOL NOT AVAILABLE";
          output = { toolId: input.toolId, sections: [], flaggedClaims: [], simulated: true as const };
        } else if (exceedsUsageLimit(prev, input.studentId, iso, students.find((s) => s.id === input.studentId)?.package)) {
          status = "Failed";
          failureReason = "USAGE LIMIT REACHED";
          output = { toolId: input.toolId, sections: [], flaggedClaims: [], simulated: true as const };
        } else {
          output = generateToolOutput(input.toolId, ctx, input.userInput, sameToolCount % 3);
        }

        created = {
          id: crypto.randomUUID(),
          generationId: generateGenerationId(prev.generations),
          studentId: input.studentId,
          businessId: input.businessId,
          projectId: input.projectId,
          toolId: input.toolId,
          masterBrainDocumentId: ctx?.masterBrainDocumentId ?? null,
          masterBrainVersion: ctx?.masterBrainVersion ?? null,
          userInput: input.userInput,
          output,
          status,
          failureReason,
          createdAt: iso,
          updatedAt: iso,
          favorited: false,
          archived: false,
          sourceGenerationId: input.sourceGenerationId ?? null,
        };

        return { ...prev, generations: [created, ...prev.generations] };
      });

      logActivity({
        studentId: input.studentId,
        businessId: input.businessId,
        action: created.status === "Completed" ? "Generation Completed" : "Generation Failed",
        toolId: input.toolId,
        summary: created.status === "Completed" ? `Generated output for ${input.toolId}` : `Generation failed: ${created.failureReason}`,
        masterBrainVersion: created.masterBrainVersion,
      });

      return created;
    },
    [getBusinessContext, updateState, logActivity, students],
  );

  const regenerate = useCallback(
    (generationId: string): AiGeneration | null => {
      const existing = state.generations.find((g) => g.id === generationId);
      if (!existing) return null;
      return generate({
        studentId: existing.studentId,
        businessId: existing.businessId,
        toolId: existing.toolId,
        projectId: existing.projectId,
        userInput: existing.userInput,
        sourceGenerationId: existing.sourceGenerationId,
      });
    },
    [state.generations, generate],
  );

  // -------------------------------------------------------------------
  // Projects (spec section 30)
  // -------------------------------------------------------------------
  const createProject = useCallback(
    (input: CreateProjectInput): AiProject => {
      let created!: AiProject;
      updateState((prev) => {
        const iso = nowIso();
        created = {
          id: crypto.randomUUID(),
          projectId: generateProjectId(prev.projects),
          studentId: input.studentId,
          businessId: input.businessId,
          name: input.name,
          type: input.type,
          masterBrainVersion: input.masterBrainVersion,
          createdAt: iso,
          updatedAt: iso,
        };
        return { ...prev, projects: [created, ...prev.projects] };
      });
      logActivity({ studentId: input.studentId, businessId: input.businessId, action: "Project Created", summary: `Created project: ${input.name}` });
      return created;
    },
    [updateState, logActivity],
  );

  const addOutputToProject = useCallback(
    (generationId: string, projectId: string | null) => {
      updateState((prev) => ({
        ...prev,
        generations: prev.generations.map((g) => (g.id === generationId ? { ...g, projectId, updatedAt: nowIso() } : g)),
        projects: projectId ? prev.projects.map((p) => (p.id === projectId ? { ...p, updatedAt: nowIso() } : p)) : prev.projects,
      }));
      const generation = state.generations.find((g) => g.id === generationId);
      if (generation) {
        logActivity({ studentId: generation.studentId, businessId: generation.businessId, action: "Output Saved", toolId: generation.toolId, summary: "Output added to project" });
      }
    },
    [updateState, state.generations, logActivity],
  );

  const toggleFavorite = useCallback(
    (generationId: string) => {
      updateState((prev) => ({ ...prev, generations: prev.generations.map((g) => (g.id === generationId ? { ...g, favorited: !g.favorited, updatedAt: nowIso() } : g)) }));
    },
    [updateState],
  );

  const archiveGeneration = useCallback(
    (generationId: string) => {
      updateState((prev) => ({ ...prev, generations: prev.generations.map((g) => (g.id === generationId ? { ...g, archived: true, updatedAt: nowIso() } : g)) }));
    },
    [updateState],
  );

  const editGenerationSection = useCallback(
    (generationId: string, sectionKey: string, content: string) => {
      updateState((prev) => ({
        ...prev,
        generations: prev.generations.map((g) =>
          g.id === generationId
            ? { ...g, updatedAt: nowIso(), output: { ...g.output, sections: g.output.sections.map((s) => (s.key === sectionKey ? { ...s, content } : s)) } }
            : g,
        ),
      }));
      const generation = state.generations.find((g) => g.id === generationId);
      if (generation) {
        logActivity({ studentId: generation.studentId, businessId: generation.businessId, action: "Output Edited", toolId: generation.toolId, summary: "Output section edited" });
      }
    },
    [updateState, state.generations, logActivity],
  );

  // -------------------------------------------------------------------
  // Admin: Tool Library (spec section 64)
  // -------------------------------------------------------------------
  const setToolStatus = useCallback(
    (toolId: AiToolId, status: AiToolStatus) => {
      updateState((prev) => ({ ...prev, tools: prev.tools.map((t) => (t.id === toolId ? { ...t, status } : t)) }));
    },
    [updateState],
  );

  const updateToolDefinition = useCallback(
    (toolId: AiToolId, patch: Partial<Pick<AiToolDefinition, "name" | "description" | "category" | "icon" | "displayOrder">>) => {
      updateState((prev) => ({ ...prev, tools: prev.tools.map((t) => (t.id === toolId ? { ...t, ...patch } : t)) }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Admin: Prompt Manager (spec sections 41-42) — never destroys history.
  // -------------------------------------------------------------------
  const savePromptVersion = useCallback(
    (toolId: AiToolId, input: UpdatePromptVersionInput): PromptVersion => {
      let created!: PromptVersion;
      updateState((prev) => {
        const existingForTool = prev.promptVersions.filter((p) => p.toolId === toolId);
        const nextVersion = Math.max(0, ...existingForTool.map((p) => p.version)) + 1;
        const iso = nowIso();
        created = {
          id: crypto.randomUUID(),
          toolId,
          version: nextVersion,
          systemInstruction: input.systemInstruction,
          toolObjective: input.toolObjective,
          requiredContext: input.requiredContext,
          outputStructure: input.outputStructure,
          guardrails: input.guardrails,
          status: "Active",
          createdAt: iso,
          updatedAt: iso,
          updatedBy: CURRENT_DEMO_USER,
          changeNotes: input.changeNotes,
        };
        return {
          ...prev,
          promptVersions: [created, ...prev.promptVersions.map((p) => (p.toolId === toolId && p.status === "Active" ? { ...p, status: "Archived" as PromptVersionStatus } : p))],
        };
      });
      return created;
    },
    [updateState],
  );

  const setPromptVersionStatus = useCallback(
    (id: string, status: PromptVersionStatus) => {
      updateState((prev) => ({ ...prev, promptVersions: prev.promptVersions.map((p) => (p.id === id ? { ...p, status, updatedAt: nowIso() } : p)) }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Admin: Access Matrix + Usage + Provider
  // -------------------------------------------------------------------
  const setPackageAccess = useCallback(
    (pkg: PackageType, toolIds: AiToolId[]) => {
      updateState((prev) => ({ ...prev, packageAccess: { ...prev.packageAccess, [pkg]: toolIds } }));
    },
    [updateState],
  );

  const addManualGrant = useCallback(
    (studentId: string, toolId: AiToolId, reason: string) => {
      updateState((prev) => ({
        ...prev,
        manualGrants: [{ id: crypto.randomUUID(), studentId, toolId, grantedBy: CURRENT_DEMO_USER, grantedAt: nowIso(), reason }, ...prev.manualGrants],
      }));
    },
    [updateState],
  );

  const removeManualGrant = useCallback(
    (id: string) => {
      updateState((prev) => ({ ...prev, manualGrants: prev.manualGrants.filter((g) => g.id !== id) }));
    },
    [updateState],
  );

  const setUsageSettings = useCallback(
    (patch: Partial<AiUsageSettings>) => {
      updateState((prev) => ({ ...prev, usageSettings: { ...prev.usageSettings, ...patch } }));
    },
    [updateState],
  );

  const setProviderConfig = useCallback(
    (patch: Partial<Pick<AiProvider, "connectionStatus" | "selectedModel" | "status">>) => {
      updateState((prev) => ({ ...prev, provider: { ...prev.provider, ...patch, lastHealthCheck: nowIso() } }));
    },
    [updateState],
  );

  const value = useMemo<AiToolsStoreValue>(
    () => ({
      tools: state.tools,
      promptVersions: state.promptVersions,
      provider: state.provider,
      packageAccess: state.packageAccess,
      manualGrants: state.manualGrants,
      usageSettings: state.usageSettings,
      projects: state.projects,
      generations: state.generations,
      activityLog: state.activityLog,
      workflowRecipes: DEMO_WORKFLOW_RECIPES,
      getToolById,
      hasToolAccess,
      getBusinessContext,
      getStudentBusinesses,
      logActivity,
      generate,
      regenerate,
      createProject,
      addOutputToProject,
      toggleFavorite,
      archiveGeneration,
      editGenerationSection,
      setToolStatus,
      updateToolDefinition,
      savePromptVersion,
      setPromptVersionStatus,
      setPackageAccess,
      addManualGrant,
      removeManualGrant,
      setUsageSettings,
      setProviderConfig,
    }),
    [
      state,
      getToolById,
      hasToolAccess,
      getBusinessContext,
      getStudentBusinesses,
      logActivity,
      generate,
      regenerate,
      createProject,
      addOutputToProject,
      toggleFavorite,
      archiveGeneration,
      editGenerationSection,
      setToolStatus,
      updateToolDefinition,
      savePromptVersion,
      setPromptVersionStatus,
      setPackageAccess,
      addManualGrant,
      removeManualGrant,
      setUsageSettings,
      setProviderConfig,
    ],
  );

  return <AiToolsStoreContext.Provider value={value}>{children}</AiToolsStoreContext.Provider>;
}

export function useAiToolsStore() {
  const ctx = useContext(AiToolsStoreContext);
  if (!ctx) throw new Error("useAiToolsStore must be used within an AiToolsStoreProvider");
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AiSkillsCatalog } from "@/types/aiSkills";
import { AI_SKILLS_CATALOG_URL, AI_SKILLS_DRAFT_STORAGE_KEY, DEFAULT_AI_SKILLS_CATALOG } from "@/data/aiSkillsConfig";
import { normalizeCatalog } from "@/utils/aiSkills";

// ---------------------------------------------------------------------------
// AI SKILLS CATALOG STORE
// ---------------------------------------------------------------------------
// PUBLISHED catalog: fetched from AI_SKILLS_CATALOG_URL — the same file for
// every visitor. This is what the live funnel shows.
//
// DRAFT catalog: the admin's working copy in the Funnel Manager, kept in
// THIS browser's localStorage only. Visitors never see a draft. The admin
// previews it with ?preview=draft, then publishes by exporting the JSON and
// replacing the published file (see AI_SKILLS_FUNNEL_SETUP.md).
// ---------------------------------------------------------------------------

const PREVIEW_SESSION_KEY = "maia.aiSkills.previewDraft";

interface AiSkillsStore {
  published: AiSkillsCatalog;
  loading: boolean;
  loadError: string | null;
  draft: AiSkillsCatalog;
  hasSavedDraft: boolean;
  updateDraft: (fn: (current: AiSkillsCatalog) => AiSkillsCatalog) => void;
  replaceDraft: (catalog: AiSkillsCatalog) => void;
  discardDraft: () => void;
  previewingDraft: boolean;
  setPreviewingDraft: (value: boolean) => void;
}

const Ctx = createContext<AiSkillsStore | null>(null);

function readDraft(): AiSkillsCatalog | null {
  try {
    const raw = localStorage.getItem(AI_SKILLS_DRAFT_STORAGE_KEY);
    return raw ? normalizeCatalog(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function readPreviewFlag(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("preview") === "draft") {
      sessionStorage.setItem(PREVIEW_SESSION_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(PREVIEW_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function AiSkillsStoreProvider({ children }: { children: ReactNode }) {
  const [published, setPublished] = useState<AiSkillsCatalog>(DEFAULT_AI_SKILLS_CATALOG);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<AiSkillsCatalog | null>(readDraft);
  const [previewingDraft, setPreviewState] = useState<boolean>(readPreviewFlag);

  useEffect(() => {
    let cancelled = false;
    fetch(AI_SKILLS_CATALOG_URL, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setPublished(normalizeCatalog(json));
      })
      .catch((err: unknown) => {
        // Fall back to the catalog bundled into the app — the page still works.
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load catalog");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: AiSkillsCatalog | null) => {
    setSavedDraft(next);
    try {
      if (next) localStorage.setItem(AI_SKILLS_DRAFT_STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(AI_SKILLS_DRAFT_STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode) — the draft still lives in memory.
    }
  }, []);

  const draft = savedDraft ?? published;

  const updateDraft = useCallback(
    (fn: (current: AiSkillsCatalog) => AiSkillsCatalog) => {
      const next = fn(savedDraft ?? published);
      persist({ ...next, updatedAt: new Date().toISOString() });
    },
    [savedDraft, published, persist],
  );

  const setPreviewingDraft = useCallback((value: boolean) => {
    setPreviewState(value);
    try {
      if (value) sessionStorage.setItem(PREVIEW_SESSION_KEY, "1");
      else sessionStorage.removeItem(PREVIEW_SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<AiSkillsStore>(
    () => ({
      published,
      loading,
      loadError,
      draft,
      hasSavedDraft: savedDraft !== null,
      updateDraft,
      replaceDraft: (c) => persist({ ...c, updatedAt: new Date().toISOString() }),
      discardDraft: () => persist(null),
      previewingDraft,
      setPreviewingDraft,
    }),
    [published, loading, loadError, draft, savedDraft, updateDraft, persist, previewingDraft, setPreviewingDraft],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAiSkillsStore(): AiSkillsStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAiSkillsStore must be used inside AiSkillsStoreProvider");
  return ctx;
}

/** The catalog the public funnel renders: published, or the admin's draft in preview mode. */
export function useFunnelCatalog(): { catalog: AiSkillsCatalog; loading: boolean; previewingDraft: boolean } {
  const { published, draft, loading, previewingDraft, hasSavedDraft } = useAiSkillsStore();
  const usingDraft = previewingDraft && hasSavedDraft;
  return { catalog: usingDraft ? draft : published, loading: usingDraft ? false : loading, previewingDraft: usingDraft };
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Tabs } from "@/components/common/Tabs";
import { AiOutputView } from "@/components/aiTools/AiOutputView";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { formatDateTime } from "@/utils/students";
import type { AiGeneration } from "@/types/aiTools";

type TabValue = "recent" | "saved" | "favorites" | "history";

export function Workspace() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();
  const { generations, tools, toggleFavorite } = useAiToolsStore();
  const [tab, setTab] = useState<TabValue>("recent");
  const [expanded, setExpanded] = useState<string | null>(null);

  const mine = useMemo(
    () => generations.filter((g) => g.studentId === student.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [generations, student.id],
  );

  const lists: Record<TabValue, AiGeneration[]> = {
    recent: mine.slice(0, 10),
    saved: mine.filter((g) => g.projectId),
    favorites: mine.filter((g) => g.favorited),
    history: mine,
  };

  const list = lists[tab];

  function toolName(g: AiGeneration) {
    return tools.find((t) => t.id === g.toolId)?.name ?? g.toolId;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-bold text-maia-ink">My AI Workspace</h1>
        <p className="text-sm text-maia-ink-soft">Recent projects, saved outputs, favorites, and your generation history.</p>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-3 sm:px-6">
          <Tabs
            tabs={[
              { value: "recent", label: "Recent" },
              { value: "saved", label: "Saved Outputs" },
              { value: "favorites", label: "Favorites" },
              { value: "history", label: "Generation History" },
            ]}
            active={tab}
            onChange={(v) => setTab(v as TabValue)}
          />
        </div>
        <div className="flex flex-col gap-2 p-5 sm:p-6">
          {list.length === 0 && <p className="py-6 text-center text-sm text-maia-ink-soft">Nothing here yet — open a tool to get started.</p>}
          {list.map((g) => (
            <div key={g.id} className="rounded-xl border border-maia-border">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                onKeyDown={(e) => e.key === "Enter" && setExpanded(expanded === g.id ? null : g.id)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-maia-ink">{toolName(g)}</p>
                    <Badge tone={g.status === "Completed" ? "success" : "danger"}>{g.status}</Badge>
                    {g.favorited && <Heart size={12} className="fill-maia-danger text-maia-danger" />}
                  </div>
                  <p className="mt-0.5 text-xs text-maia-ink-soft">
                    {g.generationId} · {formatDateTime(g.createdAt)} {g.masterBrainVersion ? `· Master Brain v${g.masterBrainVersion}` : ""}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(g.id);
                    }}
                  >
                    <Heart size={16} className={g.favorited ? "fill-maia-danger text-maia-danger" : "text-maia-ink-soft"} />
                  </button>
                  {expanded === g.id ? <ChevronUp size={16} className="text-maia-ink-soft" /> : <ChevronDown size={16} className="text-maia-ink-soft" />}
                </div>
              </div>
              {expanded === g.id && (
                <div className="border-t border-maia-border p-4">
                  {g.status === "Completed" ? (
                    <AiOutputView output={g.output} />
                  ) : (
                    <p className="text-sm text-maia-ink-soft">{g.failureReason}</p>
                  )}
                  <button onClick={() => navigate(`/portal/ai-tools/tools/${g.toolId}`)} className="mt-3 text-xs font-semibold text-maia-gold-deep hover:underline">
                    Open {toolName(g)} again →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

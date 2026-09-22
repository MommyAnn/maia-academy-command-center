import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, FolderKanban, LayoutGrid } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { ToolIcon } from "@/components/aiTools/ToolIcon";
import { MasterBrainConnectionCard } from "@/components/aiTools/MasterBrainConnectionCard";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { AI_TOOL_CATEGORIES } from "@/types/aiTools";
import { AI_GOAL_OPTIONS } from "@/data/aiToolsConfig";

export function Hub() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();
  const { tools, getBusinessContext, hasToolAccess } = useAiToolsStore();

  const ctx = useMemo(() => getBusinessContext(student.id), [getBusinessContext, student.id]);

  const toolsByCategory = useMemo(() => {
    const map = new Map<string, typeof tools>();
    for (const category of AI_TOOL_CATEGORIES) {
      const list = tools.filter((t) => t.category === category).sort((a, b) => a.displayOrder - b.displayOrder);
      if (list.length) map.set(category, list);
    }
    return map;
  }, [tools]);

  function openTool(toolId: string) {
    navigate(`/portal/ai-tools/tools/${toolId}`);
  }

  function startGoal(recommendedToolIds: string[]) {
    if (recommendedToolIds[0]) openTool(recommendedToolIds[0]);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-maia-black/10 bg-maia-black px-6 py-7 text-center sm:px-10">
        <p className="font-display text-[13px] font-bold uppercase tracking-[0.25em] text-maia-gold">M.A.I.A.</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">AI BUSINESS TOOLS</h1>
        <p className="mx-auto mt-2 max-w-lg text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
          Your Business Intelligence — Powered By Your Brand Master Brain
        </p>
      </div>

      <MasterBrainConnectionCard ctx={ctx} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card
          className="cursor-pointer transition-colors hover:border-maia-gold"
          onClick={() => navigate("/portal/ai-tools/workspace")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-maia-gold-bg text-maia-gold-deep">
              <LayoutGrid size={18} strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-maia-ink">MY AI WORKSPACE</p>
              <p className="text-xs text-maia-ink-soft">Recent projects, saved outputs, favorites, history.</p>
            </div>
          </div>
        </Card>
        <Card
          className="cursor-pointer transition-colors hover:border-maia-gold"
          onClick={() => navigate("/portal/ai-tools/projects")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-maia-gold-bg text-maia-gold-deep">
              <FolderKanban size={18} strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-maia-ink">MY AI PROJECTS</p>
              <p className="text-xs text-maia-ink-soft">Group related outputs — campaigns, launches, content sprints.</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="What Do You Want To Do Today?" subtitle="Pick a goal and we'll recommend the right tool." />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {AI_GOAL_OPTIONS.map((goal) => (
            <button
              key={goal.id}
              onClick={() => startGoal(goal.recommendedToolIds)}
              className="rounded-xl border border-maia-border px-3 py-3 text-left text-xs font-semibold text-maia-ink transition-colors hover:border-maia-gold hover:bg-maia-gold-bg/40"
            >
              {goal.label}
            </button>
          ))}
        </div>
      </Card>

      {Array.from(toolsByCategory.entries()).map(([category, list]) => (
        <Card key={category}>
          <CardHeader title={category} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((tool) => {
              const access = hasToolAccess(student.id, tool.id);
              const comingSoon = tool.status === "Coming Soon";
              const disabled = comingSoon || tool.status === "Inactive" || !access;
              return (
                <button
                  key={tool.id}
                  disabled={disabled}
                  onClick={() => openTool(tool.id)}
                  className="flex flex-col gap-2 rounded-xl border border-maia-border p-4 text-left transition-colors hover:border-maia-gold hover:bg-maia-gold-bg/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-maia-border disabled:hover:bg-transparent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-maia-gold-bg text-maia-gold-deep">
                      <ToolIcon name={tool.icon} size={17} />
                    </div>
                    {comingSoon && <Badge tone="neutral">Coming Soon</Badge>}
                    {!comingSoon && !access && <Lock size={14} className="text-maia-ink-soft" />}
                  </div>
                  <p className="font-display text-[13px] font-bold text-maia-ink">{tool.name}</p>
                  <p className="text-xs text-maia-ink-soft">{tool.description}</p>
                  {!comingSoon && !access && <p className="text-[11px] font-semibold text-maia-warning">Not included in your package</p>}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

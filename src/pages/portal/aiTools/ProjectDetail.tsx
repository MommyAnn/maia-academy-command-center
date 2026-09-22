import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { AiOutputView } from "@/components/aiTools/AiOutputView";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { formatDateTime } from "@/utils/students";

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { student } = useStudentPortal();
  const { projects, generations, tools } = useAiToolsStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const project = projects.find((p) => p.id === projectId && p.studentId === student.id);
  const outputs = generations.filter((g) => g.projectId === projectId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (!project) {
    return (
      <Card>
        <p className="text-sm text-maia-ink-soft">Project not found.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate("/portal/ai-tools/projects")} className="flex items-center gap-1.5 text-xs font-semibold text-maia-ink-soft hover:text-maia-ink">
        <ArrowLeft size={14} />
        Back to Projects
      </button>

      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-maia-ink">{project.name}</h1>
          <p className="text-sm text-maia-ink-soft">
            {project.projectId} · Created {formatDateTime(project.createdAt)}
            {project.masterBrainVersion ? ` · Master Brain v${project.masterBrainVersion} at creation` : ""}
          </p>
        </div>
        <Badge tone="gold">{project.type}</Badge>
      </div>

      <Card>
        <CardHeader title="Related AI Outputs" subtitle="Each output keeps the Master Brain version it was generated from, even if you republish later." />
        {outputs.length === 0 ? (
          <p className="py-4 text-sm text-maia-ink-soft">No outputs added to this project yet — use &ldquo;Add To Project&rdquo; from any tool&rsquo;s output.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {outputs.map((g) => {
              const toolName = tools.find((t) => t.id === g.toolId)?.name ?? g.toolId;
              return (
                <div key={g.id} className="rounded-xl border border-maia-border">
                  <button onClick={() => setExpanded(expanded === g.id ? null : g.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                    <div>
                      <p className="text-sm font-semibold text-maia-ink">{toolName}</p>
                      <p className="text-xs text-maia-ink-soft">
                        {g.generationId} · {formatDateTime(g.createdAt)} · Master Brain v{g.masterBrainVersion}
                      </p>
                    </div>
                    {expanded === g.id ? <ChevronUp size={16} className="text-maia-ink-soft" /> : <ChevronDown size={16} className="text-maia-ink-soft" />}
                  </button>
                  {expanded === g.id && (
                    <div className="border-t border-maia-border p-4">
                      <AiOutputView output={g.output} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

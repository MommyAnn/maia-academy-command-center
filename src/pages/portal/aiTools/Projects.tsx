import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { Modal } from "@/components/common/Modal";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { AI_PROJECT_TYPES, type AiProjectType } from "@/types/aiTools";
import { formatDateTime } from "@/utils/students";

export function Projects() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();
  const { projects, generations, getBusinessContext, createProject } = useAiToolsStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AiProjectType>("Campaign");

  const ctx = getBusinessContext(student.id);
  const mine = projects.filter((p) => p.studentId === student.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  function handleCreate() {
    if (!ctx || !name.trim()) return;
    const project = createProject({ studentId: student.id, businessId: ctx.businessId, name: name.trim(), type, masterBrainVersion: ctx.masterBrainVersion });
    setOpen(false);
    setName("");
    navigate(`/portal/ai-tools/projects/${project.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-maia-ink">My AI Projects</h1>
          <p className="text-sm text-maia-ink-soft">Group related AI outputs — a campaign, a launch, a content sprint.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} disabled={!ctx}>
          <Plus size={14} />
          New Project
        </Button>
      </div>

      <Card>
        <CardHeader title="Projects" />
        {mine.length === 0 ? (
          <p className="py-6 text-center text-sm text-maia-ink-soft">No projects yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {mine.map((p) => {
              const count = generations.filter((g) => g.projectId === p.id).length;
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/portal/ai-tools/projects/${p.id}`)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-maia-border px-4 py-3 text-left transition-colors hover:border-maia-gold"
                >
                  <div>
                    <p className="text-sm font-semibold text-maia-ink">{p.name}</p>
                    <p className="text-xs text-maia-ink-soft">
                      {p.projectId} · Created {formatDateTime(p.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="gold">{p.type}</Badge>
                    <Badge tone="neutral">{count} output{count === 1 ? "" : "s"}</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New AI Project">
        <div className="flex flex-col gap-4">
          <TextField label="Project Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 11.11 Campaign" />
          <SelectField label="Project Type" value={type} onChange={(e) => setType(e.target.value as AiProjectType)} options={AI_PROJECT_TYPES.map((t) => ({ value: t, label: t }))} />
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create Project
          </Button>
        </div>
      </Modal>
    </div>
  );
}

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { SelectField } from "@/components/common/SelectField";
import { ToolIcon } from "@/components/aiTools/ToolIcon";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { AI_TOOL_CATEGORIES, AI_TOOL_STATUSES, type AiToolDefinition, type AiToolStatus } from "@/types/aiTools";

const STATUS_TONE: Record<AiToolStatus, "success" | "neutral" | "warning"> = {
  Active: "success",
  Inactive: "neutral",
  "Coming Soon": "warning",
};

export function ToolLibrary() {
  const { tools, setToolStatus, updateToolDefinition } = useAiToolsStore();
  const [editing, setEditing] = useState<AiToolDefinition | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", category: "Strategy" as AiToolDefinition["category"], displayOrder: 1 });

  function openEdit(tool: AiToolDefinition) {
    setEditing(tool);
    setDraft({ name: tool.name, description: tool.description, category: tool.category, displayOrder: tool.displayOrder });
  }

  function saveEdit() {
    if (!editing) return;
    updateToolDefinition(editing.id, draft);
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-bold text-maia-ink">Tool Library</h1>
        <p className="text-sm text-maia-ink-soft">Activate, deactivate, or mark tools as Coming Soon — students only see what you enable.</p>
      </div>

      <Card padded={false}>
        <div className="divide-y divide-maia-border">
          {[...tools].sort((a, b) => a.displayOrder - b.displayOrder).map((tool) => (
            <div key={tool.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-maia-gold-bg text-maia-gold-deep">
                  <ToolIcon name={tool.icon} size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-maia-ink">{tool.name}</p>
                  <p className="truncate text-xs text-maia-ink-soft">
                    {tool.category} · Order {tool.displayOrder}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <Badge tone={STATUS_TONE[tool.status]}>{tool.status}</Badge>
                <select
                  value={tool.status}
                  onChange={(e) => setToolStatus(tool.id, e.target.value as AiToolStatus)}
                  className="rounded-lg border border-maia-border bg-maia-surface px-2 py-1.5 text-xs text-maia-ink outline-none focus:border-maia-gold"
                >
                  {AI_TOOL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button onClick={() => openEdit(tool)} className="rounded-lg p-1.5 text-maia-ink-soft hover:bg-maia-bg hover:text-maia-ink">
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ""}`}>
        <div className="flex flex-col gap-4">
          <TextField label="Name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <TextAreaField label="Description" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          <SelectField
            label="Category"
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as AiToolDefinition["category"] }))}
            options={AI_TOOL_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <TextField label="Display Order" type="number" value={draft.displayOrder} onChange={(e) => setDraft((d) => ({ ...d, displayOrder: Number(e.target.value) }))} />
          <Button onClick={saveEdit}>Save Changes</Button>
        </div>
      </Modal>

      <Card>
        <CardHeader title="A Note On This Tool Library" />
        <p className="text-sm text-maia-ink-soft">
          All 18 tools share the same M.A.I.A. Business Intelligence context (your students&rsquo; Published Master Brains) —
          they are specialized experts, not unrelated chatbots. See Prompt Manager for each tool&rsquo;s instructions and
          AI Connections for provider status.
        </p>
      </Card>
    </div>
  );
}

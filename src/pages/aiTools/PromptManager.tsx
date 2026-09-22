import { useState } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SelectField } from "@/components/common/SelectField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { useAiToolsStore } from "@/data/aiToolsStore";
import type { PromptVersionStatus } from "@/types/aiTools";
import { formatDateTime } from "@/utils/students";

const STATUS_TONE: Record<PromptVersionStatus, "success" | "warning" | "neutral"> = {
  Active: "success",
  Draft: "warning",
  Archived: "neutral",
};

export function PromptManager() {
  const { tools, promptVersions, savePromptVersion, setPromptVersionStatus } = useAiToolsStore();
  const [selectedTool, setSelectedTool] = useState<string>(tools[0]?.id ?? "");
  const [changeNotes, setChangeNotes] = useState("");

  const versions = promptVersions.filter((p) => p.toolId === selectedTool).sort((a, b) => b.version - a.version);
  const active = versions.find((v) => v.status === "Active");
  const [draft, setDraft] = useState(active?.systemInstruction ?? "");

  function handleTool(toolId: string) {
    setSelectedTool(toolId);
    const newActive = promptVersions.find((p) => p.toolId === toolId && p.status === "Active");
    setDraft(newActive?.systemInstruction ?? "");
    setChangeNotes("");
  }

  function saveNewVersion() {
    if (!active) return;
    savePromptVersion(selectedTool as typeof active.toolId, {
      systemInstruction: draft,
      toolObjective: active.toolObjective,
      requiredContext: active.requiredContext,
      outputStructure: active.outputStructure,
      guardrails: active.guardrails,
      changeNotes: changeNotes || "Updated system instruction.",
    });
    setChangeNotes("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-bold text-maia-ink">Prompt / Instruction Manager</h1>
        <p className="text-sm text-maia-ink-soft">Internal only — students never see these instructions. Old versions are archived, never destroyed.</p>
      </div>

      <SelectField label="Tool" value={selectedTool} onChange={(e) => handleTool(e.target.value)} options={tools.map((t) => ({ value: t.id, label: t.name }))} />

      {active && (
        <Card>
          <CardHeader title="Active Prompt" subtitle={`Version ${active.version} · Updated ${formatDateTime(active.updatedAt)} by ${active.updatedBy}`} />
          <div className="flex flex-col gap-3 text-sm text-maia-ink">
            <p>
              <span className="font-semibold">Objective:</span> {active.toolObjective}
            </p>
            <p>
              <span className="font-semibold">Required Context:</span> {active.requiredContext.join(", ")}
            </p>
            <p>
              <span className="font-semibold">Guardrails:</span> {active.guardrails}
            </p>
            <TextAreaField label="System Instruction" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <TextAreaField label="Change Notes" rows={2} value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)} placeholder="What changed and why?" />
            <Button size="sm" className="self-start" onClick={saveNewVersion} disabled={draft === active.systemInstruction}>
              Save As New Version
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Version History" />
        <div className="flex flex-col gap-2">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-maia-border px-4 py-2.5">
              <div>
                <p className="text-sm font-semibold text-maia-ink">
                  v{v.version} <Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge>
                </p>
                <p className="text-xs text-maia-ink-soft">
                  {formatDateTime(v.updatedAt)} · {v.changeNotes}
                </p>
              </div>
              {v.status === "Draft" && (
                <Button size="sm" variant="secondary" onClick={() => setPromptVersionStatus(v.id, "Active")}>
                  Activate
                </Button>
              )}
              {v.status === "Active" && v.version > 1 && (
                <Button size="sm" variant="ghost" onClick={() => setPromptVersionStatus(v.id, "Archived")}>
                  Archive
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

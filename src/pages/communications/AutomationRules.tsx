import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { FilterSelect } from "@/components/common/FilterSelect";
import { ChipMultiSelect } from "@/components/common/ChipMultiSelect";
import { RepeatableCardList } from "@/components/portal/masterBrainSteps/RepeatableCardList";
import { useCommunicationsStore } from "@/data/communicationsStore";
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_CATEGORIES,
  AUTOMATION_RULE_STATUSES,
  COMMUNICATION_CHANNELS,
  STOP_CONDITION_PRESETS,
} from "@/types/communications";
import type { AutomationAction, AutomationCategory, AutomationRule, AutomationRuleStatus, CreateAutomationRuleInput } from "@/types/communications";
import { GHL_EVENT_TYPES } from "@/integrations/ghlEvents";
import type { GhlEventType } from "@/integrations/ghlEvents";

function blankAction(): Omit<AutomationAction, "id"> {
  return { type: "Sync to GHL", targetLabel: "", channel: null, templateId: null, delayMinutes: 0 };
}

function blankForm(): CreateAutomationRuleInput {
  return {
    name: "",
    category: "General",
    triggerEvent: GHL_EVENT_TYPES[0],
    conditions: [],
    actions: [blankAction()],
    stopConditions: [],
  };
}

const STATUS_TONE: Record<AutomationRuleStatus, "success" | "warning" | "neutral" | "danger"> = {
  Active: "success",
  Paused: "warning",
  Draft: "neutral",
  Archived: "danger",
};

export function AutomationRules() {
  const { automationRules, templates, createAutomationRule, updateAutomationRule, setAutomationRuleStatus } = useCommunicationsStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = (searchParams.get("category") as AutomationCategory | null) ?? "all";
  const [statusFilter, setStatusFilter] = useState<"all" | AutomationRuleStatus>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState<CreateAutomationRuleInput>(blankForm());
  const [conditionsText, setConditionsText] = useState("");

  function patch(p: Partial<CreateAutomationRuleInput>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setConditionsText("");
    setModalOpen(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditing(rule);
    setForm({
      name: rule.name,
      category: rule.category,
      triggerEvent: rule.triggerEvent,
      conditions: rule.conditions,
      actions: rule.actions,
      stopConditions: rule.stopConditions,
    });
    setConditionsText(rule.conditions.join("\n"));
    setModalOpen(true);
  }

  function save(activate: boolean) {
    if (!form.name.trim()) return;
    const input: CreateAutomationRuleInput = { ...form, conditions: conditionsText.split("\n").map((c) => c.trim()).filter(Boolean) };
    if (editing) {
      updateAutomationRule(editing.id, input);
      if (activate) setAutomationRuleStatus(editing.id, "Active");
    } else {
      const created = createAutomationRule(input);
      if (activate) setAutomationRuleStatus(created.id, "Active");
    }
    setModalOpen(false);
  }

  const rows = automationRules
    .filter((r) => categoryFilter === "all" || r.category === categoryFilter)
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Automation Rules</h2>
          <p className="text-sm text-maia-ink-soft">{rows.length} rule(s). Never a GHL Workflow Builder replacement — M.A.I.A.-specific business rules only.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} />
          NEW RULE
        </Button>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <FilterSelect
          value={categoryFilter}
          onChange={(v) => {
            const next = new URLSearchParams(searchParams);
            if (v === "all") next.delete("category");
            else next.set("category", v);
            setSearchParams(next);
          }}
          options={[{ value: "all", label: "All Categories" }, ...AUTOMATION_CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as "all" | AutomationRuleStatus)} options={[{ value: "all", label: "Any Status" }, ...AUTOMATION_RULE_STATUSES.map((s) => ({ value: s, label: s }))]} />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Rule ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Triggered</th>
                <th className="px-4 py-3">Success / Failed</th>
                <th className="px-4 py-3">Last Triggered</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{r.ruleId}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{r.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.category}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{r.triggerEvent}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.totalTriggered}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                    {r.successful} / <span className={r.failed > 0 ? "text-maia-danger" : ""}>{r.failed}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.lastTriggeredAt ? new Date(r.lastTriggeredAt).toLocaleString("en-PH") : "Never"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>
                        EDIT
                      </Button>
                      {r.status === "Active" ? (
                        <Button size="sm" variant="secondary" onClick={() => setAutomationRuleStatus(r.id, "Paused")}>
                          PAUSE
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setAutomationRuleStatus(r.id, "Active")}>
                          ACTIVATE
                        </Button>
                      )}
                      {r.status !== "Archived" && (
                        <Button size="sm" variant="secondary" onClick={() => setAutomationRuleStatus(r.id, "Archived")}>
                          ARCHIVE
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No automation rules match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Automation Rule" : "New Automation Rule"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              CANCEL
            </Button>
            <Button variant="secondary" onClick={() => save(false)} disabled={!form.name.trim()}>
              SAVE AS DRAFT
            </Button>
            <Button onClick={() => save(true)} disabled={!form.name.trim()}>
              SAVE &amp; ACTIVATE
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Rule Name" required value={form.name} onChange={(e) => patch({ name: e.target.value })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField label="Category" value={form.category} onChange={(e) => patch({ category: e.target.value as AutomationCategory })} options={AUTOMATION_CATEGORIES.map((c) => ({ value: c, label: c }))} />
            <SelectField
              label="WHEN THIS HAPPENS (Trigger)"
              value={form.triggerEvent}
              onChange={(e) => patch({ triggerEvent: e.target.value as GhlEventType })}
              options={GHL_EVENT_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>

          <TextAreaField
            label="IF THESE CONDITIONS MATCH (one per line — informational; only consent/DND is actually enforced in code)"
            rows={2}
            value={conditionsText}
            onChange={(e) => setConditionsText(e.target.value)}
            placeholder="e.g. Communication consent valid"
          />

          <div>
            <p className="mb-2 text-sm font-semibold text-maia-ink">DO THESE ACTIONS</p>
            <RepeatableCardList
              items={form.actions}
              onAdd={() => patch({ actions: [...form.actions, blankAction()] })}
              onRemove={(idx) => patch({ actions: form.actions.filter((_, i) => i !== idx) })}
              onItemChange={(idx, p) => patch({ actions: form.actions.map((a, i) => (i === idx ? { ...a, ...p } : a)) })}
              addLabel="ADD ACTION"
              emptyLabel="No actions yet."
              itemLabel={(a, i) => `${i + 1}. ${a.type}`}
              renderItem={(a, update) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SelectField label="Action Type" value={a.type} onChange={(e) => update({ type: e.target.value as AutomationAction["type"] })} options={AUTOMATION_ACTION_TYPES.map((t) => ({ value: t, label: t }))} />
                  <TextField label="Delay (minutes)" type="number" value={String(a.delayMinutes)} onChange={(e) => update({ delayMinutes: Number(e.target.value) || 0 })} />
                  {(a.type === "Apply Tag" || a.type === "Remove Tag" || a.type === "Start GHL Workflow") && (
                    <TextField label={a.type === "Start GHL Workflow" ? "Workflow Name" : "Tag Name"} value={a.targetLabel} onChange={(e) => update({ targetLabel: e.target.value })} />
                  )}
                  {a.type === "Send Communication" && (
                    <>
                      <SelectField label="Channel" value={a.channel ?? ""} onChange={(e) => update({ channel: (e.target.value || null) as AutomationAction["channel"] })} options={[{ value: "", label: "Select channel" }, ...COMMUNICATION_CHANNELS.map((c) => ({ value: c, label: c }))]} />
                      <SelectField
                        label="Template (optional)"
                        value={a.templateId ?? ""}
                        onChange={(e) => update({ templateId: e.target.value || null })}
                        options={[{ value: "", label: "No template — use event summary" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]}
                      />
                    </>
                  )}
                </div>
              )}
            />
          </div>

          <ChipMultiSelect label="STOP WHEN" hint="Any matching condition stops this rule from firing." options={STOP_CONDITION_PRESETS} value={form.stopConditions} onChange={(v) => patch({ stopConditions: v })} />
        </div>
      </Modal>
    </div>
  );
}

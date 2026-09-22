import { useState } from "react";
import { AlertTriangle, Eye, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { FilterSelect } from "@/components/common/FilterSelect";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { useWebinarStore } from "@/data/webinarStore";
import { useStudentStore } from "@/data/studentStore";
import { MESSAGE_TEMPLATE_CATEGORIES, PERSONALIZATION_VARIABLES, TEMPLATE_CHANNELS } from "@/types/communications";
import type { CreateMessageTemplateInput, MessageTemplate, MessageTemplateCategory, MessageTemplateStatus, TemplateChannel } from "@/types/communications";
import { resolveTemplateVariables } from "@/utils/communications";

function blankForm(): CreateMessageTemplateInput {
  return { name: "", category: "General", channel: "Email", subject: "", message: "" };
}

const STATUS_TONE: Record<MessageTemplateStatus, "success" | "neutral" | "warning"> = { Active: "success", Draft: "neutral", Archived: "warning" };

export function Templates() {
  const { templates, createTemplate, updateTemplate, setTemplateStatus, buildVariableContext } = useCommunicationsStore();
  const { leads } = useWebinarStore();
  const { students } = useStudentStore();

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState<CreateMessageTemplateInput>(blankForm());

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [previewPersonKey, setPreviewPersonKey] = useState("");

  function patch(p: Partial<CreateMessageTemplateInput>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setModalOpen(true);
  }

  function openEdit(t: MessageTemplate) {
    setEditing(t);
    setForm({ name: t.name, category: t.category, channel: t.channel, subject: t.subject, message: t.message });
    setModalOpen(true);
  }

  function save() {
    if (!form.name.trim() || !form.message.trim()) return;
    if (editing) updateTemplate(editing.id, form);
    else createTemplate(form);
    setModalOpen(false);
  }

  function openPreview(t: MessageTemplate) {
    setPreviewTemplate(t);
    setPreviewPersonKey(leads[0] ? `Lead:${leads[0].id}` : students[0] ? `Student:${students[0].id}` : "");
    setPreviewOpen(true);
  }

  const rows = templates.filter((t) => categoryFilter === "all" || t.category === categoryFilter).sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));

  const [previewType, previewId] = previewPersonKey.split(":");
  const previewVars = previewTemplate && previewType && previewId ? buildVariableContext(previewType as "Lead" | "Student", previewId) : {};
  const previewSubject = previewTemplate ? resolveTemplateVariables(previewTemplate.subject, previewVars) : { resolved: "", missing: [] };
  const previewMessage = previewTemplate ? resolveTemplateVariables(previewTemplate.message, previewVars) : { resolved: "", missing: [] };
  const missingVariables = Array.from(new Set([...previewSubject.missing, ...previewMessage.missing]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Message Templates</h2>
          <p className="text-sm text-maia-ink-soft">{rows.length} template(s). Only approved personalization variables may be used.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} />
          NEW TEMPLATE
        </Button>
      </div>

      <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={[{ value: "all", label: "All Categories" }, ...MESSAGE_TEMPLATE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((t) => (
          <Card key={t.id} className="flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs text-maia-ink-soft">{t.templateId}</p>
                <p className="text-sm font-bold text-maia-ink">{t.name}</p>
              </div>
              <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="gold">{t.category}</Badge>
              <Badge tone="neutral">{t.channel}</Badge>
            </div>
            {t.channel === "Email" && t.subject && <p className="truncate text-xs font-semibold text-maia-ink">{t.subject}</p>}
            <p className="line-clamp-3 text-xs text-maia-ink-soft">{t.message}</p>
            <p className="text-[11px] text-maia-ink-soft">Updated {new Date(t.lastUpdated).toLocaleDateString("en-PH")} {t.approvedBy ? `· Approved by ${t.approvedBy}` : ""}</p>
            <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
              <Button size="sm" variant="secondary" onClick={() => openPreview(t)}>
                <Eye size={12} />
                PREVIEW
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>
                EDIT
              </Button>
              {t.status !== "Active" ? (
                <Button size="sm" variant="secondary" onClick={() => setTemplateStatus(t.id, "Active")}>
                  ACTIVATE
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setTemplateStatus(t.id, "Archived")}>
                  ARCHIVE
                </Button>
              )}
            </div>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card className="sm:col-span-2 xl:col-span-3">
            <p className="py-8 text-center text-sm text-maia-ink-soft">No templates match this filter.</p>
          </Card>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Template" : "New Template"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={save} disabled={!form.name.trim() || !form.message.trim()}>
              SAVE
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Template Name" required value={form.name} onChange={(e) => patch({ name: e.target.value })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField label="Category" value={form.category} onChange={(e) => patch({ category: e.target.value as MessageTemplateCategory })} options={MESSAGE_TEMPLATE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
            <SelectField label="Channel" value={form.channel} onChange={(e) => patch({ channel: e.target.value as TemplateChannel })} options={TEMPLATE_CHANNELS.map((c) => ({ value: c, label: c }))} />
          </div>
          {form.channel === "Email" && <TextField label="Subject" value={form.subject} onChange={(e) => patch({ subject: e.target.value })} />}
          <TextAreaField label="Message" rows={5} value={form.message} onChange={(e) => patch({ message: e.target.value })} />
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">Approved Variables</p>
            <div className="flex flex-wrap gap-1.5">
              {PERSONALIZATION_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => patch({ message: `${form.message}${v}` })}
                  className="rounded-full bg-maia-gold-bg px-2.5 py-1 text-[11px] font-mono font-semibold text-maia-gold-deep hover:bg-maia-gold/30"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Template Preview" size="lg">
        {previewTemplate && (
          <div className="flex flex-col gap-4">
            <SelectField
              label="Preview As"
              value={previewPersonKey}
              onChange={(e) => setPreviewPersonKey(e.target.value)}
              options={[
                ...leads.map((l) => ({ value: `Lead:${l.id}`, label: `${l.fullName} (Lead)` })),
                ...students.map((s) => ({ value: `Student:${s.id}`, label: `${s.fullName} (Student)` })),
              ]}
            />
            {missingVariables.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-maia-warning-bg px-3 py-2.5 text-xs font-semibold text-maia-warning">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                MISSING VARIABLE: {missingVariables.join(", ")} — this sample person has no value for it.
              </div>
            )}
            <Card>
              <CardHeader title="Resolved Preview" />
              {previewTemplate.channel === "Email" && previewSubject.resolved && <p className="mb-2 text-sm font-bold text-maia-ink">{previewSubject.resolved}</p>}
              <p className="whitespace-pre-line text-sm text-maia-ink">{previewMessage.resolved}</p>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { RepeatableCardList } from "@/components/portal/masterBrainSteps/RepeatableCardList";
import { useFeedbackStore, type CreateFeedbackRequestInput } from "@/data/feedbackStore";
import { cloneDefaultQuestions } from "@/data/feedbackConfig";
import { useLmsStore } from "@/data/lmsStore";
import { FEEDBACK_SOURCE_TYPES } from "@/types/feedback";
import type { FeedbackQuestion, FeedbackRequest, FeedbackSourceType } from "@/types/feedback";

const BATCHES = ["Batch 14", "Batch 13", "Batch 12"] as const;

function blankForm(): CreateFeedbackRequestInput {
  return {
    title: "",
    sourceType: "Course",
    sourceId: null,
    sourceLabel: "",
    batch: "",
    audience: "All Eligible Students",
    audienceStudentId: null,
    message: "",
    questions: cloneDefaultQuestions(),
    allowWritten: true,
    allowVideo: true,
    incentiveId: null,
    openDate: new Date().toISOString().slice(0, 10),
    closeDate: null,
  };
}

export function Requests() {
  const { requests, incentives, createRequest, updateRequest, setRequestStatus } = useFeedbackStore();
  const { courses } = useLmsStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeedbackRequest | null>(null);
  const [form, setForm] = useState<CreateFeedbackRequestInput>(blankForm());

  function patch(p: Partial<CreateFeedbackRequestInput>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setModalOpen(true);
  }

  function openEdit(request: FeedbackRequest) {
    setEditing(request);
    setForm({
      title: request.title,
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      sourceLabel: request.sourceLabel,
      batch: request.batch,
      audience: request.audience,
      audienceStudentId: request.audienceStudentId,
      message: request.message,
      questions: request.questions,
      allowWritten: request.allowWritten,
      allowVideo: request.allowVideo,
      incentiveId: request.incentiveId,
      openDate: request.openDate.slice(0, 10),
      closeDate: request.closeDate ? request.closeDate.slice(0, 10) : null,
    });
    setModalOpen(true);
  }

  function save(publish: boolean) {
    if (!form.title.trim()) return;
    if (editing) {
      updateRequest(editing.id, form);
      if (publish) setRequestStatus(editing.id, "Open");
    } else {
      const created = createRequest(form);
      if (publish) setRequestStatus(created.id, "Open");
    }
    setModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Feedback Requests</h2>
          <p className="text-sm text-maia-ink-soft">{requests.length} request(s).</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} />
          NEW REQUEST
        </Button>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Request ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Written / Video</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{r.requestId}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{r.title}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.sourceType} — {r.sourceLabel}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.batch || "All"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                    {r.allowWritten ? "Written" : ""}{r.allowWritten && r.allowVideo ? " + " : ""}{r.allowVideo ? "Video" : ""}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={r.status === "Open" ? "success" : r.status === "Closed" ? "warning" : "neutral"}>{r.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>
                        EDIT
                      </Button>
                      {r.status !== "Open" ? (
                        <Button size="sm" variant="secondary" onClick={() => setRequestStatus(r.id, "Open")}>
                          OPEN
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setRequestStatus(r.id, "Closed")}>
                          CLOSE
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No feedback requests yet.
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
        title={editing ? "Edit Feedback Request" : "New Feedback Request"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              CANCEL
            </Button>
            <Button variant="secondary" onClick={() => save(false)} disabled={!form.title.trim()}>
              SAVE DRAFT
            </Button>
            <Button onClick={() => save(true)} disabled={!form.title.trim()}>
              SAVE &amp; OPEN
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Title" required value={form.title} onChange={(e) => patch({ title: e.target.value })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Source Type"
              value={form.sourceType}
              onChange={(e) => {
                const sourceType = e.target.value as FeedbackSourceType;
                patch({ sourceType, sourceId: null, sourceLabel: sourceType === "Course" ? "" : form.sourceLabel });
              }}
              options={FEEDBACK_SOURCE_TYPES.map((t) => ({ value: t, label: t }))}
            />
            {form.sourceType === "Course" ? (
              <SelectField
                label="Course"
                value={form.sourceId ?? ""}
                onChange={(e) => {
                  const course = courses.find((c) => c.id === e.target.value);
                  patch({ sourceId: course?.id ?? null, sourceLabel: course?.title ?? "" });
                }}
                placeholder="Select a course"
                options={courses.map((c) => ({ value: c.id, label: c.title }))}
              />
            ) : (
              <TextField
                label="Source Label"
                placeholder="e.g. Facebook Ads Masterclass"
                value={form.sourceLabel}
                onChange={(e) => patch({ sourceLabel: e.target.value })}
              />
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Batch (optional)"
              value={form.batch}
              onChange={(e) => patch({ batch: e.target.value as CreateFeedbackRequestInput["batch"] })}
              options={[{ value: "", label: "All Batches" }, ...BATCHES.map((b) => ({ value: b, label: b }))]}
            />
            <SelectField
              label="Audience"
              value={form.audience}
              onChange={(e) => patch({ audience: e.target.value as CreateFeedbackRequestInput["audience"] })}
              options={[
                { value: "All Eligible Students", label: "All Eligible Students" },
                { value: "Individual Student", label: "Individual Student" },
              ]}
            />
          </div>
          <TextAreaField label="Message" rows={2} value={form.message} onChange={(e) => patch({ message: e.target.value })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2.5 text-sm font-semibold text-maia-ink">
              <input type="checkbox" checked={form.allowWritten} onChange={(e) => patch({ allowWritten: e.target.checked })} className="h-4 w-4 rounded border-maia-border accent-maia-gold-deep" />
              Allow Written Feedback
            </label>
            <label className="flex items-center gap-2.5 text-sm font-semibold text-maia-ink">
              <input type="checkbox" checked={form.allowVideo} onChange={(e) => patch({ allowVideo: e.target.checked })} className="h-4 w-4 rounded border-maia-border accent-maia-gold-deep" />
              Allow Video Feedback
            </label>
          </div>
          <SelectField
            label="Incentive (optional)"
            value={form.incentiveId ?? ""}
            onChange={(e) => patch({ incentiveId: e.target.value || null })}
            options={[{ value: "", label: "No incentive" }, ...incentives.map((i) => ({ value: i.id, label: i.name }))]}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Open Date" type="date" value={form.openDate} onChange={(e) => patch({ openDate: e.target.value })} />
            <TextField
              label="Close Date (optional)"
              type="date"
              value={form.closeDate ?? ""}
              onChange={(e) => patch({ closeDate: e.target.value || null })}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-maia-ink">Questions</p>
            <RepeatableCardList
              items={form.questions}
              onAdd={() => patch({ questions: [...form.questions, { id: crypto.randomUUID(), text: "" }] })}
              onRemove={(idx) => patch({ questions: form.questions.filter((_, i) => i !== idx) })}
              onItemChange={(idx, p) => patch({ questions: form.questions.map((q, i) => (i === idx ? { ...q, ...p } : q)) })}
              addLabel="ADD QUESTION"
              emptyLabel="No questions yet."
              itemLabel={(q: FeedbackQuestion, i) => q.text || `Question ${i + 1}`}
              renderItem={(q, update) => <TextField label="Question" value={q.text} onChange={(e) => update({ text: e.target.value })} />}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

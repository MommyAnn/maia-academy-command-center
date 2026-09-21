import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { useFeedbackStore, type CreateIncentiveInput } from "@/data/feedbackStore";
import { useLmsStore } from "@/data/lmsStore";
import { useStudentStore } from "@/data/studentStore";
import { FEEDBACK_SOURCE_TYPES, INCENTIVE_DELIVERY_TYPES } from "@/types/feedback";
import type { FeedbackIncentive, FeedbackSourceType, IncentiveDeliveryType } from "@/types/feedback";

function blankForm(): CreateIncentiveInput {
  return {
    name: "",
    description: "",
    eligibility: "",
    sourceTypeFilter: "Any",
    deliveryType: "PDF",
    bonusCourseId: null,
    resourceFileMeta: null,
  };
}

export function Incentives() {
  const { incentives, redemptions, createIncentive, updateIncentive, setIncentiveStatus, deliverRedemption } = useFeedbackStore();
  const { courses } = useLmsStore();
  const { students } = useStudentStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeedbackIncentive | null>(null);
  const [form, setForm] = useState<CreateIncentiveInput>(blankForm());

  function patch(p: Partial<CreateIncentiveInput>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setModalOpen(true);
  }

  function openEdit(incentive: FeedbackIncentive) {
    setEditing(incentive);
    setForm({
      name: incentive.name,
      description: incentive.description,
      eligibility: incentive.eligibility,
      sourceTypeFilter: incentive.sourceTypeFilter,
      deliveryType: incentive.deliveryType,
      bonusCourseId: incentive.bonusCourseId,
      resourceFileMeta: incentive.resourceFileMeta,
    });
    setModalOpen(true);
  }

  function save() {
    if (!form.name.trim()) return;
    if (editing) updateIncentive(editing.id, form);
    else createIncentive(form);
    setModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Feedback Incentives</h2>
          <p className="text-sm text-maia-ink-soft">Rewards for submitting genuine feedback — never for a positive rating.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} />
          NEW INCENTIVE
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {incentives.map((incentive) => (
          <Card key={incentive.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-sm font-bold text-maia-ink">{incentive.name}</p>
              <Badge tone={incentive.status === "Active" ? "success" : "neutral"}>{incentive.status}</Badge>
            </div>
            <p className="text-sm text-maia-ink-soft">{incentive.description}</p>
            <p className="text-xs text-maia-ink-soft"><span className="font-semibold text-maia-ink">Eligibility:</span> {incentive.eligibility}</p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge tone="gold">{incentive.deliveryType}</Badge>
              <Badge tone="neutral">{incentive.sourceTypeFilter === "Any" ? "Any Source" : incentive.sourceTypeFilter}</Badge>
              {incentive.deliveryType === "Bonus Course" && incentive.bonusCourseId && (
                <Badge tone="neutral">{courses.find((c) => c.id === incentive.bonusCourseId)?.title ?? "Course removed"}</Badge>
              )}
            </div>
            <div className="mt-auto flex gap-1.5 border-t border-maia-border pt-3">
              <Button size="sm" variant="secondary" onClick={() => openEdit(incentive)}>
                EDIT
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setIncentiveStatus(incentive.id, incentive.status === "Active" ? "Inactive" : "Active")}>
                {incentive.status === "Active" ? "DEACTIVATE" : "ACTIVATE"}
              </Button>
            </div>
          </Card>
        ))}
        {incentives.length === 0 && (
          <Card className="sm:col-span-2">
            <p className="py-8 text-center text-sm text-maia-ink-soft">No incentives configured yet.</p>
          </Card>
        )}
      </div>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader title="Redemptions" subtitle="Unlock and delivery status per student." />
        </div>
        <div className="overflow-x-auto border-t border-maia-border">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Incentive</th>
                <th className="px-4 py-3">Unlocked</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => {
                const student = students.find((s) => s.id === r.studentId);
                const incentive = incentives.find((i) => i.id === r.incentiveId);
                return (
                  <tr key={r.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink">{student?.fullName ?? "Unknown"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{incentive?.name ?? "Removed incentive"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{new Date(r.unlockedAt).toLocaleDateString("en-PH")}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={r.deliveryStatus === "Delivered" ? "success" : "gold"}>{r.deliveryStatus}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {r.deliveryStatus === "Unlocked" && (
                        <Button size="sm" onClick={() => deliverRedemption(r.id)}>
                          MARK DELIVERED
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {redemptions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No redemptions yet.
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
        title={editing ? "Edit Incentive" : "New Incentive"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={save} disabled={!form.name.trim()}>
              SAVE
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Name" required value={form.name} onChange={(e) => patch({ name: e.target.value })} />
          <TextAreaField label="Description" rows={2} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
          <TextAreaField
            label="Eligibility"
            hint="Describe the submission requirement only — never a rating or sentiment requirement."
            rows={2}
            value={form.eligibility}
            onChange={(e) => patch({ eligibility: e.target.value })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Feedback Source Filter"
              value={form.sourceTypeFilter}
              onChange={(e) => patch({ sourceTypeFilter: e.target.value as FeedbackSourceType | "Any" })}
              options={[{ value: "Any", label: "Any Source" }, ...FEEDBACK_SOURCE_TYPES.map((t) => ({ value: t, label: t }))]}
            />
            <SelectField
              label="Delivery Type"
              value={form.deliveryType}
              onChange={(e) => patch({ deliveryType: e.target.value as IncentiveDeliveryType, bonusCourseId: null, resourceFileMeta: null })}
              options={INCENTIVE_DELIVERY_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>
          {form.deliveryType === "Bonus Course" && (
            <SelectField
              label="Bonus Course"
              value={form.bonusCourseId ?? ""}
              onChange={(e) => patch({ bonusCourseId: e.target.value || null })}
              placeholder="Select a course"
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
            />
          )}
          {form.deliveryType !== "Bonus Course" && form.deliveryType !== "Coupon / Offer" && (
            <TextField
              label="Resource File Name (optional)"
              hint="Shown to students only when an actual secure resource exists in production."
              value={form.resourceFileMeta?.fileName ?? ""}
              onChange={(e) =>
                patch({ resourceFileMeta: e.target.value ? { fileName: e.target.value, fileSizeLabel: "", fileType: form.deliveryType } : null })
              }
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

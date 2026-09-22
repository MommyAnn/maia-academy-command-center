import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Tabs } from "@/components/common/Tabs";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { useWebinarStore } from "@/data/webinarStore";
import { isFollowUpOverdue, isFollowUpToday, isFollowUpUpcoming, isHighIntentLead, pipelineStageTone } from "@/utils/webinar";
import { FOLLOW_UP_OUTCOMES } from "@/types/webinar";
import type { FollowUp, FollowUpOutcome } from "@/types/webinar";

const QUEUES = [
  { value: "today", label: "Today's Follow-ups" },
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Upcoming" },
  { value: "no-response", label: "No Response" },
  { value: "high-intent", label: "High-Intent Leads" },
];

export function FollowUps() {
  const { leads, followUps, updateFollowUpResult } = useWebinarStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queue = searchParams.get("queue") ?? "today";
  const [resultModal, setResultModal] = useState<FollowUp | null>(null);
  const [resultForm, setResultForm] = useState<{ outcome: FollowUpOutcome | ""; notes: string; nextFollowUpDate: string }>({ outcome: "", notes: "", nextFollowUpDate: "" });

  function setQueue(q: string) {
    setSearchParams(q === "today" ? {} : { queue: q });
  }

  const todayFollowUps = followUps.filter((f) => isFollowUpToday(f));
  const overdueFollowUps = followUps.filter((f) => isFollowUpOverdue(f));
  const upcomingFollowUps = followUps.filter((f) => isFollowUpUpcoming(f));
  const noResponseFollowUps = followUps.filter((f) => f.status === "No Response");
  const highIntentLeads = leads.filter((l) => isHighIntentLead(l));

  const listForQueue = queue === "today" ? todayFollowUps : queue === "overdue" ? overdueFollowUps : queue === "upcoming" ? upcomingFollowUps : queue === "no-response" ? noResponseFollowUps : [];

  function openResultModal(followUp: FollowUp) {
    setResultForm({ outcome: "", notes: followUp.notes, nextFollowUpDate: "" });
    setResultModal(followUp);
  }

  function submitResult(status: "Completed" | "Rescheduled" | "Cancelled") {
    if (!resultModal) return;
    updateFollowUpResult(resultModal.id, {
      status,
      outcome: status === "Completed" ? (resultForm.outcome || null) : null,
      notes: resultForm.notes,
      nextFollowUpDate: resultForm.nextFollowUpDate || null,
    });
    setResultModal(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Follow-ups</h2>
        <p className="text-sm text-maia-ink-soft">Know exactly who needs contact right now.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { key: "today", value: todayFollowUps.length },
          { key: "overdue", value: overdueFollowUps.length },
          { key: "upcoming", value: upcomingFollowUps.length },
          { key: "no-response", value: noResponseFollowUps.length },
          { key: "high-intent", value: highIntentLeads.length },
        ].map((tile) => (
          <button key={tile.key} onClick={() => setQueue(tile.key)} className={`rounded-2xl border px-4 py-4 text-left transition-colors ${queue === tile.key ? "border-maia-gold bg-maia-gold-bg" : "border-maia-border bg-maia-surface hover:border-maia-gold"}`}>
            <p className="font-display text-2xl font-extrabold leading-none text-maia-ink">{tile.value}</p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{QUEUES.find((q) => q.value === tile.key)?.label}</p>
          </button>
        ))}
      </div>

      <Tabs tabs={QUEUES} active={queue} onChange={setQueue} />

      {queue === "high-intent" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {highIntentLeads.map((lead) => (
            <Card key={lead.id} className="flex flex-col gap-2 cursor-pointer" onClick={() => navigate(`/webinar/leads/${lead.id}`)}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-maia-ink">{lead.fullName}</p>
                <Badge tone={pipelineStageTone(lead.status)}>{lead.status}</Badge>
              </div>
              <p className="text-xs text-maia-ink-soft">{lead.facebookName} · {lead.contactNumber}</p>
              <p className="text-xs text-maia-ink-soft">Assigned: {lead.assignedStaffName ?? "Unassigned"}</p>
            </Card>
          ))}
          {highIntentLeads.length === 0 && <p className="rounded-xl bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft sm:col-span-2">No high-intent leads waiting on a next step.</p>}
        </div>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Date / Time</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {listForQueue.map((f) => {
                  const lead = leads.find((l) => l.id === f.leadId);
                  return (
                    <tr key={f.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">
                        <button onClick={() => navigate(`/webinar/leads/${f.leadId}`)} className="hover:underline">
                          {lead?.fullName ?? "Unknown"}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{f.channel}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{f.date} {f.time}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{f.assignedStaffName}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge tone={f.status === "To Do" ? "gold" : f.status === "Completed" ? "success" : "neutral"}>{f.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {f.status === "To Do" && (
                          <Button size="sm" onClick={() => openResultModal(f)}>
                            RECORD RESULT
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {listForQueue.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                      Nothing in this queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={resultModal !== null}
        onClose={() => setResultModal(null)}
        title="Record Follow-up Result"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => submitResult("Cancelled")}>CANCELLED</Button>
            <Button variant="secondary" onClick={() => submitResult("Rescheduled")}>RESCHEDULE</Button>
            <Button onClick={() => submitResult("Completed")}>COMPLETE</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <SelectField
            label="Outcome (for Completed)"
            value={resultForm.outcome}
            onChange={(e) => setResultForm((f) => ({ ...f, outcome: e.target.value as FollowUpOutcome }))}
            placeholder="Select outcome"
            options={FOLLOW_UP_OUTCOMES.map((o) => ({ value: o, label: o }))}
          />
          <TextAreaField label="Notes" rows={2} value={resultForm.notes} onChange={(e) => setResultForm((f) => ({ ...f, notes: e.target.value }))} />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Next Follow-up Date (if rescheduling or another is needed)</label>
            <input
              type="date"
              value={resultForm.nextFollowUpDate}
              onChange={(e) => setResultForm((f) => ({ ...f, nextFollowUpDate: e.target.value }))}
              className="w-full rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

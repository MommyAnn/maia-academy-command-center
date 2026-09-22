import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { checkChannelEligibility, communicationStatusTone, resolveTemplateVariables } from "@/utils/communications";
import { COMMUNICATION_CHANNELS } from "@/types/communications";
import type { CommunicationChannel, PersonType } from "@/types/communications";

/**
 * Chronological communication history + "Send Message" (spec sections 47,
 * 59) — shared between Lead Profile and Student Profile so both read from
 * the exact same CommunicationLog records, never a per-page duplicate.
 */
export function CommunicationsPanel({ personType, personId }: { personType: PersonType; personId: string }) {
  const { communicationLogs, templates, getPreferenceForPerson, sendManualMessage, buildVariableContext } = useCommunicationsStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [channel, setChannel] = useState<CommunicationChannel>("Email");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const history = communicationLogs
    .filter((c) => c.personType === personType && c.personId === personId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const preference = getPreferenceForPerson(personType, personId);
  const eligibility = checkChannelEligibility(preference, channel, "operational");

  function openSend() {
    setChannel("Email");
    setTemplateId("");
    setSubject("");
    setMessage("");
    setModalOpen(true);
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    const vars = buildVariableContext(personType, personId);
    setSubject(resolveTemplateVariables(template.subject, vars).resolved);
    setMessage(resolveTemplateVariables(template.message, vars).resolved);
    setChannel(template.channel === "Internal" ? "Internal Notification" : (template.channel as CommunicationChannel));
  }

  function handleSend() {
    if (!message.trim()) return;
    sendManualMessage({ personType, personId, channel, templateId: templateId || null, subject, message });
    setModalOpen(false);
  }

  return (
    <Card>
      <CardHeader
        title="Communications"
        subtitle="Email / SMS / WhatsApp / manual follow-up — one shared history, same Communication Log the admin module reads."
        action={
          <Button size="sm" onClick={openSend}>
            <MessageSquarePlus size={13} />
            SEND MESSAGE
          </Button>
        }
      />
      <div className="flex flex-col gap-2">
        {history.map((c) => (
          <div key={c.id} className="rounded-lg bg-maia-bg px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-maia-ink">
                {c.channel}
                {c.subject ? `: ${c.subject}` : ""}
              </span>
              <Badge tone={communicationStatusTone(c.status)}>{c.status}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-maia-ink-soft">{c.message}</p>
            <p className="mt-1 text-[11px] text-maia-ink-soft">
              {new Date(c.occurredAt).toLocaleString("en-PH")} · {c.sentBy}
              {c.failureReason ? ` · ${c.failureReason}` : ""}
            </p>
          </div>
        ))}
        {history.length === 0 && <p className="text-xs text-maia-ink-soft">No communications recorded yet.</p>}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Send Message"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={handleSend} disabled={!message.trim()}>
              SEND
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <SelectField
            label="Template (optional)"
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            options={[{ value: "", label: "No template — write manually" }, ...templates.filter((t) => t.status === "Active").map((t) => ({ value: t.id, label: t.name }))]}
          />
          <SelectField label="Channel" value={channel} onChange={(e) => setChannel(e.target.value as CommunicationChannel)} options={COMMUNICATION_CHANNELS.map((c) => ({ value: c, label: c }))} />
          {!eligibility.allowed && (
            <p className="rounded-lg bg-maia-warning-bg px-3 py-2 text-xs font-semibold text-maia-warning">
              {eligibility.reason} — this will be recorded as Skipped, not sent.
            </p>
          )}
          {channel === "Email" && <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />}
          <TextAreaField label="Message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
      </Modal>
    </Card>
  );
}

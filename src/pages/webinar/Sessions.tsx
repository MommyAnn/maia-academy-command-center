import { useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { useWebinarStore, type CreateWebinarSessionInput } from "@/data/webinarStore";
import { WEBINAR_PLATFORMS, WEBINAR_SESSION_STATUSES, WEBINAR_TYPES } from "@/types/webinar";
import type { WebinarSession, WebinarSessionStatus } from "@/types/webinar";

function blankForm(): CreateWebinarSessionInput {
  return {
    title: "",
    type: "Masterclass",
    date: new Date().toISOString().slice(0, 10),
    startTime: "20:00",
    endTime: "21:30",
    platform: "Zoom",
    meetingLink: "",
    meetingId: "",
    passcode: "",
    host: "",
    capacity: null,
    registrationOpenDate: null,
    registrationCloseDate: null,
    notes: "",
  };
}

const STATUS_TONE: Record<WebinarSessionStatus, "success" | "neutral" | "warning" | "info" | "danger" | "gold"> = {
  Draft: "neutral",
  "Open for Registration": "success",
  "Registration Closed": "warning",
  Ongoing: "info",
  Completed: "gold",
  Cancelled: "danger",
};

export function Sessions() {
  const { sessions, registrations, createSession, updateSession, setSessionStatus } = useWebinarStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WebinarSession | null>(null);
  const [form, setForm] = useState<CreateWebinarSessionInput>(blankForm());

  function patch(p: Partial<CreateWebinarSessionInput>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setModalOpen(true);
  }

  function openEdit(session: WebinarSession) {
    setEditing(session);
    setForm({
      title: session.title,
      type: session.type,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      platform: session.platform,
      meetingLink: session.meetingLink,
      meetingId: session.meetingId,
      passcode: session.passcode,
      host: session.host,
      capacity: session.capacity,
      registrationOpenDate: session.registrationOpenDate,
      registrationCloseDate: session.registrationCloseDate,
      notes: session.notes,
    });
    setModalOpen(true);
  }

  function save() {
    if (!form.title.trim() || !form.host.trim()) return;
    if (editing) updateSession(editing.id, form);
    else createSession(form);
    setModalOpen(false);
  }

  function registrationCount(sessionId: string) {
    return registrations.filter((r) => r.webinarSessionId === sessionId).length;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Webinar Sessions</h2>
          <p className="text-sm text-maia-ink-soft">{sessions.length} session(s) — create unlimited future sessions.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} />
          CREATE WEBINAR SESSION
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sessions.map((session) => (
          <Card key={session.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[11px] font-semibold text-maia-ink-soft">{session.sessionId}</p>
                <p className="font-display text-sm font-bold text-maia-ink">{session.title}</p>
              </div>
              <Badge tone={STATUS_TONE[session.status]}>{session.status}</Badge>
            </div>
            <p className="text-sm text-maia-ink-soft">
              {new Date(session.date).toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" })} · {session.startTime}–{session.endTime}
            </p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge tone="gold">{session.type}</Badge>
              <span className="rounded-full border border-maia-border px-2.5 py-1 text-maia-ink-soft">{session.platform}</span>
              <span className="rounded-full border border-maia-border px-2.5 py-1 text-maia-ink-soft">{session.host}</span>
              {session.capacity && <span className="rounded-full border border-maia-border px-2.5 py-1 text-maia-ink-soft">Cap. {session.capacity}</span>}
            </div>
            <p className="text-xs text-maia-ink-soft">
              <span className="font-semibold text-maia-ink">{registrationCount(session.id)}</span> registration(s)
            </p>
            <div className="mt-auto flex flex-wrap gap-1.5 border-t border-maia-border pt-3">
              <Button size="sm" variant="secondary" onClick={() => openEdit(session)}>
                EDIT
              </Button>
              <SelectField
                label=""
                value={session.status}
                onChange={(e) => setSessionStatus(session.id, e.target.value as WebinarSessionStatus)}
                options={WEBINAR_SESSION_STATUSES.map((s) => ({ value: s, label: s }))}
                className="!py-1.5 !text-xs"
              />
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Webinar Session" : "Create Webinar Session"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={save} disabled={!form.title.trim() || !form.host.trim()}>
              SAVE
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Webinar Title" required value={form.title} onChange={(e) => patch({ title: e.target.value })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField label="Webinar Type" value={form.type} onChange={(e) => patch({ type: e.target.value as CreateWebinarSessionInput["type"] })} options={WEBINAR_TYPES.map((t) => ({ value: t, label: t }))} />
            <TextField label="Host / Coach" required value={form.host} onChange={(e) => patch({ host: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField label="Date" type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} />
            <TextField label="Start Time" type="time" value={form.startTime} onChange={(e) => patch({ startTime: e.target.value })} />
            <TextField label="End Time" type="time" value={form.endTime} onChange={(e) => patch({ endTime: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField label="Platform" value={form.platform} onChange={(e) => patch({ platform: e.target.value as CreateWebinarSessionInput["platform"] })} options={WEBINAR_PLATFORMS.map((p) => ({ value: p, label: p }))} />
            <TextField label="Capacity (optional)" type="number" value={form.capacity ?? ""} onChange={(e) => patch({ capacity: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <TextField label="Meeting Link" value={form.meetingLink} onChange={(e) => patch({ meetingLink: e.target.value })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Meeting ID" value={form.meetingId} onChange={(e) => patch({ meetingId: e.target.value })} />
            <TextField label="Passcode" value={form.passcode} onChange={(e) => patch({ passcode: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Registration Open Date" type="date" value={form.registrationOpenDate ?? ""} onChange={(e) => patch({ registrationOpenDate: e.target.value || null })} />
            <TextField label="Registration Close Date" type="date" value={form.registrationCloseDate ?? ""} onChange={(e) => patch({ registrationCloseDate: e.target.value || null })} />
          </div>
          <TextAreaField label="Notes" rows={2} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}

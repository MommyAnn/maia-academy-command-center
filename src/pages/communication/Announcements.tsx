import { useState } from "react";
import { Megaphone, Pin, Plus, Star } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { usePortalStore } from "@/data/portalStore";
import { useStudentStore } from "@/data/studentStore";
import { ANNOUNCEMENT_AUDIENCE_TYPES, type AnnouncementAudienceType } from "@/types/portal";
import { BATCH_OPTIONS, PACKAGE_OPTIONS } from "@/data/enrollmentConfig";

export function Announcements() {
  const { announcements, createAnnouncement, togglePinAnnouncement, toggleImportantAnnouncement } = usePortalStore();
  const { students } = useStudentStore();
  const [modalOpen, setModalOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audienceType, setAudienceType] = useState<AnnouncementAudienceType>("All Students");
  const [audienceValue, setAudienceValue] = useState("");
  const [important, setImportant] = useState(false);

  const needsAudienceValue = audienceType === "Batch" || audienceType === "Package" || audienceType === "Individual Student";

  function resetForm() {
    setTitle("");
    setMessage("");
    setAudienceType("All Students");
    setAudienceValue("");
    setImportant(false);
  }

  function handleCreate() {
    if (!title.trim() || !message.trim()) return;
    if (needsAudienceValue && !audienceValue) return;
    createAnnouncement({
      title: title.trim(),
      message: message.trim(),
      audienceType,
      audienceValue: needsAudienceValue ? audienceValue : null,
      important,
      attachmentLabel: "",
      attachmentUrl: "",
    });
    resetForm();
    setModalOpen(false);
  }

  const sorted = [...announcements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Announcements</h2>
          <p className="text-sm text-maia-ink-soft">Published to the Student Portal, filtered by audience.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={15} />
          NEW ANNOUNCEMENT
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Megaphone size={28} className="text-maia-ink-soft/40" />
            <p className="text-sm text-maia-ink-soft">No announcements published yet.</p>
          </div>
        </Card>
      ) : (
        sorted.map((a) => (
          <Card key={a.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-maia-ink">{a.title}</p>
                  {a.important && <Badge tone="gold">Important</Badge>}
                  <Badge tone="neutral">
                    {a.audienceType}
                    {a.audienceValue ? ` — ${a.audienceValue}` : ""}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-maia-ink-soft">{a.message}</p>
                <p className="mt-2 text-xs text-maia-ink-soft/70">
                  {a.createdBy} &middot; {a.date}
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-1.5">
                <IconToggle active={a.pinned} onClick={() => togglePinAnnouncement(a.id)} title="Pin">
                  <Pin size={14} />
                </IconToggle>
                <IconToggle active={a.important} onClick={() => toggleImportantAnnouncement(a.id)} title="Mark Important">
                  <Star size={14} />
                </IconToggle>
              </div>
            </div>
          </Card>
        ))
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Announcement"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={handleCreate} disabled={!title.trim() || !message.trim() || (needsAudienceValue && !audienceValue)}>
              PUBLISH
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-maia-ink">
              Message<span className="ml-0.5 text-maia-danger">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
            />
          </div>
          <SelectField
            label="Audience"
            value={audienceType}
            onChange={(e) => {
              setAudienceType(e.target.value as AnnouncementAudienceType);
              setAudienceValue("");
            }}
            options={ANNOUNCEMENT_AUDIENCE_TYPES.map((t) => ({ value: t, label: t }))}
          />
          {audienceType === "Batch" && (
            <SelectField
              label="Batch"
              value={audienceValue}
              onChange={(e) => setAudienceValue(e.target.value)}
              placeholder="Select a batch"
              options={BATCH_OPTIONS.map((b) => ({ value: b, label: b }))}
            />
          )}
          {audienceType === "Package" && (
            <SelectField
              label="Package"
              value={audienceValue}
              onChange={(e) => setAudienceValue(e.target.value)}
              placeholder="Select a package"
              options={PACKAGE_OPTIONS.map((p) => ({ value: p, label: p }))}
            />
          )}
          {audienceType === "Individual Student" && (
            <SelectField
              label="Student"
              value={audienceValue}
              onChange={(e) => setAudienceValue(e.target.value)}
              placeholder="Select a student"
              options={students.map((s) => ({ value: s.id, label: `${s.fullName} (${s.studentId})` }))}
            />
          )}
          <label className="flex items-center gap-2 text-sm text-maia-ink">
            <input
              type="checkbox"
              checked={important}
              onChange={(e) => setImportant(e.target.checked)}
              className="h-4 w-4 rounded border-maia-border accent-maia-gold-deep"
            />
            Mark as Important (shown as a banner on the Student Home Dashboard)
          </label>
        </div>
      </Modal>
    </div>
  );
}

function IconToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-lg border p-2 transition-colors ${
        active
          ? "border-maia-gold bg-maia-gold-bg text-maia-gold-deep"
          : "border-maia-border text-maia-ink-soft hover:border-maia-gold hover:text-maia-gold-deep"
      }`}
    >
      {children}
    </button>
  );
}

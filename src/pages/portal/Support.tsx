import { useState } from "react";
import { LifeBuoy, Send } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { usePortalStore } from "@/data/portalStore";
import { SUPPORT_STATUS_TONE } from "@/components/portal/statusMeta";
import { SUPPORT_CATEGORIES, type SupportCategory } from "@/types/portal";
import { formatDateTime } from "@/utils/students";

export function Support() {
  const { student } = useStudentPortal();
  const { supportRequests, createSupportRequest } = usePortalStore();

  const [category, setCategory] = useState<SupportCategory>("Enrollment");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const myRequests = supportRequests
    .filter((r) => r.studentId === student.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  function handleSubmit() {
    if (!subject.trim() || !message.trim()) return;
    createSupportRequest({ studentId: student.id, category, subject: subject.trim(), message: message.trim() });
    setSubject("");
    setMessage("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Need Help?" subtitle="Send a message to the Academy team and we'll get back to you." />
        <div className="flex flex-col gap-4">
          <SelectField
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as SupportCategory)}
            options={SUPPORT_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-maia-ink">
              Message<span className="ml-0.5 text-maia-danger">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Tell us what you need help with..."
              className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
            />
          </div>
          {submitted && (
            <p className="rounded-lg bg-maia-success-bg px-3.5 py-2.5 text-sm font-medium text-maia-success">
              Your request has been sent to the Academy team.
            </p>
          )}
          <Button onClick={handleSubmit} disabled={!subject.trim() || !message.trim()} className="w-full sm:w-auto">
            <Send size={14} />
            SEND REQUEST
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="My Requests" subtitle="Your submitted support requests and their status." />
        {myRequests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <LifeBuoy size={24} className="text-maia-ink-soft/40" />
            <p className="text-sm text-maia-ink-soft">You haven&rsquo;t submitted any requests yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {myRequests.map((r) => (
              <div key={r.id} className="rounded-lg bg-maia-bg px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-maia-ink">{r.subject}</p>
                  <Badge tone={SUPPORT_STATUS_TONE[r.status]}>{r.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-maia-ink-soft">
                  {r.supportId} &middot; {r.category} &middot; {formatDateTime(r.createdAt)}
                </p>
                <p className="mt-1.5 text-sm text-maia-ink-soft">{r.message}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

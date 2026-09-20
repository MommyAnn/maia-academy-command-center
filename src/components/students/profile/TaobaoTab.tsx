import { useState } from "react";
import { Save } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { FilterSelect } from "@/components/common/FilterSelect";
import { TAOBAO_STATUS_OPTIONS, TAOBAO_STATUS_TONE } from "@/components/students/statusMeta";
import { useStudentStore } from "@/data/studentStore";
import { formatDateTime } from "@/utils/students";
import type { StudentRecord, TaobaoStatus } from "@/types/student";

export function TaobaoTab({ student }: { student: StudentRecord }) {
  const { updateTaobao } = useStudentStore();
  const [status, setStatus] = useState<TaobaoStatus>(student.taobao.status);
  const [username, setUsername] = useState(student.taobao.username);
  const [adminNotes, setAdminNotes] = useState(student.taobao.adminNotes);

  const isDirty =
    status !== student.taobao.status || username !== student.taobao.username || adminNotes !== student.taobao.adminNotes;

  function handleSave() {
    updateTaobao(student.id, { status, username, adminNotes });
  }

  return (
    <Card>
      <CardHeader
        title="Taobao Login Details"
        subtitle="Taobao access lives on the student's profile — no separate Taobao module."
        action={<Badge tone={TAOBAO_STATUS_TONE[student.taobao.status]}>{student.taobao.status}</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
            Taobao Status
          </label>
          <FilterSelect
            value={status}
            onChange={(v) => setStatus(v as TaobaoStatus)}
            options={TAOBAO_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
        </div>

        <div>
          <label htmlFor="taobao-username" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
            Taobao Login / Username
          </label>
          <input
            id="taobao-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Not yet assigned"
            className="w-full rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
          />
        </div>

        <ReadOnlyField label="Date Created" value={student.taobao.dateCreated ? formatDateTime(student.taobao.dateCreated) : "—"} />
        <ReadOnlyField label="Date Login Details Given" value={student.taobao.dateGiven ? formatDateTime(student.taobao.dateGiven) : "—"} />

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
            Admin Notes
          </label>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Given via Messenger, waiting on preferred username, etc."
            className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-maia-ink-soft/80">
        A Taobao password is intentionally not tracked here for security reasons.
      </p>

      <Button className="mt-4" onClick={handleSave} disabled={!isDirty}>
        <Save size={15} />
        SAVE TAOBAO DETAILS
      </Button>
    </Card>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className="rounded-lg bg-maia-bg px-3.5 py-2.5 text-sm text-maia-ink">{value}</p>
    </div>
  );
}

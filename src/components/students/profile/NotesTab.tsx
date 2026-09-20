import { useState } from "react";
import { StickyNote } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { useStudentStore } from "@/data/studentStore";
import { formatDateTime } from "@/utils/students";
import type { StudentRecord } from "@/types/student";

export function NotesTab({ student }: { student: StudentRecord }) {
  const { addAdminNote } = useStudentStore();
  const [draft, setDraft] = useState("");

  function handleAdd() {
    if (!draft.trim()) return;
    addAdminNote(student.id, draft);
    setDraft("");
  }

  return (
    <Card>
      <CardHeader title="Admin Notes" subtitle="Internal notes — visible to Academy staff/admin only." />

      <div className="mb-5 flex flex-col gap-2.5 sm:flex-row">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Add an internal note about this student..."
          className="flex-1 resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
        />
        <Button onClick={handleAdd} disabled={!draft.trim()} className="sm:self-end">
          ADD NOTE
        </Button>
      </div>

      {student.adminNotes.length === 0 ? (
        <p className="rounded-lg bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft">
          No admin notes yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {student.adminNotes.map((note) => (
            <li key={note.id} className="flex gap-3 rounded-xl bg-maia-bg px-4 py-3.5">
              <StickyNote size={16} className="mt-0.5 flex-shrink-0 text-maia-gold-deep" />
              <div>
                <p className="text-sm text-maia-ink">{note.text}</p>
                <p className="mt-1 text-xs text-maia-ink-soft">
                  {note.author} &middot; {formatDateTime(note.timestamp)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

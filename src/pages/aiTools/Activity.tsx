import { useState } from "react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { FilterSelect } from "@/components/common/FilterSelect";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { useStudentStore } from "@/data/studentStore";
import { formatDateTime } from "@/utils/students";

export function Activity() {
  const { activityLog, tools } = useAiToolsStore();
  const { getStudentById } = useStudentStore();
  const [actionFilter, setActionFilter] = useState("All");

  const actions = ["All", ...Array.from(new Set(activityLog.map((a) => a.action)))];
  const rows = activityLog.filter((a) => actionFilter === "All" || a.action === actionFilter).slice(0, 200);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-bold text-maia-ink">AI Activity Log</h1>
        <p className="text-sm text-maia-ink-soft">Every tool open, generation, and edit — never logging secrets or raw API responses.</p>
      </div>

      <FilterSelect value={actionFilter} onChange={setActionFilter} options={actions.map((a) => ({ value: a, label: a }))} />

      <Card padded={false}>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-maia-ink-soft">No activity recorded yet.</p>
        ) : (
          <div className="divide-y divide-maia-border">
            {rows.map((a) => {
              const student = getStudentById(a.studentId);
              const tool = a.toolId ? tools.find((t) => t.id === a.toolId) : null;
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-maia-ink">
                      <span className="font-semibold">{student?.fullName ?? a.studentId}</span> — {a.summary}
                    </p>
                    <p className="text-xs text-maia-ink-soft">
                      {formatDateTime(a.occurredAt)}
                      {tool && ` · ${tool.name}`}
                      {a.masterBrainVersion ? ` · Master Brain v${a.masterBrainVersion}` : ""}
                    </p>
                  </div>
                  <Badge tone="neutral">{a.action}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

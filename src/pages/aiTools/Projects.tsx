import { useMemo, useState } from "react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { SearchInput } from "@/components/common/SearchInput";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { useStudentStore } from "@/data/studentStore";
import { formatDateTime } from "@/utils/students";

// Admin cross-student view (spec section 30) — read-only, never edits a
// student's own project; see Student Data Isolation (spec section 58): this
// page is the one deliberate exception, gated by staff/admin role.

export function Projects() {
  const { projects, generations } = useAiToolsStore();
  const { students, getStudentById } = useStudentStore();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    return projects
      .map((p) => ({ project: p, student: getStudentById(p.studentId), outputCount: generations.filter((g) => g.projectId === p.id).length }))
      .filter((r) => !query || r.project.name.toLowerCase().includes(query.toLowerCase()) || r.student?.fullName.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (a.project.createdAt < b.project.createdAt ? 1 : -1));
  }, [projects, generations, getStudentById, query]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-bold text-maia-ink">AI Projects</h1>
        <p className="text-sm text-maia-ink-soft">Cross-student view of every AI Project created across {students.length} students.</p>
      </div>

      <SearchInput value={query} onChange={setQuery} placeholder="Search by project or student name..." />

      <Card padded={false}>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-maia-ink-soft">No projects yet.</p>
        ) : (
          <div className="divide-y divide-maia-border">
            {rows.map(({ project, student, outputCount }) => (
              <div key={project.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <div>
                  <p className="text-sm font-semibold text-maia-ink">{project.name}</p>
                  <p className="text-xs text-maia-ink-soft">
                    {project.projectId} · {student?.fullName ?? project.studentId} · Created {formatDateTime(project.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="gold">{project.type}</Badge>
                  <Badge tone="neutral">{outputCount} output{outputCount === 1 ? "" : "s"}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

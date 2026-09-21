import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { useLmsStore } from "@/data/lmsStore";
import { RESOURCE_TYPES } from "@/types/lms";

export function Resources() {
  const { courses, modules, lessons } = useLmsStore();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const rows = lessons.flatMap((lesson) =>
    lesson.resources.map((resource) => ({
      resource,
      lesson,
      module: modules.find((m) => m.id === lesson.moduleId),
      course: courses.find((c) => c.id === lesson.courseId),
    })),
  );

  const filtered = rows.filter((r) => {
    if (courseFilter !== "All" && r.course?.id !== courseFilter) return false;
    if (typeFilter !== "All" && r.resource.type !== typeFilter) return false;
    if (search.trim() && !r.resource.label.toLowerCase().includes(search.trim().toLowerCase()) && !r.lesson.title.toLowerCase().includes(search.trim().toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Course Resources</h2>
        <p className="text-sm text-maia-ink-soft">Every resource attached to a lesson, across all courses. {filtered.length} shown.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search resource or lesson..." />
        <FilterSelect
          value={courseFilter}
          onChange={setCourseFilter}
          options={[{ value: "All", label: "All Courses" }, ...courses.map((c) => ({ value: c.id, label: c.title }))]}
        />
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={[{ value: "All", label: "All Types" }, ...RESOURCE_TYPES.map((t) => ({ value: t, label: t }))]}
        />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Lesson</th>
                <th className="px-4 py-3">Size</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ resource, lesson, module, course }) => (
                <tr key={resource.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">
                    <div className="flex items-center gap-1.5">
                      {resource.type === "External Link" ? <ExternalLink size={13} className="text-maia-gold-deep" /> : <Download size={13} className="text-maia-gold-deep" />}
                      {resource.label || "Untitled Resource"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone="gold">{resource.type}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{course?.title ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{module?.title ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{lesson.title}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{resource.fileSizeLabel || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No resources match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

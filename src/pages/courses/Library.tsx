import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Plus } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useLmsStore } from "@/data/lmsStore";
import { useStudentStore } from "@/data/studentStore";
import { COURSE_CATEGORIES } from "@/types/lms";
import type { Course, CourseStatus } from "@/types/lms";
import { resolveCourseAccess } from "@/utils/lms";

const STATUS_TONE: Record<CourseStatus, "success" | "neutral" | "warning"> = {
  Published: "success",
  Draft: "neutral",
  Archived: "warning",
};

export function Library() {
  const navigate = useNavigate();
  const { courses, modules, lessons, packageAccessMatrix, accessGrants, lessonProgress, duplicateCourse, setCourseStatus } = useLmsStore();
  const { students } = useStudentStore();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [archiveTarget, setArchiveTarget] = useState<Course | null>(null);

  function studentsWithAccess(course: Course): number {
    return students.filter((s) => {
      const res = resolveCourseAccess(course, s, packageAccessMatrix, accessGrants, lessons, lessonProgress);
      return res.status !== "Locked" && res.status !== "Revoked";
    }).length;
  }

  function moduleCount(courseId: string) {
    return modules.filter((m) => m.courseId === courseId && m.status === "Active").length;
  }
  function lessonCount(courseId: string) {
    return lessons.filter((l) => l.courseId === courseId).length;
  }

  const filtered = courses.filter((c) => {
    if (categoryFilter !== "All" && c.category !== categoryFilter) return false;
    if (statusFilter !== "All" && c.status !== statusFilter) return false;
    if (search.trim() && !c.title.toLowerCase().includes(search.trim().toLowerCase()) && !c.courseId.toLowerCase().includes(search.trim().toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Course Library</h2>
          <p className="text-sm text-maia-ink-soft">{filtered.length} of {courses.length} course(s) shown.</p>
        </div>
        <Button onClick={() => navigate("/courses/builder")}>
          <Plus size={14} />
          NEW COURSE
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search title or Course ID..." />
        <FilterSelect
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[{ value: "All", label: "All Categories" }, ...COURSE_CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "All", label: "All Statuses" },
            { value: "Draft", label: "Draft" },
            { value: "Published", label: "Published" },
            { value: "Archived", label: "Archived" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((course) => (
          <Card key={course.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-maia-gold-bg text-xl">
                  {course.thumbnailLabel}
                </div>
                <div>
                  <p className="font-mono text-[11px] font-semibold text-maia-ink-soft">{course.courseId}</p>
                  <p className="font-display text-sm font-bold text-maia-ink">{course.title}</p>
                </div>
              </div>
              <Badge tone={STATUS_TONE[course.status]}>{course.status}</Badge>
            </div>

            <p className="line-clamp-2 text-sm text-maia-ink-soft">{course.shortDescription || "No description yet."}</p>

            <div className="flex flex-wrap gap-1.5 text-xs text-maia-ink-soft">
              <Badge tone="gold">{course.category}</Badge>
              <span className="rounded-full border border-maia-border px-2.5 py-1">{course.instructor}</span>
              <span className="rounded-full border border-maia-border px-2.5 py-1">
                {moduleCount(course.id)} module(s) · {lessonCount(course.id)} lesson(s)
              </span>
              {course.estimatedDuration && <span className="rounded-full border border-maia-border px-2.5 py-1">{course.estimatedDuration}</span>}
            </div>

            <p className="text-xs text-maia-ink-soft">
              <span className="font-semibold text-maia-ink">{studentsWithAccess(course)}</span> student(s) with access
            </p>

            <div className="mt-auto flex flex-wrap gap-1.5 border-t border-maia-border pt-3">
              <Button size="sm" variant="secondary" onClick={() => navigate(`/courses/${course.id}`)}>
                VIEW
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/courses/${course.id}/edit`)}>
                EDIT
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/courses/${course.id}`)}>
                MANAGE LESSONS
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/courses/access?course=${course.id}`)}>
                MANAGE ACCESS
              </Button>
              <Button size="sm" variant="secondary" onClick={() => duplicateCourse(course.id)}>
                <Copy size={12} />
                DUPLICATE
              </Button>
              {course.status !== "Archived" ? (
                <Button size="sm" variant="secondary" onClick={() => setArchiveTarget(course)}>
                  ARCHIVE
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setCourseStatus(course.id, "Draft")}>
                  RESTORE
                </Button>
              )}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="sm:col-span-2 xl:col-span-3">
            <p className="py-8 text-center text-sm text-maia-ink-soft">No courses match this filter.</p>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (archiveTarget) setCourseStatus(archiveTarget.id, "Archived");
          setArchiveTarget(null);
        }}
        title="Archive Course"
        description={`Archive "${archiveTarget?.title}"? Students will no longer see it in their course library. This can be undone from the library.`}
        confirmLabel="ARCHIVE"
        tone="danger"
      />
    </div>
  );
}

import { useState } from "react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { FilterSelect } from "@/components/common/FilterSelect";
import { ProgressBar } from "@/components/common/ProgressBar";
import { useLmsStore } from "@/data/lmsStore";
import { useStudentStore } from "@/data/studentStore";
import { useFinanceStore } from "@/data/financeStore";
import { getStudentFinanceSummary } from "@/utils/finance";
import { computeCourseProgress, resolveCourseAccess } from "@/utils/lms";

const BATCHES = ["Batch 14", "Batch 13", "Batch 12"] as const;
const PACKAGES = ["Premium", "VIP", "Dual VIP"] as const;
const PROGRESS_BUCKETS = ["0-25%", "25-50%", "50-75%", "75-100%"] as const;

function inBucket(percent: number, bucket: string): boolean {
  if (bucket === "0-25%") return percent < 25;
  if (bucket === "25-50%") return percent >= 25 && percent < 50;
  if (bucket === "50-75%") return percent >= 50 && percent < 75;
  return percent >= 75;
}

export function Progress() {
  const { courses, lessons, packageAccessMatrix, accessGrants, lessonProgress, automationSettings } = useLmsStore();
  const { students } = useStudentStore();
  const { transactions, adjustments } = useFinanceStore();

  const [batchFilter, setBatchFilter] = useState("All");
  const [packageFilter, setPackageFilter] = useState("All");
  const [courseFilter, setCourseFilter] = useState("All");
  const [progressFilter, setProgressFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const publishedCourses = courses.filter((c) => c.status === "Published");

  const rows = students.flatMap((student) => {
    const finance = getStudentFinanceSummary(student, transactions, adjustments);
    const isFullyPaidAndConfirmed = finance.status === "Fully Paid" && student.enrollmentStatus === "Confirmed Student";
    return publishedCourses
      .map((course) => ({
        student,
        course,
        access: resolveCourseAccess(course, student, packageAccessMatrix, accessGrants, lessons, lessonProgress, automationSettings, isFullyPaidAndConfirmed),
        progress: computeCourseProgress(student.id, course.id, lessons, lessonProgress),
      }))
      .filter((r) => r.access.status !== "Locked" && r.access.status !== "Revoked" && r.access.status !== "Expired");
  });

  const filtered = rows.filter((r) => {
    if (batchFilter !== "All" && r.student.batch !== batchFilter) return false;
    if (packageFilter !== "All" && r.student.package !== packageFilter) return false;
    if (courseFilter !== "All" && r.course.id !== courseFilter) return false;
    if (progressFilter !== "All" && !inBucket(r.progress.percent, progressFilter)) return false;
    if (statusFilter !== "All" && r.progress.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Course Progress</h2>
        <p className="text-sm text-maia-ink-soft">{filtered.length} student-course record(s) shown.</p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <FilterSelect value={batchFilter} onChange={setBatchFilter} options={[{ value: "All", label: "All Batches" }, ...BATCHES.map((b) => ({ value: b, label: b }))]} />
        <FilterSelect value={packageFilter} onChange={setPackageFilter} options={[{ value: "All", label: "All Packages" }, ...PACKAGES.map((p) => ({ value: p, label: p }))]} />
        <FilterSelect
          value={courseFilter}
          onChange={setCourseFilter}
          options={[{ value: "All", label: "All Courses" }, ...publishedCourses.map((c) => ({ value: c.id, label: c.title }))]}
        />
        <FilterSelect
          value={progressFilter}
          onChange={setProgressFilter}
          options={[{ value: "All", label: "All Progress" }, ...PROGRESS_BUCKETS.map((b) => ({ value: b, label: b }))]}
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "All", label: "All Statuses" },
            { value: "Not Started", label: "Not Started" },
            { value: "In Progress", label: "In Progress" },
            { value: "Completed", label: "Completed" },
          ]}
        />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Lessons Completed</th>
                <th className="px-4 py-3">Last Accessed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Completion Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ student, course, progress }) => (
                <tr key={`${student.id}-${course.id}`} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{student.fullName}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{student.studentId}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{student.batch}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{student.package}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{course.title}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24"><ProgressBar percent={progress.percent} /></div>
                      <span className="text-xs text-maia-ink-soft">{progress.percent}%</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                    {progress.lessonsCompleted}/{progress.totalLessons}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                    {progress.lastAccessedAt ? new Date(progress.lastAccessedAt).toLocaleDateString("en-PH") : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={progress.status === "Completed" ? "success" : progress.status === "In Progress" ? "gold" : "neutral"}>
                      {progress.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                    {progress.completedAt ? new Date(progress.completedAt).toLocaleDateString("en-PH") : "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No records match this filter.
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

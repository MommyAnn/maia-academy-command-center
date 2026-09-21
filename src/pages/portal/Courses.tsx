import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, PlayCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { ProgressBar } from "@/components/common/ProgressBar";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useLmsStore } from "@/data/lmsStore";
import { useFinanceStore } from "@/data/financeStore";
import { getStudentFinanceSummary } from "@/utils/finance";
import { resolveCourseAccess, computeCourseProgress } from "@/utils/lms";
import type { Course } from "@/types/lms";

export function Courses() {
  const { student } = useStudentPortal();
  const { courses, lessons, packageAccessMatrix, accessGrants, lessonProgress, automationSettings } = useLmsStore();
  const { transactions, adjustments } = useFinanceStore();
  const navigate = useNavigate();

  const isFullyPaidAndConfirmed =
    getStudentFinanceSummary(student, transactions, adjustments).status === "Fully Paid" && student.enrollmentStatus === "Confirmed Student";

  const published = courses.filter((c) => c.status === "Published");

  const resolved = useMemo(
    () =>
      published.map((course) => ({
        course,
        access: resolveCourseAccess(course, student, packageAccessMatrix, accessGrants, lessons, lessonProgress, automationSettings, isFullyPaidAndConfirmed),
        progress: computeCourseProgress(student.id, course.id, lessons, lessonProgress),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [published, student.id, packageAccessMatrix, accessGrants, lessons, lessonProgress, automationSettings, isFullyPaidAndConfirmed],
  );

  const accessible = resolved.filter((r) => r.access.status !== "Locked" && r.access.status !== "Revoked" && r.access.status !== "Expired");
  const continueLearning = accessible
    .filter((r) => r.progress.status === "In Progress")
    .sort((a, b) => (b.progress.lastAccessedAt ?? "").localeCompare(a.progress.lastAccessedAt ?? ""));
  const completed = accessible.filter((r) => r.progress.status === "Completed");
  const inLibrary = accessible.filter((r) => r.progress.status !== "Completed");
  const locked = resolved.filter((r) => r.access.status === "Locked" || r.access.status === "Revoked" || r.access.status === "Expired");

  const categories = Array.from(new Set(inLibrary.map((r) => r.course.category)));

  function CourseCard({ course, access, progress }: { course: Course; access: ReturnType<typeof resolveCourseAccess>; progress: ReturnType<typeof computeCourseProgress> }) {
    const isLocked = access.status === "Locked" || access.status === "Revoked" || access.status === "Expired";
    return (
      <button
        type="button"
        onClick={() => !isLocked && navigate(`/portal/courses/${course.id}`)}
        className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
          isLocked ? "border-maia-border/60 bg-maia-bg/60 cursor-default" : "border-maia-border bg-maia-surface hover:border-maia-gold"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-maia-gold-bg text-lg">{course.thumbnailLabel}</div>
            <div>
              <p className="text-sm font-semibold text-maia-ink">{course.title}</p>
              <p className="text-xs text-maia-ink-soft">{course.instructor} · {course.category}</p>
            </div>
          </div>
          {access.status === "Completed" && <Badge tone="success">Completed</Badge>}
          {access.status === "In Progress" && <Badge tone="gold">{progress.percent}%</Badge>}
        </div>

        {!isLocked && progress.totalLessons > 0 && (
          <div>
            <ProgressBar percent={progress.percent} />
            <p className="mt-1 text-[11px] text-maia-ink-soft">
              {progress.lessonsCompleted}/{progress.totalLessons} lessons · {progress.percent}% complete
            </p>
          </div>
        )}

        <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
          {isLocked ? (
            <span className="flex items-center gap-1 text-maia-ink-soft">
              <Lock size={13} />
              {access.reason}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-maia-gold-deep">
              <PlayCircle size={14} />
              {access.status === "Completed" ? "VIEW COMPLETED COURSE" : access.status === "In Progress" ? "CONTINUE" : "START"}
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-sm text-maia-ink-soft">
          Your M.A.I.A. learning library. This demo tracks lesson progress locally in this browser — not a production
          video hosting or sync backend yet.
        </p>
      </Card>

      {continueLearning.length > 0 && (
        <Card>
          <CardHeader title="Continue Learning" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {continueLearning.map(({ course, access, progress }) => (
              <CourseCard key={course.id} course={course} access={access} progress={progress} />
            ))}
          </div>
        </Card>
      )}

      {categories.map((category) => {
        const rows = inLibrary.filter((r) => r.course.category === category);
        if (rows.length === 0) return null;
        return (
          <Card key={category}>
            <CardHeader title={category} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map(({ course, access, progress }) => (
                <CourseCard key={course.id} course={course} access={access} progress={progress} />
              ))}
            </div>
          </Card>
        );
      })}

      {completed.length > 0 && (
        <Card>
          <CardHeader title="Completed Courses" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {completed.map(({ course, access, progress }) => (
              <CourseCard key={course.id} course={course} access={access} progress={progress} />
            ))}
          </div>
        </Card>
      )}

      {locked.length > 0 && (
        <Card>
          <CardHeader title="More Courses" subtitle="Not included in your current access yet." />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {locked.map(({ course, access, progress }) => (
              <CourseCard key={course.id} course={course} access={access} progress={progress} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

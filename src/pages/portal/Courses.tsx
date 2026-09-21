import { useMemo } from "react";
import { Lock, PlayCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { usePortalStore } from "@/data/portalStore";
import { DEMO_COURSES } from "@/data/portalConfig";
import { COURSE_CATEGORIES } from "@/types/portal";
import { hasCourseAccess } from "@/utils/portal";

export function Courses() {
  const { student } = useStudentPortal();
  const { courseAccessGrants } = usePortalStore();

  const byCategory = useMemo(() => {
    return COURSE_CATEGORIES.map((category) => ({
      category,
      courses: DEMO_COURSES.filter((c) => c.category === category),
    })).filter((group) => group.courses.length > 0);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-sm text-maia-ink-soft">
          These are the courses included with your package and batch. This is a preview of course access — not a
          full learning platform yet, so lesson-by-lesson progress isn&rsquo;t tracked here.
        </p>
      </Card>

      {byCategory.map(({ category, courses }) => (
        <Card key={category}>
          <CardHeader title={category} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => {
              const access = hasCourseAccess(course, student, courseAccessGrants);
              return (
                <div
                  key={course.id}
                  className={`flex flex-col gap-2 rounded-xl border p-4 ${
                    access ? "border-maia-border bg-maia-surface" : "border-maia-border/60 bg-maia-bg/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-maia-ink">{course.name}</p>
                    {access ? (
                      <Badge tone="success">Available</Badge>
                    ) : (
                      <Badge tone="neutral">Locked</Badge>
                    )}
                  </div>
                  <p className="text-xs text-maia-ink-soft">{course.description}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
                    {access ? (
                      <span className="flex items-center gap-1 text-maia-gold-deep">
                        <PlayCircle size={14} />
                        Available to you
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-maia-ink-soft">
                        <Lock size={13} />
                        Not included in your current package
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Lock, Video } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import { InfoTooltip } from "@/components/common/InfoTooltip";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useLmsStore } from "@/data/lmsStore";
import { useFinanceStore } from "@/data/financeStore";
import { getStudentFinanceSummary } from "@/utils/finance";
import { computeCourseProgress, getCourseStructure, resolveCourseAccess } from "@/utils/lms";

export function LessonPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { student } = useStudentPortal();
  const { courses, modules, lessons, packageAccessMatrix, accessGrants, lessonProgress, automationSettings, startLesson, completeLesson } = useLmsStore();
  const { transactions, adjustments } = useFinanceStore();

  const course = courses.find((c) => c.id === courseId);
  const lesson = lessons.find((l) => l.id === lessonId);
  const module = lesson ? modules.find((m) => m.id === lesson.moduleId) : undefined;

  const isFullyPaidAndConfirmed = course
    ? getStudentFinanceSummary(student, transactions, adjustments).status === "Fully Paid" && student.enrollmentStatus === "Confirmed Student"
    : false;
  const access = course
    ? resolveCourseAccess(course, student, packageAccessMatrix, accessGrants, lessons, lessonProgress, automationSettings, isFullyPaidAndConfirmed)
    : null;
  const hasAccess = access !== null && access.status !== "Locked" && access.status !== "Revoked" && access.status !== "Expired";

  const structure = course ? getCourseStructure(course.id, modules, lessons) : [];
  const orderedLessons = structure.flatMap((entry) => entry.lessons);
  const currentIndex = lesson ? orderedLessons.findIndex((l) => l.id === lesson.id) : -1;
  const previousLesson = currentIndex > 0 ? orderedLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < orderedLessons.length - 1 ? orderedLessons[currentIndex + 1] : null;

  const isCompleted = lessonProgress.some(
    (p) => p.studentId === student.id && p.lessonId === lesson?.id && p.status === "Completed",
  );
  const progress = course ? computeCourseProgress(student.id, course.id, lessons, lessonProgress) : null;

  useEffect(() => {
    if (course && lesson && hasAccess) {
      startLesson(student.id, course.id, lesson.moduleId, lesson.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id, lesson?.id, hasAccess]);

  if (!course || !lesson || !module) {
    return (
      <Card>
        <p className="text-sm text-maia-ink-soft">Lesson not found.</p>
        <Button className="mt-3" variant="secondary" onClick={() => navigate("/portal/courses")}>
          BACK TO MY COURSES
        </Button>
      </Card>
    );
  }

  if (!hasAccess) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Lock size={28} className="text-maia-ink-soft" />
          <p className="text-sm text-maia-ink-soft">{access?.reason ?? "You don't have access to this course."}</p>
          <Button variant="secondary" onClick={() => navigate("/portal/courses")}>
            BACK TO MY COURSES
          </Button>
        </div>
      </Card>
    );
  }

  function handleMarkComplete() {
    if (!course || !lesson) return;
    completeLesson(student.id, course.id, lesson.moduleId, lesson.id);
    if (nextLesson) navigate(`/portal/courses/${course.id}/lessons/${nextLesson.id}`);
  }

  const isVideo = lesson.type === "Video Lesson" || lesson.type === "Live Session / Replay";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-maia-ink-soft">
        <button onClick={() => navigate(`/portal/courses/${course.id}`)} className="flex items-center gap-1 hover:text-maia-gold-deep">
          <ChevronLeft size={14} />
          {course.title}
        </button>
        <span>{module.title} · {lesson.title}</span>
      </div>

      {progress && progress.totalLessons > 0 && (
        <div>
          <ProgressBar percent={progress.percent} />
          <p className="mt-1 text-[11px] text-maia-ink-soft">
            {progress.lessonsCompleted}/{progress.totalLessons} lessons · {progress.percent}% complete
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Content first on mobile, side-by-side on desktop */}
        <div className="flex flex-1 flex-col gap-4">
          <Card>
            {isVideo ? (
              <div className="flex flex-col gap-3">
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl bg-maia-black text-maia-gold-soft">
                  <Video size={32} />
                  <p className="text-sm font-semibold">{lesson.videoProvider || "No provider set"}</p>
                  <p className="font-mono text-[10px] text-maia-gold-soft/70">ref: {lesson.videoRef || "—"}</p>
                </div>
                <div className="flex items-start gap-1.5 rounded-lg bg-maia-bg px-3 py-2">
                  <InfoTooltip text="This demo has no real video hosting behind it — hiding a download button does not make a video protected. A production build needs a real secure hosting/DRM provider here." />
                  <p className="text-xs text-maia-ink-soft">Demo video placeholder — not a real, securely hosted video yet.</p>
                </div>
              </div>
            ) : lesson.type === "Text Lesson" ? (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-maia-gold-deep">
                  <FileText size={13} />
                  Lesson Notes
                </div>
                <p className="whitespace-pre-line text-sm text-maia-ink">{lesson.textContent || "No content yet."}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <FileText size={26} className="text-maia-ink-soft" />
                <p className="text-sm font-semibold text-maia-ink">{lesson.type}</p>
                <p className="text-xs text-maia-ink-soft">See resources below for this lesson's materials.</p>
              </div>
            )}

            <p className="mt-4 text-sm text-maia-ink-soft">{lesson.description}</p>

            {lesson.resources.length > 0 && (
              <div className="mt-4 border-t border-maia-border pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Resources</p>
                <div className="flex flex-col gap-2">
                  {lesson.resources.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-maia-border px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        {r.type === "External Link" ? <ExternalLink size={14} className="text-maia-gold-deep" /> : <Download size={14} className="text-maia-gold-deep" />}
                        <span className="text-maia-ink">{r.label || r.type}</span>
                      </div>
                      <span className="text-xs text-maia-ink-soft">{r.fileSizeLabel || r.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="secondary"
              disabled={!previousLesson}
              onClick={() => previousLesson && navigate(`/portal/courses/${course.id}/lessons/${previousLesson.id}`)}
            >
              <ChevronLeft size={14} />
              PREVIOUS
            </Button>
            <div className="flex gap-2">
              {isCompleted ? (
                <Badge tone="success">
                  <Check size={12} />
                  Completed
                </Badge>
              ) : (
                <Button onClick={handleMarkComplete}>
                  <Check size={14} />
                  MARK AS COMPLETE
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={!nextLesson}
                onClick={() => nextLesson && navigate(`/portal/courses/${course.id}/lessons/${nextLesson.id}`)}
              >
                NEXT
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>

        {/* Lesson/module nav — below content on mobile, side panel on desktop */}
        <Card className="lg:w-80 lg:flex-shrink-0">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Course Content</p>
          <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
            {structure.map(({ module: mod, lessons: moduleLessons }) => (
              <div key={mod.id}>
                <p className="mb-1.5 text-xs font-semibold text-maia-ink-soft">{mod.title}</p>
                <div className="flex flex-col gap-1">
                  {moduleLessons.map((l) => {
                    const done = lessonProgress.some((p) => p.studentId === student.id && p.lessonId === l.id && p.status === "Completed");
                    const active = l.id === lesson.id;
                    return (
                      <button
                        key={l.id}
                        onClick={() => navigate(`/portal/courses/${course.id}/lessons/${l.id}`)}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                          active ? "bg-maia-gold-bg text-maia-gold-deep font-semibold" : "text-maia-ink-soft hover:bg-maia-bg"
                        }`}
                      >
                        {done ? <Check size={12} className="flex-shrink-0 text-maia-success" /> : <span className="h-3 w-3 flex-shrink-0" />}
                        {l.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

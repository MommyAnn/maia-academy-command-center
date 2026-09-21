import { useNavigate, useParams } from "react-router-dom";
import { Award, Check, Lock, MessageSquareHeart, PlayCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useLmsStore } from "@/data/lmsStore";
import { useFinanceStore } from "@/data/financeStore";
import { useFeedbackStore } from "@/data/feedbackStore";
import { getStudentFinanceSummary } from "@/utils/finance";
import { computeCourseProgress, getCourseStructure, resolveCourseAccess } from "@/utils/lms";
import { hasExistingFeedbackRequest } from "@/utils/feedback";

export function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { student } = useStudentPortal();
  const { courses, modules, lessons, packageAccessMatrix, accessGrants, lessonProgress, automationSettings } = useLmsStore();
  const { transactions, adjustments } = useFinanceStore();
  const { requests, submissions } = useFeedbackStore();

  const course = courses.find((c) => c.id === courseId);

  if (!course) {
    return (
      <Card>
        <p className="text-sm text-maia-ink-soft">Course not found.</p>
        <Button className="mt-3" variant="secondary" onClick={() => navigate("/portal/courses")}>
          BACK TO MY COURSES
        </Button>
      </Card>
    );
  }

  const isFullyPaidAndConfirmed =
    getStudentFinanceSummary(student, transactions, adjustments).status === "Fully Paid" && student.enrollmentStatus === "Confirmed Student";
  const access = resolveCourseAccess(course, student, packageAccessMatrix, accessGrants, lessons, lessonProgress, automationSettings, isFullyPaidAndConfirmed);
  const progress = computeCourseProgress(student.id, course.id, lessons, lessonProgress);
  const structure = getCourseStructure(course.id, modules, lessons);

  if (access.status === "Locked" || access.status === "Revoked" || access.status === "Expired") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Lock size={28} className="text-maia-ink-soft" />
          <p className="font-display text-base font-bold text-maia-ink">{course.title}</p>
          <p className="max-w-md text-sm text-maia-ink-soft">{access.reason}</p>
          <Button variant="secondary" onClick={() => navigate("/portal/courses")}>
            BACK TO MY COURSES
          </Button>
        </div>
      </Card>
    );
  }

  // Overall ordered lesson list across the whole course, used to derive
  // Completed / Current / Locked (sequential unlock, spec section 11).
  const orderedLessons = structure.flatMap((entry) => entry.lessons);
  const completedIds = new Set(
    lessonProgress.filter((p) => p.studentId === student.id && p.courseId === course.id && p.status === "Completed").map((p) => p.lessonId),
  );
  const currentIndex = orderedLessons.findIndex((l) => !completedIds.has(l.id));

  const feedbackRequest =
    access.status === "Completed"
      ? requests.find(
          (r) =>
            r.status === "Open" &&
            r.sourceType === "Course" &&
            r.sourceId === course.id &&
            (r.audience === "All Eligible Students" || r.audienceStudentId === student.id) &&
            !hasExistingFeedbackRequest(student.id, r.sourceType, r.sourceId, [], submissions),
        )
      : undefined;

  function lessonState(index: number): "completed" | "current" | "locked" {
    if (completedIds.has(orderedLessons[index].id)) return "completed";
    if (index === currentIndex || currentIndex === -1) return "current";
    return index < currentIndex ? "current" : "locked";
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-maia-gold-bg text-2xl">{course.thumbnailLabel}</div>
            <div>
              <h2 className="font-display text-lg font-bold text-maia-ink">{course.title}</h2>
              <p className="text-sm text-maia-ink-soft">{course.instructor} · {course.category}</p>
            </div>
          </div>
          {access.status === "Completed" && <Badge tone="success">Course Completed</Badge>}
        </div>
        <p className="mt-3 text-sm text-maia-ink-soft">{course.fullDescription || course.shortDescription}</p>

        {progress.totalLessons > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-maia-ink-soft">
              <span>{progress.lessonsCompleted}/{progress.totalLessons} lessons completed</span>
              <span>{progress.percent}%</span>
            </div>
            <ProgressBar percent={progress.percent} className="mt-1.5" />
          </div>
        )}

        {orderedLessons.length > 0 && (
          <Button
            className="mt-4"
            onClick={() => {
              const target = currentIndex === -1 ? orderedLessons[0] : orderedLessons[currentIndex];
              if (target) navigate(`/portal/courses/${course.id}/lessons/${target.id}`);
            }}
          >
            <PlayCircle size={15} />
            {progress.status === "Completed" ? "REVIEW COURSE" : progress.status === "In Progress" ? "CONTINUE LEARNING" : "START COURSE"}
          </Button>
        )}
      </Card>

      {access.status === "Completed" && feedbackRequest && (
        <Card className="border-maia-gold/40 bg-maia-gold-bg/60">
          <div className="flex items-center gap-3">
            <MessageSquareHeart size={22} className="flex-shrink-0 text-maia-gold-deep" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-maia-ink">Congratulations on completing {course.title}!</p>
              <p className="text-xs text-maia-ink-soft">Share your feedback — it only takes a minute and helps future students.</p>
            </div>
            <Button size="sm" className="ml-auto flex-shrink-0" onClick={() => navigate(`/portal/feedback/${feedbackRequest.id}`)}>
              SHARE FEEDBACK
            </Button>
          </div>
        </Card>
      )}

      {access.status === "Completed" && course.certificateEligible && (
        <Card className="border-maia-gold/40 bg-maia-gold-bg/60">
          <div className="flex items-center gap-3">
            <Award size={22} className="flex-shrink-0 text-maia-gold-deep" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-maia-ink">Certificate Eligible!</p>
              <p className="text-xs text-maia-ink-soft">
                You've completed this course and it qualifies for a certificate. Check your Certificates page for status.
              </p>
            </div>
            <Button size="sm" className="ml-auto flex-shrink-0" onClick={() => navigate("/portal/certificates")}>
              VIEW CERTIFICATES
            </Button>
          </div>
        </Card>
      )}

      {structure.map(({ module, lessons: moduleLessons }) => (
        <Card key={module.id}>
          <CardHeader title={module.title} />
          <div className="flex flex-col gap-2">
            {moduleLessons.map((lesson) => {
              const idx = orderedLessons.findIndex((l) => l.id === lesson.id);
              const state = lessonState(idx);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  disabled={state === "locked"}
                  onClick={() => navigate(`/portal/courses/${course.id}/lessons/${lesson.id}`)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    state === "locked" ? "border-maia-border/60 bg-maia-bg/50 cursor-not-allowed" : "border-maia-border bg-maia-surface hover:border-maia-gold"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {state === "completed" && (
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-maia-success-bg text-maia-success">
                        <Check size={14} />
                      </span>
                    )}
                    {state === "current" && (
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-maia-gold-bg text-maia-gold-deep">
                        <PlayCircle size={14} />
                      </span>
                    )}
                    {state === "locked" && (
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-maia-bg text-maia-ink-soft">
                        <Lock size={12} />
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-maia-ink">{lesson.title}</p>
                      <p className="text-xs text-maia-ink-soft">{lesson.type} {lesson.duration && `· ${lesson.duration}`}</p>
                    </div>
                  </div>
                </button>
              );
            })}
            {moduleLessons.length === 0 && <p className="text-xs text-maia-ink-soft">No published lessons yet.</p>}
          </div>
        </Card>
      ))}
    </div>
  );
}

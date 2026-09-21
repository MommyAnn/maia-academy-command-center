import { useNavigate } from "react-router-dom";
import {
  Award,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileCheck2,
  GraduationCap,
  MessagesSquare,
  PlayCircle,
  ShoppingBag,
} from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useFinanceStore } from "@/data/financeStore";
import { useTrainingStore } from "@/data/trainingStore";
import { usePortalStore } from "@/data/portalStore";
import { useLmsStore } from "@/data/lmsStore";
import { useStudentNotifications } from "@/components/portal/useStudentNotifications";
import { ENROLLMENT_STATUS_TONE } from "@/components/students/statusMeta";
import { JOURNEY_STEP_STATUS_TONE } from "@/components/portal/statusMeta";
import { getStudentFinanceSummary } from "@/utils/finance";
import { getRequirementsSummary } from "@/utils/students";
import { computeJourneySteps, computeNextAction, isAnnouncementVisibleToStudent } from "@/utils/portal";
import { computeCourseProgress, resolveCourseAccess } from "@/utils/lms";

export function Home() {
  const { student } = useStudentPortal();
  const { transactions, adjustments } = useFinanceStore();
  const { sessions, getEnrollmentsForStudent, getCertificatesForStudent } = useTrainingStore();
  const { announcements } = usePortalStore();
  const { courses, modules, lessons, packageAccessMatrix, accessGrants, lessonProgress, automationSettings } = useLmsStore();
  const notifications = useStudentNotifications();
  const navigate = useNavigate();

  const finance = getStudentFinanceSummary(student, transactions, adjustments);
  const sessionEnrollments = getEnrollmentsForStudent(student.id);
  const certificates = getCertificatesForStudent(student.id);
  const journey = computeJourneySteps({ student, finance, sessionEnrollments, sessions, certificates });
  const nextAction = computeNextAction(journey);

  const isFullyPaidAndConfirmed = finance.status === "Fully Paid" && student.enrollmentStatus === "Confirmed Student";
  const publishedCourses = courses.filter((c) => c.status === "Published");
  const courseSummaries = publishedCourses.map((course) => ({
    course,
    access: resolveCourseAccess(course, student, packageAccessMatrix, accessGrants, lessons, lessonProgress, automationSettings, isFullyPaidAndConfirmed),
    progress: computeCourseProgress(student.id, course.id, lessons, lessonProgress),
  }));
  const accessibleCourses = courseSummaries.filter(
    (s) => s.access.status !== "Locked" && s.access.status !== "Revoked" && s.access.status !== "Expired",
  );
  const coursesInProgress = accessibleCourses.filter((s) => s.progress.status === "In Progress");
  const coursesCompleted = accessibleCourses.filter((s) => s.progress.status === "Completed");

  const mostRecentInProgress = coursesInProgress.sort((a, b) =>
    (b.progress.lastAccessedAt ?? "").localeCompare(a.progress.lastAccessedAt ?? ""),
  )[0];
  const mostRecentLessonProgress = mostRecentInProgress
    ? lessonProgress
        .filter((p) => p.studentId === student.id && p.courseId === mostRecentInProgress.course.id)
        .sort((a, b) => b.lastAccessedAt.localeCompare(a.lastAccessedAt))[0]
    : undefined;
  const mostRecentLesson = mostRecentLessonProgress ? lessons.find((l) => l.id === mostRecentLessonProgress.lessonId) : undefined;
  const mostRecentModule = mostRecentLesson ? modules.find((m) => m.id === mostRecentLesson.moduleId) : undefined;

  const importantAnnouncement = announcements
    .filter((a) => a.important && isAnnouncementVisibleToStudent(a, student))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  const upcomingSession = sessionEnrollments
    .map((e) => sessions.find((s) => s.id === e.sessionId))
    .filter((s): s is NonNullable<typeof s> => Boolean(s) && (s!.status === "Scheduled" || s!.status === "Ongoing"))
    .sort((a, b) => (a!.date < b!.date ? -1 : 1))[0];

  const requirementsSummary = getRequirementsSummary(student);

  return (
    <div className="flex flex-col gap-4">
      {/* Welcome header */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-bold text-maia-ink sm:text-xl">
              Welcome back, {student.fullName.split(" ")[0]}!
            </p>
            <p className="mt-1 text-sm text-maia-ink-soft">Here&rsquo;s where you stand in your M.A.I.A. journey.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{student.studentId}</Badge>
            <Badge tone="neutral">{student.batch}</Badge>
            <Badge tone="gold">{student.package}</Badge>
            <Badge tone={ENROLLMENT_STATUS_TONE[student.enrollmentStatus]}>{student.enrollmentStatus}</Badge>
          </div>
        </div>
      </Card>

      {/* Important announcement banner */}
      {importantAnnouncement && (
        <button
          onClick={() => navigate("/portal/announcements")}
          className="flex items-start gap-3 rounded-2xl border border-maia-gold/40 bg-maia-gold-bg px-4 py-3.5 text-left transition-colors hover:border-maia-gold"
        >
          <MessagesSquare size={18} className="mt-0.5 flex-shrink-0 text-maia-gold-deep" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-maia-ink">{importantAnnouncement.title}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-maia-ink-soft">{importantAnnouncement.message}</p>
          </div>
        </button>
      )}

      {/* What's Next widget */}
      <Card className="border-maia-gold/30 bg-gradient-to-br from-maia-gold-bg/70 to-maia-surface">
        <CardHeader title="What's Next?" subtitle="The single most important thing for you to do right now." />
        {nextAction ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-maia-ink">{nextAction.title}</p>
              <p className="mt-1 text-sm text-maia-ink-soft">{nextAction.description}</p>
            </div>
            <Button onClick={() => navigate(nextAction.ctaPath)} className="w-full sm:w-auto">
              {nextAction.ctaLabel}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-maia-ink-soft">You&rsquo;re all caught up — nothing needs your action right now.</p>
        )}
      </Card>

      {/* Journey progress tracker */}
      <Card>
        <CardHeader title="My Journey" subtitle="Your step-by-step progress through the Academy." />
        <div className="flex flex-wrap gap-2 sm:gap-0 sm:overflow-x-auto">
          {journey.map((step, idx) => (
            <div key={step.key} className="flex flex-1 min-w-[110px] flex-col items-center gap-1.5 px-1 text-center">
              <div className="flex w-full items-center">
                <div
                  className={`mx-auto flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.status === "Completed"
                      ? "bg-maia-success text-white"
                      : step.status === "Needs Action"
                        ? "bg-maia-danger text-white"
                        : step.status === "In Progress" || step.status === "Pending"
                          ? "bg-maia-gold text-maia-black"
                          : "bg-maia-bg text-maia-ink-soft border border-maia-border"
                  }`}
                >
                  {idx + 1}
                </div>
              </div>
              <p className="text-xs font-semibold text-maia-ink">{step.label}</p>
              <Badge tone={JOURNEY_STEP_STATUS_TONE[step.status]}>{step.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick status cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <QuickStatusCard
          icon={<CreditCard size={16} />}
          label="Payment"
          value={finance.status}
          onClick={() => navigate("/portal/payments")}
        />
        <QuickStatusCard
          icon={<FileCheck2 size={16} />}
          label="Requirements"
          value={requirementsSummary}
          onClick={() => navigate("/portal/requirements")}
        />
        <QuickStatusCard
          icon={<ShoppingBag size={16} />}
          label="Taobao"
          value={student.taobao.status}
          onClick={() => navigate("/portal/taobao")}
        />
        <QuickStatusCard
          icon={<ClipboardList size={16} />}
          label="Master Brain"
          value={student.masterBrainStatus}
          onClick={() => navigate("/portal/master-brain")}
        />
        <QuickStatusCard
          icon={<CalendarClock size={16} />}
          label="Next Training"
          value={upcomingSession ? upcomingSession.date : "None scheduled"}
          onClick={() => navigate("/portal/training")}
        />
        <QuickStatusCard
          icon={<Award size={16} />}
          label="Certificate"
          value={certificates[0]?.status ?? "Not Started"}
          onClick={() => navigate("/portal/courses")}
        />
        <QuickStatusCard
          icon={<GraduationCap size={16} />}
          label="Courses"
          value={`${accessibleCourses.length} avail · ${coursesInProgress.length} in progress · ${coursesCompleted.length} done`}
          onClick={() => navigate("/portal/courses")}
        />
      </div>

      {/* Continue Learning */}
      <Card>
        <CardHeader title="Continue Learning" action={<Button variant="ghost" size="sm" onClick={() => navigate("/portal/courses")}>MY COURSES</Button>} />
        {mostRecentInProgress ? (
          <button
            onClick={() =>
              mostRecentLesson
                ? navigate(`/portal/courses/${mostRecentInProgress.course.id}/lessons/${mostRecentLesson.id}`)
                : navigate(`/portal/courses/${mostRecentInProgress.course.id}`)
            }
            className="flex w-full flex-col gap-3 rounded-xl bg-maia-bg px-4 py-3.5 text-left transition-colors hover:bg-maia-gold-bg sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-maia-gold-bg text-lg">
                {mostRecentInProgress.course.thumbnailLabel}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-maia-ink">{mostRecentInProgress.course.title}</p>
                {mostRecentModule && mostRecentLesson && (
                  <p className="text-xs text-maia-ink-soft">{mostRecentModule.title} · {mostRecentLesson.title}</p>
                )}
                <div className="mt-1.5 w-40">
                  <ProgressBar percent={mostRecentInProgress.progress.percent} />
                </div>
              </div>
            </div>
            <Button className="w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
              <PlayCircle size={14} />
              CONTINUE ({mostRecentInProgress.progress.percent}%)
            </Button>
          </button>
        ) : (
          <p className="rounded-xl bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft">
            {accessibleCourses.length > 0 ? "Start a course to see your progress here." : "No courses available yet."}
          </p>
        )}
      </Card>

      {/* Upcoming training preview */}
      <Card>
        <CardHeader title="Upcoming Training" action={<Button variant="ghost" size="sm" onClick={() => navigate("/portal/training")}>VIEW ALL</Button>} />
        {upcomingSession ? (
          <div className="flex items-center gap-3 rounded-xl bg-maia-bg px-4 py-3.5">
            <CalendarClock size={18} className="flex-shrink-0 text-maia-gold-deep" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-maia-ink">{upcomingSession.title}</p>
              <p className="text-xs text-maia-ink-soft">
                {upcomingSession.date} &middot; {upcomingSession.startTime}–{upcomingSession.endTime} &middot; {upcomingSession.type}
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft">
            No upcoming training scheduled yet.
          </p>
        )}
      </Card>

      {/* Recent notifications */}
      <Card>
        <CardHeader title="Recent Notifications" subtitle="Refreshed live — not a real-time push system yet." />
        {notifications.length === 0 ? (
          <p className="rounded-xl bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft">You&rsquo;re all caught up!</p>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.slice(0, 5).map((n) => (
              <button
                key={n.id}
                onClick={n.onClick}
                className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-maia-bg"
              >
                <span className="mt-0.5 flex-shrink-0">{n.icon}</span>
                <span className="text-maia-ink">{n.message}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function QuickStatusCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-2xl border border-maia-border bg-maia-surface p-3.5 text-left transition-colors hover:border-maia-gold sm:p-4"
    >
      <div className="flex items-center gap-1.5 text-maia-gold-deep">{icon}</div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className="truncate text-sm font-bold text-maia-ink">{value}</p>
    </button>
  );
}

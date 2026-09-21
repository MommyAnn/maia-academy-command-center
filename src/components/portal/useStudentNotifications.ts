import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Award, Brain, CalendarClock, ClipboardCheck, GraduationCap, MessageSquareHeart, MessageSquareWarning, ShoppingBag } from "lucide-react";
import { createElement, type ReactNode } from "react";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useTrainingStore } from "@/data/trainingStore";
import { usePortalStore } from "@/data/portalStore";
import { useLmsStore } from "@/data/lmsStore";
import { useFeedbackStore } from "@/data/feedbackStore";
import { isAnnouncementVisibleToStudent } from "@/utils/portal";
import { hasExistingFeedbackRequest } from "@/utils/feedback";
import { computeCourseProgress } from "@/utils/lms";

export interface StudentNotificationItem {
  id: string;
  message: string;
  icon: ReactNode;
  onClick: () => void;
}

/**
 * Shared "what does this student need to know right now" computation, used
 * by both the notifications bell (StudentNotificationsDropdown) and the
 * Home Dashboard's Recent Notifications section — one source of truth so
 * the two never disagree. Same "prepared, not real-time" caveat as the
 * Admin NotificationsDropdown: this is real data computed on render, not a
 * push notification system.
 */
export function useStudentNotifications(): StudentNotificationItem[] {
  const { student } = useStudentPortal();
  const { sessions, getEnrollmentsForStudent } = useTrainingStore();
  const { announcements } = usePortalStore();
  const { courses, lessons, lessonProgress } = useLmsStore();
  const { requests: feedbackRequests, submissions: feedbackSubmissions, redemptions, incentives } = useFeedbackStore();
  const navigate = useNavigate();

  return useMemo<StudentNotificationItem[]>(() => {
    const list: StudentNotificationItem[] = [];

    if (student.proofOfPayment.status === "Needs Resubmission" || student.validId.status === "Needs Resubmission") {
      list.push({
        id: "req-resubmit",
        message: "A requirement needs resubmission — please check My Requirements.",
        icon: createElement(MessageSquareWarning, { size: 15, className: "text-maia-danger" }),
        onClick: () => navigate("/portal/requirements"),
      });
    }

    if (student.taobao.status === "For Account Creation") {
      list.push({
        id: "taobao-processing",
        message: "Your Taobao account is being processed.",
        icon: createElement(ShoppingBag, { size: 15, className: "text-maia-info" }),
        onClick: () => navigate("/portal/taobao"),
      });
    }
    if (student.taobao.status === "Login Details Ready" || student.taobao.status === "Login Details Given to Student") {
      list.push({
        id: "taobao-ready",
        message: "Your Taobao account is ready.",
        icon: createElement(ShoppingBag, { size: 15, className: "text-maia-success" }),
        onClick: () => navigate("/portal/taobao"),
      });
    }

    if (student.masterBrainStatus === "Needs Revision") {
      list.push({
        id: "masterbrain-needs-revision",
        message: "Your Master Brain needs revision — please check My Master Brain.",
        icon: createElement(Brain, { size: 15, className: "text-maia-danger" }),
        onClick: () => navigate("/portal/master-brain"),
      });
    }
    if (student.masterBrainStatus === "Published") {
      list.push({
        id: "masterbrain-published",
        message: "Your Brand Master Brain is ready!",
        icon: createElement(Brain, { size: 15, className: "text-maia-success" }),
        onClick: () => navigate("/portal/master-brain"),
      });
    }

    const upcoming = getEnrollmentsForStudent(student.id)
      .map((e) => sessions.find((s) => s.id === e.sessionId))
      .filter((s): s is NonNullable<typeof s> => Boolean(s) && s!.status === "Scheduled");
    const todayIso = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);
    for (const s of upcoming) {
      if (s.date === tomorrowIso) {
        list.push({
          id: `session-tomorrow-${s.id}`,
          message: `Your training "${s.title}" is tomorrow.`,
          icon: createElement(CalendarClock, { size: 15, className: "text-maia-gold-deep" }),
          onClick: () => navigate("/portal/training"),
        });
      } else if (s.date >= todayIso) {
        list.push({
          id: `session-scheduled-${s.id}`,
          message: `Training scheduled: "${s.title}" on ${s.date}.`,
          icon: createElement(CalendarClock, { size: 15, className: "text-maia-info" }),
          onClick: () => navigate("/portal/training"),
        });
      }
    }

    const visibleAnnouncements = announcements.filter((a) => isAnnouncementVisibleToStudent(a, student));
    for (const a of visibleAnnouncements.slice(0, 2)) {
      list.push({
        id: `announcement-${a.id}`,
        message: `New announcement: "${a.title}"`,
        icon: createElement(ClipboardCheck, { size: 15, className: "text-maia-info" }),
        onClick: () => navigate("/portal/announcements"),
      });
    }

    const now = new Date();
    const openRequests = feedbackRequests.filter((r) => {
      if (r.status !== "Open") return false;
      if (r.closeDate && new Date(r.closeDate) < now) return false;
      const targetsStudent = r.audience === "All Eligible Students" || r.audienceStudentId === student.id;
      if (!targetsStudent) return false;
      return !hasExistingFeedbackRequest(student.id, r.sourceType, r.sourceId, [], feedbackSubmissions);
    });
    for (const r of openRequests.slice(0, 2)) {
      list.push({
        id: `feedback-requested-${r.id}`,
        message: `Share your feedback on ${r.sourceLabel}.`,
        icon: createElement(MessageSquareHeart, { size: 15, className: "text-maia-gold-deep" }),
        onClick: () => navigate(`/portal/feedback/${r.id}`),
      });
    }

    const myRedemptions = redemptions.filter((r) => r.studentId === student.id);
    for (const r of myRedemptions.slice(0, 1)) {
      const incentive = incentives.find((i) => i.id === r.incentiveId);
      list.push({
        id: `bonus-unlocked-${r.id}`,
        message: `🎁 Your bonus is ready: ${incentive?.name ?? "a feedback reward"}!`,
        icon: createElement(Award, { size: 15, className: "text-maia-gold-deep" }),
        onClick: () => navigate("/portal/feedback"),
      });
    }

    const publishedCourses = courses.filter((c) => c.status === "Published");
    const completedCourse = publishedCourses.find(
      (c) => computeCourseProgress(student.id, c.id, lessons, lessonProgress).status === "Completed",
    );
    if (completedCourse) {
      list.push({
        id: `course-completed-${completedCourse.id}`,
        message: `Course completed: ${completedCourse.title}!`,
        icon: createElement(GraduationCap, { size: 15, className: "text-maia-success" }),
        onClick: () => navigate(`/portal/courses/${completedCourse.id}`),
      });
    }

    return list.slice(0, 8);
  }, [
    student,
    sessions,
    getEnrollmentsForStudent,
    announcements,
    navigate,
    courses,
    lessons,
    lessonProgress,
    feedbackRequests,
    feedbackSubmissions,
    redemptions,
    incentives,
  ]);
}

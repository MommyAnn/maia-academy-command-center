// Course Access & LMS calculation helpers — Step 9.

import type { StudentRecord } from "@/types/student";
import type {
  Course,
  CourseAccessAutomationSettings,
  CourseAccessGrant,
  CourseAccessResolution,
  CourseAccessStatus,
  Lesson,
  LessonProgress,
  Module,
  PackageAccessMatrix,
} from "@/types/lms";
import { DEFAULT_ACCESS_AUTOMATION_SETTINGS } from "@/types/lms";

export function generateCourseId(existing: Course[]): string {
  const nextSeq = String(existing.length + 1).padStart(4, "0");
  return `CRS-${nextSeq}`;
}

export function generateLessonId(existing: Lesson[]): string {
  const nextSeq = String(existing.length + 1).padStart(6, "0");
  return `LSN-${nextSeq}`;
}

function isGrantActive(grant: CourseAccessGrant, reference = new Date()): boolean {
  if (grant.status !== "Active") return false;
  if (grant.expiresAt && new Date(grant.expiresAt) < reference) return false;
  return true;
}

export interface CourseProgressSummary {
  lessonsCompleted: number;
  totalLessons: number;
  percent: number;
  status: "Not Started" | "In Progress" | "Completed";
  lastAccessedAt: string | null;
  completedAt: string | null;
}

/** The single place every page reads a student's course progress from — never a separately stored/duplicated total. */
export function computeCourseProgress(
  studentId: string,
  courseId: string,
  lessons: Lesson[],
  lessonProgress: LessonProgress[],
): CourseProgressSummary {
  const publishedLessons = lessons.filter((l) => l.courseId === courseId && l.status === "Published");
  const myProgress = lessonProgress.filter((p) => p.studentId === studentId && p.courseId === courseId);

  const completedIds = new Set(myProgress.filter((p) => p.status === "Completed").map((p) => p.lessonId));
  const lessonsCompleted = publishedLessons.filter((l) => completedIds.has(l.id)).length;
  const totalLessons = publishedLessons.length;
  const percent = totalLessons > 0 ? Math.round((lessonsCompleted / totalLessons) * 100) : 0;

  const hasAnyProgress = myProgress.some((p) => p.status !== "Not Started");
  const status: CourseProgressSummary["status"] =
    totalLessons > 0 && lessonsCompleted === totalLessons ? "Completed" : hasAnyProgress ? "In Progress" : "Not Started";

  const lastAccessedAt =
    myProgress.length > 0
      ? myProgress.reduce((latest, p) => (p.lastAccessedAt > latest ? p.lastAccessedAt : latest), myProgress[0].lastAccessedAt)
      : null;
  const completedAt =
    status === "Completed"
      ? myProgress
          .filter((p) => p.status === "Completed" && p.completedAt)
          .reduce((latest, p) => (!latest || (p.completedAt as string) > latest ? (p.completedAt as string) : latest), null as string | null)
      : null;

  return { lessonsCompleted, totalLessons, percent, status, lastAccessedAt, completedAt };
}

/**
 * The single place every page resolves whether a student can see a course,
 * and what state it's in — combining the package matrix, individual
 * grants, and live lesson progress (spec sections 16-17-20). Never a
 * hard-coded rule.
 */
export function resolveCourseAccess(
  course: Course,
  student: StudentRecord,
  matrix: PackageAccessMatrix,
  grants: CourseAccessGrant[],
  lessons: Lesson[],
  lessonProgress: LessonProgress[],
  automation: CourseAccessAutomationSettings = DEFAULT_ACCESS_AUTOMATION_SETTINGS,
  isFullyPaidAndConfirmed = true,
): CourseAccessResolution {
  const myGrants = grants.filter((g) => g.studentId === student.id && g.courseId === course.id);
  const activeGrant = myGrants.find((g) => isGrantActive(g));
  const expiredOrRevokedGrant = myGrants
    .filter((g) => !isGrantActive(g))
    .sort((a, b) => (b.grantedAt > a.grantedAt ? 1 : -1))[0];

  const packageMatches = course.accessType === "Package" && (matrix[student.package] ?? []).includes(course.id);
  const gatedByPayment = automation.grantOnFullyPaidAndConfirmed && !isFullyPaidAndConfirmed;
  const inPackageMatrix = packageMatches && !gatedByPayment;
  const isOpen = course.accessType === "Open";

  const granted = Boolean(activeGrant) || inPackageMatrix || isOpen;

  if (!granted) {
    if (packageMatches && gatedByPayment) {
      return {
        status: "Locked",
        reason: "This course unlocks automatically once your enrollment is fully paid and confirmed.",
        grant: null,
      };
    }
    if (expiredOrRevokedGrant?.status === "Expired") {
      return {
        status: "Expired",
        reason: `Your access to this course expired on ${new Date(expiredOrRevokedGrant.expiresAt ?? expiredOrRevokedGrant.grantedAt).toLocaleDateString("en-PH")}. Contact the Academy if you believe this is an error.`,
        grant: expiredOrRevokedGrant,
      };
    }
    if (expiredOrRevokedGrant?.status === "Revoked") {
      return { status: "Revoked", reason: "Access to this course has been revoked. Contact the Academy for details.", grant: expiredOrRevokedGrant };
    }
    return {
      status: "Locked",
      reason: "This course isn't included in your current package yet. Contact the Academy to learn how to unlock it.",
      grant: null,
    };
  }

  const progress = computeCourseProgress(student.id, course.id, lessons, lessonProgress);
  const status: CourseAccessStatus = progress.status === "Completed" ? "Completed" : progress.status === "In Progress" ? "In Progress" : "Available";

  return { status, reason: "", grant: activeGrant ?? null };
}

/** Groups modules for a course in display order, each with its lessons in display order. */
export function getCourseStructure(courseId: string, modules: Module[], lessons: Lesson[]) {
  return modules
    .filter((m) => m.courseId === courseId && m.status === "Active")
    .sort((a, b) => a.order - b.order)
    .map((module) => ({
      module,
      lessons: lessons
        .filter((l) => l.moduleId === module.id && l.status === "Published")
        .sort((a, b) => a.order - b.order),
    }));
}

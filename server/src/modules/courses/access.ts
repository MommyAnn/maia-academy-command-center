import { db } from "../../db.js";

// Server-side entitlement resolution (spec section 18, 22) — the ONLY
// authority on whether a Student can see a Course/Lesson/Resource. Every
// route that serves course content calls this before returning anything;
// knowing a Course/Lesson URL is never sufficient on its own.
//
// A Student's real access is the union of:
//   1. An individual, unexpired, unrevoked CourseAccessGrant row, OR
//   2. Course.accessType === "OPEN" (every confirmed student), OR
//   3. Course.accessType === "PACKAGE" AND a PackageCourseAccess row maps
//      the student's current Package to this Course.
// "MANUAL" course access type means ONLY explicit grants apply — no
// package inherits it automatically (spec section 18).

export type CourseAccessStatus = "Locked" | "Available" | "In Progress" | "Completed" | "Expired" | "Revoked";

export interface CourseAccessResolution {
  status: CourseAccessStatus;
  reason: string;
  grantId: string | null;
}

export async function resolveCourseAccess(studentId: string, courseId: string): Promise<CourseAccessResolution> {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return { status: "Locked", reason: "Course not found.", grantId: null };
  if (course.status !== "PUBLISHED") return { status: "Locked", reason: "This course is not published.", grantId: null };

  const grant = await db.courseAccessGrant.findUnique({ where: { studentId_courseId: { studentId, courseId } } });
  if (grant) {
    if (grant.status === "Revoked") return { status: "Revoked", reason: "Access to this course was revoked.", grantId: grant.id };
    if (grant.expiresAt && grant.expiresAt.getTime() < Date.now()) return { status: "Expired", reason: "This course's access period has ended.", grantId: grant.id };
    return { status: await progressAwareStatus(studentId, courseId), reason: "", grantId: grant.id };
  }

  if (course.accessType === "OPEN") {
    return { status: await progressAwareStatus(studentId, courseId), reason: "", grantId: null };
  }

  if (course.accessType === "PACKAGE") {
    const student = await db.student.findUnique({ where: { id: studentId }, select: { packageId: true } });
    if (student) {
      const mapped = await db.packageCourseAccess.findUnique({ where: { packageId_courseId: { packageId: student.packageId, courseId } } });
      if (mapped) return { status: await progressAwareStatus(studentId, courseId), reason: "", grantId: null };
    }
  }

  return { status: "Locked", reason: "This course is not included in your current access.", grantId: null };
}

async function progressAwareStatus(studentId: string, courseId: string): Promise<CourseAccessStatus> {
  const lessons = await db.lesson.findMany({ where: { module: { courseId }, status: "Published" }, select: { id: true } });
  if (lessons.length === 0) return "Available";
  const progress = await db.lessonProgress.findMany({ where: { studentId, lessonId: { in: lessons.map((l) => l.id) } } });
  const completed = progress.filter((p) => p.status === "Completed").length;
  if (completed >= lessons.length) return "Completed";
  if (progress.some((p) => p.status !== "Not Started")) return "In Progress";
  return "Available";
}

export async function assertCourseAccess(studentId: string, courseId: string): Promise<CourseAccessResolution | null> {
  const resolution = await resolveCourseAccess(studentId, courseId);
  return resolution.status === "Locked" || resolution.status === "Revoked" || resolution.status === "Expired" ? resolution : null;
}

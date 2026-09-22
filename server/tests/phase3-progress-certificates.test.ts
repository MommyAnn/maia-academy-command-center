import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let studentAId: string;
let ownerCookie: string;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

async function createOpenCourseWithTwoLessons() {
  const create = await app.inject({ method: "POST", url: "/api/courses", headers: { cookie: ownerCookie }, payload: { title: `Progress Course ${Date.now()}`, category: "Other", accessType: "OPEN" } });
  const course = create.json().course;
  const moduleRes = await app.inject({ method: "POST", url: `/api/courses/${course.id}/modules`, headers: { cookie: ownerCookie }, payload: { title: "Module 1", order: 0 } });
  const moduleId = moduleRes.json().module.id;
  const lesson1 = (await app.inject({ method: "POST", url: `/api/courses/${course.id}/modules/${moduleId}/lessons`, headers: { cookie: ownerCookie }, payload: { title: "Lesson 1", type: "Text Lesson", order: 0 } })).json().lesson;
  const lesson2 = (await app.inject({ method: "POST", url: `/api/courses/${course.id}/modules/${moduleId}/lessons`, headers: { cookie: ownerCookie }, payload: { title: "Lesson 2", type: "Text Lesson", order: 1 } })).json().lesson;
  await app.inject({ method: "PATCH", url: `/api/lessons/${lesson1.id}`, headers: { cookie: ownerCookie }, payload: { status: "Published" } });
  await app.inject({ method: "PATCH", url: `/api/lessons/${lesson2.id}`, headers: { cookie: ownerCookie }, payload: { status: "Published" } });
  await app.inject({ method: "PATCH", url: `/api/courses/${course.id}`, headers: { cookie: ownerCookie }, payload: { status: "PUBLISHED" } });
  return { course, lesson1, lesson2 };
}

describe("Lesson & Course Progress (spec sections 25-27) — derived, never fabricated", () => {
  it("completing all published lessons derives Course status = Completed, and fires COURSE_COMPLETED exactly once", async () => {
    const { course, lesson1, lesson2 } = await createOpenCourseWithTwoLessons();
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);

    const before = await app.inject({ method: "GET", url: `/api/students/${studentAId}/courses/${course.id}/progress`, headers: { cookie: cookieA } });
    expect(before.json().progress.status).toBe("Not Started");
    expect(before.json().progress.percent).toBe(0);

    const p1 = await app.inject({ method: "PATCH", url: `/api/students/${studentAId}/lessons/${lesson1.id}/progress`, headers: { cookie: cookieA }, payload: { status: "In Progress" } });
    expect(p1.statusCode).toBe(200);

    const mid = await app.inject({ method: "GET", url: `/api/students/${studentAId}/courses/${course.id}/progress`, headers: { cookie: cookieA } });
    expect(mid.json().progress.status).toBe("In Progress");

    await app.inject({ method: "PATCH", url: `/api/students/${studentAId}/lessons/${lesson1.id}/progress`, headers: { cookie: cookieA }, payload: { status: "Completed" } });
    await app.inject({ method: "PATCH", url: `/api/students/${studentAId}/lessons/${lesson2.id}/progress`, headers: { cookie: cookieA }, payload: { status: "Completed" } });

    const after = await app.inject({ method: "GET", url: `/api/students/${studentAId}/courses/${course.id}/progress`, headers: { cookie: cookieA } });
    expect(after.json().progress.status).toBe("Completed");
    expect(after.json().progress.percent).toBe(100);
    expect(after.json().progress.lessonsCompleted).toBe(2);

    const events = await db.domainEvent.findMany({ where: { type: "COURSE_COMPLETED", studentId: studentAId, enrollmentId: null } });
    const forThisCourse = events.filter((e) => (e.payloadJson as { courseId?: string }).courseId === course.id);
    expect(forThisCourse.length).toBe(1);
  });

  it("a student without course access cannot mark progress on its lessons", async () => {
    const { lesson1 } = await createOpenCourseWithTwoLessons();
    // Make it MANUAL after creation so Student A has no automatic access.
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const otherCourse = await app.inject({ method: "POST", url: "/api/courses", headers: { cookie: ownerCookie }, payload: { title: `Locked ${Date.now()}`, category: "Other", accessType: "MANUAL" } });
    const moduleRes = await app.inject({ method: "POST", url: `/api/courses/${otherCourse.json().course.id}/modules`, headers: { cookie: ownerCookie }, payload: { title: "M", order: 0 } });
    const lockedLesson = await app.inject({ method: "POST", url: `/api/courses/${otherCourse.json().course.id}/modules/${moduleRes.json().module.id}/lessons`, headers: { cookie: ownerCookie }, payload: { title: "L", type: "Text Lesson", order: 0 } });
    await app.inject({ method: "PATCH", url: `/api/courses/${otherCourse.json().course.id}`, headers: { cookie: ownerCookie }, payload: { status: "PUBLISHED" } });

    const res = await app.inject({ method: "PATCH", url: `/api/students/${studentAId}/lessons/${lockedLesson.json().lesson.id}/progress`, headers: { cookie: cookieA }, payload: { status: "Completed" } });
    expect(res.statusCode).toBe(403);
    void lesson1;
  });
});

describe("Certificates (spec sections 29-34)", () => {
  it("evaluate reflects real ineligibility reasons, then becomes Eligible once requirements are met, and issuance is guarded against double-issue", async () => {
    const notEligible = await app.inject({ method: "POST", url: `/api/students/${studentAId}/certificates/evaluate`, headers: { cookie: ownerCookie }, payload: { requireFullyPaid: false } });
    expect(notEligible.statusCode).toBe(200);
    expect(notEligible.json().eligible).toBe(false);
    expect(notEligible.json().reasons.length).toBeGreaterThan(0);
    expect(notEligible.json().certificate.status).toBe("Not Eligible");

    // Make the student pass every checked rule: confirmed enrollment,
    // verified requirements, 0% min attendance (disabled).
    await db.student.update({ where: { id: studentAId }, data: { enrollmentStatus: "Confirmed Student" } });
    const uploadDoc = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/documents`,
      headers: { cookie: await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password) },
      payload: { documentType: "ValidId", filename: "id.jpg", mimeType: "image/jpeg", contentBase64: Buffer.from("id-bytes").toString("base64") },
    });
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const submit = await app.inject({ method: "POST", url: `/api/students/${studentAId}/requirements/ValidId/submit`, headers: { cookie: cookieA }, payload: { documentId: uploadDoc.json().document.id } });
    await app.inject({ method: "POST", url: `/api/requirements/${submit.json().requirement.id}/verify`, headers: { cookie: ownerCookie } });

    const eligible = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/certificates/evaluate`,
      headers: { cookie: ownerCookie },
      payload: { requireRequirementsVerified: true, requireConfirmedEnrollment: true, minAttendancePercent: 0, requireFullyPaid: false },
    });
    expect(eligible.json().eligible).toBe(true);
    expect(eligible.json().certificate.status).toBe("Eligible");
    const certificateId = eligible.json().certificate.id;

    await app.inject({ method: "PATCH", url: `/api/certificates/${certificateId}`, headers: { cookie: ownerCookie }, payload: { status: "For Preparation" } });
    await app.inject({ method: "PATCH", url: `/api/certificates/${certificateId}`, headers: { cookie: ownerCookie }, payload: { status: "Ready" } });
    const issue = await app.inject({ method: "PATCH", url: `/api/certificates/${certificateId}`, headers: { cookie: ownerCookie }, payload: { status: "Issued" } });
    expect(issue.statusCode).toBe(200);
    expect(issue.json().certificate.certificateDisplayId).toMatch(/^CERT-B14-\d{6}$/);

    const doubleIssue = await app.inject({ method: "PATCH", url: `/api/certificates/${certificateId}`, headers: { cookie: ownerCookie }, payload: { status: "Issued" } });
    expect(doubleIssue.statusCode).toBe(409);

    // Reissue creates a NEW row; the original stays "Issued", untouched.
    const reissue = await app.inject({ method: "POST", url: `/api/certificates/${certificateId}/reissue`, headers: { cookie: ownerCookie } });
    expect(reissue.statusCode).toBe(201);
    expect(reissue.json().certificate.id).not.toBe(certificateId);
    expect(reissue.json().certificate.status).toBe("Reissued");

    const original = await db.certificate.findUniqueOrThrow({ where: { id: certificateId } });
    expect(original.status).toBe("Issued");
  });

  it("Student A can only read their own certificates", async () => {
    const studentBId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-B" } })).id;
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const crossStudent = await app.inject({ method: "GET", url: `/api/students/${studentBId}/certificates`, headers: { cookie: cookieA } });
    expect(crossStudent.statusCode).toBe(403);
  });
});

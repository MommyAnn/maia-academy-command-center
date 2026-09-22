import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let studentAId: string;
let studentBId: string;
let ownerCookie: string;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
  studentBId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-B" } })).id;
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

async function createPublishedCourse(accessType: "PACKAGE" | "MANUAL" | "OPEN") {
  const create = await app.inject({ method: "POST", url: "/api/courses", headers: { cookie: ownerCookie }, payload: { title: `Course ${accessType} ${Date.now()}`, category: "Business Strategy", accessType } });
  const course = create.json().course;
  const moduleRes = await app.inject({ method: "POST", url: `/api/courses/${course.id}/modules`, headers: { cookie: ownerCookie }, payload: { title: "Module 1", order: 0 } });
  const moduleId = moduleRes.json().module.id;
  const lessonRes = await app.inject({ method: "POST", url: `/api/courses/${course.id}/modules/${moduleId}/lessons`, headers: { cookie: ownerCookie }, payload: { title: "Lesson 1", type: "Text Lesson", order: 0 } });
  const lessonId = lessonRes.json().lesson.id;
  await app.inject({ method: "PATCH", url: `/api/lessons/${lessonId}`, headers: { cookie: ownerCookie }, payload: { status: "Published" } });
  await app.inject({ method: "PATCH", url: `/api/courses/${course.id}`, headers: { cookie: ownerCookie }, payload: { status: "PUBLISHED" } });
  return { course, moduleId, lessonId };
}

describe("Course/Module/Lesson CRUD + publish gating (spec sections 11-15)", () => {
  it("Finance Officer (no Courses grant) cannot create a course", async () => {
    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const res = await app.inject({ method: "POST", url: "/api/courses", headers: { cookie: financeCookie }, payload: { title: "Unauthorized", category: "Other" } });
    expect(res.statusCode).toBe(403);
  });

  it("a DRAFT course is never returned by the student-facing My Courses list", async () => {
    const create = await app.inject({ method: "POST", url: "/api/courses", headers: { cookie: ownerCookie }, payload: { title: "Still Draft", category: "Other" } });
    expect(create.json().course.status).toBe("DRAFT");

    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const myCourses = await app.inject({ method: "GET", url: `/api/students/${studentAId}/courses`, headers: { cookie: cookieA } });
    expect(myCourses.json().courses.some((c: { course: { id: string } }) => c.course.id === create.json().course.id)).toBe(false);
  });
});

describe("Course access resolution (spec sections 18-21)", () => {
  it("OPEN courses are Available to every student with no grant needed", async () => {
    const { course } = await createPublishedCourse("OPEN");
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const detail = await app.inject({ method: "GET", url: `/api/students/${studentAId}/courses/${course.id}`, headers: { cookie: cookieA } });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().access.status).toBe("Available");
  });

  it("PACKAGE courses require a real PackageCourseAccess mapping row, not a hard-coded rule", async () => {
    const { course } = await createPublishedCourse("PACKAGE");
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);

    const before = await app.inject({ method: "GET", url: `/api/students/${studentAId}/courses/${course.id}`, headers: { cookie: cookieA } });
    expect(before.statusCode).toBe(403);

    const student = await db.student.findUniqueOrThrow({ where: { id: studentAId } });
    const mapRes = await app.inject({ method: "POST", url: "/api/package-course-access", headers: { cookie: ownerCookie }, payload: { packageId: student.packageId, courseId: course.id } });
    expect(mapRes.statusCode).toBe(201);

    const after = await app.inject({ method: "GET", url: `/api/students/${studentAId}/courses/${course.id}`, headers: { cookie: cookieA } });
    expect(after.statusCode).toBe(200);
  });

  it("MANUAL courses require an explicit grant; revoking it removes access again", async () => {
    const { course } = await createPublishedCourse("MANUAL");
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);

    const denied = await app.inject({ method: "GET", url: `/api/students/${studentAId}/courses/${course.id}`, headers: { cookie: cookieA } });
    expect(denied.statusCode).toBe(403);

    const grant = await app.inject({ method: "POST", url: `/api/students/${studentAId}/course-access`, headers: { cookie: ownerCookie }, payload: { courseId: course.id, source: "Admin Override" } });
    expect(grant.statusCode).toBe(201);

    const allowed = await app.inject({ method: "GET", url: `/api/students/${studentAId}/courses/${course.id}`, headers: { cookie: cookieA } });
    expect(allowed.statusCode).toBe(200);

    const revoke = await app.inject({ method: "POST", url: `/api/course-access/${grant.json().grant.id}/revoke`, headers: { cookie: ownerCookie } });
    expect(revoke.statusCode).toBe(200);

    const afterRevoke = await app.inject({ method: "GET", url: `/api/students/${studentAId}/courses/${course.id}`, headers: { cookie: cookieA } });
    expect(afterRevoke.statusCode).toBe(403);
  });
});

describe("Course Access Security (spec sections 22, 69): knowing the URL is never enough", () => {
  it("Student B (no access) manually requesting Student A's granted MANUAL course is denied — even via a lesson URL directly", async () => {
    const { course, lessonId } = await createPublishedCourse("MANUAL");
    await app.inject({ method: "POST", url: `/api/students/${studentAId}/course-access`, headers: { cookie: ownerCookie }, payload: { courseId: course.id, source: "Manual" } });

    const cookieB = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
    const courseDenied = await app.inject({ method: "GET", url: `/api/students/${studentBId}/courses/${course.id}`, headers: { cookie: cookieB } });
    expect(courseDenied.statusCode).toBe(403);

    const lessonDenied = await app.inject({ method: "GET", url: `/api/students/${studentBId}/lessons/${lessonId}`, headers: { cookie: cookieB } });
    expect(lessonDenied.statusCode).toBe(403);
  });

  it("Student A cannot read Student B's course entitlement view at all (self-only enforcement)", async () => {
    const { course } = await createPublishedCourse("OPEN");
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const res = await app.inject({ method: "GET", url: `/api/students/${studentBId}/courses/${course.id}`, headers: { cookie: cookieA } });
    expect(res.statusCode).toBe(403);
  });
});

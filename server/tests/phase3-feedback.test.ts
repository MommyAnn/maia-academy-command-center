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

describe("Feedback submission + duplicate prevention (spec sections 36-38)", () => {
  it("Student A can submit feedback against an open request; a second submission to the SAME request is rejected", async () => {
    const request = await app.inject({
      method: "POST",
      url: "/api/feedback/requests",
      headers: { cookie: ownerCookie },
      payload: { title: "Masterclass Feedback", sourceType: "Masterclass" },
    });
    expect(request.statusCode).toBe(201);
    const requestId = request.json().request.id;

    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const submit = await app.inject({ method: "POST", url: `/api/students/${studentAId}/feedback`, headers: { cookie: cookieA }, payload: { requestId, sourceType: "Masterclass", writtenText: "Great session, learned a lot." } });
    expect(submit.statusCode).toBe(201);
    expect(submit.json().submission.feedbackDisplayId).toMatch(/^FDBK-\d{4}-\d{6}$/);

    const duplicate = await app.inject({ method: "POST", url: `/api/students/${studentAId}/feedback`, headers: { cookie: cookieA }, payload: { requestId, sourceType: "Masterclass", writtenText: "Trying again" } });
    expect(duplicate.statusCode).toBe(409);
  });

  it("Student A cannot submit feedback on Student B's behalf, and cannot read Student B's feedback history", async () => {
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const res = await app.inject({ method: "POST", url: `/api/students/${studentBId}/feedback`, headers: { cookie: cookieA }, payload: { sourceType: "Other", writtenText: "x" } });
    expect(res.statusCode).toBe(403);

    const read = await app.inject({ method: "GET", url: `/api/students/${studentBId}/feedback`, headers: { cookie: cookieA } });
    expect(read.statusCode).toBe(403);
  });
});

describe("Marketing consent is separate from feedback, and optional (spec sections 40-42, 67)", () => {
  it("feedback saves successfully with NO consent, and never appears in the testimonial library until consent + approval both exist", async () => {
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const submit = await app.inject({ method: "POST", url: `/api/students/${studentAId}/feedback`, headers: { cookie: cookieA }, payload: { sourceType: "Course", writtenText: "Solid content." } });
    expect(submit.statusCode).toBe(201);
    const submissionId = submit.json().submission.id;

    // No consent call was ever made — this is the point.
    const libraryBefore = await app.inject({ method: "GET", url: "/api/marketing/testimonials", headers: { cookie: ownerCookie } });
    expect(libraryBefore.json().testimonials.some((t: { id: string }) => t.id === submissionId)).toBe(false);

    // Approval attempt without consent must fail outright.
    const approveWithoutConsent = await app.inject({ method: "POST", url: `/api/feedback/submissions/${submissionId}/approve-testimonial`, headers: { cookie: ownerCookie } });
    expect(approveWithoutConsent.statusCode).toBe(409);

    // Student explicitly grants consent afterward.
    const grantConsent = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/feedback/${submissionId}/consent`,
      headers: { cookie: cookieA },
      payload: { status: "Granted", permittedAssets: ["Written Feedback", "First Name"] },
    });
    expect(grantConsent.statusCode).toBe(200);

    const approve = await app.inject({ method: "POST", url: `/api/feedback/submissions/${submissionId}/approve-testimonial`, headers: { cookie: ownerCookie } });
    expect(approve.statusCode).toBe(200);

    const libraryAfter = await app.inject({ method: "GET", url: "/api/marketing/testimonials", headers: { cookie: ownerCookie } });
    expect(libraryAfter.json().testimonials.some((t: { id: string }) => t.id === submissionId)).toBe(true);

    // Withdrawal removes it from the library again, but the historical
    // Granted event is never erased (append-only trail).
    const withdraw = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/feedback/${submissionId}/consent`,
      headers: { cookie: cookieA },
      payload: { status: "Withdrawn", permittedAssets: [] },
    });
    expect(withdraw.statusCode).toBe(200);

    const libraryAfterWithdraw = await app.inject({ method: "GET", url: "/api/marketing/testimonials", headers: { cookie: ownerCookie } });
    expect(libraryAfterWithdraw.json().testimonials.some((t: { id: string }) => t.id === submissionId)).toBe(false);

    const consentRead = await app.inject({ method: "GET", url: `/api/students/${studentAId}/feedback/${submissionId}/consent`, headers: { cookie: cookieA } });
    const events = consentRead.json().consent.events;
    expect(events.map((e: { status: string }) => e.status)).toEqual(["Granted", "Withdrawn"]);
  });
});

describe("Incentive eligibility never depends on sentiment (spec sections 46, 68), and reuses the real Course Access system (spec section 48)", () => {
  it("neutral/constructive feedback qualifies exactly the same as positive feedback, and a Bonus Course incentive grants a real CourseAccessGrant", async () => {
    const bonusCourse = await app.inject({ method: "POST", url: "/api/courses", headers: { cookie: ownerCookie }, payload: { title: `Bonus ${Date.now()}`, category: "Other", accessType: "MANUAL" } });
    await app.inject({ method: "PATCH", url: `/api/courses/${bonusCourse.json().course.id}`, headers: { cookie: ownerCookie }, payload: { status: "PUBLISHED" } });

    const incentive = await app.inject({
      method: "POST",
      url: "/api/incentives",
      headers: { cookie: ownerCookie },
      payload: { name: "Bonus Course Unlock", deliveryType: "Bonus Course", bonusCourseId: bonusCourse.json().course.id },
    });
    expect(incentive.statusCode).toBe(201);

    const request = await app.inject({
      method: "POST",
      url: "/api/feedback/requests",
      headers: { cookie: ownerCookie },
      payload: { title: "Training Feedback", sourceType: "Face-to-Face Training", incentiveId: incentive.json().incentive.id },
    });
    const requestId = request.json().request.id;

    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    // Deliberately low rating + constructive criticism — must still qualify.
    const submit = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/feedback`,
      headers: { cookie: cookieA },
      payload: { requestId, sourceType: "Face-to-Face Training", rating: 2, writtenText: "The pacing was too fast and the room was too small." },
    });
    expect(submit.statusCode).toBe(201);
    expect(submit.json().incentiveGranted).toBe(true);

    const grant = await db.courseAccessGrant.findUnique({ where: { studentId_courseId: { studentId: studentAId, courseId: bonusCourse.json().course.id } } });
    expect(grant).not.toBeNull();
    expect(grant!.source).toBe("Feedback Incentive");
    expect(grant!.status).toBe("Active");

    // The Student Portal can now see the course as accessible through the
    // SAME entitlement endpoint every other course uses.
    const myCourses = await app.inject({ method: "GET", url: `/api/students/${studentAId}/courses`, headers: { cookie: cookieA } });
    const entry = myCourses.json().courses.find((c: { course: { id: string } }) => c.course.id === bonusCourse.json().course.id);
    expect(entry.access.status).not.toBe("Locked");
  });
});

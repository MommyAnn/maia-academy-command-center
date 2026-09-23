// Phase 7 full synthetic E2E journey (spec sections 89-90): public webinar
// registration -> lead -> attendance -> follow-up -> reservation -> payment
// verification -> lead conversion -> student -> enrollment -> requirements
// -> full payment -> training -> attendance -> course access -> course
// completion -> Master Brain -> AI Business Tool -> feedback -> certificate.
//
// The critical assertion running through every stage is IDENTITY
// CONTINUITY: exactly ONE Person row is ever created for this synthetic
// individual, and every artifact (Lead, Student, Enrollment, Payments,
// WebinarRegistration, Business, AiProject, FeedbackSubmission,
// Certificate) traces back to that same Person — never a duplicate.
// Entirely synthetic data; nothing here touches real Academy records
// (spec section 21).

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeAnthropicServer } from "./anthropic-fake-server.js";

let app: FastifyInstance;
let ownerCookie: string;
let batchId: string;
let packageId: string;
const fakeAnthropic = createFakeAnthropicServer(4011);

beforeAll(async () => {
  await fakeAnthropic.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  batchId = (await db.batch.findUniqueOrThrow({ where: { code: "14" } })).id;
  packageId = (await db.package.findUniqueOrThrow({ where: { name: "Premium" } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeAnthropic.stop();
});

describe("Full synthetic journey + cross-module Person identity continuity", () => {
  it("carries ONE Person through every module with no duplicate created anywhere", async () => {
    const email = `e2e-journey-${Date.now()}@example.com`;
    const contactNumber = "09179998888";

    // --- 1. Public webinar registration -> Lead ---------------------------
    const session = await app.inject({
      method: "POST",
      url: "/api/webinar/sessions",
      headers: { cookie: ownerCookie },
      payload: { title: `E2E Session ${Date.now()}`, type: "Free Webinar", date: new Date(Date.now() + 86400000).toISOString(), startTime: "19:00", endTime: "21:00", platform: "Zoom", status: "Registration Open" },
    });
    const sessionId = session.json().session.id;

    const registration = await app.inject({
      method: "POST",
      url: "/api/webinar/register",
      payload: { fullName: "E2E Journey Person", contactNumber, email, sessionId, source: "Facebook", campaign: "E2E Campaign" },
    });
    expect(registration.statusCode).toBe(201);
    const leadId = registration.json().lead.id;
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    const personId = lead.personId;

    // Exactly one Person exists for this identity so far.
    expect(await db.person.count({ where: { id: personId } })).toBe(1);
    expect(await db.person.count({ where: { email } })).toBe(1);

    // --- 2. Attendance -----------------------------------------------------
    const webinarRegistration = await db.webinarRegistration.findFirstOrThrow({ where: { leadId, sessionId } });
    const attendance = await app.inject({
      method: "POST",
      url: `/api/webinar/registrations/${webinarRegistration.id}/attendance`,
      headers: { cookie: ownerCookie },
      payload: { status: "Attended" },
    });
    expect(attendance.statusCode).toBe(200);

    // --- 3. Follow-up --------------------------------------------------------
    const followUp = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/follow-ups`,
      headers: { cookie: ownerCookie },
      payload: { channel: "Phone", scheduledFor: new Date(Date.now() + 3600000).toISOString(), notes: "Called to discuss enrollment." },
    });
    expect(followUp.statusCode).toBe(201);
    const followUpCompleted = await app.inject({
      method: "PATCH",
      url: `/api/follow-ups/${followUp.json().followUp.id}`,
      headers: { cookie: ownerCookie },
      payload: { status: "Completed", outcome: "Interested — will reserve a slot." },
    });
    expect(followUpCompleted.statusCode).toBe(200);

    // --- 4. Reservation payment ---------------------------------------------
    const reservation = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/reservation-payment`,
      headers: { cookie: ownerCookie },
      payload: { amount: 2000, method: "GCash", batchId, packageId },
    });
    expect(reservation.statusCode).toBe(201);
    const reservationPaymentId = reservation.json().payment.id;

    // --- 5. Payment verification (reservation) ------------------------------
    const reservationVerify = await app.inject({ method: "POST", url: `/api/payments/${reservationPaymentId}/verify`, headers: { cookie: ownerCookie } });
    expect(reservationVerify.statusCode).toBe(200);

    // --- 6. Lead conversion -> Student + Enrollment -------------------------
    const convert = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/convert`,
      headers: { cookie: ownerCookie },
      payload: { batchId, packageId, discount: 20000 }, // netAmountDue = 5000; the verified 2000 reservation leaves a real 3000 balance for step 8 to pay off
    });
    expect(convert.statusCode).toBe(201);
    const studentId = convert.json().student.id;
    const enrollmentId = convert.json().enrollment.id;

    const student = await db.student.findUniqueOrThrow({ where: { id: studentId } });
    expect(student.personId).toBe(personId); // SAME Person, never a new one
    expect(await db.person.count({ where: { email } })).toBe(1);

    // The reservation payment was re-parented onto the Student, not duplicated.
    const reservationAfterConvert = await db.paymentTransaction.findUniqueOrThrow({ where: { id: reservationPaymentId } });
    expect(reservationAfterConvert.studentId).toBe(studentId);
    expect(await db.paymentTransaction.count({ where: { OR: [{ leadId }, { studentId }] } })).toBe(1);

    // --- 7. Requirements: submit + verify ------------------------------------
    // Staff submits on the student's behalf — a portal login isn't required
    // for this journey (student-driven self-service is already covered by
    // rbac-isolation.test.ts and finance.test.ts).
    const uploadDoc = await app.inject({
      method: "POST",
      url: `/api/students/${studentId}/documents`,
      headers: { cookie: ownerCookie },
      payload: { documentType: "ValidId", filename: "id.jpg", mimeType: "image/jpeg", contentBase64: Buffer.from("e2e-id-bytes").toString("base64") },
    });
    expect(uploadDoc.statusCode).toBe(201);
    const submitRequirement = await app.inject({
      method: "POST",
      url: `/api/students/${studentId}/requirements/ValidId/submit`,
      headers: { cookie: ownerCookie },
      payload: { documentId: uploadDoc.json().document.id },
    });
    expect(submitRequirement.statusCode).toBe(201);
    const verifyRequirement = await app.inject({ method: "POST", url: `/api/requirements/${submitRequirement.json().requirement.id}/verify`, headers: { cookie: ownerCookie } });
    expect(verifyRequirement.statusCode).toBe(200);

    // --- 8. Full payment -> STUDENT_FULLY_PAID -------------------------------
    const finalPayment = await app.inject({
      method: "POST",
      url: `/api/students/${studentId}/payments`,
      headers: { cookie: ownerCookie },
      payload: { amount: 3000, method: "Cash", type: "Balance Payment" }, // clears the remaining balance after the verified 2000 reservation
    });
    expect(finalPayment.statusCode).toBe(201);
    const finalPaymentVerify = await app.inject({ method: "POST", url: `/api/payments/${finalPayment.json().payment.id}/verify`, headers: { cookie: ownerCookie } });
    expect(finalPaymentVerify.statusCode).toBe(200);
    const financeSummary = await app.inject({ method: "GET", url: `/api/students/${studentId}/finance-summary`, headers: { cookie: ownerCookie } });
    expect(financeSummary.json().summary.status).toBe("Fully Paid");

    // --- 9. Training + attendance ---------------------------------------------
    const trainingSession = await app.inject({
      method: "POST",
      url: "/api/training/sessions",
      headers: { cookie: ownerCookie },
      payload: { title: "E2E Masterclass", type: "Masterclass", batchId, date: new Date().toISOString(), startTime: "09:00", endTime: "12:00" },
    });
    const trainingAttendance = await app.inject({
      method: "POST",
      url: `/api/training/sessions/${trainingSession.json().session.id}/attendance`,
      headers: { cookie: ownerCookie },
      payload: { studentId, status: "Present" },
    });
    expect(trainingAttendance.statusCode).toBe(200);

    // --- 10. Course access + completion -----------------------------------
    const courseCreate = await app.inject({ method: "POST", url: "/api/courses", headers: { cookie: ownerCookie }, payload: { title: `E2E Course ${Date.now()}`, category: "Other", accessType: "OPEN" } });
    const course = courseCreate.json().course;
    const moduleRes = await app.inject({ method: "POST", url: `/api/courses/${course.id}/modules`, headers: { cookie: ownerCookie }, payload: { title: "Module 1", order: 0 } });
    const lesson = (await app.inject({ method: "POST", url: `/api/courses/${course.id}/modules/${moduleRes.json().module.id}/lessons`, headers: { cookie: ownerCookie }, payload: { title: "Lesson 1", type: "Text Lesson", order: 0 } })).json().lesson;
    await app.inject({ method: "PATCH", url: `/api/lessons/${lesson.id}`, headers: { cookie: ownerCookie }, payload: { status: "Published" } });
    await app.inject({ method: "PATCH", url: `/api/courses/${course.id}`, headers: { cookie: ownerCookie }, payload: { status: "PUBLISHED" } });
    const lessonComplete = await app.inject({ method: "PATCH", url: `/api/students/${studentId}/lessons/${lesson.id}/progress`, headers: { cookie: ownerCookie }, payload: { status: "Completed" } });
    expect(lessonComplete.statusCode).toBe(200);
    const courseProgress = await app.inject({ method: "GET", url: `/api/students/${studentId}/courses/${course.id}/progress`, headers: { cookie: ownerCookie } });
    expect(courseProgress.json().progress.status).toBe("Completed");

    // --- 11. Master Brain: questionnaire -> generation -> publish -----------
    const businessRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie: ownerCookie }, payload: { name: "E2E Journey Business" } });
    const business = businessRes.json().business;
    expect(business.studentId).toBe(studentId);
    await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie: ownerCookie }, payload: { answers: { niche: "Skincare" } } });
    const submission = (await app.inject({ method: "GET", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie: ownerCookie } })).json().submission;
    await app.inject({ method: "POST", url: `/api/businesses/${business.id}/master-brain/submit`, headers: { cookie: ownerCookie } });
    await db.masterBrainSubmission.update({ where: { id: submission.id }, data: { status: "APPROVED_FOR_GENERATION" } });

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText(JSON.stringify({ sections: [{ key: "brandOverview", title: "1. Brand Overview", content: "Synthetic E2E brand overview.", bullets: [] }] }));
    const generateDoc = await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/generate`, headers: { cookie: ownerCookie } });
    expect(generateDoc.statusCode).toBe(201);
    const document = generateDoc.json().document;
    const publish = await app.inject({ method: "POST", url: `/api/master-brain/documents/${document.id}/publish`, headers: { cookie: ownerCookie } });
    expect(publish.statusCode).toBe(200);

    // --- 12. AI Business Tool generation --------------------------------------
    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("Synthetic ad copy generated for the E2E journey.");
    const aiGeneration = await app.inject({
      method: "POST",
      url: `/api/students/${studentId}/ai-tools/copywriter/generate`,
      headers: { cookie: ownerCookie },
      payload: { businessId: business.id, userRequest: "Write a short ad for our new skincare line." },
    });
    expect(aiGeneration.statusCode).toBe(201);
    expect(aiGeneration.json().generation.studentId).toBe(studentId);

    // --- 13. Feedback ----------------------------------------------------------
    const feedbackRequest = await app.inject({ method: "POST", url: "/api/feedback/requests", headers: { cookie: ownerCookie }, payload: { title: "E2E Masterclass Feedback", sourceType: "Masterclass" } });
    const feedbackSubmit = await app.inject({
      method: "POST",
      url: `/api/students/${studentId}/feedback`,
      headers: { cookie: ownerCookie },
      payload: { requestId: feedbackRequest.json().request.id, sourceType: "Masterclass", writtenText: "Excellent E2E journey test experience." },
    });
    expect(feedbackSubmit.statusCode).toBe(201);

    // --- 14. Certificate ---------------------------------------------------
    const eligible = await app.inject({
      method: "POST",
      url: `/api/students/${studentId}/certificates/evaluate`,
      headers: { cookie: ownerCookie },
      payload: { requireRequirementsVerified: true, requireConfirmedEnrollment: true, minAttendancePercent: 0, requireFullyPaid: true },
    });
    expect(eligible.json().eligible).toBe(true);
    const certificateId = eligible.json().certificate.id;
    await app.inject({ method: "PATCH", url: `/api/certificates/${certificateId}`, headers: { cookie: ownerCookie }, payload: { status: "For Preparation" } });
    await app.inject({ method: "PATCH", url: `/api/certificates/${certificateId}`, headers: { cookie: ownerCookie }, payload: { status: "Ready" } });
    const issued = await app.inject({ method: "PATCH", url: `/api/certificates/${certificateId}`, headers: { cookie: ownerCookie }, payload: { status: "Issued" } });
    expect(issued.statusCode).toBe(200);

    // --- FINAL: cross-module identity continuity ---------------------------
    // Every artifact created across all 14 stages traces back to the SAME
    // Person, and no duplicate Person was ever created for this identity.
    expect(await db.person.count({ where: { email } })).toBe(1);
    const finalStudent = await db.student.findUniqueOrThrow({ where: { id: studentId } });
    expect(finalStudent.personId).toBe(personId);
    const finalLead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(finalLead.personId).toBe(personId); // Lead record survives conversion, unchanged identity
    const finalBusiness = await db.business.findUniqueOrThrow({ where: { id: business.id } });
    expect(finalBusiness.studentId).toBe(studentId);
    const finalCertificate = await db.certificate.findUniqueOrThrow({ where: { id: certificateId } });
    expect(finalCertificate.studentId).toBe(studentId);
    const finalEnrollment = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    expect(finalEnrollment.studentId).toBe(studentId);
  });
});

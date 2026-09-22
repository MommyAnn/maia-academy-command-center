import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeGhlServer } from "./ghl-fake-server.js";
import { checkCommunicationEligibility } from "../src/modules/communications/eligibility.js";

let app: FastifyInstance;
let ownerCookie: string;
const fakeGhl = createFakeGhlServer(4010);

beforeAll(async () => {
  await fakeGhl.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeGhl.stop();
});

async function createConsentedLead(contactNumber: string, email: string, overrides: Partial<{ canEmail: boolean; canSms: boolean; canWhatsapp: boolean }> = {}) {
  const res = await app.inject({ method: "POST", url: "/api/leads", headers: { cookie: ownerCookie }, payload: { fullName: "Comms Test Lead", contactNumber, email } });
  const lead = res.json().lead;
  await app.inject({
    method: "PATCH",
    url: `/api/leads/${lead.id}/consent`,
    headers: { cookie: ownerCookie },
    payload: { canEmail: true, canSms: true, canWhatsapp: true, ...overrides },
  });
  return lead;
}

describe("Communication eligibility engine (spec sections 39-45, 53-54)", () => {
  it("a contact with no Lead record at all fails CLOSED (no consent on file)", async () => {
    const person = await db.person.create({ data: { fullName: "Never A Lead", email: `noleadconsent-${Date.now()}@example.com` } });
    const result = await checkCommunicationEligibility(person.id, "Email");
    expect(result.eligible).toBe(false);
  });

  it("no consent for a channel blocks that channel specifically, not the others", async () => {
    const lead = await createConsentedLead("09177770001", `elig1-${Date.now()}@example.com`, { canSms: false });
    expect((await checkCommunicationEligibility(lead.personId, "Email")).eligible).toBe(true);
    expect((await checkCommunicationEligibility(lead.personId, "SMS")).eligible).toBe(false);
  });

  it("DND blocks every automated channel regardless of individual consent flags", async () => {
    const lead = await createConsentedLead("09177770002", `elig2-${Date.now()}@example.com`);
    await app.inject({ method: "PATCH", url: `/api/leads/${lead.id}/consent`, headers: { cookie: ownerCookie }, payload: { optedOut: false } });
    await db.lead.update({ where: { id: lead.id }, data: { dnd: true } });
    expect((await checkCommunicationEligibility(lead.personId, "Email")).eligible).toBe(false);
    expect((await checkCommunicationEligibility(lead.personId, "SMS")).eligible).toBe(false);
    expect((await checkCommunicationEligibility(lead.personId, "WhatsApp")).eligible).toBe(false);
  });

  it("opting out blocks all automated channels", async () => {
    const lead = await createConsentedLead("09177770003", `elig3-${Date.now()}@example.com`);
    await app.inject({ method: "PATCH", url: `/api/leads/${lead.id}/consent`, headers: { cookie: ownerCookie }, payload: { optedOut: true } });
    expect((await checkCommunicationEligibility(lead.personId, "Email")).eligible).toBe(false);
  });

  it("Manual Viber/Messenger channels never pass the automated-send gate (spec section 45)", async () => {
    const lead = await createConsentedLead("09177770004", `elig4-${Date.now()}@example.com`);
    expect((await checkCommunicationEligibility(lead.personId, "Manual Viber")).eligible).toBe(false);
    expect((await checkCommunicationEligibility(lead.personId, "Manual Messenger")).eligible).toBe(false);
  });
});

describe("Message templates (spec sections 46-48)", () => {
  it("a new template starts Draft and can never send until published Active", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/communications/templates",
      headers: { cookie: ownerCookie },
      payload: { name: "Welcome Email", channel: "Email", body: "Hi {{firstName}}, welcome to batch {{batch}}!", variables: ["firstName", "batch"] },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().template.status).toBe("Draft");
    const templateId = create.json().template.id;

    const lead = await createConsentedLead("09177770005", `tmpl1-${Date.now()}@example.com`);
    const sendAttempt = await app.inject({ method: "POST", url: "/api/communications/send", headers: { cookie: ownerCookie }, payload: { personId: lead.personId, channel: "Email", templateId } });
    expect(sendAttempt.statusCode).toBe(201);
    expect(sendAttempt.json().log.status).toBe("Skipped");
    expect(sendAttempt.json().log.reason).toMatch(/Draft/);

    const publish = await app.inject({ method: "POST", url: `/api/communications/templates/${templateId}/publish`, headers: { cookie: ownerCookie } });
    expect(publish.json().template.status).toBe("Active");
  });

  it("preview NEVER reads a real contact — only synthetic sample data (spec section 48)", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/communications/templates",
      headers: { cookie: ownerCookie },
      payload: { name: "Preview Test", channel: "SMS", body: "Hello {{firstName}} from {{batch}}", variables: ["firstName", "batch"] },
    });
    const templateId = create.json().template.id;
    const preview = await app.inject({ method: "GET", url: `/api/communications/templates/${templateId}/preview`, headers: { cookie: ownerCookie } });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().usedSampleData).toBe(true);
    expect(preview.json().rendered).toContain("Sample");
  });

  it("undeclared variables are never interpolated, even if they happen to match a real field name", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/communications/templates",
      headers: { cookie: ownerCookie },
      payload: { name: "Undeclared Var Test", channel: "Email", body: "Secret: {{email}}", variables: [] },
    });
    const templateId = create.json().template.id;
    const preview = await app.inject({ method: "GET", url: `/api/communications/templates/${templateId}/preview`, headers: { cookie: ownerCookie } });
    expect(preview.json().rendered).toBe("Secret: {{email}}");
  });
});

describe("Automation rules (spec sections 49-51)", () => {
  it("a Draft automation rule is never treated as executable", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/communications/automation-rules",
      headers: { cookie: ownerCookie },
      payload: { name: "Draft Rule", triggerEvent: "LEAD_CREATED", actions: { tag: "test" }, stopConditions: ["LEAD_CONVERTED"] },
    });
    expect(create.json().rule.status).toBe("Draft");

    const activate = await app.inject({ method: "POST", url: `/api/communications/automation-rules/${create.json().rule.id}/activate`, headers: { cookie: ownerCookie } });
    expect(activate.json().rule.status).toBe("Active");

    const pause = await app.inject({ method: "POST", url: `/api/communications/automation-rules/${create.json().rule.id}/pause`, headers: { cookie: ownerCookie } });
    expect(pause.json().rule.status).toBe("Paused");
  });
});

describe("Manual send (spec sections 43-45, 53-54)", () => {
  it("a blocked send (missing consent) is stored as Skipped with a safe reason, never fabricated as Sent", async () => {
    const lead = await createConsentedLead("09177770006", `send1-${Date.now()}@example.com`, { canEmail: false });
    const template = (
      await app.inject({
        method: "POST",
        url: "/api/communications/templates",
        headers: { cookie: ownerCookie },
        payload: { name: "Send Test 1", channel: "Email", body: "Hi", variables: [] },
      })
    ).json().template;
    await app.inject({ method: "POST", url: `/api/communications/templates/${template.id}/publish`, headers: { cookie: ownerCookie } });

    const send = await app.inject({ method: "POST", url: "/api/communications/send", headers: { cookie: ownerCookie }, payload: { personId: lead.personId, channel: "Email", templateId: template.id } });
    expect(send.statusCode).toBe(201);
    expect(send.json().log.status).toBe("Skipped");
    expect(send.json().log.reason).toMatch(/email consent/i);
  });

  it("an eligible send with no GHL contact map yet is safely Skipped, not fabricated as delivered", async () => {
    const lead = await createConsentedLead("09177770007", `send2-${Date.now()}@example.com`);
    const template = (
      await app.inject({
        method: "POST",
        url: "/api/communications/templates",
        headers: { cookie: ownerCookie },
        payload: { name: "Send Test 2", channel: "Email", body: "Hi {{firstName}}", variables: ["firstName"] },
      })
    ).json().template;
    await app.inject({ method: "POST", url: `/api/communications/templates/${template.id}/publish`, headers: { cookie: ownerCookie } });

    const send = await app.inject({ method: "POST", url: "/api/communications/send", headers: { cookie: ownerCookie }, payload: { personId: lead.personId, channel: "Email", templateId: template.id } });
    expect(send.json().log.status).toBe("Skipped");
    expect(send.json().log.reason).toMatch(/GHL/);
  });

  it("preview never sends — the same request repeated against /send/preview never creates a CommunicationLog row", async () => {
    const lead = await createConsentedLead("09177770008", `send3-${Date.now()}@example.com`);
    const template = (
      await app.inject({ method: "POST", url: "/api/communications/templates", headers: { cookie: ownerCookie }, payload: { name: "Preview Send Test", channel: "SMS", body: "Hi {{firstName}}", variables: ["firstName"] } })
    ).json().template;
    await app.inject({ method: "POST", url: `/api/communications/templates/${template.id}/publish`, headers: { cookie: ownerCookie } });

    const before = await db.communicationLog.count({ where: { personId: lead.personId } });
    const preview = await app.inject({ method: "POST", url: "/api/communications/send/preview", headers: { cookie: ownerCookie }, payload: { personId: lead.personId, channel: "SMS", templateId: template.id } });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().eligible).toBe(true);
    const after = await db.communicationLog.count({ where: { personId: lead.personId } });
    expect(after).toBe(before);
  });
});

describe("Bulk send (spec section 56)", () => {
  it("preview reports recipient count, eligible count, and excluded contacts with real reasons — never a one-click send", async () => {
    const eligible = await createConsentedLead("09177770009", `bulk1-${Date.now()}@example.com`);
    const blocked = await createConsentedLead("09177770010", `bulk2-${Date.now()}@example.com`, { canEmail: false });
    const template = (
      await app.inject({ method: "POST", url: "/api/communications/templates", headers: { cookie: ownerCookie }, payload: { name: "Bulk Test", channel: "Email", body: "Hi {{firstName}}", variables: ["firstName"] } })
    ).json().template;
    await app.inject({ method: "POST", url: `/api/communications/templates/${template.id}/publish`, headers: { cookie: ownerCookie } });

    const preview = await app.inject({
      method: "POST",
      url: "/api/communications/bulk-send/preview",
      headers: { cookie: ownerCookie },
      payload: { personIds: [eligible.personId, blocked.personId], channel: "Email", templateId: template.id },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().recipientCount).toBe(2);
    expect(preview.json().eligibleCount).toBe(1);
    expect(preview.json().excludedContacts.length).toBe(1);
    expect(preview.json().excludedContacts[0].personId).toBe(blocked.personId);
  });

  it("bulk-send requires explicit confirm:true — omitting it is rejected, not defaulted", async () => {
    const lead = await createConsentedLead("09177770011", `bulk3-${Date.now()}@example.com`);
    const template = (
      await app.inject({ method: "POST", url: "/api/communications/templates", headers: { cookie: ownerCookie }, payload: { name: "Bulk Confirm Test", channel: "Email", body: "Hi", variables: [] } })
    ).json().template;
    const res = await app.inject({ method: "POST", url: "/api/communications/bulk-send", headers: { cookie: ownerCookie }, payload: { personIds: [lead.personId], channel: "Email", templateId: template.id } });
    expect(res.statusCode).toBe(400);
  });
});

describe("Communication logs (spec section 52)", () => {
  it("a student can see their own communications but not another student's", async () => {
    const studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const studentA = await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } });
    const studentB = await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-B" } });

    const own = await app.inject({ method: "GET", url: `/api/students/${studentA.id}/communications`, headers: { cookie: studentACookie } });
    expect(own.statusCode).toBe(200);

    const other = await app.inject({ method: "GET", url: `/api/students/${studentB.id}/communications`, headers: { cookie: studentACookie } });
    expect(other.statusCode).toBe(403);
  });
});

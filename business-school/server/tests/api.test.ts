import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { hashPassword } from "../auth.ts";
import { createApi } from "../app.ts";
import { get, openDatabase, run } from "../db.ts";
import { seed } from "../seed.ts";

const db = openDatabase(":memory:");
seed(db);
const app = createApi({ db, uploadDir: mkdtempSync(path.join(tmpdir(), "maia-up-")), production: false });
let base = "";
let server: ReturnType<typeof app.listen>;

before(async () => {
  run(db, "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')", "admin@test.local", "Admin", await hashPassword("admin-password-123"));
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

/** Tiny cookie-keeping client. */
function client() {
  let cookie = "";
  return async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(method !== "GET" ? { "x-maia-request": "1" } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const json = await res.json().catch(() => null);
    return { status: res.status, json, setCookie: set };
  };
}

describe("public site", () => {
  it("lists the five seeded workshops with official prices", async () => {
    const api = client();
    const { json } = await api("GET", "/api/public/courses");
    assert.equal(json.length, 5);
    for (const c of json) {
      assert.equal(c.priceSelfPaced, 1499);
      assert.equal(c.priceGuided, 4999);
    }
    const site = await api("GET", "/api/public/site");
    assert.equal(site.json.program.price, 15000);
    assert.equal(site.json.program.guidedTotal, 24995);
    assert.equal(site.json.program.savings, 9995);
  });

  it("never exposes lesson videos or policies settings keys publicly", async () => {
    const api = client();
    const course = await api("GET", "/api/public/courses/ai-creatives");
    const lessons = course.json.outline.flatMap((m: { lessons: object[] }) => m.lessons);
    for (const l of lessons) assert.ok(!("videoUrl" in l));
    const site = await api("GET", "/api/public/site");
    assert.ok(!Object.keys(site.json.settings).some((k) => k.startsWith("policy.")));
  });

  it("stores a contact inquiry and rejects incomplete ones", async () => {
    const api = client();
    const bad = await api("POST", "/api/public/inquiries", { name: "A", email: "x", message: "" });
    assert.equal(bad.status, 400);
    const ok = await api("POST", "/api/public/inquiries", {
      name: "Juan Dela Cruz",
      email: "juan@example.com",
      message: "Interested in the Claude Workshop.",
      consent: true,
    });
    assert.equal(ok.status, 201);
    assert.equal(get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM inquiries")!.n, 1);
  });

  it("blocks state-changing requests without the CSRF header", async () => {
    const res = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@test.local", password: "admin-password-123" }),
    });
    assert.equal(res.status, 403);
  });
});

describe("accounts and paid access", () => {
  const student = client();
  const admin = client();
  let lessonId = 0;
  let courseId = 0;

  it("registers a student with an HttpOnly session cookie", async () => {
    const res = await student("POST", "/api/auth/register", {
      name: "Maria Santos",
      email: "maria@example.com",
      password: "student-pass-123",
    });
    assert.equal(res.status, 201);
    assert.match(res.setCookie ?? "", /HttpOnly/i);
    assert.equal(res.json.user.role, "student");
    const stored = get<{ password_hash: string }>(db, "SELECT password_hash FROM users WHERE email = 'maria@example.com'")!;
    assert.ok(stored.password_hash.startsWith("scrypt$"));
  });

  it("rejects wrong passwords", async () => {
    const res = await client()("POST", "/api/auth/login", { email: "maria@example.com", password: "nope-nope-nope" });
    assert.equal(res.status, 401);
  });

  it("keeps students out of the admin API", async () => {
    assert.equal((await student("GET", "/api/admin/overview")).status, 403);
    assert.equal((await client()("GET", "/api/admin/overview")).status, 401);
  });

  it("denies lesson access before enrollment", async () => {
    const res = await student("GET", "/api/portal/courses/ai-creatives");
    assert.equal(res.status, 403);
  });

  it("lets an admin add a lesson video and enroll the student", async () => {
    assert.equal((await admin("POST", "/api/auth/login", { email: "admin@test.local", password: "admin-password-123" })).status, 200);
    const courses = await admin("GET", "/api/admin/courses");
    courseId = courses.json.find((c: { slug: string }) => c.slug === "ai-creatives").id;
    const full = await admin("GET", `/api/admin/courses/${courseId}`);
    lessonId = full.json.modules[0].lessons[0].id;
    const upd = await admin("PUT", `/api/admin/lessons/${lessonId}`, { videoUrl: "https://player.vimeo.com/video/123" });
    assert.equal(upd.status, 200);
    assert.equal(upd.json.modules[0].lessons[0].title, "Lesson recording coming soon", "partial update keeps title");

    const users = await admin("GET", "/api/admin/students?q=maria");
    const grant = await admin("POST", "/api/admin/enrollments", { userId: users.json[0].id, courseId, format: "self_paced" });
    assert.equal(grant.status, 201);
    assert.equal(grant.json.enrollments[0].expiresAt, null);
  });

  it("serves the video and saves progress once enrolled", async () => {
    const res = await student("GET", "/api/portal/courses/ai-creatives");
    assert.equal(res.status, 200);
    assert.equal(res.json.modules[0].lessons[0].videoUrl, "https://player.vimeo.com/video/123");
    assert.equal((await student("POST", `/api/portal/lessons/${lessonId}/progress`, { completed: true })).status, 200);
    const dash = await student("GET", "/api/portal/dashboard");
    assert.equal(dash.json.courses[0].lessonsDone, 1);
    // Other courses remain locked.
    assert.equal((await student("GET", "/api/portal/courses/facebook-ads")).status, 403);
  });

  it("removes access when an enrollment expires or is revoked", async () => {
    const enr = get<{ id: number }>(db, "SELECT id FROM enrollments WHERE course_id = ?", courseId)!;
    await admin("PUT", `/api/admin/enrollments/${enr.id}`, { expiresAt: "2020-01-01" });
    assert.equal((await student("GET", "/api/portal/courses/ai-creatives")).status, 403);
    await admin("PUT", `/api/admin/enrollments/${enr.id}`, { expiresAt: "", status: "revoked" });
    assert.equal((await student("GET", "/api/portal/courses/ai-creatives")).status, 403);
  });

  it("grants the complete program as guided access to every workshop, revealing join links only for the assigned batch", async () => {
    const userId = get<{ id: number }>(db, "SELECT id FROM users WHERE email = 'maria@example.com'")!.id;
    const prog = await admin("POST", "/api/admin/enrollments/program", { userId });
    assert.equal(prog.status, 201);
    assert.equal(prog.json.enrollments.filter((e: { format: string; status: string }) => e.format === "guided").length, 5);

    const b1 = await admin("POST", "/api/admin/batches", {
      courseId, title: "Batch A", mode: "zoom", startsAt: "2027-01-10T09:00", endsAt: "", scheduleText: "",
      capacity: null, status: "open", joinUrl: "https://zoom.us/j/111", location: "", notes: "",
    });
    assert.equal(b1.status, 201);
    let sched = (await student("GET", "/api/portal/schedule")).json;
    assert.equal(sched[0].joinUrl, "", "unassigned students do not see the join link");
    const pub = await client()("GET", "/api/public/courses/ai-creatives");
    assert.ok(!JSON.stringify(pub.json).includes("zoom.us"), "public schedule hides join links");

    const enr = prog.json.enrollments.find((e: { courseId: number; format: string }) => e.courseId === courseId && e.format === "guided");
    await admin("PUT", `/api/admin/enrollments/${enr.id}`, { batchId: b1.json.id });
    sched = (await student("GET", "/api/portal/schedule")).json;
    assert.equal(sched[0].joinUrl, "https://zoom.us/j/111");
  });

  it("refuses to publish testimonials without consent and rejects unsafe links", async () => {
    const t = await admin("POST", "/api/admin/testimonials", {
      name: "Student", role: "", quote: "x", videoUrl: "", photoUrl: "", courseId: null, consent: false, status: "published", sort: 0,
    });
    assert.equal(t.status, 400);
    const bad = await admin("PUT", "/api/admin/settings", { "contact.messengerUrl": "javascript:alert(1)" });
    assert.equal(bad.status, 400);
    const unknown = await admin("PUT", "/api/admin/settings", { "evil.key": "x" });
    assert.equal(unknown.status, 400);
  });

  it("signs out", async () => {
    await student("POST", "/api/auth/logout");
    assert.equal((await student("GET", "/api/auth/me")).json.user, null);
  });
});

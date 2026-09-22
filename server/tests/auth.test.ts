import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe("Authentication foundation", () => {
  it("rejects an unknown email with a generic error (no account enumeration)", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "nobody@maiaacademy.local", password: "whatever123" } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid email or password.");
  });

  it("rejects a correct email with the wrong password, with the SAME generic error", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: DEV_USERS.owner.email, password: "wrong-password" } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid email or password.");
  });

  it("logs in successfully with correct credentials and sets an httpOnly session cookie", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: DEV_USERS.owner });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(DEV_USERS.owner.email);
    const setCookie = res.headers["set-cookie"];
    const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("maia_session=");
  });

  it("rejects /api/auth/me with no cookie at all", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("accepts /api/auth/me with a valid session cookie", async () => {
    const cookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.role).toBe("Owner");
  });

  it("revokes the session on logout — the same cookie no longer works afterward", async () => {
    const cookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const logoutRes = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(logoutRes.statusCode).toBe(200);

    const meRes = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(meRes.statusCode).toBe(401);
  });

  it("blocks brute-force login attempts past the configured rate limit", async () => {
    // A fresh app instance so this test's own rate-limit bucket isn't
    // affected by the login attempts every other test in this file already made.
    const isolatedApp = await buildApp({ loginRateLimitOverride: 5 });
    const attempts = await Promise.all(
      Array.from({ length: 15 }, () => isolatedApp.inject({ method: "POST", url: "/api/auth/login", payload: { email: "brute@force.local", password: "x" } })),
    );
    const blocked = attempts.filter((r) => r.statusCode === 429);
    expect(blocked.length).toBeGreaterThan(0);
    await isolatedApp.close();
  });

  it("password reset issues a token that actually changes the password and revokes existing sessions", async () => {
    const originalCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const meBefore = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: originalCookie } });
    expect(meBefore.statusCode).toBe(200);

    const reqRes = await app.inject({ method: "POST", url: "/api/auth/request-password-reset", payload: { email: DEV_USERS.finance.email } });
    expect(reqRes.statusCode).toBe(200);
    const { devOnlyResetToken } = reqRes.json();
    expect(devOnlyResetToken).toBeTruthy();

    const newPassword = "NewFinancePass456!";
    const completeRes = await app.inject({
      method: "POST",
      url: "/api/auth/complete-password-reset",
      payload: { token: devOnlyResetToken, newPassword },
    });
    expect(completeRes.statusCode).toBe(200);

    // The old session must now be dead.
    const meAfter = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: originalCookie } });
    expect(meAfter.statusCode).toBe(401);

    // The old password must no longer work; the new one must.
    const oldLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: DEV_USERS.finance });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: DEV_USERS.finance.email, password: newPassword } });
    expect(newLogin.statusCode).toBe(200);
  });
});

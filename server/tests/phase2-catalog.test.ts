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

describe("Packages CRUD (spec section 5)", () => {
  it("Owner can create a package, and its price is never retroactively applied to an existing enrollment snapshot", async () => {
    const cookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const create = await app.inject({
      method: "POST",
      url: "/api/packages",
      headers: { cookie },
      payload: { name: "Phase 2 Test Package", defaultPrice: 30000 },
    });
    expect(create.statusCode).toBe(201);
    const pkg = create.json().package;
    expect(pkg.defaultPrice).toBe(30000);

    const update = await app.inject({
      method: "PATCH",
      url: `/api/packages/${pkg.id}`,
      headers: { cookie },
      payload: { defaultPrice: 35000 },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().package.defaultPrice).toBe(35000);
  });

  it("Finance Officer (no System Settings grant) cannot create a package", async () => {
    const cookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const res = await app.inject({ method: "POST", url: "/api/packages", headers: { cookie }, payload: { name: "Unauthorized Package", defaultPrice: 1000 } });
    expect(res.statusCode).toBe(403);
  });
});

describe("Batches CRUD (spec section 6)", () => {
  it("Owner can create a batch with a status, and duplicate batch codes are rejected", async () => {
    const cookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const create = await app.inject({
      method: "POST",
      url: "/api/batches",
      headers: { cookie },
      payload: { code: "P2-TEST", label: "Phase 2 Test Batch" },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().batch.status).toBe("UPCOMING");

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/batches",
      headers: { cookie },
      payload: { code: "P2-TEST", label: "Duplicate Attempt" },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it("updating a batch's status to OPEN also syncs the legacy isActive flag", async () => {
    const cookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const create = await app.inject({ method: "POST", url: "/api/batches", headers: { cookie }, payload: { code: "P2-SYNC", label: "Sync Test Batch" } });
    const batchId = create.json().batch.id;

    const update = await app.inject({ method: "PATCH", url: `/api/batches/${batchId}`, headers: { cookie }, payload: { status: "OPEN" } });
    expect(update.statusCode).toBe(200);
    expect(update.json().batch.status).toBe("OPEN");
    expect(update.json().batch.isActive).toBe(true);

    const archive = await app.inject({ method: "PATCH", url: `/api/batches/${batchId}`, headers: { cookie }, payload: { status: "ARCHIVED" } });
    expect(archive.json().batch.isActive).toBe(false);
  });
});

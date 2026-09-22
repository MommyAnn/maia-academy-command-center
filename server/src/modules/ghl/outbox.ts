// Outbox consumer (spec sections 14, 29-31, 47) — the ONLY path by which a
// DomainEvent ever reaches GHL. Nothing in the enrollment/finance/
// requirements/training/webinar/lead route modules calls the GHL client
// directly; they only ever call recordDomainEvent(...) (see events.ts),
// which stays a pure internal write. This module is the seam that turns
// those internal-only rows into real outbound HighLevel API calls, with a
// durable retry queue and a dead-letter queue for whatever a human admin
// must resolve manually.

import { db } from "../../db.js";
import type { Prisma } from "@prisma/client";
import * as ghl from "./client.js";

const MAX_ATTEMPTS = 5;

type ErrorCategory = "Timeout" | "RateLimited" | "AuthenticationFailed" | "InsufficientPermissions" | "PermanentError" | "NetworkError" | "NotConfigured";

function categorize(status: ghl.GhlConnectionStatus): ErrorCategory {
  switch (status) {
    case "NOT_CONFIGURED":
      return "NotConfigured";
    case "AUTHENTICATION_FAILED":
      return "AuthenticationFailed";
    case "INSUFFICIENT_PERMISSIONS":
      return "InsufficientPermissions";
    case "RATE_LIMITED":
      return "RateLimited";
    case "CONNECTION_ERROR":
    default:
      return "NetworkError";
  }
}

function nextRetryDelayMinutes(attemptCount: number): number {
  // 2, 4, 8, 16, 32 minutes — capped exponential backoff.
  return Math.min(2 ** attemptCount, 60);
}

/**
 * Scans unprocessed DomainEvent rows and creates one IntegrationOutboxEvent
 * per event, exactly once — the domainEventId unique constraint (not an
 * in-memory check) is the real idempotency guard (spec section 31), so
 * calling this concurrently or repeatedly can never create a duplicate row.
 */
export async function enqueuePendingDomainEvents(limit = 200): Promise<number> {
  const pending = await db.domainEvent.findMany({
    where: { processedAt: null, outboxEvent: null },
    orderBy: { occurredAt: "asc" },
    take: limit,
  });

  let enqueued = 0;
  for (const event of pending) {
    const personId = await resolvePersonId(event.type, event.studentId, event.payloadJson);
    try {
      await db.integrationOutboxEvent.create({
        data: {
          domainEventId: event.id,
          idempotencyKey: `evt_${event.id}`,
          eventType: event.type,
          personId: personId ?? null,
        },
      });
      enqueued++;
    } catch (err) {
      // P2002 unique constraint violation = another concurrent sweep already
      // enqueued this exact DomainEvent — the correct, expected outcome of
      // the race, not an error to surface.
      if (!(err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002")) throw err;
    }
  }
  return enqueued;
}

async function resolvePersonId(_eventType: string, studentId: string | null, payloadJson: Prisma.JsonValue): Promise<string | undefined> {
  if (studentId) {
    const student = await db.student.findUnique({ where: { id: studentId }, select: { personId: true } });
    if (student) return student.personId;
  }
  const payload = payloadJson as { leadId?: string; personId?: string } | null;
  if (payload?.personId) return payload.personId;
  if (payload?.leadId) {
    const lead = await db.lead.findUnique({ where: { id: payload.leadId }, select: { personId: true } });
    if (lead) return lead.personId;
  }
  return undefined;
}

/** Resolves the handful of M.A.I.A. fields this phase supports mapping to a GHL custom field (spec section 11). */
async function resolveMaiaFieldValue(maiaField: string, personId: string): Promise<string | null> {
  const [lead, student] = await Promise.all([
    db.lead.findUnique({ where: { personId } }),
    db.student.findUnique({ where: { personId }, include: { batch: true, package: true } }),
  ]);
  switch (maiaField) {
    case "pipelineStage":
      return lead?.pipelineStage ?? null;
    case "leadSource":
      return lead?.source ?? null;
    case "batch":
      return student?.batch.code ?? null;
    case "package":
      return student?.package.name ?? null;
    case "enrollmentStatus":
      return student?.enrollmentStatus ?? null;
    default:
      return null;
  }
}

interface ProcessOutcome {
  status: "SUCCESS" | "RETRYING" | "DEAD_LETTER";
  lastError?: string;
  lastErrorCategory?: ErrorCategory;
}

/**
 * Processes ONE outbox row: resolves the contact, upserts it in GHL, and
 * applies whatever tag/custom-field/workflow mappings are configured and
 * Active for this event's type. Every outcome — success, a retryable
 * failure, or a dead-lettered one — is written back to the row so the
 * admin health dashboard (spec section 4) reflects real state, never a
 * simulated one.
 */
export async function processOutboxEvent(outboxEventId: string): Promise<ProcessOutcome> {
  const row = await db.integrationOutboxEvent.findUniqueOrThrow({ where: { id: outboxEventId } });

  const finish = async (outcome: ProcessOutcome) => {
    const attemptCount = row.attemptCount + 1;
    if (outcome.status === "SUCCESS") {
      await db.$transaction([
        db.integrationOutboxEvent.update({
          where: { id: outboxEventId },
          data: { status: "SUCCESS", attemptCount, lastAttemptAt: new Date(), resolvedAt: new Date(), lastError: null, lastErrorCategory: null, nextRetryAt: null },
        }),
        db.domainEvent.update({ where: { id: row.domainEventId }, data: { processedAt: new Date() } }),
      ]);
    } else {
      await db.integrationOutboxEvent.update({
        where: { id: outboxEventId },
        data: {
          status: outcome.status,
          attemptCount,
          lastAttemptAt: new Date(),
          lastError: outcome.lastError ?? null,
          lastErrorCategory: outcome.lastErrorCategory ?? null,
          nextRetryAt: outcome.status === "RETRYING" ? new Date(Date.now() + nextRetryDelayMinutes(attemptCount) * 60_000) : null,
        },
      });
    }
    return outcome;
  };

  if (!row.personId) {
    return finish({ status: "SUCCESS", lastError: "No associated contact — nothing to sync." });
  }

  const person = await db.person.findUnique({ where: { id: row.personId } });
  if (!person) {
    return finish({ status: "DEAD_LETTER", lastError: "Associated Person no longer exists.", lastErrorCategory: "PermanentError" });
  }
  if (!person.email && !person.contactNumber) {
    return finish({ status: "DEAD_LETTER", lastError: "Contact has no email or phone number — cannot sync to GHL.", lastErrorCategory: "PermanentError" });
  }

  const [tagMapping, workflowMapping, customFieldMappings] = await Promise.all([
    db.ghlTagMapping.findUnique({ where: { eventKey: row.eventType } }),
    db.ghlWorkflowMapping.findUnique({ where: { eventKey: row.eventType } }),
    db.ghlCustomFieldMapping.findMany({ where: { isActive: true } }),
  ]);

  const customFields: { id: string; value: string }[] = [];
  for (const mapping of customFieldMappings) {
    const value = await resolveMaiaFieldValue(mapping.maiaField, row.personId);
    if (value !== null) customFields.push({ id: mapping.ghlFieldId, value });
  }

  const [firstName, ...rest] = person.fullName.trim().split(/\s+/);
  const upsertResult = await ghl.upsertContact({
    email: person.email ?? undefined,
    phone: person.contactNumber ?? undefined,
    firstName,
    lastName: rest.join(" ") || undefined,
    tags: tagMapping?.isActive ? [tagMapping.ghlTagName] : undefined,
    customFields: customFields.length > 0 ? customFields : undefined,
  });

  if (!upsertResult.ok) {
    await db.ghlContactMap.upsert({
      where: { personId: row.personId },
      update: { syncStatus: "FAILED", lastError: upsertResult.message, lastSyncDirection: "Outbound" },
      create: { personId: row.personId, syncStatus: "FAILED", lastError: upsertResult.message, lastSyncDirection: "Outbound" },
    });
    const category = categorize(upsertResult.status);
    const status = row.attemptCount + 1 >= MAX_ATTEMPTS || category === "NotConfigured" ? "DEAD_LETTER" : "RETRYING";
    return finish({ status, lastError: upsertResult.message, lastErrorCategory: category });
  }

  const contactId = upsertResult.data.contactId;
  await db.ghlContactMap.upsert({
    where: { personId: row.personId },
    update: { ghlContactId: contactId, ghlLocationId: process.env.GHL_LOCATION_ID ?? null, syncStatus: "SYNCED", lastSyncedAt: new Date(), lastSyncDirection: "Outbound", lastError: null },
    create: { personId: row.personId, ghlContactId: contactId, syncStatus: "SYNCED", lastSyncedAt: new Date(), lastSyncDirection: "Outbound" },
  });

  if (workflowMapping?.isActive) {
    const workflowResult = await ghl.triggerWorkflow(contactId, workflowMapping.ghlWorkflowId);
    if (!workflowResult.ok) {
      const category = categorize(workflowResult.status);
      const status = row.attemptCount + 1 >= MAX_ATTEMPTS || category === "NotConfigured" ? "DEAD_LETTER" : "RETRYING";
      return finish({ status, lastError: `Workflow trigger failed: ${workflowResult.message}`, lastErrorCategory: category });
    }
  }

  return finish({ status: "SUCCESS" });
}

/** Processes every row currently due (QUEUED, or RETRYING with nextRetryAt in the past), up to `limit` rows per sweep. */
export async function runOutboxSweep(limit = 50): Promise<{ enqueued: number; processed: number }> {
  const enqueued = await enqueuePendingDomainEvents();

  const due = await db.integrationOutboxEvent.findMany({
    where: {
      OR: [{ status: "QUEUED" }, { status: "RETRYING", nextRetryAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const row of due) {
    await processOutboxEvent(row.id);
  }

  return { enqueued, processed: due.length };
}

let sweepInterval: NodeJS.Timeout | null = null;

/** Started once from app.ts, skipped entirely under NODE_ENV=test (spec: tests drive processing explicitly and deterministically instead). */
export function startOutboxWorker(intervalMs = 30_000): void {
  if (sweepInterval) return;
  sweepInterval = setInterval(() => {
    runOutboxSweep().catch((err) => {
      console.error("Outbox sweep failed:", err);
    });
  }, intervalMs);
  sweepInterval.unref();
}

export function stopOutboxWorker(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
}

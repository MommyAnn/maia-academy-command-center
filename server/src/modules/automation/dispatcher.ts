// The dispatcher — matches new DomainEvent rows against ACTIVE Automations'
// triggers and creates runs, then advances every run that is due (mirrors
// ghl/outbox.ts's own enqueue-then-process sweep pattern exactly). This is
// deliberately a SEPARATE consumer from the GHL outbox: DomainEvent.processedAt
// is the outbox's own field, never written by this module, so the two
// consumers never interfere with each other (see schema.prisma's Phase 12
// header comment).
//
// Scan window: a bounded recent time window (default 7 days), not an
// unbounded "everything since forever" scan. The @@unique([automationId,
// domainEventId]) constraint (via startRun) makes re-scanning the same
// window on every sweep safe — a duplicate create just fails with P2002,
// exactly like the outbox's own idempotency guard — but this is not a
// durable per-consumer cursor; a DomainEvent older than the window at the
// moment an Automation first goes ACTIVE will never retroactively match.
// Disclosed as a known scope limit, not a silent gap.

import { db } from "../../db.js";
import { startRun, advanceRun } from "./executor.js";

function isUniqueConstraintError(err: unknown): boolean {
  return !!(err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002");
}

async function resolveEntityFromEvent(event: { studentId: string | null; payloadJson: unknown }): Promise<{ entityType: "Lead" | "Student"; entityId: string } | null> {
  if (event.studentId) return { entityType: "Student", entityId: event.studentId };
  const payload = event.payloadJson as { leadId?: string } | null;
  if (payload?.leadId) return { entityType: "Lead", entityId: payload.leadId };
  return null;
}

export async function matchNewDomainEvents(windowHours = 24 * 7, limit = 500): Promise<number> {
  const activeAutomations = await db.automation.findMany({
    where: { status: "ACTIVE", currentVersion: { status: "ACTIVE" } },
    include: { currentVersion: true },
  });

  const byTrigger = new Map<string, typeof activeAutomations>();
  for (const automation of activeAutomations) {
    const triggerType = automation.currentVersion?.triggerType;
    if (!triggerType || triggerType === "MANUAL" || triggerType === "SCHEDULE") continue;
    const list = byTrigger.get(triggerType) ?? [];
    list.push(automation);
    byTrigger.set(triggerType, list);
  }
  if (byTrigger.size === 0) return 0;

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const events = await db.domainEvent.findMany({
    where: { type: { in: [...byTrigger.keys()] }, occurredAt: { gte: since } },
    orderBy: { occurredAt: "asc" },
    take: limit,
  });

  let created = 0;
  for (const event of events) {
    const automations = byTrigger.get(event.type) ?? [];
    if (automations.length === 0) continue;
    const entity = await resolveEntityFromEvent(event);
    if (!entity) continue;

    for (const automation of automations) {
      try {
        await startRun({
          automationId: automation.id,
          automationVersionId: automation.currentVersion!.id,
          entityType: entity.entityType,
          entityId: entity.entityId,
          triggerEvent: event.type,
          domainEventId: event.id,
          isTest: false,
        });
        created++;
      } catch (err) {
        if (!isUniqueConstraintError(err)) throw err;
      }
    }
  }
  return created;
}

export async function runDispatcherSweep(limit = 100): Promise<{ matched: number; advanced: number }> {
  const matched = await matchNewDomainEvents();

  const due = await db.automationRun.findMany({
    where: {
      OR: [{ status: "QUEUED" }, { status: "WAITING", resumeAt: { lte: new Date() } }],
    },
    orderBy: { startedAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const run of due) {
    await advanceRun(run.id);
  }

  return { matched, advanced: due.length };
}

let sweepInterval: NodeJS.Timeout | null = null;

/** Started once from app.ts, skipped under NODE_ENV=test — tests drive advanceRun/matchNewDomainEvents explicitly instead (same convention as the GHL outbox worker). */
export function startAutomationDispatcher(intervalMs = 15_000): void {
  if (sweepInterval) return;
  sweepInterval = setInterval(() => {
    runDispatcherSweep().catch((err) => {
      console.error("Automation dispatcher sweep failed:", err);
    });
  }, intervalMs);
  sweepInterval.unref();
}

export function stopAutomationDispatcher(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
}

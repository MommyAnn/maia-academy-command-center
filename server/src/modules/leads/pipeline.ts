import type { Prisma, LeadStage } from "@prisma/client";
import { db } from "../../db.js";

type DbOrTx = typeof db | Prisma.TransactionClient;

// The ONE place a Lead's pipelineStage is ever written (spec section 18) —
// every caller goes through this so the append-only LeadPipelineHistory
// trail can never drift from the current value on the Lead row itself.
// Accepts either the top-level db client or an in-flight transaction
// client, so it composes inside the Lead→Student conversion transaction
// (spec section 38) as well as being called standalone.
export async function moveLeadStage(
  client: DbOrTx,
  leadId: string,
  newStage: LeadStage,
  changedById: string | null,
  reason?: string,
) {
  const lead = await client.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.pipelineStage === newStage) return lead;

  const updated = await client.lead.update({ where: { id: leadId }, data: { pipelineStage: newStage } });
  await client.leadPipelineHistory.create({
    data: { leadId, previousStage: lead.pipelineStage, newStage, changedById, reason: reason ?? null },
  });
  return updated;
}

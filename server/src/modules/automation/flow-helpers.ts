// Small shared helpers between executor.ts and simulator.ts — kept in one
// place so the dry-run's action-type resolution can never silently drift
// from what the real executor actually does.

import type { FlowNode } from "./flow.js";

export function resolveActionTypeForSimulation(node: FlowNode): string {
  if (node.type === "TASK") return "CREATE_TASK";
  if (node.type === "WEBHOOK") return "CALL_WEBHOOK";
  if (node.type === "INTEGRATION") return "SYNC_GHL_CONTACT";
  return ((node.config as { actionType?: string }).actionType as string) ?? "";
}

// The Dry Run / Simulator (spec sections 49, 51). Reads real current state
// through the same condition evaluator the real executor uses, so a
// branch-selection result is trustworthy — but calls executeAction() for
// NOTHING. No Task, no CommunicationLog, no CourseAccessGrant, no webhook
// call, no GHL call is ever created by this file. It walks the graph once,
// following the SAME edge-selection rule as executor.ts.

import { resolveEntityContext, evaluateConditionGroup } from "./conditions.js";
import { resolveActionTypeForSimulation } from "./flow-helpers.js";
import type { FlowDefinition, ConditionGroup } from "./flow.js";

export interface SimulatedStep {
  nodeId: string;
  nodeType: string;
  label?: string;
  description: string;
  branchTaken?: "YES" | "NO";
}

export interface SimulationResult {
  path: SimulatedStep[];
  wouldExecuteActions: { nodeId: string; actionType: string; label?: string }[];
  wouldSendMessages: { nodeId: string; channel?: string; templateId?: string; label?: string }[];
  terminal: "COMPLETED" | "MAX_STEPS_EXCEEDED" | "DEAD_END";
}

const MAX_STEPS = 100;

export async function simulateFlow(flow: FlowDefinition, entityType: "Lead" | "Student", entityId: string): Promise<SimulationResult> {
  const ctx = await resolveEntityContext(entityType, entityId);
  const nodeById = new Map(flow.nodes.map((n) => [n.id, n]));
  const path: SimulatedStep[] = [];
  const wouldExecuteActions: SimulationResult["wouldExecuteActions"] = [];
  const wouldSendMessages: SimulationResult["wouldSendMessages"] = [];

  let currentNodeId: string | null = flow.nodes.find((n) => n.type === "START")?.id ?? null;
  let steps = 0;

  while (currentNodeId && steps < MAX_STEPS) {
    steps++;
    const node = nodeById.get(currentNodeId);
    if (!node) break;

    let branchTaken: "YES" | "NO" | undefined;
    if (node.type === "CONDITION" || node.type === "DECISION") {
      const group = ((node.config as { group?: ConditionGroup }).group as ConditionGroup) ?? { op: "AND", rules: [] };
      const result = await evaluateConditionGroup(ctx, group);
      branchTaken = result ? "YES" : "NO";
      path.push({ nodeId: node.id, nodeType: node.type, label: node.label, description: `Evaluated ${node.type.toLowerCase()} — result: ${result}`, branchTaken });
    } else if (node.type === "DELAY") {
      const amount = (node.config as { amount?: number }).amount ?? 0;
      const unit = (node.config as { unit?: string }).unit ?? "HOURS";
      path.push({ nodeId: node.id, nodeType: node.type, label: node.label, description: `Would WAIT ${amount} ${unit.toLowerCase()} here (simulated instantly).` });
    } else if (node.type === "MESSAGE") {
      const channel = (node.config as { channel?: string }).channel;
      const templateId = (node.config as { templateId?: string }).templateId;
      wouldSendMessages.push({ nodeId: node.id, channel, templateId, label: node.label });
      path.push({ nodeId: node.id, nodeType: node.type, label: node.label, description: `Would send a ${channel ?? "?"} message (no message is actually sent in a dry run).` });
    } else if (node.type === "ACTION" || node.type === "TASK" || node.type === "WEBHOOK" || node.type === "INTEGRATION") {
      const actionType = resolveActionTypeForSimulation(node);
      wouldExecuteActions.push({ nodeId: node.id, actionType, label: node.label });
      path.push({ nodeId: node.id, nodeType: node.type, label: node.label, description: `Would execute action ${actionType} (no real action is taken in a dry run).` });
    } else if (node.type === "GOAL") {
      path.push({ nodeId: node.id, nodeType: node.type, label: node.label, description: `Would reach GOAL: ${(node.config as { goalType?: string }).goalType ?? "unspecified"}.` });
    } else if (node.type === "EXIT") {
      path.push({ nodeId: node.id, nodeType: node.type, label: node.label, description: "Run would end here." });
      return { path, wouldExecuteActions, wouldSendMessages, terminal: "COMPLETED" };
    } else {
      path.push({ nodeId: node.id, nodeType: node.type, label: node.label, description: `Passes through ${node.type}.` });
    }

    const outgoing = flow.edges.filter((e) => e.from === node.id);
    let nextNodeId: string | null;
    if (branchTaken) {
      const wantBranch = branchTaken === "YES" ? ["YES", "TRUE"] : ["NO", "FALSE"];
      nextNodeId = outgoing.find((e) => e.branch && wantBranch.includes(e.branch.toUpperCase()))?.to ?? outgoing[0]?.to ?? null;
    } else {
      nextNodeId = outgoing[0]?.to ?? null;
    }
    currentNodeId = nextNodeId;
    if (!currentNodeId) return { path, wouldExecuteActions, wouldSendMessages, terminal: node.type === "GOAL" ? "COMPLETED" : "DEAD_END" };
  }

  return { path, wouldExecuteActions, wouldSendMessages, terminal: steps >= MAX_STEPS ? "MAX_STEPS_EXCEEDED" : "COMPLETED" };
}

// The Flow Validator (spec sections 46-47) — a pure(-ish) function that
// inspects a flow graph BEFORE it is ever allowed to run. Blocking issues
// keep an AutomationVersion at DESIGN_ONLY readiness; non-blocking issues
// (a missing template, an unconnected platform) still allow TEST MODE but
// block PUBLISH. Nothing here executes a node — see executor.ts for that.

import { db } from "../../db.js";
import { ACTION_TYPES, MESSAGE_CHANNELS, type FlowDefinition, type FlowNode } from "./flow.js";

export type IssueSeverity = "BLOCKING" | "WARNING";

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  nodeId?: string;
}

export type Readiness = "DESIGN_ONLY" | "READY_FOR_TEST" | "READY_FOR_APPROVAL" | "READY_TO_PUBLISH" | "ACTIVE" | "BLOCKED";

export interface ValidationResult {
  issues: ValidationIssue[];
  blocking: boolean;
  /** The best readiness this flow could reach on structure alone — approval/publish/active are workflow-status-driven on top of this (see automation/routes.ts). */
  structuralReadiness: "BLOCKED" | "DESIGN_ONLY" | "READY_FOR_TEST";
}

const AUTOMATED_MESSAGE_CHANNELS = ["Email", "SMS", "WhatsApp"] as const;

function buildAdjacency(flow: FlowDefinition): { forward: Map<string, string[]>; incoming: Map<string, number> } {
  const forward = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  for (const node of flow.nodes) {
    forward.set(node.id, []);
    incoming.set(node.id, 0);
  }
  for (const edge of flow.edges) {
    if (!forward.has(edge.from) || !incoming.has(edge.to)) continue; // invalid edges reported separately
    forward.get(edge.from)!.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }
  return { forward, incoming };
}

/** DFS cycle detection that ignores cycles passing through a DELAY/WAIT_UNTIL-config node — a recurring "wait then re-check" loop is legitimate; a zero-delay loop is not (spec section 33). */
function findUnsafeCycle(flow: FlowDefinition, forward: Map<string, string[]>): string[] | null {
  const nodeById = new Map(flow.nodes.map((n) => [n.id, n]));
  const isDelayLike = (id: string) => {
    const node = nodeById.get(id);
    return node?.type === "DELAY" || (node?.type === "ACTION" && (node.config as { waitUntil?: boolean }).waitUntil === true);
  };

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>(flow.nodes.map((n) => [n.id, WHITE]));
  const stack: string[] = [];

  function dfs(nodeId: string): string[] | null {
    color.set(nodeId, GRAY);
    stack.push(nodeId);
    for (const next of forward.get(nodeId) ?? []) {
      if (color.get(next) === GRAY) {
        const cycleStart = stack.indexOf(next);
        const cycle = stack.slice(cycleStart);
        if (!cycle.some(isDelayLike)) return cycle;
      } else if (color.get(next) === WHITE) {
        const found = dfs(next);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(nodeId, BLACK);
    return null;
  }

  for (const node of flow.nodes) {
    if (color.get(node.id) === WHITE) {
      const found = dfs(node.id);
      if (found) return found;
    }
  }
  return null;
}

export interface ValidateOptions {
  /** Skip DB-backed checks (template/platform) for a pure offline/unit-test validation. */
  skipDbChecks?: boolean;
}

export async function validateFlow(flow: FlowDefinition, options: ValidateOptions = {}): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(flow.nodes.map((n) => n.id));

  for (const edge of flow.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      issues.push({ severity: "BLOCKING", code: "INVALID_EDGE", message: `Edge references an unknown node (${edge.from} -> ${edge.to}).` });
    }
  }

  const startNodes = flow.nodes.filter((n) => n.type === "START");
  if (startNodes.length === 0) issues.push({ severity: "BLOCKING", code: "MISSING_START", message: "The flow has no START node." });
  if (startNodes.length > 1) issues.push({ severity: "BLOCKING", code: "MULTIPLE_START", message: "The flow has more than one START node." });

  const terminalTypes = new Set(["EXIT", "GOAL"]);
  const hasExit = flow.nodes.some((n) => terminalTypes.has(n.type));
  if (!hasExit) issues.push({ severity: "BLOCKING", code: "MISSING_EXIT", message: "The flow has no EXIT or GOAL node — every automation must define where it ends." });

  const { forward, incoming } = buildAdjacency(flow);

  for (const node of flow.nodes) {
    if (node.type === "START") continue;
    if ((incoming.get(node.id) ?? 0) === 0) {
      issues.push({ severity: "BLOCKING", code: "UNREACHABLE_NODE", message: `Node "${node.label ?? node.id}" has no incoming connection and can never run.`, nodeId: node.id });
    }
  }
  for (const node of flow.nodes) {
    if (terminalTypes.has(node.type)) continue;
    if ((forward.get(node.id) ?? []).length === 0) {
      issues.push({ severity: "BLOCKING", code: "DEAD_END", message: `Node "${node.label ?? node.id}" has no outgoing connection and is not an EXIT/GOAL node.`, nodeId: node.id });
    }
  }

  const unsafeCycle = findUnsafeCycle(flow, forward);
  if (unsafeCycle) {
    issues.push({ severity: "BLOCKING", code: "INFINITE_LOOP", message: `A loop was detected with no DELAY/WAIT step in it (nodes: ${unsafeCycle.join(" -> ")}) — this would execute forever.` });
  }

  for (const node of flow.nodes) {
    validateNodeConfig(node, issues);
  }

  if (!options.skipDbChecks) {
    await runDbChecks(flow.nodes, issues);
  }

  const blocking = issues.some((i) => i.severity === "BLOCKING");
  return {
    issues,
    blocking,
    structuralReadiness: blocking ? "DESIGN_ONLY" : "READY_FOR_TEST",
  };
}

function validateNodeConfig(node: FlowNode, issues: ValidationIssue[]) {
  const config = node.config as Record<string, unknown>;
  if (node.type === "ACTION" || node.type === "TASK") {
    const actionType = (node.type === "TASK" ? "CREATE_TASK" : config.actionType) as string | undefined;
    if (!actionType || !(ACTION_TYPES as readonly string[]).includes(actionType)) {
      issues.push({ severity: "BLOCKING", code: "UNSUPPORTED_ACTION", message: `Node "${node.label ?? node.id}" has an unsupported or missing actionType.`, nodeId: node.id });
    }
  }
  if (node.type === "WEBHOOK") {
    if (!config.url || typeof config.url !== "string") {
      issues.push({ severity: "BLOCKING", code: "MISSING_WEBHOOK_URL", message: `Webhook node "${node.label ?? node.id}" has no URL configured.`, nodeId: node.id });
    }
  }
  if (node.type === "MESSAGE") {
    const channel = config.channel as string | undefined;
    if (!channel || !(MESSAGE_CHANNELS as readonly string[]).includes(channel)) {
      issues.push({ severity: "BLOCKING", code: "INVALID_CHANNEL", message: `Message node "${node.label ?? node.id}" has an invalid or missing channel.`, nodeId: node.id });
    }
  }
  if (node.type === "DELAY") {
    const amount = config.amount;
    const unit = config.unit as string | undefined;
    if (typeof amount !== "number" || amount <= 0 || !["MINUTES", "HOURS", "DAYS"].includes(unit ?? "")) {
      issues.push({ severity: "BLOCKING", code: "INVALID_DELAY", message: `Delay node "${node.label ?? node.id}" has an invalid amount/unit.`, nodeId: node.id });
    }
  }
}

async function runDbChecks(nodes: FlowNode[], issues: ValidationIssue[]) {
  const messageNodes = nodes.filter((n) => n.type === "MESSAGE");
  if (messageNodes.length === 0) return;

  const needsGhl = messageNodes.some((n) => AUTOMATED_MESSAGE_CHANNELS.includes((n.config as { channel?: string }).channel as never));
  if (needsGhl) {
    const ghlConfig = await db.ghlIntegrationConfig.findUnique({ where: { id: "singleton" } });
    if (!ghlConfig || ghlConfig.status !== "CONNECTED") {
      issues.push({
        severity: "WARNING",
        code: "MISSING_PLATFORM",
        message: "One or more Message nodes use an automated channel (Email/SMS/WhatsApp), but GHL is not CONNECTED — this automation cannot PUBLISH until GHL is connected. It may still run in TEST MODE, which never sends externally.",
      });
    }
  }

  for (const node of messageNodes) {
    const templateId = (node.config as { templateId?: string }).templateId;
    if (!templateId) {
      issues.push({ severity: "WARNING", code: "MISSING_TEMPLATE", message: `Message node "${node.label ?? node.id}" has no template selected yet.`, nodeId: node.id });
      continue;
    }
    const template = await db.messageTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      issues.push({ severity: "WARNING", code: "MISSING_TEMPLATE", message: `Message node "${node.label ?? node.id}" references a template that no longer exists.`, nodeId: node.id });
      continue;
    }
    if (template.status !== "Active") {
      issues.push({ severity: "WARNING", code: "MISSING_TEMPLATE", message: `Message node "${node.label ?? node.id}" references template "${template.name}", which is ${template.status}, not Active.`, nodeId: node.id });
    }
    const declaredVars = new Set(((template.variablesJson as string[] | null) ?? []));
    const usedVars = ((node.config as { variables?: string[] }).variables ?? []) as string[];
    const invalid = usedVars.filter((v) => !declaredVars.has(v));
    if (invalid.length > 0) {
      issues.push({ severity: "WARNING", code: "INVALID_VARIABLE", message: `Message node "${node.label ?? node.id}" uses variable(s) not declared safe by its template: ${invalid.join(", ")}.`, nodeId: node.id });
    }
  }
}

/** Warns (never blocks) when an existing Phase 5 AutomationRule already fires on the same trigger — this codebase does not cross-validate the two systems automatically, so this is the one real signal an admin gets (spec section 55). */
export async function checkDuplicateAutomationRisk(triggerType: string): Promise<ValidationIssue[]> {
  if (triggerType === "MANUAL" || triggerType === "SCHEDULE") return [];
  const existing = await db.automationRule.findMany({ where: { triggerEvent: triggerType, status: "Active" } });
  if (existing.length === 0) return [];
  return [
    {
      severity: "WARNING",
      code: "DUPLICATE_AUTOMATION_RISK",
      message: `${existing.length} existing Phase 5 Automation Rule(s) already fire on "${triggerType}" (${existing.map((r) => r.name).join(", ")}) — review to avoid sending the same message twice for the same trigger.`,
    },
  ];
}

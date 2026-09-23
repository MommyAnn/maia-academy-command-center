// The AI Automation Architect (spec sections 43-45, 110-113) — translates a
// plain-language description into a structured DRAFT Automation + v1
// AutomationVersion. Reuses the EXACT same access/usage/context/model
// plumbing as Phase 11's creative/generation.ts (buildAiRequestContext,
// resolveModelConfig, generateStructured, a real AiGeneration audit row) —
// this is the same "structured tool" pattern, not a new mechanism. The
// generated flow is run through the REAL Flow Validator before it is ever
// stored, so a DRAFT's validationJson reflects actual structural issues,
// never the model's own self-report.

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { getProvider, resolveModelConfig } from "../../ai/registry.js";
import { buildAiRequestContext, renderUserMessage } from "../ai/context.js";
import { checkToolAccess } from "../ai-tools/access.js";
import { checkUsageLimits } from "../ai-tools/usage.js";
import { generateAiGenerationDisplayId, generateAutomationDisplayId } from "../sequence.js";
import { writeAuditLog } from "../../audit/log.js";
import { validateFlow, checkDuplicateAutomationRisk, type ValidationIssue } from "./validator.js";
import { NODE_TYPES, ACTION_TYPES, MESSAGE_CHANNELS, flowDefinitionSchema, type FlowDefinition } from "./flow.js";
import { DOMAIN_EVENT_TYPES } from "../events.js";

export type ArchitectOutcome = { ok: true; generationId: string; automationId: string } | { ok: false; httpStatus: number; reason: string };

interface ArchitectStructuredResult {
  name: string;
  goal: string;
  triggerType: string;
  audience?: string;
  eligibility?: string;
  flow: { nodes: { id: string; type: string; label?: string; config: Record<string, unknown> }[]; edges: { from: string; to: string; branch?: string }[] };
  messagesNeeded: string[];
  conditions: string[];
  branches: string[];
  delays: string[];
  exitConditions: string[];
  platformRequirements: string[];
  risks: string[];
  missingInformation: string[];
}

export async function generateAutomationBlueprint(input: {
  studentId: string;
  businessId: string;
  journeyId?: string;
  description: string;
  actorUserId: string;
}): Promise<ArchitectOutcome> {
  const toolKey = "automation-architect";
  const access = await checkToolAccess(input.studentId, toolKey);
  if (!access.allowed) return { ok: false, httpStatus: 403, reason: access.reason! };

  const tool = await db.aiTool.findUnique({ where: { toolKey } });
  if (!tool) return { ok: false, httpStatus: 404, reason: "Unknown AI tool." };
  const student = await db.student.findUnique({ where: { id: input.studentId } });
  if (!student) return { ok: false, httpStatus: 404, reason: "Unknown student." };

  const usage = await checkUsageLimits(input.studentId, tool.id, student.packageId);
  if (!usage.allowed) return { ok: false, httpStatus: 429, reason: usage.reason! };

  const validTriggers = [...DOMAIN_EVENT_TYPES, "MANUAL"];
  const userRequest = [
    `Describe an automation for this request: ${input.description}`,
    `Valid trigger types (use EXACTLY one of these strings, or "MANUAL" if no system event fits): ${validTriggers.join(", ")}`,
    `Valid flow node types: ${NODE_TYPES.join(", ")}`,
    `Valid action types (for ACTION/TASK nodes): ${ACTION_TYPES.join(", ")}`,
    `Valid message channels (for MESSAGE nodes): ${MESSAGE_CHANNELS.join(", ")}`,
    `The flow MUST have exactly one START node and at least one EXIT or GOAL node, and every node must be reachable and have an outgoing connection unless it is EXIT/GOAL.`,
  ].join("\n");

  const contextResult = await buildAiRequestContext({ studentId: input.studentId, businessId: input.businessId, toolKey, userRequest });
  if (!contextResult.ok) {
    const httpStatus = contextResult.code === "BUSINESS_NOT_OWNED" ? 403 : contextResult.code === "NO_MASTER_BRAIN" ? 422 : 404;
    return { ok: false, httpStatus, reason: contextResult.reason };
  }
  const context = contextResult.context;
  if (!context.modelConfigKey) return { ok: false, httpStatus: 422, reason: "This tool has no model configuration assigned." };
  const resolved = await resolveModelConfig(context.modelConfigKey);
  if (!resolved.ok) return { ok: false, httpStatus: 503, reason: resolved.reason };

  const schema = {
    type: "object",
    required: ["name", "goal", "triggerType", "flow", "messagesNeeded", "conditions", "branches", "delays", "exitConditions", "platformRequirements", "risks", "missingInformation"],
    properties: {
      name: { type: "string" },
      goal: { type: "string" },
      triggerType: { type: "string" },
      audience: { type: "string" },
      eligibility: { type: "string" },
      flow: {
        type: "object",
        required: ["nodes", "edges"],
        properties: {
          nodes: { type: "array", items: { type: "object", required: ["id", "type", "config"], properties: { id: { type: "string" }, type: { type: "string" }, label: { type: "string" }, config: { type: "object" } } } },
          edges: { type: "array", items: { type: "object", required: ["from", "to"], properties: { from: { type: "string" }, to: { type: "string" }, branch: { type: "string" } } } },
        },
      },
      messagesNeeded: { type: "array", items: { type: "string" } },
      conditions: { type: "array", items: { type: "string" } },
      branches: { type: "array", items: { type: "string" } },
      delays: { type: "array", items: { type: "string" } },
      exitConditions: { type: "array", items: { type: "string" } },
      platformRequirements: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      missingInformation: { type: "array", items: { type: "string" } },
    },
  };

  const provider = getProvider(resolved.config.provider);
  const userMessage = renderUserMessage(context);
  const result = await provider.generateStructured<ArchitectStructuredResult>({
    model: resolved.config.model,
    systemInstruction: context.systemInstruction,
    userMessage,
    maxOutputTokens: resolved.config.maxOutputTokens,
    temperature: resolved.config.temperature,
    schema,
    schemaName: "AutomationBlueprint",
  });

  const generationDisplayId = await generateAiGenerationDisplayId();
  const baseData = {
    generationDisplayId,
    studentId: input.studentId,
    businessId: input.businessId,
    projectId: null,
    toolId: tool.id,
    promptVersionId: context.promptVersionId,
    masterBrainDocumentId: context.masterBrainDocumentId,
    masterBrainVersion: context.masterBrainVersion,
    userInputJson: { description: input.description } as Prisma.InputJsonValue,
    requestedAt: new Date(),
  };

  if (!result.ok) {
    const generation = await db.aiGeneration.create({
      data: { ...baseData, provider: resolved.config.provider, model: resolved.config.model, status: "FAILED", failureReason: result.message, errorCategory: result.errorCategory, completedAt: new Date() },
    });
    await writeAuditLog({ action: "AI Generation Failed", summary: `${tool.name} generation failed: ${result.errorCategory}`, actorUserId: input.actorUserId, entityType: "AiGeneration", entityId: generation.id });
    return { ok: false, httpStatus: 502, reason: result.message };
  }

  const blueprint = result.data.data;
  const rawFlow = { nodes: blueprint.flow.nodes, edges: blueprint.flow.edges, exitConditions: blueprint.exitConditions.filter((c) => ["ENROLLED", "STUDENT_FULLY_PAID", "LEAD_OPTED_OUT", "LEAD_MARKED_NOT_INTERESTED"].includes(c)) };
  const triggerType = validTriggers.includes(blueprint.triggerType) ? blueprint.triggerType : "MANUAL";

  // The AI's structured output is NEVER trusted blindly — re-parsed through
  // the same zod shape check every human-authored flow must pass, before
  // it is ever run through the real validator or persisted (spec section
  // 45's "AI must not invent connections" applies just as much to node
  // shape as to platform claims).
  const parsedFlow = flowDefinitionSchema.safeParse(rawFlow);
  let flow: FlowDefinition;
  let shapeIssues: ValidationIssue[] = [];
  if (parsedFlow.success) {
    flow = parsedFlow.data as FlowDefinition;
  } else {
    flow = { nodes: [{ id: "start", type: "START", config: {} }, { id: "exit", type: "EXIT", config: {} }], edges: [{ from: "start", to: "exit" }] };
    shapeIssues = [{ severity: "BLOCKING", code: "AI_OUTPUT_MALFORMED", message: "The AI's generated flow did not match the required node/edge shape and was replaced with a minimal placeholder — review and rebuild this automation manually." }];
  }

  const [validation, duplicateWarnings] = await Promise.all([validateFlow(flow), checkDuplicateAutomationRisk(triggerType)]);
  const allIssues = [...shapeIssues, ...validation.issues, ...duplicateWarnings];
  const blocking = validation.blocking || shapeIssues.length > 0;

  const generation = await db.aiGeneration.create({
    data: {
      ...baseData,
      provider: resolved.config.provider,
      model: resolved.config.model,
      outputJson: blueprint as unknown as Prisma.InputJsonValue,
      status: "COMPLETED",
      usageJson: result.data.usage as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  await writeAuditLog({ action: "AI Tool Used", summary: `${tool.name} used`, actorUserId: input.actorUserId, entityType: "AiGeneration", entityId: generation.id });

  const automation = await db.automation.create({
    data: {
      automationDisplayId: await generateAutomationDisplayId(),
      studentId: input.studentId,
      businessId: input.businessId,
      journeyId: input.journeyId ?? null,
      name: blueprint.name,
      goal: blueprint.goal,
      audience: blueprint.audience ?? null,
      status: "DRAFT",
      readiness: blocking ? "DESIGN_ONLY" : "READY_FOR_TEST",
      createdById: input.actorUserId,
    },
  });
  const version = await db.automationVersion.create({
    data: {
      automationId: automation.id,
      versionNumber: 1,
      flowJson: flow as unknown as Prisma.InputJsonValue,
      triggerType,
      status: "DRAFT",
      validationJson: { issues: allIssues, blocking, aiDisclosed: { messagesNeeded: blueprint.messagesNeeded, platformRequirements: blueprint.platformRequirements, risks: blueprint.risks, missingInformation: blueprint.missingInformation } } as unknown as Prisma.InputJsonValue,
      createdById: input.actorUserId,
    },
  });
  await db.automation.update({ where: { id: automation.id }, data: { currentVersionId: version.id } });

  await writeAuditLog({ action: "Automation Created", summary: `Automation "${automation.name}" drafted by AI Architect`, actorUserId: input.actorUserId, entityType: "Automation", entityId: automation.id });

  return { ok: true, generationId: generation.id, automationId: automation.id };
}

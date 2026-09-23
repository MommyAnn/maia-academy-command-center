// Flow definition types (spec sections 11-12) — the shape every
// AutomationVersion.flowJson must match. Kept as plain TypeScript interfaces
// + a light zod shape check rather than a deep per-node-type schema, since
// node.config varies by type and is interpreted by the validator/executor,
// not by a single rigid schema (mirrors this codebase's existing
// Script.sectionsJson/StoryboardScene "structured but interpreted" pattern
// from Phase 11).

import { z } from "zod";

export const NODE_TYPES = ["START", "TRIGGER", "CONDITION", "ACTION", "MESSAGE", "DELAY", "DECISION", "TASK", "WEBHOOK", "INTEGRATION", "GOAL", "EXIT"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

// The full action library (spec section 18). Deliberately absent: any
// action that could change financial status, verify a payment, issue a
// refund, delete a record, mass-message, or change access — those are not
// merely permission-gated, they do not exist as callable actions anywhere
// in this engine (spec sections 19-21, "Payment Safety").
export const ACTION_TYPES = [
  "CREATE_TASK",
  "ASSIGN_STAFF",
  "UPDATE_INTERNAL_STATUS",
  "ADD_INTERNAL_NOTE",
  "ADD_TAG",
  "REMOVE_TAG",
  "GRANT_COURSE_ACCESS",
  "REQUEST_FEEDBACK",
  "QUEUE_COMMUNICATION",
  "CALL_WEBHOOK",
  "SYNC_GHL_CONTACT",
  "CREATE_FOLLOW_UP",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const MESSAGE_CHANNELS = ["Email", "SMS", "WhatsApp", "Messenger", "Internal Notification", "Manual Phone Task", "Manual Viber"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const CONDITION_FIELDS = [
  "LEAD_STAGE",
  "STUDENT_STATUS",
  "PACKAGE",
  "BATCH",
  "PAYMENT_STATUS",
  "BALANCE",
  "WEBINAR_ATTENDANCE",
  "COURSE_PROGRESS",
  "REQUIREMENT_STATUS",
  "CONSENT",
  "DND",
  "TAG",
] as const;
export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const CONDITION_OPERATORS = ["EQUALS", "NOT_EQUALS", "IN", "GREATER_THAN", "LESS_THAN", "HAS_TAG", "NOT_HAS_TAG", "IS_TRUE", "IS_FALSE"] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export interface ConditionRule {
  field: ConditionField;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConditionGroup {
  op: "AND" | "OR";
  rules: (ConditionRule | ConditionGroup)[];
}

export interface FlowNode {
  id: string;
  type: NodeType;
  label?: string;
  config: Record<string, unknown>;
}

export interface FlowEdge {
  from: string;
  to: string;
  /** For DECISION/CONDITION branching — e.g. "YES" | "NO", or a named branch. Omitted for a simple linear edge. */
  branch?: string;
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Global guardrails checked before every non-EXIT node (spec section 31) — values from EXIT_STOP_CONDITIONS. */
  exitConditions?: string[];
}

const flowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(NODE_TYPES),
  label: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

const flowEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  branch: z.string().optional(),
});

export const flowDefinitionSchema = z.object({
  nodes: z.array(flowNodeSchema).min(1),
  edges: z.array(flowEdgeSchema),
  exitConditions: z.array(z.string()).optional(),
});

// The named GOAL types (spec section 32) — a GOAL node marks a measurable
// success point in the run; it does not branch execution.
export const GOAL_TYPES = ["WEBINAR_ATTENDED", "RESERVATION_VERIFIED", "ENROLLMENT_CREATED", "FULLY_PAID", "COURSE_COMPLETED", "FEEDBACK_SUBMITTED"] as const;

// Stop conditions available to an EXIT node (spec section 31) — mirrors
// AutomationRule.stopConditionsJson's existing vocabulary (checkStopConditions
// in communications/eligibility.ts), extended with ENROLLED. ACCOUNT_DEACTIVATED
// is deliberately absent: no account-deactivation concept exists anywhere in
// this codebase yet (disclosed gap, not faked).
export const EXIT_STOP_CONDITIONS = ["ENROLLED", "STUDENT_FULLY_PAID", "LEAD_OPTED_OUT", "LEAD_MARKED_NOT_INTERESTED"] as const;

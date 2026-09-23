// Real condition evaluation (spec sections 16-17, 29) against actual system
// state — never a cached/guessed value. Every DECISION/CONDITION node in a
// flow bottoms out here. Reuses the exact same derived-finance calculation
// (finance/calc.ts) and course entitlement resolution (courses/access.ts)
// every other module already uses, rather than recomputing balance/access
// a second, possibly-inconsistent way.

import { db } from "../../db.js";
import type { Lead, Student } from "@prisma/client";
import { computeStudentFinanceSummary, resolveNetAmountDue } from "../finance/calc.js";
import { resolveCourseAccess } from "../courses/access.js";
import type { ConditionGroup, ConditionRule } from "./flow.js";

export interface EntityContext {
  entityType: "Lead" | "Student";
  entityId: string;
  personId: string;
  lead: Lead | null;
  student: Student | null;
}

export async function resolveEntityContext(entityType: "Lead" | "Student", entityId: string): Promise<EntityContext> {
  if (entityType === "Lead") {
    const lead = await db.lead.findUniqueOrThrow({ where: { id: entityId } });
    const student = await db.student.findUnique({ where: { personId: lead.personId } });
    return { entityType, entityId, personId: lead.personId, lead, student };
  }
  const student = await db.student.findUniqueOrThrow({ where: { id: entityId } });
  const lead = await db.lead.findUnique({ where: { personId: student.personId } });
  return { entityType, entityId, personId: student.personId, lead, student };
}

function compare(operator: string, actual: unknown, expected: unknown): boolean {
  switch (operator) {
    case "EQUALS":
      return actual === expected;
    case "NOT_EQUALS":
      return actual !== expected;
    case "IN":
      return Array.isArray(expected) && expected.includes(actual);
    case "GREATER_THAN":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "LESS_THAN":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "IS_TRUE":
      return actual === true;
    case "IS_FALSE":
      return actual === false;
    default:
      return false;
  }
}

async function evaluateRule(ctx: EntityContext, rule: ConditionRule): Promise<boolean> {
  switch (rule.field) {
    case "LEAD_STAGE":
      return ctx.lead ? compare(rule.operator, ctx.lead.pipelineStage, rule.value) : false;
    case "STUDENT_STATUS":
      return ctx.student ? compare(rule.operator, ctx.student.enrollmentStatus, rule.value) : false;
    case "PACKAGE": {
      if (!ctx.student) return false;
      const pkg = await db.package.findUnique({ where: { id: ctx.student.packageId } });
      return compare(rule.operator, pkg?.name ?? null, rule.value);
    }
    case "BATCH": {
      if (!ctx.student) return false;
      const batch = await db.batch.findUnique({ where: { id: ctx.student.batchId } });
      return compare(rule.operator, batch?.code ?? null, rule.value);
    }
    case "PAYMENT_STATUS": {
      if (!ctx.student) return false;
      const summary = await computeStudentFinanceSummary(ctx.student.id, await resolveNetAmountDue(ctx.student.id));
      return compare(rule.operator, summary.status, rule.value);
    }
    case "BALANCE": {
      if (!ctx.student) return false;
      const summary = await computeStudentFinanceSummary(ctx.student.id, await resolveNetAmountDue(ctx.student.id));
      return compare(rule.operator, summary.balance, rule.value);
    }
    case "WEBINAR_ATTENDANCE": {
      if (!ctx.lead) return false;
      const latest = await db.webinarRegistration.findFirst({ where: { leadId: ctx.lead.id }, orderBy: { registeredAt: "desc" } });
      return compare(rule.operator, latest?.attendanceStatus ?? null, rule.value);
    }
    case "COURSE_PROGRESS": {
      if (!ctx.student) return false;
      const value = rule.value as { courseId?: string } | undefined;
      if (!value?.courseId) return false;
      const resolution = await resolveCourseAccess(ctx.student.id, value.courseId);
      return compare(rule.operator, resolution.status, (rule.value as { status?: string })?.status);
    }
    case "REQUIREMENT_STATUS": {
      if (!ctx.student) return false;
      const [total, verified, rejected] = await Promise.all([
        db.requirement.count({ where: { studentId: ctx.student.id } }),
        db.requirement.count({ where: { studentId: ctx.student.id, status: "VERIFIED" } }),
        db.requirement.count({ where: { studentId: ctx.student.id, status: "REJECTED" } }),
      ]);
      const summaryStatus = total > 0 && total === verified ? "ALL_VERIFIED" : rejected > 0 ? "HAS_REJECTED" : total > verified ? "HAS_PENDING" : "NONE";
      return compare(rule.operator, summaryStatus, rule.value);
    }
    case "CONSENT": {
      if (!ctx.lead) return false;
      const channel = rule.value as "Email" | "SMS" | "WhatsApp" | undefined;
      const consentMap = { Email: ctx.lead.canEmail, SMS: ctx.lead.canSms, WhatsApp: ctx.lead.canWhatsapp };
      return channel ? compare(rule.operator, consentMap[channel], true) : false;
    }
    case "DND":
      return ctx.lead ? compare(rule.operator, ctx.lead.dnd, rule.value ?? true) : false;
    case "TAG": {
      const tag = rule.value as string;
      const found = await db.entityTag.findUnique({ where: { entityType_entityId_tag: { entityType: ctx.entityType, entityId: ctx.entityId, tag } } });
      return rule.operator === "NOT_HAS_TAG" ? !found : !!found;
    }
    default:
      return false;
  }
}

function isConditionGroup(rule: ConditionRule | ConditionGroup): rule is ConditionGroup {
  return (rule as ConditionGroup).op !== undefined && Array.isArray((rule as ConditionGroup).rules);
}

export async function evaluateConditionGroup(ctx: EntityContext, group: ConditionGroup): Promise<boolean> {
  if (group.rules.length === 0) return true;
  const results: boolean[] = [];
  for (const rule of group.rules) {
    results.push(isConditionGroup(rule) ? await evaluateConditionGroup(ctx, rule) : await evaluateRule(ctx, rule));
  }
  return group.op === "AND" ? results.every(Boolean) : results.some(Boolean);
}

// The rule-evaluation engine (spec sections 47-54). Deliberately dumb on
// purpose: it runs each active rule's evaluator, diffs the result against
// currently-open signals for that rule, creates what's newly true, and
// auto-resolves what's no longer true. No AI involved anywhere in this file
// — this is the "RULE-BASED must still work if AI is down" half of the
// system (spec section 83).

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { RULE_DEFINITIONS, type RuleCandidate } from "./rules.js";
import { writeAuditLog } from "../../audit/log.js";

const OPEN_STATUSES = ["NEW", "REVIEWED", "ACTIONED"] as const;

export async function seedDefaultRules() {
  for (const def of RULE_DEFINITIONS) {
    await db.intelligenceRule.upsert({
      where: { ruleKey: def.ruleKey },
      update: {},
      create: {
        ruleKey: def.ruleKey,
        name: def.name,
        domain: def.domain,
        description: def.description,
        triggerType: def.triggerType,
        thresholdJson: def.defaultThreshold as Prisma.InputJsonValue,
        severity: def.defaultSeverity,
        recommendation: def.defaultRecommendation,
        active: true,
      },
    });
  }
}

export interface EvaluationSummary {
  ruleKey: string;
  candidatesFound: number;
  signalsCreated: number;
  signalsAutoResolved: number;
}

/** Runs every active rule once. Idempotent — running it twice in a row with no data change creates zero new signals. */
export async function evaluateAllRules(): Promise<EvaluationSummary[]> {
  const rules = await db.intelligenceRule.findMany({ where: { active: true } });
  const defsByKey = new Map(RULE_DEFINITIONS.map((d) => [d.ruleKey, d]));
  const summaries: EvaluationSummary[] = [];

  for (const rule of rules) {
    const def = defsByKey.get(rule.ruleKey);
    if (!def) continue; // a rule row with no matching code definition is inert, never crashes the engine

    const candidates = await def.evaluate(rule.thresholdJson as Record<string, unknown>);
    const candidateKey = (c: RuleCandidate) => `${c.entityType}:${c.entityId}`;
    const candidateMap = new Map(candidates.map((c) => [candidateKey(c), c]));

    const openSignals = await db.intelligenceSignal.findMany({ where: { ruleId: rule.id, status: { in: [...OPEN_STATUSES] } } });
    const openKeys = new Set(openSignals.map((s) => `${s.entityType}:${s.entityId}`));

    let created = 0;
    for (const candidate of candidates) {
      if (openKeys.has(candidateKey(candidate))) continue; // already tracked — dedup (spec section 52)
      await db.intelligenceSignal.create({
        data: {
          ruleId: rule.id,
          domain: rule.domain,
          entityType: candidate.entityType,
          entityId: candidate.entityId,
          severity: rule.severity,
          title: candidate.title,
          explanation: candidate.explanation,
          evidenceJson: candidate.evidence as Prisma.InputJsonValue,
        },
      });
      created++;
    }

    let autoResolved = 0;
    for (const signal of openSignals) {
      if (candidateMap.has(`${signal.entityType}:${signal.entityId}`)) continue; // still true, leave open
      await db.intelligenceSignal.update({
        where: { id: signal.id },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolution: "Underlying condition no longer met (auto-resolved)." },
      });
      autoResolved++;
    }

    summaries.push({ ruleKey: rule.ruleKey, candidatesFound: candidates.length, signalsCreated: created, signalsAutoResolved: autoResolved });
  }

  return summaries;
}

export async function resolveSignal(signalId: string, actorUserId: string, resolution: string) {
  const signal = await db.intelligenceSignal.update({
    where: { id: signalId },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: actorUserId, resolution },
  });
  await writeAuditLog({ action: "Intelligence Signal Resolved", summary: `Signal "${signal.title}" resolved: ${resolution}`, actorUserId, entityType: "IntelligenceSignal", entityId: signal.id });
  return signal;
}

export async function dismissSignal(signalId: string, actorUserId: string, resolution: string) {
  const signal = await db.intelligenceSignal.update({
    where: { id: signalId },
    data: { status: "DISMISSED", resolvedAt: new Date(), resolvedById: actorUserId, resolution },
  });
  await writeAuditLog({ action: "Intelligence Signal Dismissed", summary: `Signal "${signal.title}" dismissed: ${resolution}`, actorUserId, entityType: "IntelligenceSignal", entityId: signal.id });
  return signal;
}

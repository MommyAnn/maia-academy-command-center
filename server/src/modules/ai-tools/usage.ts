// Usage limits (spec sections 59-60) — usage itself is always live-counted
// from AiGeneration (never a separately stored counter, matching this
// codebase's established "derive, never store" rule from finance/calc.ts).
// Every applicable limit (GLOBAL, PACKAGE, TOOL, PACKAGE_TOOL) must pass;
// the first one that's already at capacity blocks the request.

import { db } from "../../db.js";

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function checkUsageLimits(studentId: string, toolId: string, packageId: string): Promise<UsageCheckResult> {
  const limits = await db.aiUsageLimit.findMany({
    where: {
      OR: [
        { scope: "GLOBAL", packageId: null, toolId: null },
        { scope: "PACKAGE", packageId },
        { scope: "TOOL", toolId },
        { scope: "PACKAGE_TOOL", packageId, toolId },
      ],
    },
  });
  if (limits.length === 0) return { allowed: true };

  for (const limit of limits) {
    const scopedToTool = limit.scope === "TOOL" || limit.scope === "PACKAGE_TOOL";
    const where = scopedToTool ? { studentId, toolId } : { studentId };

    if (limit.dailyLimit) {
      const count = await db.aiGeneration.count({ where: { ...where, createdAt: { gte: startOfToday() } } });
      if (count >= limit.dailyLimit) {
        return { allowed: false, reason: `Daily AI generation limit reached (${limit.dailyLimit}/day, scope: ${limit.scope}).` };
      }
    }
    if (limit.monthlyLimit) {
      const count = await db.aiGeneration.count({ where: { ...where, createdAt: { gte: startOfMonth() } } });
      if (count >= limit.monthlyLimit) {
        return { allowed: false, reason: `Monthly AI generation limit reached (${limit.monthlyLimit}/month, scope: ${limit.scope}).` };
      }
    }
  }
  return { allowed: true };
}

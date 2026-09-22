// AI access rules (spec sections 24, 61) — a Student sees/uses only what
// their Package, a manual grant, or an admin override actually entitles
// them to. Course/Subscription/Promotion sources listed in the spec are
// not yet separately modeled in this codebase (no CourseAiAccess table
// exists) — Package and Manual Grant are the two real, enforced sources
// today; see the Phase 6 completion report for this honestly scoped gap.

import { db } from "../../db.js";

export interface ToolAccessResult {
  allowed: boolean;
  reason?: string;
}

export async function checkToolAccess(studentId: string, toolKey: string): Promise<ToolAccessResult> {
  const tool = await db.aiTool.findUnique({ where: { toolKey } });
  if (!tool) return { allowed: false, reason: "Unknown AI tool." };
  if (tool.status !== "ACTIVE") return { allowed: false, reason: `This tool is currently ${tool.status === "COMING_SOON" ? "Coming Soon" : "unavailable"}.` };

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) return { allowed: false, reason: "Unknown student." };

  const [packageAccess, manualGrant] = await Promise.all([
    db.aiPackageAccess.findUnique({ where: { packageId_toolKey: { packageId: student.packageId, toolKey } } }),
    db.aiManualGrant.findUnique({ where: { studentId_toolId: { studentId, toolId: tool.id } } }),
  ]);

  if (!packageAccess && !manualGrant) {
    return { allowed: false, reason: "Your current package does not include this AI tool, and no manual access has been granted." };
  }
  return { allowed: true };
}

export async function listAccessibleToolKeys(studentId: string): Promise<Set<string>> {
  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) return new Set();
  const [packageGrants, manualGrants] = await Promise.all([
    db.aiPackageAccess.findMany({ where: { packageId: student.packageId } }),
    db.aiManualGrant.findMany({ where: { studentId }, include: { tool: true } }),
  ]);
  const keys = new Set(packageGrants.map((g) => g.toolKey));
  for (const grant of manualGrants) keys.add(grant.tool.toolKey);
  return keys;
}

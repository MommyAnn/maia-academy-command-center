// "Ask M.A.I.A." (spec sections 64-68) — a FIXED set of predefined,
// permission-scoped retrieval functions, never free-form SQL and never a
// database dump into a prompt (spec section 65/57). Every answer's numbers
// come from the deterministic retrieval below; an optional AI pass may only
// reword the already-computed facts into a sentence, never invent new ones.
// If the AI provider is unavailable, the raw facts are returned directly —
// rule-based/factual retrieval never depends on AI being up (spec section 83).

import { db } from "../../db.js";
import type { PermissionModule } from "../../rbac/modules.js";
import { resolveModelConfig } from "../../ai/registry.js";
import { getProvider } from "../../ai/registry.js";
import { buildDailyBrief, buildTodaysPriorities } from "./brief.js";

export interface AskContext {
  hasPermission: (module: PermissionModule) => Promise<boolean>;
}

interface QuestionHandler {
  match: RegExp;
  requiredPermission?: PermissionModule;
  retrieve: () => Promise<{ facts: Record<string, unknown>; factualAnswer: string }>;
}

const HANDLERS: QuestionHandler[] = [
  {
    match: /attention today|today.?s priorities|what needs my attention/i,
    async retrieve() {
      const priorities = await buildTodaysPriorities();
      const top = priorities.slice(0, 5).map((p) => `[${p.severity}] ${p.title}`);
      return {
        facts: { totalOpen: priorities.length, top },
        factualAnswer: priorities.length === 0 ? "Nothing currently needs attention — no open signals." : `${priorities.length} open item(s). Top priorities: ${top.join("; ")}.`,
      };
    },
  },
  {
    match: /payments?.*pending verification|pending payments?/i,
    requiredPermission: "Finance - Payments",
    async retrieve() {
      const [count, sum] = await Promise.all([
        db.paymentTransaction.count({ where: { status: "PENDING_VERIFICATION" } }),
        db.paymentTransaction.aggregate({ where: { status: "PENDING_VERIFICATION" }, _sum: { amount: true } }),
      ]);
      const total = Number(sum._sum.amount ?? 0);
      return { facts: { count, total }, factualAnswer: `${count} payment(s) pending verification, totaling ${total}.` };
    },
  },
  {
    match: /webinar leads?.*follow.?up|leads?.*need.*follow.?up/i,
    requiredPermission: "Free Webinar",
    async retrieve() {
      const signals = await db.intelligenceSignal.findMany({
        where: { domain: "Lead", status: { in: ["NEW", "REVIEWED", "ACTIONED"] } },
        take: 20,
      });
      return {
        facts: { count: signals.length, leads: signals.map((s) => s.evidenceJson) },
        factualAnswer: signals.length === 0 ? "No leads currently need follow-up per the configured rule." : `${signals.length} lead(s) need follow-up.`,
      };
    },
  },
  {
    match: /students?.*incomplete requirements?|requirements?.*incomplete/i,
    requiredPermission: "Students",
    async retrieve() {
      const requirements = await db.requirement.findMany({
        where: { status: { in: ["PENDING", "REJECTED"] } },
        include: { student: { include: { person: true } } },
      });
      const byStudent = new Map<string, string>();
      for (const r of requirements) byStudent.set(r.studentId, r.student.person.fullName);
      return {
        facts: { studentCount: byStudent.size, requirementRowCount: requirements.length },
        factualAnswer: byStudent.size === 0 ? "No students currently have incomplete requirements." : `${byStudent.size} student(s) have at least one incomplete requirement.`,
      };
    },
  },
  {
    match: /courses?.*most completions?|which courses?.*completion/i,
    requiredPermission: "Courses",
    async retrieve() {
      const events = await db.domainEvent.findMany({ where: { type: "COURSE_COMPLETED" } });
      const counts = new Map<string, number>();
      for (const e of events) {
        const courseId = (e.payloadJson as { courseId?: string } | null)?.courseId;
        if (courseId) counts.set(courseId, (counts.get(courseId) ?? 0) + 1);
      }
      const courseIds = [...counts.keys()];
      const courses = courseIds.length > 0 ? await db.course.findMany({ where: { id: { in: courseIds } } }) : [];
      const ranked = courses
        .map((c) => ({ title: c.title, completions: counts.get(c.id) ?? 0 }))
        .sort((a, b) => b.completions - a.completions)
        .slice(0, 5);
      return {
        facts: { ranked },
        factualAnswer: ranked.length === 0 ? "No course completions recorded yet." : ranked.map((r) => `${r.title}: ${r.completions}`).join("; "),
      };
    },
  },
  {
    match: /what changed this week|this week/i,
    async retrieve() {
      const brief = await buildDailyBrief(7);
      return { facts: brief.facts, factualAnswer: `This week: ${brief.facts.newLeads} new leads, ${brief.facts.webinarRegistrations} webinar registrations, ${brief.facts.newEnrollments} new enrollments, ${brief.calculatedMetrics.verifiedCollections} verified collections.` };
    },
  },
  // Phase 11 — M.A.I.A. Creative Studio (spec sections 93-94's named
  // example questions). Every answer below counts real Campaign/
  // CreativePackage rows — never an AI guess at campaign performance.
  {
    match: /campaigns?.*(no|without).*(approved )?creative|which campaigns?.*need creative/i,
    requiredPermission: "Creative Studio",
    async retrieve() {
      const signals = await db.intelligenceSignal.findMany({
        where: { domain: "Marketing", rule: { ruleKey: "marketing-campaign-no-approved-creative" }, status: { in: ["NEW", "REVIEWED", "ACTIONED"] } },
        take: 20,
      });
      return {
        facts: { count: signals.length, campaigns: signals.map((s) => s.evidenceJson) },
        factualAnswer: signals.length === 0 ? "Every active campaign past the Creative Development stage has at least one approved Creative Package." : `${signals.length} campaign(s) have no approved creative yet.`,
      };
    },
  },
  {
    match: /creative packages?.*(awaiting|pending|need).*review|pending creative review/i,
    requiredPermission: "Creative Studio",
    async retrieve() {
      const packages = await db.creativePackage.findMany({ where: { status: "FOR_REVIEW" }, include: { campaign: true } });
      return {
        facts: { count: packages.length, packages: packages.map((p) => ({ packageDisplayId: p.packageDisplayId, campaignName: p.campaign.name, updatedAt: p.updatedAt })) },
        factualAnswer: packages.length === 0 ? "No creative packages are currently awaiting review." : `${packages.length} creative package(s) are awaiting review.`,
      };
    },
  },
  {
    match: /how many (campaigns? are )?active campaigns?|active campaigns?/i,
    requiredPermission: "Creative Studio",
    async retrieve() {
      const count = await db.campaign.count({ where: { status: "ACTIVE" } });
      return {
        facts: { count },
        factualAnswer: `${count} campaign(s) are currently at ACTIVE status. This reflects Academy-side creative production status only — it is never a claim that a real ad platform campaign is live.`,
      };
    },
  },
];

export type AskResult =
  | { ok: true; answer: string; facts: Record<string, unknown>; source: "RULE-BASED"; aiPhrased: boolean }
  | { ok: false; reason: "NO_MATCHING_HANDLER" | "PERMISSION_DENIED" };

export async function askMaia(question: string, ctx: AskContext): Promise<AskResult> {
  const handler = HANDLERS.find((h) => h.match.test(question));
  if (!handler) return { ok: false, reason: "NO_MATCHING_HANDLER" };
  if (handler.requiredPermission && !(await ctx.hasPermission(handler.requiredPermission))) {
    return { ok: false, reason: "PERMISSION_DENIED" };
  }

  const { facts, factualAnswer } = await handler.retrieve();

  // Optional AI phrasing pass — the AI is given ONLY the already-computed
  // facts and told to reword them, never asked to compute or add anything
  // (spec section 57/67: grounded in real retrieved records, never a guess).
  const resolved = await resolveModelConfig("default");
  if (!resolved.ok) return { ok: true, answer: factualAnswer, facts, source: "RULE-BASED", aiPhrased: false };

  const provider = getProvider(resolved.config.provider);
  const result = await provider.generate({
    model: resolved.config.model,
    systemInstruction:
      "You reword an already-computed factual answer into one short, clear sentence for a business owner. " +
      "You must not add, infer, or change any number or fact. If you cannot reword it faithfully, repeat it verbatim.",
    userMessage: `Question: ${question}\nComputed factual answer: ${factualAnswer}\nFacts: ${JSON.stringify(facts)}`,
    maxOutputTokens: 200,
  });

  if (!result.ok) return { ok: true, answer: factualAnswer, facts, source: "RULE-BASED", aiPhrased: false };
  return { ok: true, answer: result.data.text.trim() || factualAnswer, facts, source: "RULE-BASED", aiPhrased: true };
}

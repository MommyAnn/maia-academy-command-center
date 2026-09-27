import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db.js";
import { validateSession, SESSION_COOKIE_NAME } from "../auth/session.js";
import type { PermissionAction, PermissionModule } from "./modules.js";

export interface AuthContext {
  kind: "staff" | "student";
  userId: string;
  personId: string;
  fullName: string;
  roleName?: string; // staff only
  studentId?: string; // student only
}

declare module "fastify" {
  interface FastifyRequest {
    authContext?: AuthContext;
  }
}

/**
 * Resolves the session cookie into a real AuthContext, or rejects the
 * request. This runs for EVERY protected route — permission and ownership
 * checks below all build on top of this, never on a frontend-supplied
 * role/id (spec section 11: "Do NOT rely only on... frontend route guards").
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[SESSION_COOKIE_NAME];
  if (!token) {
    reply.code(401).send({ error: "Authentication required." });
    return reply;
  }
  const session = await validateSession(token);
  if (!session) {
    reply.code(401).send({ error: "Session expired or revoked." });
    return reply;
  }

  const student = await db.student.findUnique({ where: { personId: session.user.personId } });

  request.authContext = {
    kind: student ? "student" : "staff",
    userId: session.userId,
    personId: session.user.personId,
    fullName: session.user.person.fullName,
    roleName: session.user.role.name,
    studentId: student?.id,
  };
}

/**
 * Server-side permission enforcement (spec section 11) — looks up the
 * caller's role's RolePermission row for this exact module+action. A
 * Student session is never staff-permissioned at all (the entire staff
 * matrix does not apply to Students, matching the frontend's own rule);
 * student-facing endpoints must use requireStudentSelf below instead.
 */
/**
 * Reusable permission check for code paths that need a yes/no answer
 * outside of a route preHandler (e.g. Ask M.A.I.A.'s per-question, dynamic
 * permission scoping) — same lookup requirePermission's preHandler uses.
 */
export async function checkPermission(userId: string, module: PermissionModule, action: PermissionAction): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { roleId: true } });
  if (!user) return false;
  const grant = await db.rolePermission.findUnique({ where: { roleId_module_action: { roleId: user.roleId, module, action } } });
  return grant?.allowed ?? false;
}

export function requirePermission(module: PermissionModule, action: PermissionAction) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.authContext;
    if (!ctx || ctx.kind !== "staff") {
      reply.code(403).send({ error: "Forbidden." });
      return reply;
    }
    const allowed = await checkPermission(ctx.userId, module, action);
    if (!allowed) {
      reply.code(403).send({ error: `Forbidden: requires ${module} / ${action}.` });
      return reply;
    }
  };
}

/**
 * CRITICAL student data isolation (spec section 14): a Student session may
 * only touch records that belong to their own Student row. This is the
 * server-side check that makes the frontend's existing StudentPortalContext
 * pattern actually safe — previously that isolation lived only in the
 * browser.
 */
export function requireStudentSelf(paramName = "studentId") {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.authContext;
    if (!ctx) {
      reply.code(401).send({ error: "Authentication required." });
      return reply;
    }
    const targetStudentId = (request.params as Record<string, string>)[paramName];
    if (ctx.kind === "staff") return; // staff access is governed by requirePermission instead
    if (ctx.kind === "student" && ctx.studentId === targetStudentId) return;
    reply.code(403).send({ error: "Forbidden: you may only access your own records." });
    return reply;
  };
}

/**
 * Business isolation (spec section 15): a Business row must belong to the
 * requesting student. Used by every Master Brain / AI Project / AI
 * Generation endpoint scoped by businessId.
 */
export async function assertBusinessOwnedByStudent(businessId: string, studentId: string): Promise<boolean> {
  const business = await db.business.findUnique({ where: { id: businessId }, select: { studentId: true } });
  return business?.studentId === studentId;
}

export type BusinessAccessLevel = "VIEW" | "EDIT";

// OWNER/MANAGER may edit; MARKETING/SALES/SUPPORT/OPERATIONS/CUSTOM are
// VIEW-only by default (spec section 67-68) — a real, minimal per-Business
// team RBAC layer, distinct from the global Staff RolePermission matrix.
const BUSINESS_ROLE_EDIT_ALLOWED = new Set(["OWNER", "MANAGER"]);

/**
 * M.A.I.A. Business OS access (spec sections 67-69): the owning Student
 * always has full access; an invited team member (BusinessRoleGrant) gets
 * VIEW always, and EDIT only when their per-Business role is OWNER/MANAGER;
 * staff holding the "Business OS" platform permission get oversight access.
 * Never leaks Academy/Student data beyond what Business OS itself needs
 * (spec section 69).
 */
export async function assertBusinessAccess(businessId: string, ctx: AuthContext, level: BusinessAccessLevel): Promise<boolean> {
  if (ctx.kind === "student" && ctx.studentId && (await assertBusinessOwnedByStudent(businessId, ctx.studentId))) {
    return true;
  }
  const grant = await db.businessRoleGrant.findUnique({ where: { businessId_userId: { businessId, userId: ctx.userId } } });
  if (grant) {
    if (level === "VIEW") return true;
    if (level === "EDIT" && BUSINESS_ROLE_EDIT_ALLOWED.has(grant.role)) return true;
  }
  if (ctx.kind === "staff") {
    return checkPermission(ctx.userId, "Business OS", level === "VIEW" ? "VIEW" : "EDIT");
  }
  return false;
}

/**
 * Allows either the owning student, or staff holding the given permission —
 * the common shape for every read endpoint scoped by :studentId across
 * finance, requirements, activity, and (Phase 3) training/courses/
 * certificates/feedback. Previously duplicated verbatim in several route
 * files; centralized here so it can't drift.
 */
export function requireStudentSelfOrPermission(module: PermissionModule, action: PermissionAction) {
  const selfCheck = requireStudentSelf("studentId");
  const permCheck = requirePermission(module, action);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.authContext?.kind === "student") return selfCheck(request, reply);
    return permCheck(request, reply);
  };
}

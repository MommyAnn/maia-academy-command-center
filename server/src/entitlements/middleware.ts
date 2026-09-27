// Backend feature gates (spec sections 13, 101-104) — protects the
// endpoint itself, not just the navigation link. Staff sessions bypass
// entitlement checks entirely: entitlements are a Student-commercial
// concept governed by Product/Purchase/Subscription, while staff access is
// already governed by the platform RBAC permission matrix (spec section
// 84 keeps ROLE/PERMISSION and ENTITLEMENT as two separate, composable
// checks — this file is the ENTITLEMENT half).

import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveEntitlement } from "./resolver.js";

export function requireFeatureEntitlement(featureKey: string, getBusinessId?: (request: FastifyRequest) => string | undefined) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.authContext;
    if (!ctx) {
      reply.code(401).send({ error: "Authentication required." });
      return reply;
    }
    if (ctx.kind === "staff") return; // governed by RBAC permission instead
    if (!ctx.studentId) {
      reply.code(403).send({ error: "Forbidden." });
      return reply;
    }
    const businessId = getBusinessId?.(request);
    const result = await resolveEntitlement({ studentId: ctx.studentId, businessId, featureKey });
    if (result.decision !== "ALLOWED") {
      // 402 Payment Required — deliberately distinct from RBAC's 403, so
      // the frontend can distinguish "you don't have permission" from
      // "you don't have commercial access to this" (spec section 39).
      reply.code(402).send({ error: result.reason, decision: result.decision, featureKey });
      return reply;
    }
  };
}

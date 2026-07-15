import type { NextRequest } from "next/server";
import {
  requireClaimedParticipant,
  requireSender,
  type PlanAccessRecord,
  type PlanViewer,
} from "./plan-access";
import { verifyPlanCapability } from "./plan-capability";

const CAPABILITY_COOKIE_PREFIX = "plan_capability_";

type IdentityPlanRecord = Pick<
  PlanAccessRecord,
  "id" | "senderId" | "recipientId" | "inviteId"
>;

export function planCapabilityCookieName(planId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(planId)) {
    throw new Error("Plan id cannot be used in a capability cookie name");
  }
  return `${CAPABILITY_COOKIE_PREFIX}${planId}`;
}

export function planViewerFromRequest(
  request: NextRequest,
  userId: string | null,
  planId: string,
): PlanViewer {
  const token = request.cookies.get(planCapabilityCookieName(planId))?.value;
  const secret = process.env.PLAN_CAPABILITY_SECRET;
  if (!token || !secret) return { userId };

  try {
    const verification = verifyPlanCapability(token, secret);
    return {
      userId,
      capability: verification.valid ? verification.claims : null,
    };
  } catch {
    return { userId };
  }
}

function identityAccessRecord(plan: IdentityPlanRecord): PlanAccessRecord {
  return {
    ...plan,
    capabilityVersion: 1,
  };
}

export function requireRouteSender(plan: IdentityPlanRecord, userId: string) {
  return requireSender(identityAccessRecord(plan), { userId });
}

export function requireRouteClaimedParticipant(plan: IdentityPlanRecord, userId: string) {
  return requireClaimedParticipant(identityAccessRecord(plan), { userId });
}

import type { VerifiedPlanCapability } from "./plan-capability";

export type PlanAccessRecord = {
  id: string;
  senderId: string;
  recipientId: string | null;
  inviteId: string | null;
  capabilityVersion: number;
  anonymousAccessRevoked?: boolean;
};

export type PlanViewer = {
  userId?: string | null;
  capability?: VerifiedPlanCapability | null;
};

export type PlanAccessRole = "sender" | "recipient" | "anonymous";
export type PlanAccessDenial =
  | "missing-identity"
  | "stranger"
  | "capability-revoked"
  | "capability-plan-mismatch"
  | "capability-invite-mismatch"
  | "capability-version-mismatch";

export type PlanAccessGrant =
  | { allowed: true; role: "sender"; userId: string }
  | { allowed: true; role: "recipient"; userId: string }
  | { allowed: true; role: "anonymous"; userId: null };

export type PlanAccessDecision =
  | PlanAccessGrant
  | { allowed: false; reason: PlanAccessDenial };

export class PlanAccessError extends Error {
  constructor(readonly code: PlanAccessDenial | "sender-required" | "claimed-participant-required") {
    super("Plan access denied");
    this.name = "PlanAccessError";
  }
}

export function authorizePlanViewer(
  plan: PlanAccessRecord,
  viewer: PlanViewer,
): PlanAccessDecision {
  if (viewer.userId === plan.senderId) {
    return { allowed: true, role: "sender", userId: viewer.userId };
  }

  if (plan.recipientId !== null && viewer.userId === plan.recipientId) {
    return { allowed: true, role: "recipient", userId: viewer.userId };
  }

  const capability = viewer.capability;
  if (!capability) {
    return { allowed: false, reason: viewer.userId ? "stranger" : "missing-identity" };
  }
  if (plan.anonymousAccessRevoked) {
    return { allowed: false, reason: "capability-revoked" };
  }
  if (capability.planId !== plan.id) {
    return { allowed: false, reason: "capability-plan-mismatch" };
  }
  if (plan.inviteId === null || capability.inviteId !== plan.inviteId) {
    return { allowed: false, reason: "capability-invite-mismatch" };
  }
  if (capability.capabilityVersion !== plan.capabilityVersion) {
    return { allowed: false, reason: "capability-version-mismatch" };
  }

  return { allowed: true, role: "anonymous", userId: null };
}

export function requireParticipant(
  plan: PlanAccessRecord,
  viewer: PlanViewer,
): Exclude<PlanAccessDecision, { allowed: false }> {
  const decision = authorizePlanViewer(plan, viewer);
  if (!decision.allowed) throw new PlanAccessError(decision.reason);
  return decision;
}

export function requireClaimedParticipant(
  plan: PlanAccessRecord,
  viewer: PlanViewer,
): Exclude<PlanAccessDecision, { allowed: false } | { role: "anonymous" }> {
  const decision = authorizePlanViewer(plan, viewer);
  if (!decision.allowed) throw new PlanAccessError(decision.reason);
  if (decision.role === "anonymous") {
    throw new PlanAccessError("claimed-participant-required");
  }
  return decision;
}

export function requireSender(
  plan: PlanAccessRecord,
  viewer: PlanViewer,
): Extract<PlanAccessDecision, { allowed: true; role: "sender" }> {
  const decision = authorizePlanViewer(plan, viewer);
  if (!decision.allowed) throw new PlanAccessError(decision.reason);
  if (decision.role !== "sender") throw new PlanAccessError("sender-required");
  return decision;
}

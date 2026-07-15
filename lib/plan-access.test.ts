import { describe, expect, it } from "vitest";
import { mintPlanCapability, verifyPlanCapability } from "./plan-capability";
import {
  authorizePlanViewer,
  PlanAccessError,
  requireClaimedParticipant,
  requireParticipant,
  requireSender,
  type PlanAccessRecord,
} from "./plan-access";

const secret = "test-secret-with-at-least-thirty-two-bytes";
const now = Date.UTC(2026, 6, 14, 12);
const plan: PlanAccessRecord = {
  id: "plan-1",
  senderId: "sender-1",
  recipientId: "recipient-1",
  inviteId: "invite-1",
  capabilityVersion: 2,
};

function capability(overrides: { planId?: string; inviteId?: string; version?: number } = {}) {
  const token = mintPlanCapability(
    {
      planId: overrides.planId ?? plan.id,
      inviteId: overrides.inviteId ?? plan.inviteId!,
      capabilityVersion: overrides.version ?? plan.capabilityVersion,
      issuedAt: now,
      expiresAt: now + 60_000,
    },
    secret,
  );
  const result = verifyPlanCapability(token, secret, now);
  if (!result.valid) throw new Error("Test capability did not verify");
  return result.claims;
}

describe("authorizePlanViewer", () => {
  it("recognizes the sender and claimed recipient", () => {
    expect(authorizePlanViewer(plan, { userId: "sender-1" })).toEqual({
      allowed: true,
      role: "sender",
      userId: "sender-1",
    });
    expect(authorizePlanViewer(plan, { userId: "recipient-1" })).toEqual({
      allowed: true,
      role: "recipient",
      userId: "recipient-1",
    });
  });

  it("never treats a null recipient as participant access", () => {
    const unclaimed = { ...plan, recipientId: null };

    expect(authorizePlanViewer(unclaimed, {})).toEqual({
      allowed: false,
      reason: "missing-identity",
    });
    expect(authorizePlanViewer(unclaimed, { userId: "stranger-1" })).toEqual({
      allowed: false,
      reason: "stranger",
    });
  });

  it("allows a verified capability as anonymous access", () => {
    expect(authorizePlanViewer({ ...plan, recipientId: null }, { capability: capability() })).toEqual({
      allowed: true,
      role: "anonymous",
      userId: null,
    });
  });

  it("rejects revoked and mismatched capabilities", () => {
    expect(
      authorizePlanViewer(
        { ...plan, recipientId: null, anonymousAccessRevoked: true },
        { capability: capability() },
      ),
    ).toEqual({ allowed: false, reason: "capability-revoked" });
    expect(authorizePlanViewer(plan, { capability: capability({ planId: "plan-2" }) })).toEqual({
      allowed: false,
      reason: "capability-plan-mismatch",
    });
    expect(authorizePlanViewer(plan, { capability: capability({ inviteId: "invite-2" }) })).toEqual({
      allowed: false,
      reason: "capability-invite-mismatch",
    });
    expect(authorizePlanViewer(plan, { capability: capability({ version: 1 }) })).toEqual({
      allowed: false,
      reason: "capability-version-mismatch",
    });
  });
});

describe("plan access requirements", () => {
  it("allows anonymous capabilities only for participant-level access", () => {
    const viewer = { capability: capability() };
    expect(requireParticipant(plan, viewer).role).toBe("anonymous");
    expect(() => requireClaimedParticipant(plan, viewer)).toThrowError(
      expect.objectContaining<Partial<PlanAccessError>>({ code: "claimed-participant-required" }),
    );
  });

  it("requires the sender for sender-only access", () => {
    expect(requireSender(plan, { userId: "sender-1" }).role).toBe("sender");
    expect(() => requireSender(plan, { userId: "recipient-1" })).toThrowError(
      expect.objectContaining<Partial<PlanAccessError>>({ code: "sender-required" }),
    );
  });

  it("allows both identity-bound participants for claimed access", () => {
    expect(requireClaimedParticipant(plan, { userId: "sender-1" }).role).toBe("sender");
    expect(requireClaimedParticipant(plan, { userId: "recipient-1" }).role).toBe("recipient");
  });
});

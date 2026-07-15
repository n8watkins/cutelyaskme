import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { mintPlanCapability } from "./plan-capability";
import {
  planCapabilityCookieName,
  planViewerFromRequest,
  requireRouteClaimedParticipant,
  requireRouteSender,
} from "./plan-route-access";

const secret = "test-secret-with-at-least-thirty-two-bytes";
const plan = {
  id: "plan-1",
  senderId: "sender-1",
  recipientId: "recipient-1",
  inviteId: "invite-1",
};

afterEach(() => {
  delete process.env.PLAN_CAPABILITY_SECRET;
});

describe("plan route access", () => {
  it("reads a valid plan-scoped capability from its HttpOnly cookie slot", () => {
    process.env.PLAN_CAPABILITY_SECRET = secret;
    const token = mintPlanCapability(
      {
        planId: plan.id,
        inviteId: plan.inviteId,
        capabilityVersion: 1,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
      secret,
    );
    const request = new NextRequest("https://example.test/api/plans/plan-1", {
      headers: { cookie: `${planCapabilityCookieName(plan.id)}=${token}` },
    });

    expect(planViewerFromRequest(request, null, plan.id).capability).toMatchObject({
      planId: plan.id,
      inviteId: plan.inviteId,
      capabilityVersion: 1,
    });
  });

  it("ignores malformed capabilities and keeps an authenticated identity", () => {
    process.env.PLAN_CAPABILITY_SECRET = secret;
    const request = new NextRequest("https://example.test/api/plans/plan-1", {
      headers: { cookie: `${planCapabilityCookieName(plan.id)}=invalid` },
    });

    expect(planViewerFromRequest(request, "sender-1", plan.id)).toEqual({
      userId: "sender-1",
      capability: null,
    });
  });

  it("enforces sender-only and claimed-participant route roles", () => {
    expect(requireRouteSender(plan, "sender-1").role).toBe("sender");
    expect(() => requireRouteSender(plan, "recipient-1")).toThrow();
    expect(requireRouteClaimedParticipant(plan, "recipient-1").role).toBe("recipient");
    expect(() => requireRouteClaimedParticipant({ ...plan, recipientId: null }, "stranger-1"))
      .toThrow();
  });
});

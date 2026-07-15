import { describe, expect, it } from "vitest";
import { mintPlanCapability, verifyPlanCapability } from "./plan-capability";

const secret = "test-secret-with-at-least-thirty-two-bytes";
const issuedAt = Date.UTC(2026, 6, 14, 12);
const expiresAt = issuedAt + 60_000;

describe("plan capabilities", () => {
  it("round-trips signed, scoped, versioned claims", () => {
    const token = mintPlanCapability(
      { planId: "plan-1", inviteId: "invite-1", capabilityVersion: 3, issuedAt, expiresAt },
      secret,
    );
    const result = verifyPlanCapability(token, secret, issuedAt + 30_000);

    expect(token.startsWith("pc1.")).toBe(true);
    expect(result).toMatchObject({
      valid: true,
      claims: {
        kind: "plan-invite",
        planId: "plan-1",
        inviteId: "invite-1",
        capabilityVersion: 3,
        issuedAt: issuedAt / 1000,
        expiresAt: expiresAt / 1000,
      },
    });
  });

  it("rejects payload and signature tampering", () => {
    const token = mintPlanCapability(
      { planId: "plan-1", inviteId: "invite-1", capabilityVersion: 1, issuedAt, expiresAt },
      secret,
    );
    const [prefix, payload, signature] = token.split(".");
    const changedPayload = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;
    const changedSignature = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;

    expect(verifyPlanCapability(`${prefix}.${changedPayload}.${signature}`, secret, issuedAt)).toEqual({
      valid: false,
      error: "invalid-signature",
    });
    expect(verifyPlanCapability(`${prefix}.${payload}.${changedSignature}`, secret, issuedAt)).toEqual({
      valid: false,
      error: "invalid-signature",
    });
  });

  it("rejects expired tokens at the expiration boundary", () => {
    const token = mintPlanCapability(
      { planId: "plan-1", inviteId: "invite-1", capabilityVersion: 1, issuedAt, expiresAt },
      secret,
    );

    expect(verifyPlanCapability(token, secret, expiresAt)).toEqual({ valid: false, error: "expired" });
  });

  it("rejects malformed tokens", () => {
    expect(verifyPlanCapability("not-a-capability", secret, issuedAt)).toEqual({
      valid: false,
      error: "malformed",
    });
  });

  it("requires a strong signing secret", () => {
    expect(() =>
      mintPlanCapability(
        { planId: "plan-1", inviteId: "invite-1", capabilityVersion: 1, issuedAt, expiresAt },
        "too-short",
      ),
    ).toThrow("at least 32 bytes");
  });
});

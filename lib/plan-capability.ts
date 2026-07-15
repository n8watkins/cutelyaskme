import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "pc1";
const CAPABILITY_KIND = "plan-invite";
const MIN_SECRET_BYTES = 32;
const verifiedCapability = Symbol("verified-plan-capability");

export type PlanCapabilityClaims = {
  kind: typeof CAPABILITY_KIND;
  planId: string;
  inviteId: string;
  capabilityVersion: number;
  issuedAt: number;
  expiresAt: number;
};

export type VerifiedPlanCapability = Readonly<PlanCapabilityClaims> & {
  readonly [verifiedCapability]: true;
};

export type MintPlanCapabilityInput = {
  planId: string;
  inviteId: string;
  capabilityVersion: number;
  expiresAt: Date | number;
  issuedAt?: Date | number;
};

export type CapabilityVerificationError =
  | "malformed"
  | "invalid-signature"
  | "invalid-claims"
  | "expired";

export type CapabilityVerificationResult =
  | { valid: true; claims: VerifiedPlanCapability }
  | { valid: false; error: CapabilityVerificationError };

function secretBytes(secret: string | Uint8Array): Uint8Array {
  const bytes = typeof secret === "string" ? Buffer.from(secret, "utf8") : secret;
  if (bytes.byteLength < MIN_SECRET_BYTES) {
    throw new Error(`Plan capability secret must be at least ${MIN_SECRET_BYTES} bytes`);
  }
  return bytes;
}

function unixSeconds(value: Date | number): number {
  const milliseconds = value instanceof Date ? value.getTime() : value;
  return Math.floor(milliseconds / 1000);
}

function signature(encodedPayload: string, secret: string | Uint8Array): Buffer {
  return createHmac("sha256", secretBytes(secret))
    .update(`${TOKEN_PREFIX}.${encodedPayload}`)
    .digest();
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function parseClaims(value: unknown): PlanCapabilityClaims | null {
  if (!value || typeof value !== "object") return null;
  const claims = value as Partial<PlanCapabilityClaims>;
  if (
    claims.kind !== CAPABILITY_KIND ||
    !isNonEmptyId(claims.planId) ||
    !isNonEmptyId(claims.inviteId) ||
    !Number.isSafeInteger(claims.capabilityVersion) ||
    (claims.capabilityVersion ?? 0) < 1 ||
    !Number.isSafeInteger(claims.issuedAt) ||
    !Number.isSafeInteger(claims.expiresAt) ||
    (claims.issuedAt ?? -1) < 0 ||
    (claims.expiresAt ?? -1) <= (claims.issuedAt ?? 0)
  ) {
    return null;
  }

  return claims as PlanCapabilityClaims;
}

function decodeSignature(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

export function mintPlanCapability(
  input: MintPlanCapabilityInput,
  secret: string | Uint8Array,
): string {
  const claims: PlanCapabilityClaims = {
    kind: CAPABILITY_KIND,
    planId: input.planId,
    inviteId: input.inviteId,
    capabilityVersion: input.capabilityVersion,
    issuedAt: unixSeconds(input.issuedAt ?? Date.now()),
    expiresAt: unixSeconds(input.expiresAt),
  };

  if (!parseClaims(claims)) {
    throw new Error("Invalid plan capability claims");
  }

  const encodedPayload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const encodedSignature = signature(encodedPayload, secret).toString("base64url");
  return `${TOKEN_PREFIX}.${encodedPayload}.${encodedSignature}`;
}

export function verifyPlanCapability(
  token: string,
  secret: string | Uint8Array,
  now: Date | number = Date.now(),
): CapabilityVerificationResult {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX || !parts[1] || !parts[2]) {
    return { valid: false, error: "malformed" };
  }

  const suppliedSignature = decodeSignature(parts[2]);
  if (!suppliedSignature) return { valid: false, error: "malformed" };

  const expectedSignature = signature(parts[1], secret);
  if (!timingSafeEqual(suppliedSignature, expectedSignature)) {
    return { valid: false, error: "invalid-signature" };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { valid: false, error: "invalid-claims" };
  }

  const claims = parseClaims(decoded);
  if (!claims) return { valid: false, error: "invalid-claims" };
  if (claims.expiresAt <= unixSeconds(now)) return { valid: false, error: "expired" };

  return {
    valid: true,
    claims: Object.freeze({ ...claims, [verifiedCapability]: true as const }),
  };
}

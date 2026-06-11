// G1 Task B: pure helpers for keepsake share links (/plan/[id]/memory?share=…).
//
// A memory's `share_token` is minted by the author via PATCH /api/memories/share
// and lets anyone with the link view that exact memory, logged out. Token
// matching and URL building live here so they're unit-testable; the route and
// page stay thin. Tested in memory-share.test.ts.

export type ShareableMemoryRow = { shareToken: string | null };

/**
 * The memory row a `?share=<token>` query unlocks — exact match against a
 * non-null share_token only. Empty/missing tokens never match (a row with
 * sharing off has shareToken null, and `?share=` must not unlock it).
 */
export function findSharedMemory<T extends ShareableMemoryRow>(
  rows: T[],
  token: string | null | undefined,
): T | null {
  if (!token) return null;
  return rows.find((r) => r.shareToken !== null && r.shareToken === token) ?? null;
}

/** The public URL for a shared keepsake, e.g. `${origin}/plan/<id>/memory?share=<token>`. */
export function buildShareUrl(origin: string, planId: string, token: string): string {
  return `${origin}/plan/${planId}/memory?share=${encodeURIComponent(token)}`;
}

/** A fresh unguessable share token (two UUIDs' worth of randomness, hex only). */
export function mintShareToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replaceAll("-", "");
}

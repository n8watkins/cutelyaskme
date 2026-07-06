// The one place_cache read/write pattern, shared by every API route that
// caches third-party lookups (places, details, photos, geocode, routes,
// weather). Fail-soft by design: a cache outage must never break the request.

import { db } from "@/lib/db";
import { placeCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Unexpired cached value for a key, or undefined on miss/error. `null` is a
 * legitimate cached value (negative caching), so the miss sentinel is undefined. */
export async function cacheGet<T>(cacheKey: string): Promise<T | undefined> {
  try {
    const now = new Date().toISOString();
    const [row] = await db
      .select()
      .from(placeCache)
      .where(eq(placeCache.cacheKey, cacheKey))
      .limit(1);
    if (row && row.expiresAt > now) return JSON.parse(row.results) as T;
  } catch {}
  return undefined;
}

/** Upsert a value with a TTL. Fire-and-forget safe: never throws. */
export async function cacheSet(cacheKey: string, value: unknown, ttlMs: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const results = JSON.stringify(value);
  await db
    .insert(placeCache)
    .values({ id: crypto.randomUUID(), cacheKey, results, expiresAt })
    .onConflictDoUpdate({
      target: placeCache.cacheKey,
      set: { results, expiresAt },
    })
    .catch(() => null);
}

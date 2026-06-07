import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Persistent fixed-window rate limit. Returns true if the request is allowed.
// Survives serverless cold starts (unlike an in-memory Map). Personal-scale —
// the read-modify-write isn't strictly atomic, which is fine here.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();

  try {
    const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);

    if (!row || row.resetAt < now) {
      await db
        .insert(rateLimits)
        .values({ key, count: 1, resetAt: now + windowMs })
        .onConflictDoUpdate({ target: rateLimits.key, set: { count: 1, resetAt: now + windowMs } });
      return true;
    }

    if (row.count >= limit) return false;

    await db.update(rateLimits).set({ count: row.count + 1 }).where(eq(rateLimits.key, key));
    return true;
  } catch {
    // If the limiter errors, fail open rather than blocking real users.
    return true;
  }
}

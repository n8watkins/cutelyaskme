import { db } from "@/lib/db";
import { apiUsage } from "@/lib/db/schema";
import { inArray, sql, and, eq } from "drizzle-orm";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Count an outbound third-party API call (C7). Fire-and-forget: never throws,
 * never blocks the response path on failure.
 */
export async function trackApiUsage(service: string, calls = 1): Promise<void> {
  const day = todayUTC();
  try {
    await db
      .insert(apiUsage)
      .values({ key: `${service}:${day}`, service, day, count: calls })
      .onConflictDoUpdate({
        target: apiUsage.key,
        set: { count: sql`${apiUsage.count} + ${calls}` },
      });
  } catch {
    // tracking must never break the actual request
  }
}

/** Today's call counts for the given services, zero-filled. */
export async function getUsageToday(services: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = Object.fromEntries(services.map((s) => [s, 0]));
  try {
    const rows = await db
      .select()
      .from(apiUsage)
      .where(and(eq(apiUsage.day, todayUTC()), inArray(apiUsage.service, services)));
    for (const r of rows) result[r.service] = r.count;
  } catch {}
  return result;
}

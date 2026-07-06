import { db } from "@/lib/db";
import { apiUsage } from "@/lib/db/schema";
import { inArray, sql, and, gte, isNotNull } from "drizzle-orm";
import { usageKey, type TrackedService } from "@/lib/api-limits";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartUTC(): string {
  return `${todayUTC().slice(0, 7)}-01`;
}

/**
 * Count an outbound third-party API call (C7). Fire-and-forget: never throws,
 * never blocks the response path on failure. When a planId is given the call
 * is counted in that plan's own row, so per-service totals are SUM over rows.
 */
export async function trackApiUsage(
  service: TrackedService,
  calls = 1,
  planId?: string | null,
): Promise<void> {
  const day = todayUTC();
  const pid = planId || null;
  try {
    await db
      .insert(apiUsage)
      .values({ key: usageKey(service, day, pid), service, day, planId: pid, count: calls })
      .onConflictDoUpdate({
        target: apiUsage.key,
        set: { count: sql`${apiUsage.count} + ${calls}` },
      });
  } catch {
    // tracking must never break the actual request
  }
}

export type UsageCounts = { today: number; monthToDate: number };

/** Today's and month-to-date call counts per service, zero-filled. */
export async function getUsageSummary(services: string[]): Promise<Record<string, UsageCounts>> {
  const result: Record<string, UsageCounts> = Object.fromEntries(
    services.map((s) => [s, { today: 0, monthToDate: 0 }]),
  );
  const day = todayUTC();
  try {
    const rows = await db
      .select({
        service: apiUsage.service,
        today: sql<number>`coalesce(sum(case when ${apiUsage.day} = ${day} then ${apiUsage.count} else 0 end), 0)`,
        monthToDate: sql<number>`coalesce(sum(${apiUsage.count}), 0)`,
      })
      .from(apiUsage)
      .where(and(gte(apiUsage.day, monthStartUTC()), inArray(apiUsage.service, services)))
      .groupBy(apiUsage.service);
    for (const r of rows) result[r.service] = { today: r.today, monthToDate: r.monthToDate };
  } catch {}
  return result;
}

export type PlanUsageRow = { planId: string; service: string; count: number };

/** Month-to-date calls attributed to a date plan, one row per plan+service. */
export async function getUsageByPlan(): Promise<PlanUsageRow[]> {
  try {
    const rows = await db
      .select({
        planId: apiUsage.planId,
        service: apiUsage.service,
        count: sql<number>`coalesce(sum(${apiUsage.count}), 0)`,
      })
      .from(apiUsage)
      .where(and(gte(apiUsage.day, monthStartUTC()), isNotNull(apiUsage.planId)))
      .groupBy(apiUsage.planId, apiUsage.service);
    return rows.filter((r): r is PlanUsageRow => r.planId !== null);
  } catch {
    return [];
  }
}

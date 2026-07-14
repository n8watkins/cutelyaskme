import { getApiLimit, type TrackedService } from "@/lib/api-limits";
import { getDbClient } from "@/lib/db";
import { reserveServiceBudget } from "@/lib/service-budget";

const DAY_MS = 24 * 60 * 60 * 1000;

export function viewerDailyBudget(globalDailyBudget: number): number {
  return Math.min(globalDailyBudget, Math.max(10, Math.floor(globalDailyBudget / 10)));
}

/** Reserve paid third-party calls against both viewer and application caps. */
export async function reserveTrackedApiCall(
  service: TrackedService,
  subjectId: string,
  cost = 1,
): Promise<boolean> {
  const configured = getApiLimit(service);
  if (!configured || configured.dailyBudget === null) return true;

  const now = Date.now();
  const windowStart = Math.floor(now / DAY_MS) * DAY_MS;
  try {
    const result = await reserveServiceBudget(getDbClient(), {
      service,
      cost,
      windowStart,
      windowEnd: windowStart + DAY_MS,
      limits: [
        { subjectId: `viewer:${subjectId}`, limit: viewerDailyBudget(configured.dailyBudget) },
        { subjectId: "global", limit: configured.dailyBudget },
      ],
    });
    return result.allowed;
  } catch {
    return false;
  }
}

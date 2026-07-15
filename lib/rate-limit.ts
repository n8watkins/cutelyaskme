import { getDbClient } from "@/lib/db";
import { reserveServiceBudget } from "@/lib/service-budget";

// Persistent, atomic fixed-window rate limit. Returns true if the request is
// allowed and fails closed when the backing budget cannot be reserved.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;

  try {
    const reservation = await reserveServiceBudget(getDbClient(), {
      service: "request",
      windowStart,
      windowEnd: windowStart + windowMs,
      limits: [{ subjectId: key, limit }],
    });
    return reservation.allowed;
  } catch {
    return false;
  }
}

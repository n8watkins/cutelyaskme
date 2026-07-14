import { getDbClient } from "./db";
import { reserveServiceBudget } from "./service-budget";

const DAY_MS = 24 * 60 * 60 * 1000;
const VIEWER_LIMITS = {
  itinerary: 10,
  poem: 5,
  ideas: 20,
} as const;

export type GeminiFeature = keyof typeof VIEWER_LIMITS;

export async function reserveGeminiCall(
  feature: GeminiFeature,
  subjectId: string,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / DAY_MS) * DAY_MS;
  try {
    const result = await reserveServiceBudget(getDbClient(), {
      service: "gemini",
      windowStart,
      windowEnd: windowStart + DAY_MS,
      limits: [
        { subjectId: `${feature}:${subjectId}`, limit: VIEWER_LIMITS[feature] },
        { subjectId: "global", limit: 200 },
      ],
    });
    return result.allowed;
  } catch {
    return false;
  }
}

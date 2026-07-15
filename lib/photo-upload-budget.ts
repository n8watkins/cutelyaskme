import type { Client } from "@libsql/client";
import { getDbClient } from "./db";
import { MAX_MEMORY_PHOTOS } from "./photo-refs";
import { reserveServiceBudget } from "./service-budget";

export const MEMORY_PHOTO_SIGNATURE_LIMIT = MAX_MEMORY_PHOTOS;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reserve one single-asset upload authorization for a participant and plan.
 * The persistent daily ceiling matches the maximum number of stored photos.
 */
export async function reserveMemoryPhotoSignature(
  planId: string,
  userId: string,
  client: Client = getDbClient(),
  now = Date.now(),
): Promise<boolean> {
  const windowStart = Math.floor(now / DAY_MS) * DAY_MS;
  try {
    const result = await reserveServiceBudget(client, {
      service: "memory-photo-signature",
      windowStart,
      windowEnd: windowStart + DAY_MS,
      limits: [
        {
          subjectId: JSON.stringify([planId, userId]),
          limit: MEMORY_PHOTO_SIGNATURE_LIMIT,
        },
      ],
    });
    return result.allowed;
  } catch {
    return false;
  }
}

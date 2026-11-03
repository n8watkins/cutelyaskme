import { getCloudflareContext } from "@opennextjs/cloudflare";
import { send as sendToVercelQueue } from "@vercel/queue";
import {
  NOTIFICATION_QUEUE_MAX_DELAY_SECONDS,
  type NotificationWakeMessage,
  type NotificationWakeReason,
} from "@/lib/notification-wake";

export const NOTIFICATION_QUEUE_TOPIC = "notification-delivery";
export const NOTIFICATION_QUEUE_BATCH_SIZE = 20;
export const NOTIFICATION_QUEUE_INITIAL_DELAY_SECONDS = 10;

type ScheduleNotificationDeliveryOptions = {
  idempotencyKey: string;
  reason: NotificationWakeReason;
  delaySeconds?: number;
};

type NotificationQueueBinding = {
  send(message: NotificationWakeMessage, options?: { delaySeconds?: number }): Promise<unknown>;
};

function cloudflareNotificationQueue(): NotificationQueueBinding | undefined {
  try {
    // The binding is declared in wrangler.jsonc. Its generated type lives in
    // cloudflare-env.d.ts, which only the Worker's tsconfig includes.
    const env = getCloudflareContext().env as { NOTIFICATION_QUEUE?: NotificationQueueBinding };
    return env.NOTIFICATION_QUEUE;
  } catch {
    // Not running on Cloudflare (next dev, next start, Vercel).
    return undefined;
  }
}

/**
 * Wake the durable notification worker without making queue availability part
 * of the user-facing request. The database outbox and daily reconciliation job
 * retain the work if the queue is temporarily unavailable.
 *
 * On Cloudflare the wake-up goes to the NOTIFICATION_QUEUE binding, consumed by
 * worker/handlers.ts. Cloudflare Queues has no idempotency keys, so the key only labels
 * the message: a duplicate wake-up is harmless because jobs are claimed
 * atomically from the outbox. While the Vercel deployment still serves
 * production, it keeps using Vercel Queue.
 */
export async function scheduleNotificationDelivery({
  idempotencyKey,
  reason,
  delaySeconds = NOTIFICATION_QUEUE_INITIAL_DELAY_SECONDS,
}: ScheduleNotificationDeliveryOptions): Promise<boolean> {
  try {
    const queue = cloudflareNotificationQueue();
    if (queue) {
      await queue.send(
        { version: 1, reason, key: idempotencyKey },
        { delaySeconds: Math.min(Math.max(0, delaySeconds), NOTIFICATION_QUEUE_MAX_DELAY_SECONDS) },
      );
      return true;
    }

    if (process.env.NODE_ENV !== "test" && !process.env.VERCEL_DEPLOYMENT_ID) {
      return false;
    }
    await sendToVercelQueue(
      NOTIFICATION_QUEUE_TOPIC,
      { version: 1, reason },
      {
        delaySeconds,
        idempotencyKey,
        retentionSeconds: 24 * 60 * 60,
      },
    );
    return true;
  } catch (error) {
    console.error("Failed to schedule notification delivery", error);
    return false;
  }
}

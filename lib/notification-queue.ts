import { send } from "@vercel/queue";

export const NOTIFICATION_QUEUE_TOPIC = "notification-delivery";
export const NOTIFICATION_QUEUE_BATCH_SIZE = 20;
export const NOTIFICATION_QUEUE_INITIAL_DELAY_SECONDS = 10;

type NotificationWakeReason = "new" | "retry" | "continue";

type ScheduleNotificationDeliveryOptions = {
  idempotencyKey: string;
  reason: NotificationWakeReason;
  delaySeconds?: number;
};

/**
 * Wake the durable notification worker without making queue availability part
 * of the user-facing request. The database outbox and daily reconciliation job
 * retain the work if Vercel Queue is temporarily unavailable.
 */
export async function scheduleNotificationDelivery({
  idempotencyKey,
  reason,
  delaySeconds = NOTIFICATION_QUEUE_INITIAL_DELAY_SECONDS,
}: ScheduleNotificationDeliveryOptions): Promise<boolean> {
  if (process.env.NODE_ENV !== "test" && !process.env.VERCEL_DEPLOYMENT_ID) {
    return false;
  }

  try {
    await send(
      NOTIFICATION_QUEUE_TOPIC,
      { version: 1, reason },
      {
        delaySeconds,
        idempotencyKey,
        retentionSeconds: 7 * 24 * 60 * 60,
      },
    );
    return true;
  } catch (error) {
    console.error("Failed to schedule notification delivery", error);
    return false;
  }
}

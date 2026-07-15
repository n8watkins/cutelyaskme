import { handleCallback, type MessageMetadata } from "@vercel/queue";
import { deliverPendingNotificationJobs } from "@/lib/notification-delivery";
import {
  NOTIFICATION_QUEUE_BATCH_SIZE,
  scheduleNotificationDelivery,
} from "@/lib/notification-queue";

export async function processNotificationQueueMessage(
  metadata: Pick<MessageMetadata, "messageId" | "deliveryCount">,
): Promise<void> {
  const summary = await deliverPendingNotificationJobs(NOTIFICATION_QUEUE_BATCH_SIZE);
  const processed = summary.sent + summary.failed + summary.exhausted + summary.canceled;

  if (processed === NOTIFICATION_QUEUE_BATCH_SIZE) {
    await scheduleNotificationDelivery({
      idempotencyKey: `notification-continuation:${metadata.messageId}:${metadata.deliveryCount}`,
      reason: "continue",
      delaySeconds: 0,
    });
  }
}

export const POST = handleCallback(async (_message, metadata) => {
  await processNotificationQueueMessage(metadata);
});

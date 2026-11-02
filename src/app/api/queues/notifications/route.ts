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

// Built on the first request rather than at import: the default queue client
// reads VERCEL_REGION when it is created, which is only set at runtime (at
// build time it logs a "Region not detected" warning and guesses iad1).
let callbackHandler: ((request: Request) => Promise<Response>) | null = null;

export async function POST(request: Request): Promise<Response> {
  callbackHandler ??= handleCallback(async (_message, metadata) => {
    await processNotificationQueueMessage(metadata);
  });
  return callbackHandler(request);
}

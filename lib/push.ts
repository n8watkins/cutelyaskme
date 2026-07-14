import webpush from "web-push";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export type PushDeliveryResult = "sent" | "missing" | "dead" | "transient_failure";

// Send to exactly one outbox target. Dead subscriptions are pruned, while
// transient failures remain retryable without resending sibling devices.
export async function sendPushToSubscription(
  subscriptionId: string,
  userId: string,
  payload: PushPayload,
): Promise<PushDeliveryResult> {
  if (!configure()) return "transient_failure";

  const [subscription] = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.id, subscriptionId),
        eq(pushSubscriptions.userId, userId),
      ),
    )
    .limit(1);
  if (!subscription) return "missing";

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return "sent";
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 404 || code === 410) {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, subscription.id))
        .catch(() => {});
      return "dead";
    }
    return "transient_failure";
  }
}

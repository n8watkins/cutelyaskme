// Shared by the producer (lib/notification-queue.ts) and the Worker's queue
// consumer (worker/handlers.ts). No imports, so the Worker entry stays small.

// A failed drain is retried after this delay (wrangler.jsonc retry_delay, and
// retryAfterSeconds in vercel.json).
export const NOTIFICATION_QUEUE_RETRY_DELAY_SECONDS = 120;

// Cloudflare Queues accepts delays of up to 12 hours.
export const NOTIFICATION_QUEUE_MAX_DELAY_SECONDS = 12 * 60 * 60;

export type NotificationWakeReason = "new" | "retry" | "continue";

export type NotificationWakeMessage = {
  version: 1;
  reason: NotificationWakeReason;
  key: string;
};

// The Worker's handlers around the OpenNext build of the Next.js app. They add
// the two background entry points that Vercel used to provide:
//
// - queue: Cloudflare Queues delivers the notification wake-ups sent by
//   lib/notification-queue.ts. Each batch drains the notification outbox once.
// - scheduled: the daily Cron Trigger reconciles the outbox, as the Vercel cron
//   did.
//
// Both call the existing /api/notifications/process route in-process through
// the OpenNext fetch handler (no network hop), so the delivery code stays in
// the Next.js bundle and keeps its route-level tests. The route authorizes the
// call with CRON_SECRET.

import {
  NOTIFICATION_QUEUE_RETRY_DELAY_SECONDS,
  type NotificationWakeMessage,
} from "../lib/notification-wake";
import { errorSummary, logError, pathOf } from "../lib/log";

export type FetchHandler = {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response>;
};

// The process route drains at most this many jobs per call (5 batches of 20).
// A wake-up that fills it sends a continuation so a backlog keeps draining.
const PROCESS_ROUTE_CAPACITY = 100;

// Handled in-process, so the host never resolves. The host header must match
// it: without one, OpenNext treats the middleware's rewrite as external and
// fetches it over the network.
const INTERNAL_HOST = "worker.internal";
const INTERNAL_PROCESS_URL = `https://${INTERNAL_HOST}/api/notifications/process`;

type DrainSummary = {
  processed: number;
  sent: number;
  failed: number;
  exhausted: number;
  canceled: number;
};

async function drainOutbox(
  app: FetchHandler,
  env: CloudflareEnv,
  ctx: ExecutionContext,
  trigger: string,
): Promise<DrainSummary> {
  if (!env.CRON_SECRET) throw new Error("CRON_SECRET is not set");
  const request = new Request(INTERNAL_PROCESS_URL, {
    headers: {
      host: INTERNAL_HOST,
      authorization: `Bearer ${env.CRON_SECRET}`,
      "x-notification-trigger": trigger,
    },
  });
  const response = await app.fetch(request, env, ctx);
  if (!response.ok) {
    throw new Error(`notification drain failed with status ${response.status}`);
  }
  return (await response.json()) as DrainSummary;
}

export function createWorker(app: FetchHandler) {
  return {
    async fetch(request, env, ctx) {
      try {
        return await app.fetch(request, env, ctx);
      } catch (err) {
        // Next reports its own errors (src/instrumentation.ts); this is for a
        // throw that escapes OpenNext itself.
        logError({
          event: "unhandled_exception",
          reason: "worker_fetch_threw",
          route: pathOf(request.url),
          method: request.method,
          status: 500,
          error: errorSummary(err),
        });
        throw err;
      }
    },

    async queue(batch, env, ctx) {
      try {
        const summary = await drainOutbox(app, env, ctx, "queue");
        console.log(
          JSON.stringify({
            event: "notification_queue_drain",
            messages: batch.messages.length,
            ...summary,
          }),
        );
        if (summary.processed >= PROCESS_ROUTE_CAPACITY) {
          await env.NOTIFICATION_QUEUE.send({
            version: 1,
            reason: "continue",
            key: `notification-continuation:${batch.messages[0]?.id ?? "batch"}`,
          } satisfies NotificationWakeMessage);
        }
        batch.ackAll();
      } catch (error) {
        // Cloudflare retries the batch, and after max_retries (wrangler.jsonc)
        // moves it to the dead-letter queue; the outbox rows stay either way.
        logError({
          event: "notification_queue_drain_failed",
          reason: "drain_failed",
          route: `queue:${batch.queue}`,
          messages: batch.messages.length,
          attempt: Math.max(0, ...batch.messages.map((message) => message.attempts)),
          retryInSeconds: NOTIFICATION_QUEUE_RETRY_DELAY_SECONDS,
          error: errorSummary(error),
        });
        batch.retryAll({ delaySeconds: NOTIFICATION_QUEUE_RETRY_DELAY_SECONDS });
      }
    },

    async scheduled(controller, env, ctx) {
      const summary = await drainOutbox(app, env, ctx, `cron:${controller.cron}`).catch((error: unknown) => {
        logError({
          event: "notification_reconciliation_failed",
          reason: "drain_failed",
          route: `cron:${controller.cron}`,
          error: errorSummary(error),
        });
        throw error;
      });
      console.log(JSON.stringify({ event: "notification_reconciliation", ...summary }));
    },
  } satisfies ExportedHandler<CloudflareEnv, NotificationWakeMessage>;
}

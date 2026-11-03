import { beforeEach, describe, expect, it, vi } from "vitest";

const queue = vi.hoisted(() => ({ send: vi.fn() }));
const cloudflare = vi.hoisted(() => ({
  context: vi.fn((): { env: Record<string, unknown> } => {
    throw new Error("not running on Cloudflare");
  }),
}));

vi.mock("@vercel/queue", () => ({ send: queue.send }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: cloudflare.context }));

import {
  NOTIFICATION_QUEUE_TOPIC,
  scheduleNotificationDelivery,
} from "./notification-queue";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notification queue scheduling on Cloudflare", () => {
  it("sends a delayed wake-up to the queue binding instead of Vercel Queue", async () => {
    const binding = { send: vi.fn().mockResolvedValue(undefined) };
    cloudflare.context.mockReturnValueOnce({ env: { NOTIFICATION_QUEUE: binding } });

    await expect(
      scheduleNotificationDelivery({
        idempotencyKey: "notification-retry:job-1:2",
        reason: "retry",
        delaySeconds: 240,
      }),
    ).resolves.toBe(true);

    expect(binding.send).toHaveBeenCalledWith(
      { version: 1, reason: "retry", key: "notification-retry:job-1:2" },
      { delaySeconds: 240 },
    );
    expect(queue.send).not.toHaveBeenCalled();
  });

  it("keeps delays inside the range Cloudflare Queues accepts", async () => {
    const binding = { send: vi.fn().mockResolvedValue(undefined) };
    cloudflare.context
      .mockReturnValueOnce({ env: { NOTIFICATION_QUEUE: binding } })
      .mockReturnValueOnce({ env: { NOTIFICATION_QUEUE: binding } });

    await scheduleNotificationDelivery({ idempotencyKey: "a", reason: "retry", delaySeconds: 86_400 });
    await scheduleNotificationDelivery({ idempotencyKey: "b", reason: "continue", delaySeconds: -5 });

    expect(binding.send.mock.calls.map(([, options]) => options)).toEqual([
      { delaySeconds: 43_200 },
      { delaySeconds: 0 },
    ]);
  });

  it("leaves recovery to the outbox when the queue binding rejects", async () => {
    const error = new Error("queue unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    cloudflare.context.mockReturnValueOnce({
      env: { NOTIFICATION_QUEUE: { send: vi.fn().mockRejectedValue(error) } },
    });

    await expect(
      scheduleNotificationDelivery({ idempotencyKey: "invite-created:invite-1", reason: "new" }),
    ).resolves.toBe(false);

    expect(consoleError).toHaveBeenCalledWith("Failed to schedule notification delivery", error);
    consoleError.mockRestore();
  });
});

describe("notification queue scheduling", () => {
  it("sends an idempotent delayed wake-up with enough retention for retries", async () => {
    queue.send.mockResolvedValue({ messageId: "message-1" });

    await expect(
      scheduleNotificationDelivery({
        idempotencyKey: "notification-retry:job-1:2",
        reason: "retry",
        delaySeconds: 240,
      }),
    ).resolves.toBe(true);

    expect(queue.send).toHaveBeenCalledWith(
      NOTIFICATION_QUEUE_TOPIC,
      { version: 1, reason: "retry" },
      {
        delaySeconds: 240,
        idempotencyKey: "notification-retry:job-1:2",
        retentionSeconds: 86400,
      },
    );
  });

  it("leaves recovery to the outbox when queue scheduling is unavailable", async () => {
    const error = new Error("queue unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    queue.send.mockRejectedValue(error);

    await expect(
      scheduleNotificationDelivery({
        idempotencyKey: "invite-created:invite-1",
        reason: "new",
      }),
    ).resolves.toBe(false);

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to schedule notification delivery",
      error,
    );
    consoleError.mockRestore();
  });
});

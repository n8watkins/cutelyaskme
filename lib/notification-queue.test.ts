import { beforeEach, describe, expect, it, vi } from "vitest";

const queue = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@vercel/queue", () => ({ send: queue.send }));

import {
  NOTIFICATION_QUEUE_TOPIC,
  scheduleNotificationDelivery,
} from "./notification-queue";

beforeEach(() => {
  vi.clearAllMocks();
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
        retentionSeconds: 604800,
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

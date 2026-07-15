import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(),
  schedule: vi.fn(),
}));

vi.mock("@vercel/queue", () => ({
  handleCallback: (handler: unknown) => handler,
}));
vi.mock("@/lib/notification-delivery", () => ({
  deliverPendingNotificationJobs: mocks.deliver,
}));
vi.mock("@/lib/notification-queue", () => ({
  NOTIFICATION_QUEUE_BATCH_SIZE: 20,
  scheduleNotificationDelivery: mocks.schedule,
}));

import { processNotificationQueueMessage } from "../src/app/api/queues/notifications/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.schedule.mockResolvedValue(true);
});

describe("notification queue consumer", () => {
  it("drains a bounded outbox batch", async () => {
    mocks.deliver.mockResolvedValue({ sent: 3, failed: 1, exhausted: 0, canceled: 2 });

    await processNotificationQueueMessage({ messageId: "message-1", deliveryCount: 1 });

    expect(mocks.deliver).toHaveBeenCalledWith(20);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it("schedules an immediate continuation when the batch was full", async () => {
    mocks.deliver.mockResolvedValue({ sent: 17, failed: 1, exhausted: 1, canceled: 1 });

    await processNotificationQueueMessage({ messageId: "message-2", deliveryCount: 3 });

    expect(mocks.schedule).toHaveBeenCalledWith({
      idempotencyKey: "notification-continuation:message-2:3",
      reason: "continue",
      delaySeconds: 0,
    });
  });

  it("propagates worker failures so Vercel Queue redelivers the message", async () => {
    mocks.deliver.mockRejectedValue(new Error("database unavailable"));

    await expect(
      processNotificationQueueMessage({ messageId: "message-3", deliveryCount: 1 }),
    ).rejects.toThrow("database unavailable");
  });
});

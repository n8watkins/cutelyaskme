import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selected: [] as Array<{
    id: string;
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>,
  deleted: [] as string[],
}));

const sendNotification = vi.hoisted(() => vi.fn());

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification,
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => state.selected,
        }),
      }),
    }),
    delete: () => ({
      where: async () => {
        state.deleted.push(state.selected[0]?.id ?? "missing");
      },
    }),
  },
}));

import { sendPushToSubscription } from "./push";

const payload = { title: "Ready", body: "Your date is ready", tag: "job-1" };

beforeEach(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-key";
  process.env.VAPID_PRIVATE_KEY = "private-key";
  state.selected = [
    {
      id: "subscription-1",
      userId: "recipient-1",
      endpoint: "https://push.example.test/one",
      p256dh: "p256dh-one",
      auth: "auth-one",
    },
  ];
  state.deleted = [];
  sendNotification.mockReset();
});

describe("subscription-scoped push delivery", () => {
  it("sends exactly once to the selected outbox target", async () => {
    sendNotification.mockResolvedValue(undefined);

    const result = await sendPushToSubscription(
      "subscription-1",
      "recipient-1",
      payload,
    );

    expect(result).toBe("sent");
    expect(sendNotification).toHaveBeenCalledOnce();
    expect(sendNotification).toHaveBeenCalledWith(
      {
        endpoint: "https://push.example.test/one",
        keys: { p256dh: "p256dh-one", auth: "auth-one" },
      },
      JSON.stringify(payload),
    );
  });

  it("prunes a dead target without retrying sibling subscriptions", async () => {
    sendNotification.mockRejectedValue({ statusCode: 410 });

    const result = await sendPushToSubscription(
      "subscription-1",
      "recipient-1",
      payload,
    );

    expect(result).toBe("dead");
    expect(sendNotification).toHaveBeenCalledOnce();
    expect(state.deleted).toEqual(["subscription-1"]);
  });
});

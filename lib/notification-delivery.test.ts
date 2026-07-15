import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  jobs: [] as Array<Record<string, unknown>>,
  selections: [] as Array<Array<Record<string, unknown>>>,
}));

const mocks = vi.hoisted(() => ({
  sendSpotReadyEmail: vi.fn(),
  sendPushToSubscription: vi.fn(),
  markSent: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: {
      getUser: async () => ({
        firstName: "Sender",
        emailAddresses: [{ emailAddress: "sender@example.test" }],
      }),
    },
  }),
}));

vi.mock("@/lib/db", () => ({
  getDbClient: () => ({}),
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => state.selections.shift() ?? [],
          orderBy: async () => state.selections.shift() ?? [],
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/email", () => ({
  sendDateCanceledEmail: vi.fn(),
  sendInviteEmail: vi.fn(),
  sendPlanNotificationEmail: vi.fn(),
  sendSpotReadyEmail: mocks.sendSpotReadyEmail,
}));

vi.mock("@/lib/notification-outbox", () => ({
  claimNotificationJobs: async () => state.jobs,
  claimInviteNotificationJobs: vi.fn(),
  claimPlanNotificationJobs: vi.fn(),
  markNotificationCanceled: vi.fn(),
  markNotificationFailed: vi.fn(),
  markNotificationSent: mocks.markSent,
}));

vi.mock("@/lib/push", () => ({
  sendPushToSubscription: mocks.sendPushToSubscription,
}));

import { deliverPendingNotificationJobs } from "./notification-delivery";

const invite = {
  id: "invite-1",
  senderId: "sender-1",
  recipientName: "Recipient",
  recipientEmail: "recipient@example.test",
  token: "invite-token",
};

function plan(recipientId: string | null) {
  return {
    id: "plan-1",
    inviteId: invite.id,
    senderId: "sender-1",
    recipientId,
    notificationMode: "surprise",
    selectedDateLabel: "Friday",
    selectedTimeLabel: "6:30 PM",
    selectedActivities: "[]",
    selectedActivityVenues: "{}",
    selectedEntree: null,
    selectedEntreeVenue: null,
  };
}

beforeEach(() => {
  state.jobs = [];
  state.selections = [];
  vi.clearAllMocks();
});

describe("notification delivery policy", () => {
  it("links claimed recipients through authenticated plan access", async () => {
    state.jobs = [{
      id: "email-job",
      planId: "plan-1",
      inviteId: null,
      channel: "email",
      targetId: "email",
      kind: "plan_ready",
      attempts: 1,
    }];
    state.selections = [[plan("recipient-1")], [invite], []];
    mocks.sendSpotReadyEmail.mockResolvedValue(undefined);

    await deliverPendingNotificationJobs();

    expect(mocks.sendSpotReadyEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "plan-1",
        inviteToken: undefined,
        deliveryKey: "email-job",
      }),
    );
    expect(mocks.markSent).toHaveBeenCalledWith({}, "email-job");
  });

  it("uses the stable job id to replace a retried push on one subscription", async () => {
    state.jobs = [{
      id: "push-job",
      planId: "plan-1",
      inviteId: null,
      channel: "push",
      targetId: "subscription-1",
      kind: "plan_ready",
      attempts: 2,
    }];
    state.selections = [[plan("recipient-1")], [invite]];
    mocks.sendPushToSubscription.mockResolvedValue("sent");

    await deliverPendingNotificationJobs();

    expect(mocks.sendPushToSubscription).toHaveBeenCalledWith(
      "subscription-1",
      "recipient-1",
      expect.objectContaining({
        url: "/plan/plan-1",
        tag: "push-job",
      }),
    );
    expect(mocks.markSent).toHaveBeenCalledWith({}, "push-job");
  });
});

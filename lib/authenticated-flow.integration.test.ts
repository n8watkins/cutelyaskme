import { createClient, type Client } from "@libsql/client";
import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { areRecipientPlanDetailsVisible } from "./plan-visibility";
import { planCapabilityCookieName } from "./plan-route-access";

const authState = vi.hoisted(() => ({ userId: null as string | null }));
const deliveryState = vi.hoisted(() => ({
  calls: [] as string[],
  failures: new Set<string>(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: authState.userId }),
  currentUser: async () => ({
    emailAddresses: [
      {
        emailAddress:
          authState.userId === "recipient-1"
            ? "recipient@example.test"
            : "other@example.test",
        verification: { status: "verified" },
      },
    ],
  }),
  clerkClient: async () => ({
    users: {
      getUser: async () => ({
        emailAddresses: [{ emailAddress: "sender@example.test" }],
      }),
    },
  }),
}));
vi.mock("./gemini-budget", () => ({ reserveGeminiCall: async () => false }));
vi.mock("./itinerary", () => ({ generateItinerary: async () => null }));
vi.mock("./memory-poem", () => ({ generateMemoryPoem: async () => null }));
vi.mock("./email", () => ({ sendPlanNotificationEmail: async () => undefined }));
vi.mock("./notification-delivery", () => ({
  deliverPlanNotificationJobs: async (planId: string, kind: string) => {
    deliveryState.calls.push(`${planId}:${kind}`);
    if (deliveryState.failures.has(kind)) throw new Error("delivery unavailable");
    return { sent: 0, failed: 0 };
  },
}));
vi.mock("./notification-queue", () => ({
  NOTIFICATION_QUEUE_INITIAL_DELAY_SECONDS: 10,
  scheduleNotificationDelivery: async () => true,
}));
vi.mock("./cloudinary", () => ({ destroyCloudinaryImage: async () => undefined }));
vi.mock("./after-response", () => ({
  afterResponse: (task: () => Promise<void> | void) => {
    void task();
  },
}));

const execFileAsync = promisify(execFile);
const databasePath = path.join(
  process.cwd(),
  `.authenticated-flow-test-${process.pid}-${Math.random().toString(16).slice(2)}.db`,
);

type Routes = {
  createPlan: typeof import("../src/app/api/plans/route").POST;
  editPlan: typeof import("../src/app/api/plans/[id]/route").PATCH;
  notifyPlan: typeof import("../src/app/api/plans/[id]/notify/route").POST;
  cancelPlan: typeof import("../src/app/api/plans/[id]/cancel/route").POST;
  ratePlan: typeof import("../src/app/api/ratings/route").POST;
  saveMemory: typeof import("../src/app/api/memories/route").POST;
  savePhotos: typeof import("../src/app/api/memories/photos/route").PUT;
  shareMemory: typeof import("../src/app/api/memories/share/route").PATCH;
  redeemInvite: typeof import("../src/app/api/invites/redeem/route").GET;
  revokeCapability: typeof import("../src/app/api/plans/[id]/capability/revoke/route").POST;
};

let client: Client;
let routes: Routes;
let planId: string;

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.PLAN_CAPABILITY_SECRET = "integration-secret-with-at-least-thirty-two-bytes";
  process.env.CLOUDINARY_CLOUD_NAME = "demo-cloud";
  await execFileAsync(process.execPath, ["scripts/migrate.mjs"], { env: process.env });
  client = createClient({ url: `file:${databasePath}` });

  const [
    createPlan,
    editPlan,
    notifyPlan,
    cancelPlan,
    ratePlan,
    saveMemory,
    savePhotos,
    shareMemory,
    redeemInvite,
    revokeCapability,
  ] =
    await Promise.all([
      import("../src/app/api/plans/route"),
      import("../src/app/api/plans/[id]/route"),
      import("../src/app/api/plans/[id]/notify/route"),
      import("../src/app/api/plans/[id]/cancel/route"),
      import("../src/app/api/ratings/route"),
      import("../src/app/api/memories/route"),
      import("../src/app/api/memories/photos/route"),
      import("../src/app/api/memories/share/route"),
      import("../src/app/api/invites/redeem/route"),
      import("../src/app/api/plans/[id]/capability/revoke/route"),
    ]);
  routes = {
    createPlan: createPlan.POST,
    editPlan: editPlan.PATCH,
    notifyPlan: notifyPlan.POST,
    cancelPlan: cancelPlan.POST,
    ratePlan: ratePlan.POST,
    saveMemory: saveMemory.POST,
    savePhotos: savePhotos.PUT,
    shareMemory: shareMemory.PATCH,
    redeemInvite: redeemInvite.GET,
    revokeCapability: revokeCapability.POST,
  };
});

afterAll(async () => {
  client.close();
  const { getDbClient } = await import("./db");
  getDbClient().close();
  await rm(databasePath, { force: true });
});

describe.sequential("authenticated database-backed API flow", () => {
  it("requires callers to identify the event timezone", async () => {
    await client.execute({
      sql: `
        INSERT INTO invites (
          id, token, sender_id, recipient_name, recipient_email, status
        ) VALUES (?, ?, ?, ?, ?, 'pending')
      `,
      args: [
        "invite-no-timezone",
        "token-no-timezone",
        "sender-1",
        "Recipient",
        "recipient@example.test",
      ],
    });
    authState.userId = null;

    const response = await routes.createPlan(
      jsonRequest("http://localhost/api/plans", "POST", {
        inviteToken: "token-no-timezone",
      }),
    );

    expect(response.status).toBe(400);
    const invite = await client.execute(
      "SELECT status FROM invites WHERE id = 'invite-no-timezone'",
    );
    expect(invite.rows[0]?.status).toBe("pending");
  });

  it("rotates the completed invite token when anonymous access is revoked", async () => {
    await client.execute({
      sql: `
        INSERT INTO invites (
          id, token, sender_id, recipient_name, recipient_email, status
        ) VALUES (?, ?, ?, ?, ?, 'pending')
      `,
      args: [
        "invite-revocation",
        "token-revocation",
        "sender-1",
        "Recipient",
        "recipient@example.test",
      ],
    });
    authState.userId = null;
    const created = await routes.createPlan(
      jsonRequest("http://localhost/api/plans", "POST", {
        inviteToken: "token-revocation",
        selectedDate: "2099-01-01",
        selectedTime: "18:00",
        timezone: "America/Los_Angeles",
      }),
    );
    expect(created.status).toBe(200);
    const { planId: revokedPlanId } = await created.json() as { planId: string };
    expect(created.cookies.get(planCapabilityCookieName(revokedPlanId))?.value).toBeTruthy();

    const beforeRevocation = await routes.redeemInvite(
      new NextRequest(
        "http://localhost/api/invites/redeem?token=token-revocation",
      ),
    );
    expect(beforeRevocation.headers.get("location")).toBe(
      `http://localhost/plan/${revokedPlanId}`,
    );

    authState.userId = "sender-1";
    const revoked = await routes.revokeCapability(
      new Request(`http://localhost/api/plans/${revokedPlanId}/capability/revoke`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: revokedPlanId }) },
    );
    expect(revoked.status).toBe(200);

    const invite = await client.execute(
      "SELECT token, capability_version FROM invites WHERE id = 'invite-revocation'",
    );
    expect(invite.rows[0]?.token).not.toBe("token-revocation");
    expect(invite.rows[0]?.capability_version).toBe(2);

    const afterRevocation = await routes.redeemInvite(
      new NextRequest(
        "http://localhost/api/invites/redeem?token=token-revocation",
      ),
    );
    expect(afterRevocation.headers.get("location")).toBe("http://localhost/login");
  });

  it("does not let an unrelated signed-in user claim an invite token", async () => {
    await client.execute({
      sql: `
        INSERT INTO invites (
          id, token, sender_id, recipient_name, recipient_email, status
        ) VALUES (?, ?, ?, ?, ?, 'pending')
      `,
      args: [
        "invite-takeover",
        "token-takeover",
        "sender-1",
        "Recipient",
        "recipient@example.test",
      ],
    });
    authState.userId = "stranger-1";
    const response = await routes.createPlan(
      jsonRequest("http://localhost/api/plans", "POST", {
        inviteToken: "token-takeover",
        timezone: "UTC",
      }),
    );
    expect(response.status).toBe(403);

    const invite = await client.execute(
      "SELECT status FROM invites WHERE id = 'invite-takeover'",
    );
    expect(invite.rows[0]?.status).toBe("pending");
  });

  it("creates a recipient plan and permits only its sender to edit the stops", async () => {
    await client.execute({
      sql: `
        INSERT INTO invites (
          id, token, sender_id, recipient_name, recipient_email, status
        ) VALUES (?, ?, ?, ?, ?, 'pending')
      `,
      args: ["invite-flow", "token-flow", "sender-1", "Recipient", "recipient@example.test"],
    });
    authState.userId = "recipient-1";
    const response = await routes.createPlan(
      jsonRequest("http://localhost/api/plans", "POST", {
        inviteToken: "token-flow",
        selectedDate: "2020-01-01",
        selectedDateLabel: "January 1",
        selectedTime: "18:00",
        selectedTimeLabel: "6:00 PM",
        selectedEntree: "Italian",
        selectedActivities: ["Coffee"],
        timezone: "America/Los_Angeles",
      }),
    );
    const responseBody = await response.json();
    expect(response.status, JSON.stringify(responseBody)).toBe(200);
    planId = String(responseBody.planId);

    authState.userId = "recipient-1";
    const recipientEdit = await routes.editPlan(
      jsonRequest(`http://localhost/api/plans/${planId}`, "PATCH", {}),
      { params: Promise.resolve({ id: planId }) },
    );
    expect(recipientEdit.status).toBe(404);

    authState.userId = "sender-1";
    const senderEdit = await routes.editPlan(
      jsonRequest(`http://localhost/api/plans/${planId}`, "PATCH", {
        activityOrder: ["Coffee"],
        stopOrder: ["Coffee", "__entree__"],
        stopDurations: { Coffee: 60, __entree__: 90 },
        stopTravelMinutes: { Coffee: 10, __entree__: 15 },
        selectedActivityVenues: {
          Coffee: { id: "coffee-1", name: "Coffee Shop" },
        },
        selectedEntreeVenue: { id: "dinner-1", name: "Dinner Place" },
      }),
      { params: Promise.resolve({ id: planId }) },
    );
    expect(senderEdit.status).toBe(200);

    const stops = await client.execute({
      sql: `
        SELECT activity, duration_minutes, travel_minutes
        FROM plan_stops WHERE plan_id = ? ORDER BY position
      `,
      args: [planId],
    });
    expect(stops.rows).toEqual([
      expect.objectContaining({ activity: "Coffee", duration_minutes: 60, travel_minutes: 10 }),
      expect.objectContaining({ activity: "Italian", duration_minutes: 90, travel_minutes: 15 }),
    ]);
  });

  it("opens post-date writes only to claimed participants and scopes photos", async () => {
    authState.userId = "stranger-1";
    const forbidden = await routes.ratePlan(
      jsonRequest("http://localhost/api/ratings", "POST", { planId, score: 5 }),
    );
    expect(forbidden.status).toBe(403);

    authState.userId = "recipient-1";
    const rating = await routes.ratePlan(
      jsonRequest("http://localhost/api/ratings", "POST", {
        planId,
        score: 5,
        note: "Wonderful",
      }),
    );
    expect(rating.status).toBe(200);

    const memory = await routes.saveMemory(
      jsonRequest("http://localhost/api/memories", "POST", {
        planId,
        notes: "A lovely evening",
      }),
    );
    expect(memory.status).toBe(200);

    const ownedPublicId = `date-memories/${planId}/recipient-1/photo-1`;
    const photos = await routes.savePhotos(
      jsonRequest("http://localhost/api/memories/photos", "PUT", {
        planId,
        photoRefs: [
          { url: "https://example.test/owned.jpg", publicId: ownedPublicId },
          {
            url: "https://example.test/foreign.jpg",
            publicId: `date-memories/${planId}/someone-else/photo-2`,
          },
        ],
      }),
    );
    expect(photos.status).toBe(200);

    const shared = await routes.shareMemory(
      jsonRequest("http://localhost/api/memories/share", "PATCH", {
        planId,
        share: true,
      }),
    );
    expect(shared.status).toBe(200);
    expect((await shared.json()).shareToken).toEqual(expect.any(String));

    const row = await client.execute({
      sql: "SELECT photo_refs, share_token FROM date_memories WHERE plan_id = ? AND author_id = ?",
      args: [planId, "recipient-1"],
    });
    expect(JSON.parse(String(row.rows[0]?.photo_refs))).toEqual([
      {
        url: `https://res.cloudinary.com/demo-cloud/image/upload/${ownedPublicId}`,
        publicId: ownedPublicId,
      },
    ]);
    expect(row.rows[0]?.share_token).not.toBeNull();
  });

  it("atomically confirms, queues, cancels, and rejects later notification or writes", async () => {
    await client.execute({
      sql: `
        INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
        VALUES
          ('recipient-device-1', 'recipient-1', 'https://push.example.test/1', 'key-1', 'auth-1'),
          ('recipient-device-2', 'recipient-1', 'https://push.example.test/2', 'key-2', 'auth-2')
      `,
      args: [],
    });
    authState.userId = "sender-1";
    const notified = await routes.notifyPlan(
      jsonRequest(`http://localhost/api/plans/${planId}/notify`, "POST", { mode: "surprise" }),
      { params: Promise.resolve({ id: planId }) },
    );
    expect(notified.status).toBe(200);

    const rejectedEdit = await routes.editPlan(
      jsonRequest(`http://localhost/api/plans/${planId}`, "PATCH", {
        stopOrder: ["Coffee", "__entree__"],
      }),
      { params: Promise.resolve({ id: planId }) },
    );
    expect(rejectedEdit.status).toBe(409);

    deliveryState.failures.add("date_canceled");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const canceled = await routes.cancelPlan(
      jsonRequest(`http://localhost/api/plans/${planId}/cancel`, "POST", {}),
      { params: Promise.resolve({ id: planId }) },
    );
    deliveryState.failures.delete("date_canceled");
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to deliver cancellation notifications",
      expect.any(Error),
    );
    consoleError.mockRestore();
    expect(canceled.status).toBe(200);

    const rejectedNotify = await routes.notifyPlan(
      jsonRequest(`http://localhost/api/plans/${planId}/notify`, "POST", { mode: "share" }),
      { params: Promise.resolve({ id: planId }) },
    );
    expect(rejectedNotify.status).toBe(409);

    authState.userId = "recipient-1";
    const rejectedRating = await routes.ratePlan(
      jsonRequest("http://localhost/api/ratings", "POST", { planId, score: 4 }),
    );
    expect(rejectedRating.status).toBe(409);

    const state = await client.execute({
      sql: `
        SELECT notification_mode, confirmed_at, canceled_at
        FROM date_plans WHERE id = ?
      `,
      args: [planId],
    });
    expect(state.rows[0]).toEqual(
      expect.objectContaining({
        notification_mode: "surprise",
        confirmed_at: expect.any(String),
        canceled_at: expect.any(String),
      }),
    );
    const jobs = await client.execute({
      sql: "SELECT kind, channel, target_id FROM notification_jobs WHERE plan_id = ? ORDER BY kind, channel, target_id",
      args: [planId],
    });
    expect(jobs.rows).toEqual([
      expect.objectContaining({ kind: "date_canceled", channel: "email", target_id: "email" }),
      expect.objectContaining({ kind: "date_canceled", channel: "push", target_id: "recipient-device-1" }),
      expect.objectContaining({ kind: "date_canceled", channel: "push", target_id: "recipient-device-2" }),
      expect.objectContaining({ kind: "plan_ready", channel: "email", target_id: "email" }),
      expect.objectContaining({ kind: "plan_ready", channel: "push", target_id: "recipient-device-1" }),
      expect.objectContaining({ kind: "plan_ready", channel: "push", target_id: "recipient-device-2" }),
      expect.objectContaining({ kind: "sender_plan_completed", channel: "email", target_id: "email" }),
    ]);
    expect(deliveryState.calls.filter((call) => call.startsWith(`${planId}:`))).toEqual([
      `${planId}:sender_plan_completed`,
      `${planId}:plan_ready`,
      `${planId}:date_canceled`,
    ]);
  });

  it("keeps future post-date content locked", async () => {
    await client.batch(
      [
        {
          sql: `
            INSERT INTO invites (
              id, token, sender_id, recipient_name, recipient_email, status
            ) VALUES (?, ?, ?, ?, ?, 'completed')
          `,
          args: [
            "future-invite",
            "future-token",
            "sender-1",
            "Recipient",
            "recipient@example.test",
          ],
        },
        {
          sql: `
            INSERT INTO date_plans (
              id, invite_id, sender_id, recipient_id, selected_date, selected_time, timezone
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            "future-plan",
            "future-invite",
            "sender-1",
            "recipient-1",
            "2099-01-01",
            "18:00",
            "UTC",
          ],
        },
      ],
      "write",
    );

    authState.userId = "sender-1";
    const notify = await routes.notifyPlan(
      jsonRequest("http://localhost/api/plans/future-plan/notify", "POST", {
        mode: "surprise",
      }),
      { params: Promise.resolve({ id: "future-plan" }) },
    );
    expect(notify.status).toBe(200);
    const plan = await client.execute(
      "SELECT notification_mode, confirmed_at, revealed_at, selected_date, selected_time, timezone FROM date_plans WHERE id = 'future-plan'",
    );
    const row = plan.rows[0]!;
    const visibility: Parameters<typeof areRecipientPlanDetailsVisible>[0] = {
      notificationMode: row.notification_mode as "share" | "surprise" | null,
      confirmedAt: row.confirmed_at === null ? null : String(row.confirmed_at),
      revealedAt: row.revealed_at === null ? null : String(row.revealed_at),
      selectedDate: row.selected_date === null ? null : String(row.selected_date),
      selectedTime: row.selected_time === null ? null : String(row.selected_time),
      timezone: String(row.timezone),
    };
    expect(areRecipientPlanDetailsVisible(visibility, new Date("2026-07-14T12:00:00Z"))).toBe(
      false,
    );
    expect(
      areRecipientPlanDetailsVisible(
        { ...visibility, revealedAt: "2026-07-14T12:00:00Z" },
        new Date("2026-07-14T12:00:01Z"),
      ),
    ).toBe(true);

    authState.userId = "recipient-1";
    const response = await routes.saveMemory(
      jsonRequest("http://localhost/api/memories", "POST", {
        planId: "future-plan",
        notes: "Too soon",
      }),
    );
    expect(response.status).toBe(403);
  });
});

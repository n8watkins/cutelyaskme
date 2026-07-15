import { createClient, type Client } from "@libsql/client";
import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  claimNotificationJobs,
  enqueueInviteNotification,
  enqueuePlanNotifications,
  markNotificationFailed,
  markNotificationSent,
  MAX_NOTIFICATION_ATTEMPTS,
} from "./notification-outbox";

let client: Client;
const databasePath = path.join(
  process.cwd(),
  `.outbox-test-${process.pid}-${Math.random().toString(16).slice(2)}.db`,
);

beforeEach(async () => {
  client = createClient({ url: `file:${databasePath}` });
  await client.execute(`
    CREATE TABLE date_plans (
      id text PRIMARY KEY NOT NULL,
      recipient_id text
    )
  `);
  await client.execute(`
    CREATE TABLE push_subscriptions (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE notification_jobs (
      id text PRIMARY KEY NOT NULL,
      plan_id text,
      invite_id text,
      channel text NOT NULL,
      target_id text NOT NULL,
      kind text NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      attempts integer DEFAULT 0 NOT NULL,
      available_at text DEFAULT (datetime('now')) NOT NULL,
      sent_at text,
      last_error_code text,
      created_at text DEFAULT (datetime('now')) NOT NULL,
      updated_at text DEFAULT (datetime('now')) NOT NULL
    )
  `);
  await client.execute(
    "CREATE UNIQUE INDEX plan_delivery_unique ON notification_jobs (plan_id, channel, kind, target_id)",
  );
  await client.execute(
    "CREATE UNIQUE INDEX invite_delivery_unique ON notification_jobs (invite_id, channel, kind, target_id)",
  );
  await client.execute("INSERT INTO date_plans (id, recipient_id) VALUES ('plan-1', 'recipient-1')");
  await client.execute(
    "INSERT INTO push_subscriptions (id, user_id) VALUES ('push-1', 'recipient-1'), ('push-2', 'recipient-1')",
  );
});

afterEach(async () => {
  client.close();
  await rm(databasePath, { force: true });
});

describe("notification outbox", () => {
  it("enqueues each delivery once and claims each job once", async () => {
    await enqueuePlanNotifications(client, "plan-1", "plan_ready");
    await enqueuePlanNotifications(client, "plan-1", "plan_ready");

    const claimed = await claimNotificationJobs(client);
    expect(claimed).toHaveLength(3);
    expect(new Set(claimed.map((job) => job.channel))).toEqual(new Set(["email", "push"]));
    expect(claimed.filter((job) => job.channel === "push").map((job) => job.targetId).sort()).toEqual([
      "push-1",
      "push-2",
    ]);
    expect(await claimNotificationJobs(client)).toEqual([]);
  });

  it("records sent jobs and schedules failed jobs for a later retry", async () => {
    await client.execute("DELETE FROM push_subscriptions WHERE id = 'push-2'");
    await enqueuePlanNotifications(client, "plan-1", "date_canceled");
    const [sent, failed] = await claimNotificationJobs(client);

    await markNotificationSent(client, sent.id);
    await markNotificationFailed(client, failed.id, "provider_timeout", 5, failed.attempts);

    const rows = await client.execute(
      "SELECT status, last_error_code FROM notification_jobs ORDER BY status DESC",
    );
    expect(rows.rows).toEqual([
      expect.objectContaining({ status: "sent", last_error_code: null }),
      expect.objectContaining({ status: "failed", last_error_code: "provider_timeout" }),
    ]);
  });

  it("durably enqueues an invite email once without requiring a plan", async () => {
    await enqueueInviteNotification(client, "invite-1", "invite_created");
    await enqueueInviteNotification(client, "invite-1", "invite_created");

    const claimed = await claimNotificationJobs(client);

    expect(claimed).toEqual([
      expect.objectContaining({
        planId: null,
        inviteId: "invite-1",
        channel: "email",
        targetId: "email",
        kind: "invite_created",
      }),
    ]);
  });

  it("moves a job to an operationally visible terminal state at the attempt cap", async () => {
    await enqueuePlanNotifications(client, "plan-1", "plan_ready", ["email"]);
    const [job] = await claimNotificationJobs(client);

    const status = await markNotificationFailed(
      client,
      job.id,
      "provider_timeout",
      60,
      MAX_NOTIFICATION_ATTEMPTS,
    );

    expect(status).toBe("exhausted");
    expect(await claimNotificationJobs(client)).toEqual([]);
    const row = await client.execute({
      sql: "SELECT status, attempts, last_error_code FROM notification_jobs WHERE id = ?",
      args: [job.id],
    });
    expect(row.rows[0]).toEqual(
      expect.objectContaining({
        status: "exhausted",
        attempts: 1,
        last_error_code: "provider_timeout",
      }),
    );
  });

  it("exhausts an abandoned job that already reached the attempt cap", async () => {
    await client.execute({
      sql: `
        INSERT INTO notification_jobs (
          id, plan_id, channel, target_id, kind, status, attempts, updated_at
        ) VALUES (?, ?, 'email', 'email', 'plan_ready', 'failed', ?, datetime('now', '-1 hour'))
      `,
      args: ["at-limit", "plan-1", MAX_NOTIFICATION_ATTEMPTS],
    });

    expect(await claimNotificationJobs(client)).toEqual([]);
    const row = await client.execute(
      "SELECT status FROM notification_jobs WHERE id = 'at-limit'",
    );
    expect(row.rows[0]?.status).toBe("exhausted");
  });
});

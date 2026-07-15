import { randomUUID } from "node:crypto";
import type { Client, InStatement, ResultSet, Transaction } from "@libsql/client";

export type NotificationChannel = "email" | "push";
export type NotificationKind =
  | "invite_created"
  | "sender_plan_completed"
  | "plan_ready"
  | "date_canceled";
export type PlanNotificationKind = Exclude<NotificationKind, "invite_created">;
export const MAX_NOTIFICATION_ATTEMPTS = 5;

type SqlExecutor = Pick<Client | Transaction, "execute">;

export type ClaimedNotificationJob = {
  id: string;
  planId: string | null;
  inviteId: string | null;
  channel: NotificationChannel;
  targetId: string;
  kind: NotificationKind;
  attempts: number;
};

function execute(executor: SqlExecutor, statement: InStatement): Promise<ResultSet> {
  return executor.execute(statement);
}

/** Queue email once and one push job per current recipient subscription. */
export async function enqueuePlanNotifications(
  executor: SqlExecutor,
  planId: string,
  kind: PlanNotificationKind,
  channels: NotificationChannel[] = ["email", "push"],
): Promise<void> {
  if (!planId) throw new Error("planId is required");
  if (channels.length === 0) return;

  const requestedChannels = new Set(channels);
  const deliveries: { channel: NotificationChannel; targetId: string }[] = [];
  if (requestedChannels.has("email")) {
    deliveries.push({ channel: "email", targetId: "email" });
  }
  if (requestedChannels.has("push")) {
    const subscriptions = await execute(executor, {
      sql: `
        SELECT push_subscriptions.id
        FROM date_plans
        INNER JOIN push_subscriptions
          ON push_subscriptions.user_id = date_plans.recipient_id
        WHERE date_plans.id = ?
      `,
      args: [planId],
    });
    for (const row of subscriptions.rows) {
      deliveries.push({ channel: "push", targetId: String(row.id) });
    }
  }
  if (deliveries.length === 0) return;

  const values = deliveries.map(() => "(?, ?, ?, ?, ?)").join(", ");
  await execute(executor, {
    sql: `
      INSERT INTO notification_jobs (id, plan_id, channel, target_id, kind)
      VALUES ${values}
      ON CONFLICT(plan_id, channel, kind, target_id) DO NOTHING
    `,
    args: deliveries.flatMap(({ channel, targetId }) => [
      randomUUID(),
      planId,
      channel,
      targetId,
      kind,
    ]),
  });
}

/** Queue an invite-scoped email once as part of the invite transaction. */
export async function enqueueInviteNotification(
  executor: SqlExecutor,
  inviteId: string,
  kind: "invite_created",
): Promise<void> {
  if (!inviteId) throw new Error("inviteId is required");
  await execute(executor, {
    sql: `
      INSERT INTO notification_jobs (id, invite_id, channel, target_id, kind)
      VALUES (?, ?, 'email', 'email', ?)
      ON CONFLICT(invite_id, channel, kind, target_id) DO NOTHING
    `,
    args: [randomUUID(), inviteId, kind],
  });
}

async function exhaustAbandonedJobsAtLimit(client: Client): Promise<void> {
  await client.execute({
    sql: `
      UPDATE notification_jobs
      SET status = 'exhausted', updated_at = datetime('now')
      WHERE
        attempts >= ?
        AND (
          status = 'failed'
          OR (status = 'processing' AND updated_at <= datetime('now', '-5 minutes'))
        )
    `,
    args: [MAX_NOTIFICATION_ATTEMPTS],
  });
}

/** Atomically lease pending work and recover leases abandoned for five minutes. */
export async function claimNotificationJobs(
  client: Client,
  limit = 10,
): Promise<ClaimedNotificationJob[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit must be between 1 and 100");
  }

  await exhaustAbandonedJobsAtLimit(client);
  const result = await client.execute({
    sql: `
      UPDATE notification_jobs
      SET
        status = 'processing',
        attempts = attempts + 1,
        updated_at = datetime('now')
      WHERE id IN (
        SELECT id
        FROM notification_jobs
        WHERE
          attempts < ?
          AND (
            (status IN ('pending', 'failed') AND available_at <= datetime('now'))
            OR (status = 'processing' AND updated_at <= datetime('now', '-5 minutes'))
          )
        ORDER BY available_at, created_at
        LIMIT ?
      )
      RETURNING id, plan_id, invite_id, channel, target_id, kind, attempts
    `,
    args: [MAX_NOTIFICATION_ATTEMPTS, limit],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    planId: row.plan_id === null ? null : String(row.plan_id),
    inviteId: row.invite_id === null ? null : String(row.invite_id),
    channel: String(row.channel) as NotificationChannel,
    targetId: String(row.target_id),
    kind: String(row.kind) as NotificationKind,
    attempts: Number(row.attempts),
  }));
}

export async function claimPlanNotificationJobs(
  client: Client,
  planId: string,
  kind: PlanNotificationKind,
): Promise<ClaimedNotificationJob[]> {
  await exhaustAbandonedJobsAtLimit(client);
  const result = await client.execute({
    sql: `
      UPDATE notification_jobs
      SET
        status = 'processing',
        attempts = attempts + 1,
        updated_at = datetime('now')
      WHERE id IN (
        SELECT id
        FROM notification_jobs
        WHERE
          plan_id = ?
          AND kind = ?
          AND attempts < ?
          AND (
            (status IN ('pending', 'failed') AND available_at <= datetime('now'))
            OR (status = 'processing' AND updated_at <= datetime('now', '-5 minutes'))
          )
      )
      RETURNING id, plan_id, invite_id, channel, target_id, kind, attempts
    `,
    args: [planId, kind, MAX_NOTIFICATION_ATTEMPTS],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    planId: row.plan_id === null ? null : String(row.plan_id),
    inviteId: row.invite_id === null ? null : String(row.invite_id),
    channel: String(row.channel) as NotificationChannel,
    targetId: String(row.target_id),
    kind: String(row.kind) as NotificationKind,
    attempts: Number(row.attempts),
  }));
}

export async function claimInviteNotificationJobs(
  client: Client,
  inviteId: string,
  kind: "invite_created",
): Promise<ClaimedNotificationJob[]> {
  await exhaustAbandonedJobsAtLimit(client);
  const result = await client.execute({
    sql: `
      UPDATE notification_jobs
      SET
        status = 'processing',
        attempts = attempts + 1,
        updated_at = datetime('now')
      WHERE id IN (
        SELECT id
        FROM notification_jobs
        WHERE
          invite_id = ?
          AND kind = ?
          AND attempts < ?
          AND (
            (status IN ('pending', 'failed') AND available_at <= datetime('now'))
            OR (status = 'processing' AND updated_at <= datetime('now', '-5 minutes'))
          )
      )
      RETURNING id, plan_id, invite_id, channel, target_id, kind, attempts
    `,
    args: [inviteId, kind, MAX_NOTIFICATION_ATTEMPTS],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    planId: row.plan_id === null ? null : String(row.plan_id),
    inviteId: row.invite_id === null ? null : String(row.invite_id),
    channel: String(row.channel) as NotificationChannel,
    targetId: String(row.target_id),
    kind: String(row.kind) as NotificationKind,
    attempts: Number(row.attempts),
  }));
}

export async function markNotificationSent(client: Client, id: string): Promise<void> {
  await client.execute({
    sql: `
      UPDATE notification_jobs
      SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND status = 'processing'
    `,
    args: [id],
  });
}

export async function markNotificationCanceled(
  client: Client,
  id: string,
  errorCode: string | null = null,
): Promise<void> {
  await client.execute({
    sql: `
      UPDATE notification_jobs
      SET status = 'canceled', last_error_code = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'processing'
    `,
    args: [errorCode, id],
  });
}

export async function markNotificationFailed(
  client: Client,
  id: string,
  errorCode: string,
  retryDelayMinutes: number,
  attempts = 1,
): Promise<"failed" | "exhausted"> {
  if (!/^[a-z0-9_-]{1,64}$/i.test(errorCode)) throw new Error("invalid error code");
  if (!Number.isSafeInteger(retryDelayMinutes) || retryDelayMinutes < 1) {
    throw new Error("retry delay must be a positive integer");
  }
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new Error("attempts must be a positive integer");
  }

  const status = attempts >= MAX_NOTIFICATION_ATTEMPTS ? "exhausted" : "failed";

  await client.execute({
    sql: `
      UPDATE notification_jobs
      SET
        status = ?,
        last_error_code = ?,
        available_at = datetime('now', '+' || ? || ' minutes'),
        updated_at = datetime('now')
      WHERE id = ? AND status = 'processing'
    `,
    args: [status, errorCode, retryDelayMinutes, id],
  });
  return status;
}

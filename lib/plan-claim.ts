import type { Client } from "@libsql/client";
import { getDbClient } from "./db";

export type PlanClaimResult = {
  claimed: boolean;
  recipientId: string | null;
  capabilityVersion: number;
};

/**
 * Atomically binds an unclaimed plan to one recipient and rotates every
 * anonymous capability for its invite. A concurrent loser receives the
 * winning state without rotating the capability a second time.
 */
export async function claimPlanRecipient(
  planId: string,
  inviteId: string,
  userId: string,
  client: Client = getDbClient(),
): Promise<PlanClaimResult> {
  if (!planId || !inviteId || !userId) {
    throw new Error("planId, inviteId, and userId are required");
  }

  const transaction = await client.transaction("write");
  try {
    const claimed = await transaction.execute({
      sql: `
        UPDATE date_plans
        SET recipient_id = ?
        WHERE id = ? AND invite_id = ? AND recipient_id IS NULL
      `,
      args: [userId, planId, inviteId],
    });

    if (claimed.rowsAffected === 1) {
      const rotated = await transaction.execute({
        sql: `
          UPDATE invites
          SET capability_version = capability_version + 1
          WHERE id = ?
        `,
        args: [inviteId],
      });
      if (rotated.rowsAffected !== 1) {
        throw new Error("Invite capability could not be rotated");
      }
    }

    const state = await transaction.execute({
      sql: `
        SELECT p.recipient_id, i.capability_version
        FROM date_plans p
        INNER JOIN invites i ON i.id = p.invite_id
        WHERE p.id = ? AND i.id = ?
        LIMIT 1
      `,
      args: [planId, inviteId],
    });
    await transaction.commit();

    const row = state.rows[0];
    if (!row) throw new Error("Plan claim state was not found");
    return {
      claimed: claimed.rowsAffected === 1,
      recipientId: row.recipient_id === null ? null : String(row.recipient_id),
      capabilityVersion: Number(row.capability_version),
    };
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  } finally {
    transaction.close();
  }
}

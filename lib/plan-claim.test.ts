import { createClient, type Client } from "@libsql/client";
import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { claimPlanRecipient } from "./plan-claim";

const databasePath = path.join(
  process.cwd(),
  `.plan-claim-test-${process.pid}-${Math.random().toString(16).slice(2)}.db`,
);
let client: Client;

beforeEach(async () => {
  client = createClient({ url: `file:${databasePath}` });
  await client.batch(
    [
      `CREATE TABLE invites (
        id text PRIMARY KEY NOT NULL,
        capability_version integer DEFAULT 1 NOT NULL
      )`,
      `CREATE TABLE date_plans (
        id text PRIMARY KEY NOT NULL,
        invite_id text,
        recipient_id text
      )`,
      "INSERT INTO invites (id) VALUES ('invite-1')",
      "INSERT INTO date_plans (id, invite_id) VALUES ('plan-1', 'invite-1')",
    ],
    "write",
  );
});

afterEach(async () => {
  client.close();
  await rm(databasePath, { force: true });
});

describe("claimPlanRecipient", () => {
  it("claims once, rotates capabilities once, and returns the winner thereafter", async () => {
    const first = await claimPlanRecipient("plan-1", "invite-1", "recipient-1", client);
    const second = await claimPlanRecipient("plan-1", "invite-1", "recipient-2", client);

    expect(first).toEqual({
      claimed: true,
      recipientId: "recipient-1",
      capabilityVersion: 2,
    });
    expect(second).toEqual({
      claimed: false,
      recipientId: "recipient-1",
      capabilityVersion: 2,
    });
  });

  it("does not claim a plan through the wrong invite", async () => {
    await expect(
      claimPlanRecipient("plan-1", "invite-other", "recipient-1", client),
    ).rejects.toThrow("Plan claim state was not found");

    const row = await client.execute(
      "SELECT recipient_id FROM date_plans WHERE id = 'plan-1'",
    );
    expect(row.rows[0]?.recipient_id).toBeNull();
  });
});

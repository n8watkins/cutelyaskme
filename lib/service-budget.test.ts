import { createClient, type Client } from "@libsql/client";
import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reserveServiceBudget } from "./service-budget";

let client: Client;
const databasePath = path.join(
  process.cwd(),
  `.service-budget-test-${process.pid}-${Math.random().toString(16).slice(2)}.db`,
);

beforeEach(async () => {
  client = createClient({ url: `file:${databasePath}` });
  await client.execute(`
    CREATE TABLE service_budgets (
      key text PRIMARY KEY NOT NULL,
      service text NOT NULL,
      subject_id text NOT NULL,
      window_start integer NOT NULL,
      window_end integer NOT NULL,
      count integer DEFAULT 0 NOT NULL,
      limit_value integer NOT NULL
    )
  `);
});

afterEach(async () => {
  client.close();
  await rm(databasePath, { force: true });
});

describe("reserveServiceBudget", () => {
  it("allows only the configured number of concurrent reservations", async () => {
    const reservations = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const concurrentClient = createClient({ url: `file:${databasePath}` });
        try {
          return await reserveServiceBudget(concurrentClient, {
            service: "places",
            windowStart: 1,
            windowEnd: 2,
            limits: [{ subjectId: "user-1", limit: 3 }],
          });
        } finally {
          concurrentClient.close();
        }
      }),
    );

    expect(reservations.filter((result) => result.allowed)).toHaveLength(3);
    const stored = await client.execute(
      "SELECT count FROM service_budgets WHERE subject_id = 'user-1'",
    );
    expect(stored.rows[0]?.count).toBe(3);
  });

  it("rolls back the viewer increment when the global ceiling is exhausted", async () => {
    const input = {
      service: "itinerary",
      windowStart: 1,
      windowEnd: 2,
      limits: [
        { subjectId: "user-1", limit: 5 },
        { subjectId: "global", limit: 1 },
      ],
    };

    expect(await reserveServiceBudget(client, input)).toEqual({ allowed: true });
    expect(await reserveServiceBudget(client, input)).toEqual({
      allowed: false,
    });

    const stored = await client.execute(
      "SELECT subject_id, count FROM service_budgets ORDER BY subject_id",
    );
    expect(stored.rows).toEqual([
      expect.objectContaining({ subject_id: "global", count: 1 }),
      expect.objectContaining({ subject_id: "user-1", count: 1 }),
    ]);
  });
});

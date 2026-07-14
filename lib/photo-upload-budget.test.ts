import { createClient, type Client } from "@libsql/client";
import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MEMORY_PHOTO_SIGNATURE_LIMIT,
  reserveMemoryPhotoSignature,
} from "./photo-upload-budget";

let client: Client;
const databasePath = path.join(
  process.cwd(),
  `.photo-upload-budget-test-${process.pid}-${Math.random().toString(16).slice(2)}.db`,
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

describe("reserveMemoryPhotoSignature", () => {
  it("atomically limits each participant and plan to twenty signatures per day", async () => {
    const now = Date.UTC(2026, 6, 14, 12);
    const attempts = await Promise.all(
      Array.from({ length: MEMORY_PHOTO_SIGNATURE_LIMIT + 5 }, () =>
        reserveMemoryPhotoSignature("plan-1", "user-1", client, now),
      ),
    );

    expect(attempts.filter(Boolean)).toHaveLength(MEMORY_PHOTO_SIGNATURE_LIMIT);
    expect(await reserveMemoryPhotoSignature("plan-2", "user-1", client, now)).toBe(true);
    expect(await reserveMemoryPhotoSignature("plan-1", "user-2", client, now)).toBe(true);
    expect(
      await reserveMemoryPhotoSignature("plan-1", "user-1", client, now + 24 * 60 * 60 * 1000),
    ).toBe(true);
  });
});

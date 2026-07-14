import { createClient } from "@libsql/client";
import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const databasePath = path.join(
  process.cwd(),
  `.migration-test-${process.pid}-${Math.random().toString(16).slice(2)}.db`,
);
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await rm(databasePath, { force: true });
});

describe("wave 0 migration", () => {
  it("bootstraps a fresh database and remains idempotent", async () => {
    const environment = {
      ...process.env,
      TURSO_DATABASE_URL: `file:${databasePath}`,
      TURSO_AUTH_TOKEN: "",
    };
    await execFileAsync(process.execPath, ["scripts/migrate.mjs"], { env: environment });
    await execFileAsync(process.execPath, ["scripts/migrate.mjs"], { env: environment });

    const client = createClient({ url: `file:${databasePath}` });
    try {
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      );
      expect(tables.rows.map((row) => row.name)).toEqual(
        expect.arrayContaining([
          "app_migrations",
          "date_plans",
          "invites",
          "notification_jobs",
          "plan_stops",
          "service_budgets",
        ]),
      );
      const migrations = await client.execute("SELECT id FROM app_migrations ORDER BY id");
      expect(migrations.rows.map((row) => row.id)).toEqual([
        "0000_baseline.sql",
        "0001_wave0_foundation.sql",
        "0002_notification_outbox_expansion.sql",
      ]);
    } finally {
      client.close();
    }
  });

  it("preserves legacy plans while backfilling ordered stops", async () => {
    const client = createClient({ url: `file:${databasePath}` });

    try {
      await client.batch(
        [
          `CREATE TABLE invites (
            id text PRIMARY KEY NOT NULL,
            token text NOT NULL,
            sender_id text NOT NULL,
            recipient_name text NOT NULL,
            recipient_email text NOT NULL
          )`,
          `CREATE TABLE date_plans (
            id text PRIMARY KEY NOT NULL,
            recipient_id text,
            selected_entree text,
            selected_activities text NOT NULL DEFAULT '[]',
            selected_entree_venue text,
            selected_activity_venues text NOT NULL DEFAULT '{}'
          )`,
          `CREATE TABLE push_subscriptions (
            id text PRIMARY KEY NOT NULL,
            user_id text NOT NULL
          )`,
          {
            sql: `INSERT INTO date_plans (
              id,
              selected_entree,
              selected_activities,
              selected_entree_venue,
              selected_activity_venues
            ) VALUES (?, ?, ?, ?, ?)`,
            args: [
              "plan-1",
              "Italian",
              JSON.stringify(["Coffee", "Movie"]),
              JSON.stringify({ id: "dinner", name: "Pasta Place" }),
              JSON.stringify({
                Coffee: { id: "coffee", name: "Cafe" },
                Movie: { id: "movie", name: "Cinema" },
              }),
            ],
          },
        ],
        "write",
      );

      client.close();
      await execFileAsync(process.execPath, ["scripts/migrate.mjs"], {
        env: {
          ...process.env,
          TURSO_DATABASE_URL: `file:${databasePath}`,
          TURSO_AUTH_TOKEN: "",
        },
      });

      const migratedClient = createClient({ url: `file:${databasePath}` });
      const stops = await migratedClient.execute(
        `SELECT id, position, kind, activity, duration_minutes, venue
         FROM plan_stops
         WHERE plan_id = 'plan-1'
         ORDER BY position`,
      );

      expect(stops.rows).toEqual([
        expect.objectContaining({
          id: "plan-1:activity:0",
          position: 0,
          kind: "activity",
          activity: "Coffee",
          duration_minutes: 45,
          venue: JSON.stringify({ id: "coffee", name: "Cafe" }),
        }),
        expect.objectContaining({
          id: "plan-1:activity:1",
          position: 1,
          kind: "activity",
          activity: "Movie",
          duration_minutes: 120,
          venue: JSON.stringify({ id: "movie", name: "Cinema" }),
        }),
        expect.objectContaining({
          id: "plan-1:entree",
          position: 2,
          kind: "entree",
          activity: "Italian",
          duration_minutes: 75,
          venue: JSON.stringify({ id: "dinner", name: "Pasta Place" }),
        }),
      ]);
      const migrations = await migratedClient.execute(
        "SELECT id FROM app_migrations ORDER BY id",
      );
      expect(migrations.rows.map((row) => row.id)).toEqual([
        "0000_baseline.sql",
        "0001_wave0_foundation.sql",
        "0002_notification_outbox_expansion.sql",
      ]);
      migratedClient.close();
    } finally {
      client.close();
    }
  });

  it("validates a migration on a disposable copy without modifying the snapshot", async () => {
    const client = createClient({ url: `file:${databasePath}` });
    await client.batch(
      [
        `CREATE TABLE invites (
          id text PRIMARY KEY NOT NULL,
          token text NOT NULL,
          sender_id text NOT NULL,
          recipient_name text NOT NULL,
          recipient_email text NOT NULL
        )`,
          `CREATE TABLE date_plans (
            id text PRIMARY KEY NOT NULL,
            recipient_id text,
            selected_entree text,
          selected_activities text NOT NULL DEFAULT '[]',
          selected_entree_venue text,
            selected_activity_venues text NOT NULL DEFAULT '{}'
          )`,
          `CREATE TABLE push_subscriptions (
            id text PRIMARY KEY NOT NULL,
            user_id text NOT NULL
          )`,
        "INSERT INTO date_plans (id, selected_activities) VALUES ('snapshot-plan', '[]')",
      ],
      "write",
    );
    client.close();

    const result = await execFileAsync(
      process.execPath,
      ["scripts/validate-migration-copy.mjs", databasePath],
      { env: process.env },
    );
    expect(result.stdout).toContain("Validated migration on an isolated copy");

    const original = createClient({ url: `file:${databasePath}` });
    try {
      const migrationTable = await original.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_migrations'",
      );
      expect(migrationTable.rows).toHaveLength(0);
      const plans = await original.execute("SELECT id FROM date_plans");
      expect(plans.rows).toEqual([expect.objectContaining({ id: "snapshot-plan" })]);
    } finally {
      original.close();
    }
  });

  it("refuses to adopt a partial foundation schema", async () => {
    const client = createClient({ url: `file:${databasePath}` });
    await client.batch(
      [
        `CREATE TABLE invites (
          id text PRIMARY KEY NOT NULL,
          token text NOT NULL,
          sender_id text NOT NULL,
          recipient_name text NOT NULL,
          recipient_email text NOT NULL
        )`,
        `CREATE TABLE date_plans (
          id text PRIMARY KEY NOT NULL,
          timezone text NOT NULL DEFAULT 'UTC',
          selected_entree text,
          selected_activities text NOT NULL DEFAULT '[]',
          selected_entree_venue text,
          selected_activity_venues text NOT NULL DEFAULT '{}'
        )`,
      ],
      "write",
    );
    client.close();

    await expect(
      execFileAsync(process.execPath, ["scripts/migrate.mjs"], {
        env: {
          ...process.env,
          TURSO_DATABASE_URL: `file:${databasePath}`,
          TURSO_AUTH_TOKEN: "",
        },
      }),
    ).rejects.toThrow("partial foundation schema");

    const unchanged = createClient({ url: `file:${databasePath}` });
    try {
      const planColumns = await unchanged.execute("PRAGMA table_info(date_plans)");
      expect(planColumns.rows.map((row) => row.name)).not.toContain("notification_mode");
      const migrations = await unchanged.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_migrations'",
      );
      expect(migrations.rows).toHaveLength(0);
    } finally {
      unchanged.close();
    }
  });
});

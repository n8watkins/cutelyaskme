import { createClient } from "@libsql/client";
import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
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
          "plan_timezone_backfills",
          "service_budgets",
        ]),
      );
      const migrations = await client.execute("SELECT id FROM app_migrations ORDER BY id");
      expect(migrations.rows.map((row) => row.id)).toEqual([
        "0000_baseline.sql",
        "0001_wave0_foundation.sql",
        "0002_notification_outbox_expansion.sql",
        "0003_plan_timezone_verification.sql",
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
          LEGACY_PLAN_TIMEZONES: JSON.stringify({
            "plan-1": "America/Los_Angeles",
          }),
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
      const plans = await migratedClient.execute(
        "SELECT timezone FROM date_plans WHERE id = 'plan-1'",
      );
      expect(plans.rows[0]?.timezone).toBe("America/Los_Angeles");
      const migrations = await migratedClient.execute(
        "SELECT id FROM app_migrations ORDER BY id",
      );
      expect(migrations.rows.map((row) => row.id)).toEqual([
        "0000_baseline.sql",
        "0001_wave0_foundation.sql",
        "0002_notification_outbox_expansion.sql",
        "0003_plan_timezone_verification.sql",
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
      {
        env: {
          ...process.env,
          LEGACY_PLAN_TIMEZONES: JSON.stringify({
            "snapshot-plan": "America/New_York",
          }),
        },
      },
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

  it("validates post-migration plans without requiring historical audit rows", async () => {
    const environment = {
      ...process.env,
      TURSO_DATABASE_URL: `file:${databasePath}`,
      TURSO_AUTH_TOKEN: "",
    };
    await execFileAsync(process.execPath, ["scripts/migrate.mjs"], {
      env: environment,
    });
    const client = createClient({ url: `file:${databasePath}` });
    try {
      await client.execute({
        sql: `
          INSERT INTO date_plans (id, sender_id, timezone, created_at)
          VALUES (?, ?, ?, datetime('now', '+1 minute'))
        `,
        args: ["post-migration-plan", "sender-1", "America/Chicago"],
      });
    } finally {
      client.close();
    }

    const result = await execFileAsync(
      process.execPath,
      ["scripts/validate-migration-copy.mjs", databasePath],
      { env: process.env },
    );
    expect(result.stdout).toContain("Validated migration on an isolated copy");

    const original = createClient({ url: `file:${databasePath}` });
    try {
      const audits = await original.execute(
        "SELECT plan_id FROM plan_timezone_backfills",
      );
      expect(audits.rows).toHaveLength(0);
      const plan = await original.execute(
        "SELECT timezone FROM date_plans WHERE id = 'post-migration-plan'",
      );
      expect(plan.rows[0]?.timezone).toBe("America/Chicago");
    } finally {
      original.close();
    }
  });

  it("rejects a migrated copy missing a historical timezone audit", async () => {
    const environment = {
      ...process.env,
      TURSO_DATABASE_URL: `file:${databasePath}`,
      TURSO_AUTH_TOKEN: "",
    };
    await execFileAsync(process.execPath, ["scripts/migrate.mjs"], {
      env: environment,
    });
    const client = createClient({ url: `file:${databasePath}` });
    try {
      await client.batch(
        [
          `INSERT INTO date_plans (id, sender_id, timezone, created_at)
           VALUES ('historical-plan', 'sender-1', 'America/New_York', '2000-01-01 00:00:00')`,
          `INSERT INTO plan_timezone_backfills (
             plan_id, previous_timezone, verified_timezone
           ) VALUES ('historical-plan', 'UTC', 'America/New_York')`,
          "DELETE FROM plan_timezone_backfills WHERE plan_id = 'historical-plan'",
        ],
        "write",
      );
    } finally {
      client.close();
    }

    await expect(
      execFileAsync(
        process.execPath,
        ["scripts/validate-migration-copy.mjs", databasePath],
        { env: process.env },
      ),
    ).rejects.toThrow("Per-plan timezone verification is incomplete");
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

  it("refuses to reinterpret legacy plans without complete per-plan timezones", async () => {
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
          selected_entree text,
          selected_activities text NOT NULL DEFAULT '[]',
          selected_entree_venue text,
          selected_activity_venues text NOT NULL DEFAULT '{}'
        )`,
        `CREATE TABLE push_subscriptions (
          id text PRIMARY KEY NOT NULL,
          user_id text NOT NULL
        )`,
        "INSERT INTO date_plans (id) VALUES ('legacy-plan')",
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
          LEGACY_PLAN_TIMEZONES: JSON.stringify({}),
        },
      }),
    ).rejects.toThrow("exactly one entry for every existing plan id");

    const unchanged = createClient({ url: `file:${databasePath}` });
    try {
      const columns = await unchanged.execute("PRAGMA table_info(date_plans)");
      expect(columns.rows.map((row) => row.name)).not.toContain("timezone");
      const plans = await unchanged.execute("SELECT id FROM date_plans");
      expect(plans.rows).toEqual([expect.objectContaining({ id: "legacy-plan" })]);
    } finally {
      unchanged.close();
    }
  });

  it("repairs an already-applied UTC migration with per-plan timezones", async () => {
    const client = createClient({ url: `file:${databasePath}` });
    try {
      const baseline = await readFile(
        path.join(process.cwd(), "drizzle/0000_baseline.sql"),
        "utf8",
      );
      const statements = baseline
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);
      await client.batch(
        [
          ...statements,
          `CREATE TABLE app_migrations (
            id text PRIMARY KEY NOT NULL,
            applied_at text NOT NULL DEFAULT (datetime('now'))
          )`,
          "INSERT INTO app_migrations (id) VALUES ('0000_baseline.sql'), ('0001_wave0_foundation.sql'), ('0002_notification_outbox_expansion.sql')",
          "INSERT INTO date_plans (id, sender_id, timezone) VALUES ('west-plan', 'sender', 'UTC'), ('east-plan', 'sender', 'UTC')",
        ],
        "write",
      );
    } finally {
      client.close();
    }

    await execFileAsync(process.execPath, ["scripts/migrate.mjs"], {
      env: {
        ...process.env,
        TURSO_DATABASE_URL: `file:${databasePath}`,
        TURSO_AUTH_TOKEN: "",
        LEGACY_PLAN_TIMEZONES: JSON.stringify({
          "west-plan": "America/Los_Angeles",
          "east-plan": "America/New_York",
        }),
      },
    });

    const migrated = createClient({ url: `file:${databasePath}` });
    try {
      const plans = await migrated.execute(
        "SELECT id, timezone FROM date_plans ORDER BY id",
      );
      expect(plans.rows).toEqual([
        expect.objectContaining({ id: "east-plan", timezone: "America/New_York" }),
        expect.objectContaining({ id: "west-plan", timezone: "America/Los_Angeles" }),
      ]);
      const audit = await migrated.execute(
        "SELECT plan_id, previous_timezone, verified_timezone FROM plan_timezone_backfills ORDER BY plan_id",
      );
      expect(audit.rows).toEqual([
        expect.objectContaining({
          plan_id: "east-plan",
          previous_timezone: "UTC",
          verified_timezone: "America/New_York",
        }),
        expect.objectContaining({
          plan_id: "west-plan",
          previous_timezone: "UTC",
          verified_timezone: "America/Los_Angeles",
        }),
      ]);
    } finally {
      migrated.close();
    }
  });
});

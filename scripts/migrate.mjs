import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createClient } from "@libsql/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "drizzle");
const baselineMigration = "0000_baseline.sql";
const foundationMigration = "0001_wave0_foundation.sql";
const outboxMigration = "0002_notification_outbox_expansion.sql";
const timezoneVerificationMigration = "0003_plan_timezone_verification.sql";
const url = process.env.TURSO_DATABASE_URL;

function isValidTimeZone(value) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function parsePlanTimezoneBackfills(value, planIds) {
  let parsed;
  try {
    parsed = JSON.parse(value ?? "");
  } catch {
    throw new Error(
      "LEGACY_PLAN_TIMEZONES must be a JSON object mapping every existing plan id to its IANA timezone",
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "LEGACY_PLAN_TIMEZONES must be a JSON object mapping every existing plan id to its IANA timezone",
    );
  }

  const suppliedIds = Object.keys(parsed).sort();
  const expectedIds = [...planIds].sort();
  if (JSON.stringify(suppliedIds) !== JSON.stringify(expectedIds)) {
    throw new Error(
      "LEGACY_PLAN_TIMEZONES must contain exactly one entry for every existing plan id",
    );
  }

  return new Map(
    expectedIds.map((planId) => {
      const timezone = parsed[planId];
      if (typeof timezone !== "string" || !isValidTimeZone(timezone)) {
        throw new Error(`LEGACY_PLAN_TIMEZONES contains an invalid timezone for ${planId}`);
      }
      return [planId, timezone];
    }),
  );
}

if (!url) {
  throw new Error("TURSO_DATABASE_URL is required");
}

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

try {
  const schemaTables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  const tableNames = new Set(schemaTables.rows.map((row) => String(row.name)));
  const hadPlansTable = tableNames.has("date_plans");
  async function columnsFor(table) {
    if (!tableNames.has(table)) return new Set();
    const result = await client.execute(`PRAGMA table_info("${table}")`);
    return new Set(result.rows.map((row) => String(row.name)));
  }

  const [planColumns, inviteColumns, stopColumns, budgetColumns, jobColumns] =
    await Promise.all([
      columnsFor("date_plans"),
      columnsFor("invites"),
      columnsFor("plan_stops"),
      columnsFor("service_budgets"),
      columnsFor("notification_jobs"),
    ]);
  const indexResult = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'index'",
  );
  const indexNames = new Set(indexResult.rows.map((row) => String(row.name)));
  const hasColumns = (columns, required) =>
    required.every((column) => columns.has(column));
  const expandedOutbox =
    hasColumns(jobColumns, [
      "plan_id",
      "invite_id",
      "channel",
      "target_id",
      "kind",
      "status",
    ]) &&
    indexNames.has("notification_jobs_plan_delivery_unique") &&
    indexNames.has("notification_jobs_invite_delivery_unique");
  const legacyOutbox =
    hasColumns(jobColumns, ["plan_id", "channel", "kind", "status"]) &&
    indexNames.has("notification_jobs_delivery_unique");
  const foundationComplete =
    hasColumns(planColumns, ["timezone", "notification_mode", "revealed_at"]) &&
    hasColumns(inviteColumns, ["location_lat", "location_lng", "capability_version"]) &&
    hasColumns(stopColumns, [
      "plan_id",
      "position",
      "kind",
      "activity",
      "duration_minutes",
      "travel_minutes",
      "leg_mode",
    ]) &&
    hasColumns(budgetColumns, [
      "service",
      "subject_id",
      "window_start",
      "window_end",
      "count",
      "limit_value",
    ]) &&
    indexNames.has("plan_stops_plan_position_unique") &&
    indexNames.has("service_budgets_window_unique") &&
    (legacyOutbox || expandedOutbox);
  const hasAnyFoundationMarker =
    tableNames.has("plan_stops") ||
    tableNames.has("service_budgets") ||
    tableNames.has("notification_jobs") ||
    ["timezone", "notification_mode", "revealed_at"].some((column) =>
      planColumns.has(column),
    ) ||
    ["location_lat", "location_lng", "capability_version"].some((column) =>
      inviteColumns.has(column),
    );

  if (hadPlansTable && hasAnyFoundationMarker && !foundationComplete) {
    throw new Error(
      "Refusing to adopt a partial foundation schema; restore a complete snapshot or repair it explicitly",
    );
  }

  const existingApplied = new Set();
  if (tableNames.has("app_migrations")) {
    const existingLedger = await client.execute("SELECT id FROM app_migrations");
    for (const row of existingLedger.rows) existingApplied.add(String(row.id));
  }
  let planTimezoneBackfills = new Map();
  if (hadPlansTable && !existingApplied.has(timezoneVerificationMigration)) {
    const existingPlans = await client.execute("SELECT id FROM date_plans ORDER BY id");
    const planIds = existingPlans.rows.map((row) => String(row.id));
    if (planIds.length > 0) {
      planTimezoneBackfills = parsePlanTimezoneBackfills(
        process.env.LEGACY_PLAN_TIMEZONES,
        planIds,
      );
    }
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedResult = await client.execute("SELECT id FROM app_migrations");
  const applied = new Set(appliedResult.rows.map((row) => String(row.id)));
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (!hadPlansTable && !applied.has(baselineMigration)) {
    const baselineSql = await readFile(
      path.join(migrationsDirectory, baselineMigration),
      "utf8",
    );
    const statements = baselineSql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    await client.batch(
      [
        ...statements,
        {
          sql: "INSERT INTO app_migrations (id) VALUES (?), (?)",
          args: [baselineMigration, foundationMigration],
        },
      ],
      "write",
    );
    applied.add(baselineMigration);
    applied.add(foundationMigration);
    process.stdout.write(`Applied ${baselineMigration}\n`);
  } else if (hadPlansTable) {
    if (!applied.has(baselineMigration)) {
      await client.execute({
        sql: "INSERT INTO app_migrations (id) VALUES (?)",
        args: [baselineMigration],
      });
      applied.add(baselineMigration);
      process.stdout.write(`Adopted ${baselineMigration}\n`);
    }
    if (foundationComplete && !applied.has(foundationMigration)) {
      await client.execute({
        sql: "INSERT INTO app_migrations (id) VALUES (?)",
        args: [foundationMigration],
      });
      applied.add(foundationMigration);
      process.stdout.write(`Adopted ${foundationMigration}\n`);
    }
    if (expandedOutbox && !applied.has(outboxMigration)) {
      await client.execute({
        sql: "INSERT INTO app_migrations (id) VALUES (?)",
        args: [outboxMigration],
      });
      applied.add(outboxMigration);
      process.stdout.write(`Adopted ${outboxMigration}\n`);
    }
  }

  for (const file of migrationFiles) {
    if (applied.has(file)) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    if (file === timezoneVerificationMigration) {
      for (const [planId, timezone] of planTimezoneBackfills) {
        statements.push({
          sql: `INSERT INTO plan_timezone_backfills (
            plan_id, previous_timezone, verified_timezone
          ) SELECT id, timezone, ? FROM date_plans WHERE id = ?`,
          args: [timezone, planId],
        });
        statements.push({
          sql: "UPDATE date_plans SET timezone = ? WHERE id = ?",
          args: [timezone, planId],
        });
      }
    }

    await client.batch(
      [
        ...statements,
        {
          sql: "INSERT INTO app_migrations (id) VALUES (?)",
          args: [file],
        },
      ],
      "write",
    );

    process.stdout.write(`Applied ${file}\n`);
  }
} finally {
  await client.close();
}

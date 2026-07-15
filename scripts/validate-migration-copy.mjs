import { createClient } from "@libsql/client";
import { execFile } from "node:child_process";
import { access, copyFile, mkdtemp, readdir, realpath, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const sourceArgument = process.argv[2];

if (!sourceArgument || sourceArgument.startsWith("-")) {
  throw new Error(
    "Usage: npm run db:migrate:validate-copy -- /absolute/path/to/offline-staging-snapshot.db",
  );
}

const sourcePath = await realpath(path.resolve(sourceArgument));
const sourceStat = await stat(sourcePath);
if (!sourceStat.isFile()) {
  throw new Error("Migration validation source must be a local database file");
}
await access(`${sourcePath}-wal`)
  .then(() => {
    throw new Error(
      "Snapshot has an active WAL file; checkpoint and close it before validation",
    );
  })
  .catch((error) => {
    if ((error && error.code) !== "ENOENT") throw error;
  });

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "cutelyaskme-migration-"));
const copyPath = path.join(temporaryDirectory, "validation.db");

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function tableCounts(client) {
  const tables = await client.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);
  const counts = new Map();
  for (const row of tables.rows) {
    const name = String(row.name);
    const result = await client.execute(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(name)}`,
    );
    counts.set(name, Number(result.rows[0]?.count ?? 0));
  }
  return counts;
}

try {
  await copyFile(sourcePath, copyPath);
  const beforeClient = createClient({ url: `file:${copyPath}` });
  const before = await tableCounts(beforeClient);
  beforeClient.close();

  const migration = await execFileAsync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TURSO_DATABASE_URL: `file:${copyPath}`,
      TURSO_AUTH_TOKEN: "",
    },
  });

  const afterClient = createClient({ url: `file:${copyPath}` });
  try {
    const integrity = await afterClient.execute("PRAGMA integrity_check");
    if (integrity.rows.some((row) => row.integrity_check !== "ok")) {
      throw new Error("SQLite integrity check failed after migration");
    }
    const foreignKeys = await afterClient.execute("PRAGMA foreign_key_check");
    if (foreignKeys.rows.length > 0) {
      throw new Error("Foreign key check failed after migration");
    }

    const after = await tableCounts(afterClient);
    for (const [table, count] of before) {
      const migratedCount = after.get(table);
      if (migratedCount === undefined || migratedCount < count) {
        throw new Error(
          `Row preservation check failed for ${table}: ${count} before, ${migratedCount ?? 0} after`,
        );
      }
    }

    const required = [
      "app_migrations",
      "date_plans",
      "invites",
      "notification_jobs",
      "plan_stops",
      "service_budgets",
    ];
    for (const table of required) {
      if (!after.has(table)) throw new Error(`Required table is missing: ${table}`);
    }
    const requiredColumns = {
      invites: ["location_lat", "location_lng", "capability_version"],
      date_plans: ["timezone", "notification_mode", "revealed_at"],
      plan_stops: ["position", "duration_minutes", "travel_minutes", "leg_mode"],
      notification_jobs: ["plan_id", "invite_id", "target_id", "kind", "status", "attempts"],
      service_budgets: ["subject_id", "window_start", "window_end", "limit_value"],
    };
    for (const [table, columns] of Object.entries(requiredColumns)) {
      const info = await afterClient.execute(`PRAGMA table_info(${quoteIdentifier(table)})`);
      const actual = new Set(info.rows.map((row) => String(row.name)));
      for (const column of columns) {
        if (!actual.has(column)) throw new Error(`Required column is missing: ${table}.${column}`);
      }
    }
    const missingTimezones = await afterClient.execute(
      "SELECT id FROM date_plans WHERE timezone IS NULL LIMIT 1",
    );
    if (missingTimezones.rows.length > 0) {
      throw new Error(
        `Timezone backfill is incomplete for plan ${missingTimezones.rows[0].id}`,
      );
    }
    const planColumnInfo = await afterClient.execute("PRAGMA table_info(date_plans)");
    const timezoneColumn = planColumnInfo.rows.find((row) => row.name === "timezone");
    if (Number(timezoneColumn?.notnull ?? 0) !== 1) {
      const timezoneTriggers = await afterClient.execute(`
        SELECT name FROM sqlite_master
        WHERE type = 'trigger' AND name IN (
          'date_plans_timezone_insert_required',
          'date_plans_timezone_update_required'
        )
      `);
      if (timezoneTriggers.rows.length !== 2) {
        throw new Error("Legacy plan timezone constraints are missing");
      }
    }

    const requiredIndexes = [
      "notification_jobs_invite_delivery_unique",
      "notification_jobs_plan_delivery_unique",
      "plan_stops_plan_position_unique",
      "service_budgets_window_unique",
    ];
    const indexes = await afterClient.execute(
      "SELECT name FROM sqlite_master WHERE type = 'index'",
    );
    const indexNames = new Set(indexes.rows.map((row) => String(row.name)));
    for (const index of requiredIndexes) {
      if (!indexNames.has(index)) throw new Error(`Required index is missing: ${index}`);
    }

    const migrationFiles = (await readdir(path.join(process.cwd(), "drizzle")))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const applied = await afterClient.execute("SELECT id FROM app_migrations ORDER BY id");
    if (JSON.stringify(applied.rows.map((row) => row.id)) !== JSON.stringify(migrationFiles)) {
      throw new Error("Applied migration ledger does not match migration files");
    }

    const missingBackfills = await afterClient.execute(`
      SELECT p.id
      FROM date_plans p
      WHERE
        (json_valid(p.selected_activities) AND EXISTS (
          SELECT 1 FROM json_each(p.selected_activities) activity
          WHERE NOT EXISTS (
            SELECT 1 FROM plan_stops s
            WHERE s.plan_id = p.id AND s.kind = 'activity' AND s.activity = activity.value
          )
        ))
        OR (
          p.selected_entree IS NOT NULL
          AND trim(p.selected_entree) <> ''
          AND p.selected_entree <> 'Surprise me'
          AND NOT EXISTS (
            SELECT 1 FROM plan_stops s
            WHERE s.plan_id = p.id AND s.kind = 'entree' AND s.activity = p.selected_entree
          )
        )
      LIMIT 1
    `);
    if (missingBackfills.rows.length > 0) {
      throw new Error(`Normalized stop backfill is incomplete for plan ${missingBackfills.rows[0].id}`);
    }

    await execFileAsync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TURSO_DATABASE_URL: `file:${copyPath}`,
        TURSO_AUTH_TOKEN: "",
      },
    });
    const afterSecondRun = await tableCounts(afterClient);
    for (const [table, count] of after) {
      if (afterSecondRun.get(table) !== count) {
        throw new Error(`Migration is not idempotent for table ${table}`);
      }
    }

    process.stdout.write(migration.stdout);
    process.stdout.write(
      `Validated migration on an isolated copy of ${sourcePath}\n` +
        `Preserved ${before.size} pre-existing tables; schema, backfills, integrity, foreign keys, and idempotence are valid\n`,
    );
  } finally {
    afterClient.close();
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

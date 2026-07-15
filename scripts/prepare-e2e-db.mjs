import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const url = process.env.TURSO_DATABASE_URL;

if (!url?.startsWith("file:")) {
  throw new Error("E2E tests require a local file TURSO_DATABASE_URL");
}

const databasePath = path.resolve(
  process.cwd(),
  fileURLToPath(new URL(url)),
);

await Promise.all([
  rm(databasePath, { force: true }),
  rm(`${databasePath}-shm`, { force: true }),
  rm(`${databasePath}-wal`, { force: true }),
]);
await execFileAsync(process.execPath, ["scripts/migrate.mjs"], {
  cwd: process.cwd(),
  env: process.env,
});

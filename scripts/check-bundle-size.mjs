// Reports the gzipped first-load JavaScript of every App Router page in the
// last `next build`, and fails when a page grows past its budget in
// bundle-budget.json. In GitHub Actions it also writes the table to the job
// summary. Run it after `npm run build`: `npm run size`.
import { appendFile, readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const nextDir = path.join(root, ".next");
const budgets = JSON.parse(await readFile(path.join(root, "bundle-budget.json"), "utf8"));

function findManifests(directory) {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return findManifests(full);
    return name === "page_client-reference-manifest.js" ? [full] : [];
  });
}

const gzipCache = new Map();
async function gzipBytes(file) {
  if (!gzipCache.has(file)) {
    const contents = await readFile(path.join(nextDir, file));
    gzipCache.set(file, gzipSync(contents, { level: 9 }).length);
  }
  return gzipCache.get(file);
}

const buildManifest = JSON.parse(
  await readFile(path.join(nextDir, "build-manifest.json"), "utf8"),
);
const shared = [...buildManifest.rootMainFiles];

const rows = [];
for (const file of findManifests(path.join(nextDir, "server", "app"))) {
  const sandbox = { globalThis: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(await readFile(file, "utf8"), sandbox);
  for (const [key, manifest] of Object.entries(sandbox.__RSC_MANIFEST)) {
    const route = key.replace(/\/page$/, "") || "/";
    if (route.startsWith("/_")) continue;
    const files = new Set(shared);
    for (const chunks of Object.values(manifest.entryJSFiles ?? {})) {
      for (const chunk of chunks) files.add(chunk);
    }
    let bytes = 0;
    for (const chunk of files) bytes += await gzipBytes(chunk);
    const budgetKb = budgets.routes?.[route] ?? budgets.defaultKb;
    rows.push({ route, kb: bytes / 1024, budgetKb });
  }
}

if (rows.length === 0) {
  console.error("No App Router pages found in .next: run `npm run build` first.");
  process.exit(1);
}

rows.sort((a, b) => a.route.localeCompare(b.route));
const over = rows.filter((row) => row.kb > row.budgetKb);
const table = [
  "| Page | First-load JS (gzip) | Budget | |",
  "|---|---:|---:|---|",
  ...rows.map(
    (row) =>
      `| \`${row.route}\` | ${row.kb.toFixed(1)} kB | ${row.budgetKb} kB | ${row.kb > row.budgetKb ? "over" : "ok"} |`,
  ),
].join("\n");

console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Bundle size\n\n${table}\n`);
}
if (over.length > 0) {
  console.error(
    `\n${over.length} page(s) over budget: ${over.map((row) => row.route).join(", ")}.` +
      " Trim the bundle, or raise the budget in bundle-budget.json on purpose.",
  );
  process.exit(1);
}

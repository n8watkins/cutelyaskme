import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// PLAYWRIGHT_PORT lets a local run sit beside `npm run dev`, which uses 1437.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 1437);
const baseURL = `http://127.0.0.1:${port}`;
const artifactsDirectory = "node_modules/.cache/playwright";
const databasePath = path.join(process.cwd(), ".playwright-e2e.db");

process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
process.env.TURSO_AUTH_TOKEN = "";
process.env.PLAN_CAPABILITY_SECRET =
  "playwright-plan-capability-secret-with-thirty-two-bytes";
process.env.PLAYWRIGHT_E2E = "1";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??=
  "pk_live_Y2xlcmsuZXhhbXBsZS50ZXN0JA";
process.env.CLERK_SECRET_KEY ??= "sk_live_playwright-not-a-production-secret";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  outputDir: `${artifactsDirectory}/test-results`,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: `${artifactsDirectory}/report` }]]
    : [["list"], ["html", { open: "never", outputFolder: `${artifactsDirectory}/report` }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/prepare-e2e-db.mjs && npm run build && npm run start -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--mute-audio"] } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"], launchOptions: { args: ["--mute-audio"] } },
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const port = 1437;
const baseURL = `http://127.0.0.1:${port}`;
const artifactsDirectory = "node_modules/.cache/playwright";
const databasePath = path.join(process.cwd(), ".playwright-e2e.db");

process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
process.env.TURSO_AUTH_TOKEN = "";
process.env.PLAN_CAPABILITY_SECRET =
  "playwright-plan-capability-secret-with-thirty-two-bytes";

// Optional: a Clerk *development* instance's keys turn on the auth specs
// (e2e/clerk-auth.spec.ts), which render the real Clerk widgets under the
// production CSP and create a throwaway email account. Without them the app
// runs with placeholder keys and ClerkProvider is left out of the layout.
const clerkTestPublishableKey = process.env.E2E_CLERK_PUBLISHABLE_KEY;
const clerkTestSecretKey = process.env.E2E_CLERK_SECRET_KEY;
if (clerkTestPublishableKey?.startsWith("pk_test_") && clerkTestSecretKey?.startsWith("sk_test_")) {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = clerkTestPublishableKey;
  process.env.CLERK_SECRET_KEY = clerkTestSecretKey;
  process.env.PLAYWRIGHT_E2E = "0";
} else {
  process.env.PLAYWRIGHT_E2E = "1";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??=
    "pk_live_Y2xlcmsuZXhhbXBsZS50ZXN0JA";
  process.env.CLERK_SECRET_KEY ??= "sk_live_playwright-not-a-production-secret";
}

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
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],
});

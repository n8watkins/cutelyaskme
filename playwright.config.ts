import { defineConfig, devices } from "@playwright/test";

const port = 1437;
const baseURL = `http://127.0.0.1:${port}`;
const artifactsDirectory = "node_modules/.cache/playwright";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
    command: `npm run build && npm run start -- -p ${port}`,
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

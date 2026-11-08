import { expect, test, type Page } from "@playwright/test";

// These specs need a Clerk development instance (see playwright.config.ts).
// They guard the two launch blockers from the November 2026 review: the
// sign-in widget rendering unstyled under the CSP, and "Sign up" looping back
// to the sign-in page.
const clerkEnabled = process.env.PLAYWRIGHT_E2E === "0";
const clerkSecretKey = process.env.CLERK_SECRET_KEY ?? "";

test.skip(!clerkEnabled, "Set E2E_CLERK_PUBLISHABLE_KEY and E2E_CLERK_SECRET_KEY to run");

function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) {
      violations.push(`${new URL(page.url()).pathname}: ${message.text()}`);
    }
  });
  return violations;
}

// Clerk's documented testing-token flow (what @clerk/testing does): append
// the token to Frontend API calls and mark the client as captcha-exempt, so
// the bot-protection challenge does not block an automated sign-up.
async function bypassClerkBotProtection(page: Page) {
  const response = await fetch("https://api.clerk.com/v1/testing_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${clerkSecretKey}` },
  });
  expect(response.ok).toBe(true);
  const { token } = (await response.json()) as { token: string };
  await page.route(/\.clerk\.accounts\.dev\/v1\//, async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set("__clerk_testing_token", token);
    const upstream = await route.fetch({ url: url.toString() });
    let json: { response?: { captcha_bypass?: boolean }; client?: { captcha_bypass?: boolean } };
    try {
      json = await upstream.json();
    } catch {
      await route.fulfill({ response: upstream });
      return;
    }
    if (json.response?.captcha_bypass === false) json.response.captcha_bypass = true;
    if (json.client?.captcha_bypass === false) json.client.captcha_bypass = true;
    await route.fulfill({ response: upstream, json });
  });
}

async function deleteClerkUsersByEmail(email: string) {
  const headers = { Authorization: `Bearer ${clerkSecretKey}` };
  const list = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
    { headers },
  );
  const users = (await list.json()) as { id: string }[];
  for (const user of users) {
    await fetch(`https://api.clerk.com/v1/users/${user.id}`, { method: "DELETE", headers });
  }
}

test("sign-in modal is styled and the page has no CSP violations", async ({ page }) => {
  const violations = collectCspViolations(page);
  await page.goto("/dashboard");
  const card = page.locator(".cl-modalContent .cl-card").first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  // Unstyled Clerk markup has no box: the card only gets a background,
  // radius and shadow from Clerk's injected (nonce-carrying) styles.
  const cardStyle = await card.evaluate((element) => {
    const style = getComputedStyle(element);
    return { radius: style.borderRadius, shadow: style.boxShadow };
  });
  expect(cardStyle.radius).not.toBe("0px");
  expect(cardStyle.shadow).not.toBe("none");
  expect(violations).toEqual([]);
});

test("signed-out visitors keep their page and get the sign-in modal", async ({ page }) => {
  const violations = collectCspViolations(page);
  // The home page prefetches /send; a redirect to Clerk's hosted page used to
  // break that prefetch under the CSP.
  await page.goto("/");
  await page.getByRole("link", { name: "Plan a date" }).click();
  await expect(page).toHaveURL(/\/send$/);
  const modal = page.locator(".cl-modalContent").first();
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await expect(modal.locator(".cl-signIn-root")).toBeVisible();
  expect(violations).toEqual([]);
});

test("old /login links open the same modal", async ({ page }) => {
  await page.goto("/login?redirect_url=/dashboard");
  await expect(page.locator(".cl-modalContent").first()).toBeVisible({ timeout: 15_000 });
});

test("a visitor can create an account with email and password", async ({ page }) => {
  const violations = collectCspViolations(page);
  const email = `cutely-e2e-${Date.now()}+clerk_test@example.com`;
  await bypassClerkBotProtection(page);
  try {
    await page.goto("/dashboard");
    // The modal signs in or signs up from one email field; a new address
    // continues to sign-up inside the same modal, on the same page.
    const modal = page.locator(".cl-modalContent").first();
    await modal.getByLabel("Email address").fill(email);
    await modal.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(modal.getByText("Create your account")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard$/);
    await modal.getByLabel("Password", { exact: true }).fill(`Cutely-${crypto.randomUUID()}`);
    await modal.getByRole("button", { name: "Continue", exact: true }).click();
    // Clerk test addresses (+clerk_test) accept the fixed code 424242.
    const code = page.locator('input[autocomplete="one-time-code"]').first();
    await expect(code).toBeVisible({ timeout: 15_000 });
    await code.click();
    await page.keyboard.type("424242");
    // Signed in, the same address reloads (through Clerk's handshake in a
    // development instance) as the real dashboard.
    await expect(page).toHaveURL(/^[^?]*\/dashboard$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Sign in to keep going" })).toHaveCount(0, {
      timeout: 30_000,
    });
    expect(violations).toEqual([]);
  } finally {
    await deleteClerkUsersByEmail(email);
  }
});

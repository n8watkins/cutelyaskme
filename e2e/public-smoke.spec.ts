import { expect, test } from "@playwright/test";

test.describe("public experience", () => {
  test("home page presents the primary public actions", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Date Night" }),
    ).toBeVisible();
    await expect(
      page.getByText("Plan a date, send an invite, and let them pick what sounds good."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Plan a date" })).toHaveAttribute(
      "href",
      "/send",
    );
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("name-based invite starts the recipient journey", async ({ page }) => {
    await page.goto("/invite/Playwright");

    await expect(page).toHaveTitle(/Playwright, you're invited on a date/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Playwright..." }),
    ).toBeVisible();
    await expect(
      page.getByText("Will you go on a date with me?"),
    ).toBeVisible();

    const accept = page.getByRole("button", { name: "Yes!" });
    await expect(accept).toBeEnabled();
    await accept.click();

    await expect(
      page.getByRole("heading", { level: 1, name: "What day feels sweet?" }),
    ).toBeVisible();
  });

  test("responses carry the browser security baseline", async ({ request }) => {
    const response = await request.get("/");
    const contentSecurityPolicy = response.headers()["content-security-policy"];
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy).toContain("'strict-dynamic'");
    expect(contentSecurityPolicy).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(contentSecurityPolicy).not.toContain("'unsafe-inline'");
    expect(contentSecurityPolicy).not.toContain("'unsafe-eval'");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["strict-transport-security"]).toContain("max-age=63072000");
  });
});

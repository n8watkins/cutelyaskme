import { expect, test } from "@playwright/test";
import { createClient } from "@libsql/client";

test.describe("public experience", () => {
  // Fixed device timezone so the detected-timezone default is deterministic.
  test.use({ timezoneId: "America/Los_Angeles" });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

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
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/invite/Playwright");

    await expect(page).toHaveTitle(/Playwright, you're invited on a date/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Playwright..." }),
    ).toBeVisible();
    await expect(
      page.getByText("Will you go on a date with me?"),
    ).toBeVisible();

    const accept = page.getByRole("button", { name: "Yes!" });
    const decline = page.getByRole("button", { name: "No", exact: true });
    await expect(accept).toBeEnabled();
    // Buttons keep their Tailwind type scale: no global rule may override
    // the "text-2xl font-black" on the main call to action.
    expect(
      await accept.evaluate((button) => {
        const style = getComputedStyle(button);
        return { size: style.fontSize, weight: style.fontWeight };
      }),
    ).toEqual({ size: "24px", weight: "900" });
    const [acceptBounds, declineBounds] = await Promise.all([
      accept.boundingBox(),
      decline.boundingBox(),
    ]);
    expect(acceptBounds).not.toBeNull();
    expect(declineBounds).not.toBeNull();
    expect(
      acceptBounds!.x + acceptBounds!.width <= declineBounds!.x ||
        declineBounds!.x + declineBounds!.width <= acceptBounds!.x ||
        acceptBounds!.y + acceptBounds!.height <= declineBounds!.y ||
        declineBounds!.y + declineBounds!.height <= acceptBounds!.y,
    ).toBe(true);
    expect(
      await accept.evaluate((button) => {
        const bounds = button.getBoundingClientRect();
        return document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        ) === button;
      }),
    ).toBe(true);
    await accept.click();

    await expect(
      page.getByRole("heading", { level: 1, name: "What day feels sweet?" }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(
      consoleErrors.filter((message) => /hydration|React error #418/i.test(message)),
    ).toEqual([]);
  });

  test("anonymous invite completes with the detected event timezone", async ({ page, baseURL }) => {
    const token = crypto.randomUUID();
    const inviteId = crypto.randomUUID();
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    // The local SQLite file is shared with the app server; a remote libSQL
    // database (PLAYWRIGHT_BASE_URL runs) handles its own locking.
    if (process.env.TURSO_DATABASE_URL!.startsWith("file:")) {
      await client.execute("PRAGMA busy_timeout = 5000");
    }
    await client.execute({
      sql: `
        INSERT INTO invites (
          id, token, sender_id, recipient_name, recipient_email, location, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `,
      args: [
        inviteId,
        token,
        "sender-playwright",
        "Playwright",
        "recipient@example.test",
        "Los Angeles, CA",
      ],
    });

    try {
      await page.goto(`/invite/${token}`);
      expect(
        await page.evaluate(() =>
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
      ).toBe(true);
      await page.getByRole("button", { name: "Yes!" }).click();
      await expect(page.getByRole("heading", { name: "What day feels sweet?" })).toBeVisible();
      expect(
        await page.evaluate(() =>
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
      ).toBe(true);
      await expect(page.locator("main section")).toHaveCount(1);
      await expect(page.locator("canvas")).toHaveCount(0);
      // The first suggestion is "Today is actually open" on Fri-Sun and its evening slots
      // disappear as the day goes on; the second is always a later weekend day.
      await page.getByRole("button", { name: /Weekend energy/ }).click();
      await page.getByRole("button", { name: "continue" }).click();
      await expect(page.getByRole("button", { name: /6:30 PM/ })).toBeVisible();
      await expect(page.locator("main section")).toHaveCount(1);
      await page.getByRole("button", { name: /6:30 PM/ }).click();
      await page.getByRole("button", { name: "continue" }).click();
      await expect(page.getByRole("button", { name: /Bookstore/ })).toBeVisible();
      await expect(page.locator("main section")).toHaveCount(1);
      await page.getByRole("button", { name: /Bookstore/ }).click();
      await page.getByRole("button", { name: /Photo booth/ }).click();
      await page.getByRole("button", { name: /Bookstore.*Photo booth.*→/ }).click();
      await page.getByRole("button", { name: /Pizza/ }).click();
      await page.getByRole("button", { name: "add the fun" }).click();
      await page.getByRole("button", { name: /Keep it casual/ }).click();
      await page.getByRole("button", { name: "Almost there →" }).click();

      // The date's timezone defaults to the device zone (this context runs
      // in Los Angeles); the search is only an override.
      const lockIn = page.getByRole("button", { name: "Lock it in 🔒" });
      await expect(page.getByTestId("timezone-value")).toContainText(
        "Los Angeles - Pacific",
      );
      await expect(lockIn).toBeEnabled();
      await page.getByRole("button", { name: "Change the date timezone" }).click();
      await page.getByRole("combobox", { name: "Date timezone" }).fill("new yo");
      await page.getByRole("option", { name: /New York - Eastern/ }).click();
      await expect(page.getByTestId("timezone-value")).toContainText("New York - Eastern");
      await page.getByRole("button", { name: "Change the date timezone" }).click();
      await page.getByRole("combobox", { name: "Date timezone" }).fill("los angeles");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("timezone-value")).toContainText("Los Angeles - Pacific");
      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/plans") &&
          response.request().method() === "POST",
      );
      await lockIn.click();
      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBe(true);

      await expect(
        page.getByRole("heading", { level: 1, name: "It's a date! 🎉" }),
      ).toBeVisible({ timeout: 10_000 });
      const plan = await client.execute({
        sql: `
          SELECT date_plans.id, date_plans.timezone, invites.status
          FROM date_plans
          INNER JOIN invites ON invites.id = date_plans.invite_id
          WHERE invites.id = ?
        `,
        args: [inviteId],
      });
      expect(plan.rows[0]).toEqual(
        expect.objectContaining({
          timezone: "America/Los_Angeles",
          status: "completed",
        }),
      );
      const planId = String(plan.rows[0]?.id);
      const capabilityCookieName = `plan_capability_${planId}`;
      const setCookie = (await createResponse.allHeaders())["set-cookie"] ?? "";
      expect(setCookie).toContain(`${capabilityCookieName}=`);
      if (!(await page.context().cookies()).some((cookie) => cookie.name === capabilityCookieName)) {
        const cookiePair = setCookie.split(";", 1)[0];
        const separator = cookiePair.indexOf("=");
        await page.context().addCookies([{
          name: cookiePair.slice(0, separator),
          value: cookiePair.slice(separator + 1),
          url: baseURL!,
        }]);
      }

      const duplicate = await page.request.post("/api/plans", {
        data: { inviteToken: token, timezone: "America/Los_Angeles" },
      });
      expect(duplicate.status()).toBe(409);
      await page.getByRole("link", { name: "See the plan ✨" }).click();
      await expect(page).toHaveURL(`/plan/${planId}`);
    } finally {
      client.close();
    }
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

test.describe("invite celebration", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });

  test("uses confetti only on desktop when motion is allowed", async ({ page }) => {
    await page.goto("/invite/Playwright");

    const accept = page.getByRole("button", { name: "Yes!" });
    const decline = page.getByRole("button", { name: "No", exact: true });
    const expectSeparatedControls = async () => {
      const [acceptBounds, declineBounds] = await Promise.all([
        accept.boundingBox(),
        decline.boundingBox(),
      ]);
      expect(acceptBounds).not.toBeNull();
      expect(declineBounds).not.toBeNull();
      expect(
        acceptBounds!.x + acceptBounds!.width <= declineBounds!.x ||
          declineBounds!.x + declineBounds!.width <= acceptBounds!.x ||
          acceptBounds!.y + acceptBounds!.height <= declineBounds!.y ||
          declineBounds!.y + declineBounds!.height <= acceptBounds!.y,
      ).toBe(true);
    };

    await expectSeparatedControls();
    await decline.dispatchEvent("touchstart");
    await expectSeparatedControls();
    await accept.click();

    await expect(
      page.getByRole("heading", { level: 1, name: "What day feels sweet?" }),
    ).toBeVisible();

    const hasDesktopViewport = await page.evaluate(() =>
      window.matchMedia("(min-width: 640px)").matches,
    );
    await expect(page.locator("canvas")).toHaveCount(hasDesktopViewport ? 1 : 0);
  });
});

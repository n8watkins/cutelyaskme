import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// WCAG 2.1 A and AA rules on the public pages a recipient sees first.
// Pages behind sign-in are left out: CI runs Clerk with placeholder keys.
// Color contrast is known to fail (white on the #ff7aaa primary is 2.4:1) and is
// step 1 of docs/UX_PLAN_2026-11.md; turn the rule back on with that sweep.
const KNOWN_FAILING_RULES = ["color-contrast"];
async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .disableRules(KNOWN_FAILING_RULES)
    .analyze();
  expect(
    results.violations.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      targets: nodes.map((node) => node.target.join(" ")),
    })),
  ).toEqual([]);
}

test.describe("accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoViolations(page);
  });

  test("invite ask", async ({ page }) => {
    await page.goto("/invite/Playwright");
    await expect(page.getByRole("button", { name: "Yes!" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("first wizard step", async ({ page }) => {
    await page.goto("/invite/Playwright");
    await page.getByRole("button", { name: "Yes!" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "What day feels sweet?" }),
    ).toBeVisible();
    await expectNoViolations(page);
  });
});

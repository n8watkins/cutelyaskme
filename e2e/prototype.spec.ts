import { expect, test } from "@playwright/test";

// The UX prototype under /proposal is for `npm run dev` (or a PROTOTYPE=1
// build) only. The production build the suite runs must not serve it.
test.describe("UX prototype", () => {
  for (const path of ["/proposal", "/proposal/home", "/proposal/plan", "/proposal/their-plan"]) {
    test(`${path} is not served by a production build`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(404);
      expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
      expect(await response.text()).not.toContain("UX upgrade prototype");
    });
  }
});

import { describe, expect, it } from "vitest";
import { viewerDailyBudget } from "./api-budget";

describe("viewerDailyBudget", () => {
  it("keeps one viewer from consuming a large shared daily pool", () => {
    expect(viewerDailyBudget(300)).toBe(30);
    expect(viewerDailyBudget(150)).toBe(15);
  });

  it("does not exceed small application pools", () => {
    expect(viewerDailyBudget(30)).toBe(10);
    expect(viewerDailyBudget(5)).toBe(5);
  });
});

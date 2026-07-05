import { describe, it, expect } from "vitest";
import { mapPriceLevel } from "./venues";

describe("mapPriceLevel", () => {
  it("maps Google priceLevel enums to 1-4", () => {
    expect(mapPriceLevel("PRICE_LEVEL_FREE")).toBe(1);
    expect(mapPriceLevel("PRICE_LEVEL_INEXPENSIVE")).toBe(1);
    expect(mapPriceLevel("PRICE_LEVEL_MODERATE")).toBe(2);
    expect(mapPriceLevel("PRICE_LEVEL_EXPENSIVE")).toBe(3);
    expect(mapPriceLevel("PRICE_LEVEL_VERY_EXPENSIVE")).toBe(4);
  });
  it("defaults unknown or missing levels to 2", () => {
    expect(mapPriceLevel(undefined)).toBe(2);
    expect(mapPriceLevel("")).toBe(2);
    expect(mapPriceLevel("PRICE_LEVEL_UNSPECIFIED")).toBe(2);
  });
});

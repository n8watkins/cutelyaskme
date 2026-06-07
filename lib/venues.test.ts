import { describe, it, expect } from "vitest";
import { mapPrice } from "./venues";

describe("mapPrice", () => {
  it("maps Yelp price strings to 1-4", () => {
    expect(mapPrice("$")).toBe(1);
    expect(mapPrice("$$")).toBe(2);
    expect(mapPrice("$$$")).toBe(3);
    expect(mapPrice("$$$$")).toBe(4);
  });
  it("clamps and defaults", () => {
    expect(mapPrice("$$$$$$")).toBe(4);
    expect(mapPrice(undefined)).toBe(2);
    expect(mapPrice("")).toBe(2);
  });
});

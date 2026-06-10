import { describe, it, expect } from "vitest";
import { haversineMiles, formatMiles } from "./geo";

describe("haversineMiles", () => {
  it("is zero for identical points", () => {
    expect(haversineMiles({ lat: 34.05, lng: -118.24 }, { lat: 34.05, lng: -118.24 })).toBe(0);
  });

  it("LA city hall → Santa Monica pier ≈ 15 mi", () => {
    const d = haversineMiles({ lat: 34.0537, lng: -118.2428 }, { lat: 34.0084, lng: -118.4987 });
    expect(d).toBeGreaterThan(14);
    expect(d).toBeLessThan(16);
  });

  it("NYC → LA ≈ 2,450 mi", () => {
    const d = haversineMiles({ lat: 40.7128, lng: -74.006 }, { lat: 34.0522, lng: -118.2437 });
    expect(d).toBeGreaterThan(2400);
    expect(d).toBeLessThan(2500);
  });

  it("is symmetric", () => {
    const a = { lat: 37.77, lng: -122.42 };
    const b = { lat: 37.8, lng: -122.27 };
    expect(haversineMiles(a, b)).toBeCloseTo(haversineMiles(b, a), 10);
  });
});

describe("formatMiles", () => {
  it("shows one decimal under 10 miles", () => {
    expect(formatMiles(0.42)).toBe("0.4 mi");
    expect(formatMiles(9.96)).toBe("10.0 mi");
  });
  it("rounds whole miles at 10+", () => {
    expect(formatMiles(12.4)).toBe("12 mi");
  });
});

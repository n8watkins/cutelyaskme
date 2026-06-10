import { describe, it, expect } from "vitest";
import {
  roundCoord,
  osrmCoordPath,
  routeCacheKey,
  fallbackLeg,
  isWalkable,
  plausibleWalk,
  legInfoForMode,
  formatLegDuration,
  formatLeg,
  WALK_THRESHOLD_METERS,
  METERS_PER_MILE,
  type LegInfo,
} from "./route-legs";

const LA = { lat: 34.0537, lng: -118.2428 }; // city hall
const SM = { lat: 34.0084, lng: -118.4987 }; // Santa Monica pier (~15 mi away)

describe("roundCoord", () => {
  it("rounds to 4 decimals", () => {
    expect(roundCoord(34.05372901)).toBe(34.0537);
    expect(roundCoord(-118.24284)).toBe(-118.2428);
  });
});

describe("osrmCoordPath / routeCacheKey", () => {
  it("emits lon,lat pairs joined by semicolons", () => {
    expect(osrmCoordPath([LA, SM])).toBe("-118.2428,34.0537;-118.4987,34.0084");
  });

  it("collapses nearby coords onto the same cache key", () => {
    const jittered = { lat: 34.05370004, lng: -118.24280002 };
    expect(routeCacheKey([jittered, SM])).toBe(routeCacheKey([LA, SM]));
    expect(routeCacheKey([LA, SM])).toMatch(/^osrm:/);
  });

  it("different waypoint order is a different key", () => {
    expect(routeCacheKey([LA, SM])).not.toBe(routeCacheKey([SM, LA]));
  });
});

describe("fallbackLeg", () => {
  it("drive: haversine × 1.3 at 28 mph, flagged as estimate", () => {
    const leg = fallbackLeg(LA, SM, "drive");
    const miles = leg.distanceMeters / METERS_PER_MILE;
    // ~15 mi straight line × 1.3 ≈ 19–20 mi
    expect(miles).toBeGreaterThan(18);
    expect(miles).toBeLessThan(21);
    // duration consistent with 28 mph
    expect(leg.durationSec).toBeCloseTo((miles / 28) * 3600, -1);
    expect(leg.estimate).toBe(true);
  });

  it("walk: same distance but 3 mph", () => {
    const drive = fallbackLeg(LA, SM, "drive");
    const walk = fallbackLeg(LA, SM, "walk");
    expect(walk.distanceMeters).toBe(drive.distanceMeters);
    expect(walk.durationSec / drive.durationSec).toBeCloseTo(28 / 3, 1);
  });
});

describe("isWalkable", () => {
  it("true under 0.8 mi, false at/over", () => {
    expect(isWalkable(500)).toBe(true);
    expect(isWalkable(WALK_THRESHOLD_METERS - 1)).toBe(true);
    expect(isWalkable(WALK_THRESHOLD_METERS)).toBe(false);
    expect(isWalkable(5000)).toBe(false);
  });
});

describe("plausibleWalk", () => {
  const drive: LegInfo = { distanceMeters: 900, durationSec: 240, estimate: false };

  it("keeps a walk that is slower than driving", () => {
    const walk: LegInfo = { distanceMeters: 800, durationSec: 700, estimate: false };
    expect(plausibleWalk(drive, walk, LA, SM)).toBe(walk);
  });

  it("replaces a walk as fast as driving (demo server car data) with an estimate", () => {
    const bogus: LegInfo = { distanceMeters: 900, durationSec: 240, estimate: false };
    const result = plausibleWalk(drive, bogus, LA, SM);
    expect(result.estimate).toBe(true);
    expect(result.durationSec).toBeGreaterThan(drive.durationSec);
  });
});

describe("legInfoForMode", () => {
  const drive: LegInfo = { distanceMeters: 1000, durationSec: 180, estimate: false };
  const walk: LegInfo = { distanceMeters: 900, durationSec: 720, estimate: false };

  it("returns the chosen mode when available", () => {
    expect(legInfoForMode({ drive, walk }, "walk")).toBe(walk);
    expect(legInfoForMode({ drive, walk }, "drive")).toBe(drive);
  });

  it("falls back to drive when walk was never fetched", () => {
    expect(legInfoForMode({ drive, walk: null }, "walk")).toBe(drive);
  });
});

describe("formatLegDuration", () => {
  it("never shows under a minute", () => {
    expect(formatLegDuration(20)).toBe("1 min");
  });
  it("minutes under an hour", () => {
    expect(formatLegDuration(12 * 60)).toBe("12 min");
    expect(formatLegDuration(59.4 * 60)).toBe("59 min");
  });
  it("hours and minutes", () => {
    expect(formatLegDuration(3600)).toBe("1 hr");
    expect(formatLegDuration(65 * 60)).toBe("1 hr 5 min");
  });
});

describe("formatLeg", () => {
  it('renders "12 min · 4.3 mi"', () => {
    expect(
      formatLeg({ distanceMeters: 4.3 * METERS_PER_MILE, durationSec: 12 * 60, estimate: false }),
    ).toBe("12 min · 4.3 mi");
  });

  it("prefixes ~ for estimates", () => {
    expect(
      formatLeg({ distanceMeters: 0.5 * METERS_PER_MILE, durationSec: 4 * 60, estimate: true }),
    ).toBe("~4 min · 0.5 mi");
  });
});

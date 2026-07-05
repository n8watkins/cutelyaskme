import { describe, it, expect } from "vitest";
import {
  API_LIMITS,
  TRACKED_SERVICES,
  CLIENT_TRACKED_SERVICES,
  getApiLimit,
  capFraction,
  sanitizePlanId,
  usageKey,
} from "./api-limits";

describe("API_LIMITS registry", () => {
  it("covers the shared service-name contract", () => {
    for (const service of [
      "places-search",
      "places-details",
      "places-photos",
      "routes",
      "static-maps",
      "maps-js-loads",
      "overpass",
      "nws",
    ]) {
      expect(TRACKED_SERVICES).toContain(service);
    }
  });

  it("has unique service names and non-empty labels", () => {
    expect(new Set(TRACKED_SERVICES).size).toBe(API_LIMITS.length);
    for (const l of API_LIMITS) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.shortLabel.length).toBeGreaterThan(0);
    }
  });

  it("pairs a daily budget with every monthly cap, and neither on free services", () => {
    for (const l of API_LIMITS) {
      if (l.monthlyCap === null) {
        expect(l.dailyBudget).toBeNull();
      } else {
        expect(l.monthlyCap).toBeGreaterThan(0);
        expect(l.dailyBudget).toBeGreaterThan(0);
        expect(l.dailyBudget!).toBeLessThan(l.monthlyCap);
      }
    }
  });

  it("knows places-details is the scarcest capped SKU", () => {
    const caps = API_LIMITS.filter((l) => l.monthlyCap !== null);
    const scarcest = caps.reduce((a, b) => (b.monthlyCap! < a.monthlyCap! ? b : a));
    expect(scarcest.service).toBe("places-details");
    expect(scarcest.monthlyCap).toBe(1000);
  });

  it("labels uncapped services as free", () => {
    for (const service of ["overpass", "nws"]) {
      const l = getApiLimit(service)!;
      expect(l.monthlyCap).toBeNull();
      expect(l.label.toLowerCase()).toContain("free");
    }
  });

  it("only lets the client report map loads", () => {
    expect(CLIENT_TRACKED_SERVICES.has("maps-js-loads")).toBe(true);
    expect(CLIENT_TRACKED_SERVICES.has("places-details")).toBe(false);
  });
});

describe("getApiLimit", () => {
  it("finds registered services and misses unknown ones", () => {
    expect(getApiLimit("places-search")?.monthlyCap).toBe(5000);
    expect(getApiLimit("yelp")).toBeUndefined();
  });
});

describe("capFraction", () => {
  it("returns the consumed fraction, clamped to [0, 1]", () => {
    expect(capFraction(250, 1000)).toBe(0.25);
    expect(capFraction(2000, 1000)).toBe(1);
    expect(capFraction(-5, 1000)).toBe(0);
  });

  it("is null for uncapped or nonsense caps", () => {
    expect(capFraction(10, null)).toBeNull();
    expect(capFraction(10, 0)).toBeNull();
  });
});

describe("sanitizePlanId", () => {
  it("accepts plausible ids", () => {
    expect(sanitizePlanId("abc123")).toBe("abc123");
    expect(sanitizePlanId("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("rejects empty, missing, oversized, or weird input", () => {
    expect(sanitizePlanId(null)).toBeNull();
    expect(sanitizePlanId(undefined)).toBeNull();
    expect(sanitizePlanId("")).toBeNull();
    expect(sanitizePlanId("a".repeat(65))).toBeNull();
    expect(sanitizePlanId("has:colon")).toBeNull();
    expect(sanitizePlanId("has space")).toBeNull();
  });
});

describe("usageKey", () => {
  it("keys unattributed calls by service and day", () => {
    expect(usageKey("places-search", "2026-07-05")).toBe("places-search:2026-07-05");
    expect(usageKey("places-search", "2026-07-05", null)).toBe("places-search:2026-07-05");
  });

  it("gives plan-attributed calls their own row", () => {
    expect(usageKey("nws", "2026-07-05", "plan1")).toBe("nws:2026-07-05:plan1");
  });
});

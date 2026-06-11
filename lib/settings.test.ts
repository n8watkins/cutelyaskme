import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  parseMapZoomMode,
  parseSettingsPatch,
  mergeSettings,
} from "./settings";

describe("parseMapZoomMode", () => {
  it("returns plain only for the exact value, ctrl otherwise", () => {
    expect(parseMapZoomMode("plain")).toBe("plain");
    expect(parseMapZoomMode("ctrl")).toBe("ctrl");
    expect(parseMapZoomMode(null)).toBe("ctrl");
    expect(parseMapZoomMode("garbage")).toBe("ctrl");
  });
});

describe("parseSettingsPatch", () => {
  it("rejects non-objects", () => {
    expect(parseSettingsPatch(null).ok).toBe(false);
    expect(parseSettingsPatch("hi").ok).toBe(false);
    expect(parseSettingsPatch([1, 2]).ok).toBe(false);
  });

  it("accepts a valid full patch", () => {
    const r = parseSettingsPatch({
      defaultRadiusMi: 10,
      radiusMinMi: 2,
      radiusMaxMi: 20,
      mapZoomMode: "plain",
      calendarMode: "per-stop",
    });
    expect(r).toEqual({
      ok: true,
      value: {
        defaultRadiusMi: 10,
        radiusMinMi: 2,
        radiusMaxMi: 20,
        mapZoomMode: "plain",
        calendarMode: "per-stop",
      },
    });
  });

  it("accepts a partial patch and ignores unknown keys", () => {
    const r = parseSettingsPatch({ mapZoomMode: "ctrl", theme: "dark" });
    expect(r).toEqual({ ok: true, value: { mapZoomMode: "ctrl" } });
  });

  it("rejects bad enum values", () => {
    expect(parseSettingsPatch({ mapZoomMode: "scroll" }).ok).toBe(false);
    expect(parseSettingsPatch({ calendarMode: "one" }).ok).toBe(false);
  });

  it("rejects non-numeric radii", () => {
    expect(parseSettingsPatch({ defaultRadiusMi: "5" }).ok).toBe(false);
    expect(parseSettingsPatch({ radiusMinMi: NaN }).ok).toBe(false);
    expect(parseSettingsPatch({ radiusMaxMi: Infinity }).ok).toBe(false);
  });
});

describe("mergeSettings", () => {
  it("applies a partial patch over the base", () => {
    const r = mergeSettings(DEFAULT_SETTINGS, { defaultRadiusMi: 12 });
    expect(r).toEqual({ ok: true, value: { ...DEFAULT_SETTINGS, defaultRadiusMi: 12 } });
  });

  it("clamps bounds to the 1–25 hard limits and rounds", () => {
    const r = mergeSettings(DEFAULT_SETTINGS, { radiusMinMi: 0, radiusMaxMi: 99.7 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.radiusMinMi).toBe(1);
      expect(r.value.radiusMaxMi).toBe(25);
    }
  });

  it("rejects min >= max", () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { radiusMinMi: 10, radiusMaxMi: 10 }).ok).toBe(false);
    expect(mergeSettings(DEFAULT_SETTINGS, { radiusMinMi: 20, radiusMaxMi: 5 }).ok).toBe(false);
  });

  it("clamps the default radius into the user's bounds", () => {
    const r = mergeSettings(DEFAULT_SETTINGS, { radiusMinMi: 3, radiusMaxMi: 8, defaultRadiusMi: 20 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.defaultRadiusMi).toBe(8);

    const r2 = mergeSettings(
      { ...DEFAULT_SETTINGS, defaultRadiusMi: 2 },
      { radiusMinMi: 5, radiusMaxMi: 25 },
    );
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.value.defaultRadiusMi).toBe(5);
  });

  it("rounds a fractional default radius", () => {
    const r = mergeSettings(DEFAULT_SETTINGS, { defaultRadiusMi: 7.4 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.defaultRadiusMi).toBe(7);
  });
});

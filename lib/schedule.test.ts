import { describe, it, expect } from "vitest";
import { projectedStarts, suggestOrder, sunsetWindowLabel } from "./schedule";

// Sunset 8:06 PM, dark 8:41 PM — the PLANNER_V2 acceptance scenario's sky.
const sun = { sunset: 1206, dusk: 1241 };
const START_630PM = 18 * 60 + 30; // 1110

describe("projectedStarts", () => {
  it("accumulates durations from the start time", () => {
    const starts = projectedStarts(["Coffee", "Drinks"], { Coffee: 45, Drinks: 75 }, 1110);
    expect(starts).toEqual({ Coffee: 1110, Drinks: 1155 });
  });

  it("adds travel time into each stop, including the first", () => {
    const starts = projectedStarts(
      ["Coffee", "Drinks"],
      { Coffee: 45, Drinks: 75 },
      1110,
      { Coffee: 10, Drinks: 15 },
    );
    expect(starts).toEqual({ Coffee: 1120, Drinks: 1180 });
  });

  it("defaults unknown durations to 60 minutes", () => {
    const starts = projectedStarts(["Mystery", "Coffee"], {}, 1110);
    expect(starts.Coffee).toBe(1170);
  });
});

describe("suggestOrder", () => {
  it("acceptance: 6:30 start, sunset 8:06 — Sunset view first gets moved to the end", () => {
    const s = suggestOrder(
      ["Sunset view", "Coffee", "Drinks"],
      { "Sunset view": 45, Coffee: 45, Drinks: 75 },
      sun,
      { startMinutes: START_630PM },
    );
    expect(s).not.toBeNull();
    expect(s!.stopKey).toBe("Sunset view");
    expect(s!.order).toEqual(["Coffee", "Drinks", "Sunset view"]);
    expect(s!.message).toContain("move it to the end");
    expect(s!.message).toContain("~7:45–8:20 PM");
  });

  it("returns null without sun data", () => {
    expect(
      suggestOrder(["Sunset view", "Coffee"], { "Sunset view": 45, Coffee: 45 }, null, {
        startMinutes: START_630PM,
      }),
    ).toBeNull();
  });

  it("returns null when nothing is sun-sensitive", () => {
    expect(
      suggestOrder(["Coffee", "Drinks"], { Coffee: 45, Drinks: 75 }, sun, {
        startMinutes: START_630PM,
      }),
    ).toBeNull();
  });

  it("returns null when the sunset stop already lands in its window", () => {
    expect(
      suggestOrder(["Coffee", "Sunset view"], { Coffee: 45, "Sunset view": 45 }, sun, {
        startMinutes: START_630PM,
      }),
    ).toBeNull();
  });

  it("moves Stargazing after dark", () => {
    const s = suggestOrder(
      ["Stargazing", "Drinks"],
      { Stargazing: 60, Drinks: 180 },
      sun,
      { startMinutes: START_630PM },
    );
    expect(s).not.toBeNull();
    expect(s!.order).toEqual(["Drinks", "Stargazing"]);
    expect(s!.message).toContain("dark");
  });

  it("moves a daylight stop earlier", () => {
    const s = suggestOrder(
      ["Drinks", "Park picnic"],
      { Drinks: 120, "Park picnic": 90 },
      sun,
      { startMinutes: START_630PM },
    );
    expect(s).not.toBeNull();
    expect(s!.stopKey).toBe("Park picnic");
    expect(s!.order).toEqual(["Park picnic", "Drinks"]);
    expect(s!.message).toContain("move it to the start");
  });

  it("accounts for travel time and picks a mid-lineup slot when the end runs past dark", () => {
    // 6:00 PM start, 10-min legs: at the end Sunset view would start 9:15 PM
    // (way past sunset+30), so the slot between Coffee and Drinks wins.
    const s = suggestOrder(
      ["Sunset view", "Coffee", "Drinks"],
      { "Sunset view": 45, Coffee: 45, Drinks: 120 },
      sun,
      {
        startMinutes: 18 * 60,
        travelMinutes: { "Sunset view": 10, Coffee: 10, Drinks: 10 },
      },
    );
    expect(s).not.toBeNull();
    expect(s!.order).toEqual(["Coffee", "Sunset view", "Drinks"]);
    expect(s!.message).toContain("move it later");
  });

  it("does not suggest when travel time already lands the stop in its window", () => {
    // 6:30 + 10 min of travel = 6:40 PM start, inside the sunset window.
    expect(
      suggestOrder(
        ["Sunset view", "Coffee"],
        { "Sunset view": 45, Coffee: 45 },
        sun,
        { startMinutes: START_630PM, travelMinutes: { "Sunset view": 10 } },
      ),
    ).toBeNull();
  });

  it("returns null when no position fixes the warning", () => {
    // Date starts 3 PM and ends long before golden hour — nowhere to put it.
    const s = suggestOrder(
      ["Sunset view", "Coffee"],
      { "Sunset view": 45, Coffee: 30 },
      sun,
      { startMinutes: 15 * 60 },
    );
    expect(s).toBeNull();
  });

  it("rejects a reorder that fixes one stop by breaking another", () => {
    // Moving Stargazing last puts Sunset view first at 6:30 ("still bright").
    const s = suggestOrder(
      ["Stargazing", "Sunset view"],
      { Stargazing: 60, "Sunset view": 180 },
      sun,
      { startMinutes: START_630PM },
    );
    expect(s).toBeNull();
  });
});

describe("sunsetWindowLabel", () => {
  it("rounds to 5 minutes and shares the meridiem", () => {
    expect(sunsetWindowLabel(sun)).toBe("~7:45–8:20 PM");
  });
});

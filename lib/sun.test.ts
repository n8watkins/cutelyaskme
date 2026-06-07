import { describe, it, expect } from "vitest";
import { sunWarning } from "./sun";

const sun = { sunset: 1200, dusk: 1260 }; // 8:00 PM / 9:00 PM

describe("sunWarning", () => {
  it("returns null for non-sun-sensitive activities", () => {
    expect(sunWarning("Coffee", 1300, sun)).toBeNull();
  });
  it("returns null when no sun data", () => {
    expect(sunWarning("Sunset view", 1300, null)).toBeNull();
  });

  it("flags Sunset view scheduled after dark", () => {
    expect(sunWarning("Sunset view", 1300, sun)).toContain("dark");
  });
  it("flags Sunset view far too early", () => {
    expect(sunWarning("Sunset view", 1000, sun)).toContain("still bright");
  });
  it("accepts Sunset view near sunset", () => {
    expect(sunWarning("Sunset view", 1200, sun)).toBeNull();
  });

  it("flags Stargazing before dusk", () => {
    expect(sunWarning("Stargazing", 1200, sun)).toContain("too early");
  });
  it("accepts Stargazing after dusk", () => {
    expect(sunWarning("Stargazing", 1300, sun)).toBeNull();
  });

  it("flags daylight activities after sunset", () => {
    expect(sunWarning("Scenic drive", 1300, sun)).toContain("sun's down");
    expect(sunWarning("Park picnic", 1100, sun)).toBeNull();
  });
});

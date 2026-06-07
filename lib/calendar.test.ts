import { describe, it, expect } from "vitest";
import { icsEscape, buildGCalLink, buildItineraryText } from "./calendar";

describe("icsEscape", () => {
  it("escapes ICS special chars", () => {
    expect(icsEscape("a,b;c")).toBe("a\\,b\\;c");
    expect(icsEscape("line1\nline2")).toBe("line1\\nline2");
    expect(icsEscape("a\\b")).toBe("a\\\\b");
  });
});

describe("buildGCalLink", () => {
  it("includes encoded dates, location, and details when a date is given", () => {
    const url = buildGCalLink("Coffee", 1140, 1200, "123 Main St", "2026-06-15", "the plan");
    expect(url).toContain("dates=20260615T190000/20260615T200000");
    expect(url).toContain("text=Coffee");
    expect(url).toContain("location=123%20Main%20St");
    expect(url).toContain("details=the%20plan");
  });
  it("omits dates when no date is given", () => {
    const url = buildGCalLink("Coffee", 1140, 1200, "loc", null, "d");
    expect(url).not.toContain("dates=");
    expect(url).toContain("text=Coffee");
  });
});

describe("buildItineraryText", () => {
  it("lists only stops with venues and appends the link", () => {
    const text = buildItineraryText(
      [
        { startMinutes: 1140, icon: "☕", label: "Coffee", venue: { name: "Blue Bottle" } },
        { startMinutes: 1200, icon: "📚", label: "Bookstore", venue: null },
      ],
      "https://x/plan/1",
    );
    expect(text).toContain("Your date plan");
    expect(text).toContain("7:00 PM — ☕ Coffee @ Blue Bottle");
    expect(text).not.toContain("Bookstore");
    expect(text).toContain("Full plan: https://x/plan/1");
  });
});

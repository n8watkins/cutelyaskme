import { describe, it, expect } from "vitest";
import {
  icsEscape,
  buildGCalLink,
  buildItineraryText,
  buildGCalLinks,
  buildICS,
  dateWindow,
  parseCalendarMode,
  type CalendarStop,
} from "./calendar";

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

  it("interleaves travel legs before the stop they lead into", () => {
    const text = buildItineraryText(
      [
        {
          startMinutes: 1140,
          icon: "☕",
          label: "Coffee",
          venue: { name: "Blue Bottle" },
          travelIn: "🚗 12 min · 4.3 mi",
        },
        {
          startMinutes: 1200,
          icon: "🌅",
          label: "Sunset",
          venue: { name: "Pier" },
          travelIn: "🚶 8 min · 0.4 mi",
        },
      ],
      "https://x/plan/1",
    );
    const lines = text.split("\n");
    expect(lines.indexOf("  ↓ 🚗 12 min · 4.3 mi")).toBe(
      lines.findIndex((l) => l.includes("Coffee")) - 1,
    );
    expect(lines.indexOf("  ↓ 🚶 8 min · 0.4 mi")).toBe(
      lines.findIndex((l) => l.includes("Sunset")) - 1,
    );
  });

  it("omits travel lines when the leg is not routed yet", () => {
    const text = buildItineraryText(
      [{ startMinutes: 1140, icon: "☕", label: "Coffee", venue: { name: "BB" }, travelIn: null }],
      "https://x/plan/1",
    );
    expect(text).not.toContain("↓");
  });

  it("appends a route navigation link when venues carry coords", () => {
    const text = buildItineraryText(
      [
        { startMinutes: 1140, icon: "☕", label: "Coffee", venue: { name: "BB", lat: 1, lng: 2 } },
        { startMinutes: 1200, icon: "🌅", label: "Sunset", venue: { name: "Pier", lat: 3, lng: 4 } },
      ],
      "https://x/plan/1",
    );
    expect(text).toContain("Navigate the route: https://www.google.com/maps/dir/?api=1");
    expect(text).toContain(encodeURIComponent("BB, 1,2").replace(/%20/g, "+"));
  });

  it("skips the navigation link when venues have no coords (older plans)", () => {
    const text = buildItineraryText(
      [{ startMinutes: 1140, icon: "☕", label: "Coffee", venue: { name: "BB" } }],
      "https://x/plan/1",
    );
    expect(text).not.toContain("Navigate");
  });
});

const stops: CalendarStop[] = [
  {
    key: "Coffee",
    startMinutes: 1140,
    endMinutes: 1200,
    icon: "☕",
    label: "Coffee",
    venue: { name: "Blue Bottle", address: "1 Bean St", lat: 37.7955, lng: -122.4005 },
    travelIn: "🚗 12 min · 4.3 mi",
  },
  {
    key: "Picnic",
    startMinutes: 1200,
    endMinutes: 1260,
    icon: "🧺",
    label: "Picnic",
    venue: null,
  },
  {
    key: "Sunset",
    startMinutes: 1260,
    endMinutes: 1320,
    icon: "🌅",
    label: "Sunset",
    venue: { name: "Pier 7", address: "Pier 7, SF", lat: 37.8006, lng: -122.3982 },
    travelIn: "🚶 8 min · 0.4 mi",
    legMode: "walk",
  },
];

describe("parseCalendarMode", () => {
  it("defaults to single and only accepts per-stop", () => {
    expect(parseCalendarMode(null)).toBe("single");
    expect(parseCalendarMode("garbage")).toBe("single");
    expect(parseCalendarMode("per-stop")).toBe("per-stop");
  });
});

describe("dateWindow", () => {
  it("spans first to last venue stop", () => {
    expect(dateWindow(stops)).toEqual({ startMinutes: 1140, endMinutes: 1320 });
  });
  it("is null with no venues", () => {
    expect(dateWindow([{ startMinutes: 0, endMinutes: 60, venue: null }])).toBeNull();
  });
});

describe("buildGCalLinks", () => {
  it("single mode: one link spanning the whole window, itinerary + travel in details", () => {
    const links = buildGCalLinks(stops, {
      mode: "single",
      selectedDate: "2026-06-15",
      planLink: "https://x/plan/1",
    });
    expect(links).toHaveLength(1);
    expect(links[0].url).toContain("dates=20260615T190000/20260615T220000");
    expect(links[0].url).toContain(encodeURIComponent("1 Bean St"));
    expect(decodeURIComponent(links[0].url)).toContain("🚗 12 min · 4.3 mi");
    expect(decodeURIComponent(links[0].url)).toContain("Full plan: https://x/plan/1");
  });

  it("per-stop mode: one pre-filled link per venue stop at its own time/venue", () => {
    const links = buildGCalLinks(stops, {
      mode: "per-stop",
      selectedDate: "2026-06-15",
      planLink: "https://x/plan/1",
    });
    expect(links.map((l) => l.key)).toEqual(["Coffee", "Sunset"]);
    expect(links[0].url).toContain("dates=20260615T190000/20260615T200000");
    expect(links[1].url).toContain("dates=20260615T210000/20260615T220000");
    expect(links[1].url).toContain(encodeURIComponent("Pier 7, SF"));
    // every event carries the full itinerary
    expect(decodeURIComponent(links[1].url)).toContain("Blue Bottle");
  });

  it("returns nothing when no stop has a venue", () => {
    const bare = stops.map((s) => ({ ...s, venue: null }));
    expect(buildGCalLinks(bare, { mode: "single", selectedDate: null, planLink: "x" })).toEqual([]);
  });

  it("per-stop mode: each event description carries its own navigation link", () => {
    const links = buildGCalLinks(stops, {
      mode: "per-stop",
      selectedDate: "2026-06-15",
      planLink: "https://x/plan/1",
    });
    // decoding the details param reveals the embedded (still URL-encoded) nav link
    const first = decodeURIComponent(links[0].url);
    const second = decodeURIComponent(links[1].url);
    // first stop: from current location, driving
    expect(first).toContain("Navigate to this stop:");
    expect(first).toContain("destination=Blue+Bottle%2C+37.7955%2C-122.4005");
    expect(first.split("Navigate to this stop:")[1]).not.toContain("origin=");
    // second stop: leg from the previous venue, honoring the walk toggle
    expect(second).toContain("origin=Blue+Bottle%2C+37.7955%2C-122.4005");
    expect(second).toContain("destination=Pier+7%2C+37.8006%2C-122.3982");
    expect(second).toContain("travelmode=walking");
  });
});

describe("buildICS", () => {
  const opts = { selectedDate: "2026-06-15", planId: "p1", planLink: "https://x/plan/1" };

  it("single mode: exactly one VEVENT spanning the whole window", () => {
    const ics = buildICS(stops, { ...opts, mode: "single" });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("DTSTART:20260615T190000");
    expect(ics).toContain("DTEND:20260615T220000");
    expect(ics).toContain("LOCATION:1 Bean St");
    expect(ics).toContain("UID:date-p1@cutelyask");
    expect(ics).toContain("🚗 12 min · 4.3 mi"); // travel leg in the description
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR")).toBe(true);
  });

  it("per-stop mode: one VEVENT per venue stop in a single file", () => {
    const ics = buildICS(stops, { ...opts, mode: "per-stop" });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("SUMMARY:☕ Coffee — Blue Bottle");
    expect(ics).toContain("SUMMARY:🌅 Sunset — Pier 7");
    expect(ics).toContain("UID:Coffee-p1@cutelyask");
    expect(ics).toContain("UID:Sunset-p1@cutelyask");
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
  });

  it("escapes commas in ICS fields", () => {
    const ics = buildICS(stops, { ...opts, mode: "per-stop" });
    expect(ics).toContain("LOCATION:Pier 7\\, SF");
  });

  it("per-stop mode: descriptions include an escaped per-stop navigation link", () => {
    const ics = buildICS(stops, { ...opts, mode: "per-stop" });
    expect(ics).toContain("Navigate to this stop:");
    // the URL's commas must be ICS-escaped inside DESCRIPTION
    expect(ics).toContain("travelmode=walking");
    expect(ics).toContain("origin=Blue+Bottle%2C+37.7955%2C-122.4005");
  });
});

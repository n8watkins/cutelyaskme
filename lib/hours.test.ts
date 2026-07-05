import { describe, it, expect } from "vitest";
import { dayIndexFromDate, slotMinutes, daySlots, formatDayHours, openBadge } from "./hours";
import type { OpenSlot } from "./hours";

// Restaurant: Fri 5pm–11pm, Sat 5pm–1am (overnight)
const slots: OpenSlot[] = [
  { day: 4, start: "1700", end: "2300", is_overnight: false },
  { day: 5, start: "1700", end: "0100", is_overnight: true },
];

describe("dayIndexFromDate", () => {
  it("maps JS weekdays to Yelp 0=Monday", () => {
    expect(dayIndexFromDate("2026-06-15")).toBe(0); // a Monday
    expect(dayIndexFromDate("2026-06-19")).toBe(4); // a Friday
    expect(dayIndexFromDate("2026-06-21")).toBe(6); // a Sunday
  });
  it("returns null for garbage", () => {
    expect(dayIndexFromDate("not-a-date")).toBeNull();
  });
});

describe("slotMinutes", () => {
  it("parses HHMM", () => {
    expect(slotMinutes("1730")).toBe(1050);
    expect(slotMinutes("0000")).toBe(0);
  });
});

describe("daySlots", () => {
  it("extends overnight ends past midnight", () => {
    expect(daySlots(slots, 5)).toEqual([{ start: 1020, end: 1500 }]);
  });
  it("empty for closed days", () => {
    expect(daySlots(slots, 0)).toEqual([]);
  });
});

describe("formatDayHours", () => {
  it("formats ranges", () => {
    expect(formatDayHours(slots, 4)).toBe("5:00 PM – 11:00 PM");
  });
  it("says Closed", () => {
    expect(formatDayHours(slots, 1)).toBe("Closed");
  });
});

describe("openBadge", () => {
  it("open when window fits inside a slot", () => {
    expect(openBadge(slots, 4, 1140, 1260).state).toBe("open"); // 7–9pm Fri
  });
  it("flags early close", () => {
    const b = openBadge(slots, 4, 1320, 1440); // 10pm–midnight Fri, closes 11
    expect(b.state).toBe("closes-early");
    expect(b.label).toContain("11:00 PM");
  });
  it("flags late open", () => {
    const b = openBadge(slots, 4, 900, 1080); // 3–6pm, opens 5
    expect(b.state).toBe("opens-late");
    expect(b.label).toContain("5:00 PM");
  });
  it("closed that day", () => {
    expect(openBadge(slots, 0, 1140, 1260).state).toBe("closed");
  });
  it("overnight slot covers past-midnight stops", () => {
    expect(openBadge(slots, 5, 1380, 1470).state).toBe("open"); // 11pm–12:30am Sat
  });
  it("unknown without data", () => {
    expect(openBadge([], 4, 1140, 1260).state).toBe("unknown");
    expect(openBadge(slots, null, 1140, 1260).state).toBe("unknown");
  });
});

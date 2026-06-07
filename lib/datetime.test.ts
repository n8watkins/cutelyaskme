import { describe, it, expect } from "vitest";
import { parseTimeToMinutes, formatTime, formatDuration } from "./datetime";

describe("parseTimeToMinutes", () => {
  it("parses HH:MM", () => {
    expect(parseTimeToMinutes("19:30")).toBe(19 * 60 + 30);
    expect(parseTimeToMinutes("09:05")).toBe(545);
    expect(parseTimeToMinutes("00:00")).toBe(0);
  });
  it("defaults to 7pm when null/empty", () => {
    expect(parseTimeToMinutes(null)).toBe(19 * 60);
    expect(parseTimeToMinutes("")).toBe(19 * 60);
  });
});

describe("formatTime", () => {
  it("formats 12-hour with AM/PM", () => {
    expect(formatTime(1170)).toBe("7:30 PM");
    expect(formatTime(545)).toBe("9:05 AM");
    expect(formatTime(0)).toBe("12:00 AM");
    expect(formatTime(720)).toBe("12:00 PM");
  });
  it("wraps past midnight and handles negatives", () => {
    expect(formatTime(1440)).toBe("12:00 AM");
    expect(formatTime(1500)).toBe("1:00 AM");
    expect(formatTime(-60)).toBe("11:00 PM");
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(150)).toBe("2h 30m");
  });
});

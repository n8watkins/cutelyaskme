import { describe, expect, it } from "vitest";
import {
  classifyPlanDate,
  dateKeyInTimeZone,
  isValidTimeZone,
  planEndInstant,
  resolveZonedDateTime,
  zonedDateTimeToInstant,
} from "./plan-time";

describe("isValidTimeZone", () => {
  it("accepts supported IANA zones and rejects unknown zones", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Moon/Sea_of_Tranquility")).toBe(false);
  });
});

describe("resolveZonedDateTime", () => {
  it("resolves the same wall time differently in different zones", () => {
    expect(zonedDateTimeToInstant("2026-07-14", "18:30", "America/Los_Angeles")?.toISOString()).toBe(
      "2026-07-15T01:30:00.000Z",
    );
    expect(zonedDateTimeToInstant("2026-07-14", "18:30", "America/New_York")?.toISOString()).toBe(
      "2026-07-14T22:30:00.000Z",
    );
  });

  it("rejects nonexistent spring-forward wall times", () => {
    expect(resolveZonedDateTime("2026-03-08", "02:30", "America/Los_Angeles")).toEqual({
      ok: false,
      reason: "nonexistent-time",
    });
  });

  it("makes repeated fall-back wall times explicit", () => {
    const earlier = resolveZonedDateTime("2026-11-01", "01:30", "America/Los_Angeles");
    const later = resolveZonedDateTime("2026-11-01", "01:30", "America/Los_Angeles", "later");
    const rejected = resolveZonedDateTime("2026-11-01", "01:30", "America/Los_Angeles", "reject");

    expect(earlier.ok && earlier.ambiguous).toBe(true);
    expect(earlier.ok && earlier.instant.toISOString()).toBe("2026-11-01T08:30:00.000Z");
    expect(later.ok && later.instant.toISOString()).toBe("2026-11-01T09:30:00.000Z");
    expect(rejected).toEqual({ ok: false, reason: "ambiguous-time" });
  });

  it("reports invalid dates, times, and zones", () => {
    expect(resolveZonedDateTime("2026-02-29", "18:30", "UTC")).toEqual({
      ok: false,
      reason: "invalid-date",
    });
    expect(resolveZonedDateTime("2026-07-14", "24:00", "UTC")).toEqual({
      ok: false,
      reason: "invalid-time",
    });
    expect(resolveZonedDateTime("2026-07-14", "18:30", "Not/A_Zone")).toEqual({
      ok: false,
      reason: "invalid-time-zone",
    });
  });
});

describe("planEndInstant", () => {
  it("rolls an end after midnight into the next local date", () => {
    expect(planEndInstant("2026-07-14", "23:00", 25 * 60 + 15, "America/Los_Angeles")?.toISOString()).toBe(
      "2026-07-15T08:15:00.000Z",
    );
  });

  it("preserves elapsed duration when a plan crosses fall-back", () => {
    expect(planEndInstant("2026-10-31", "23:30", 25 * 60 + 30, "America/Los_Angeles")?.toISOString()).toBe(
      "2026-11-01T08:30:00.000Z",
    );
  });

  it("preserves elapsed duration when a plan crosses spring-forward", () => {
    expect(planEndInstant("2026-03-08", "00:30", 210, "America/Los_Angeles")?.toISOString()).toBe(
      "2026-03-08T11:30:00.000Z",
    );
  });

  it("returns null for unscheduled, invalid, or nonexistent starts", () => {
    expect(planEndInstant(null, "20:00", 1200, "UTC")).toBeNull();
    expect(planEndInstant("2026-07-14", "20:00", -1, "UTC")).toBeNull();
    expect(planEndInstant("2026-03-08", "02:30", 300, "America/Los_Angeles")).toBeNull();
  });
});

describe("dashboard local date helpers", () => {
  const nearMidnight = new Date("2026-07-15T01:00:00.000Z");

  it("creates calendar keys in the requested timezone", () => {
    expect(dateKeyInTimeZone(nearMidnight, "America/Los_Angeles")).toBe("2026-07-14");
    expect(dateKeyInTimeZone(nearMidnight, "Asia/Tokyo")).toBe("2026-07-15");
    expect(dateKeyInTimeZone(nearMidnight, "Not/A_Zone")).toBeNull();
  });

  it("classifies dates against today in the plan timezone", () => {
    expect(classifyPlanDate("2026-07-14", "America/Los_Angeles", nearMidnight)).toBe("today");
    expect(classifyPlanDate("2026-07-13", "America/Los_Angeles", nearMidnight)).toBe("past");
    expect(classifyPlanDate("2026-07-15", "America/Los_Angeles", nearMidnight)).toBe("future");
    expect(classifyPlanDate("2026-07-15", "Asia/Tokyo", nearMidnight)).toBe("today");
  });

  it("distinguishes unscheduled plans from invalid data", () => {
    expect(classifyPlanDate(null, "UTC", nearMidnight)).toBe("unscheduled");
    expect(classifyPlanDate("July 14", "UTC", nearMidnight)).toBe("invalid");
    expect(classifyPlanDate("2026-07-14", "Not/A_Zone", nearMidnight)).toBe("invalid");
  });
});

import { describe, it, expect } from "vitest";
import {
  DEFAULT_DATE_DURATION_MINUTES,
  dateEnd,
  dateEndFromPlan,
  dateEndMinutes,
  dateStopKeys,
  isDateOver,
  parseClockLabel,
} from "./date-end";
import { buildItineraryStops, deterministicTimeline } from "./itinerary";
import { parseTimeToMinutes } from "./datetime";
import type { ItineraryJson } from "./db/schema";

// 6:30 PM start, Coffee (45) → Drinks (75) → entree (75): ends 9:45 PM.
const START = "18:30";
const ACTIVITIES = ["Coffee", "Drinks"];
const ENTREE = "Tacos";

function savedItinerary(
  activities = ACTIVITIES,
  entree: string | null = ENTREE,
  time = START,
): ItineraryJson {
  const stops = buildItineraryStops({
    selectedDateLabel: null,
    selectedTimeLabel: null,
    selectedTime: time,
    selectedEntree: entree,
    selectedActivities: activities,
  });
  return {
    title: "Test Night",
    summary: "",
    timeline: deterministicTimeline(stops, parseTimeToMinutes(time)),
    tips: [],
  };
}

describe("parseClockLabel", () => {
  it("parses the deterministic timeline's formatTime output", () => {
    expect(parseClockLabel("7:45 PM")).toBe(19 * 60 + 45);
    expect(parseClockLabel("12:05 AM")).toBe(5);
    expect(parseClockLabel("12:00 PM")).toBe(12 * 60);
  });

  it("tolerates lowercase and missing minutes", () => {
    expect(parseClockLabel(" 7 pm ")).toBe(19 * 60);
  });

  it("rejects garbage", () => {
    expect(parseClockLabel("evening-ish")).toBeNull();
    expect(parseClockLabel("19:45")).toBeNull();
    expect(parseClockLabel("13:00 PM")).toBeNull();
  });
});

describe("dateStopKeys", () => {
  it("appends the entree key after the activities", () => {
    expect(dateStopKeys(ACTIVITIES, ENTREE)).toEqual(["Coffee", "Drinks", "__entree__"]);
  });

  it("skips Surprise me / missing entree", () => {
    expect(dateStopKeys(ACTIVITIES, "Surprise me")).toEqual(ACTIVITIES);
    expect(dateStopKeys(ACTIVITIES, null)).toEqual(ACTIVITIES);
  });
});

describe("dateEndMinutes", () => {
  it("uses the saved timeline: last entry's start + that stop's duration", () => {
    // 6:30 Coffee, 7:15 Drinks, 8:30 entree (75) → ends 9:45 PM (1305).
    const end = dateEndMinutes({
      selectedTime: START,
      selectedEntree: ENTREE,
      selectedActivities: ACTIVITIES,
      itinerary: savedItinerary(),
    });
    expect(end).toBe(21 * 60 + 45);
  });

  it("projects from stop durations when no itinerary is saved", () => {
    const end = dateEndMinutes({
      selectedTime: START,
      selectedEntree: ENTREE,
      selectedActivities: ACTIVITIES,
      itinerary: null,
    });
    expect(end).toBe(21 * 60 + 45); // same math, no timeline needed
  });

  it("uses persisted normalized durations instead of mutable defaults", () => {
    const end = dateEndMinutes({
      selectedTime: START,
      selectedEntree: ENTREE,
      selectedActivities: ACTIVITIES,
      stops: [
        { position: 2, durationMinutes: 30 },
        { position: 0, durationMinutes: 20 },
        { position: 1, durationMinutes: 40 },
      ],
      itinerary: savedItinerary(),
    });
    expect(end).toBe(20 * 60);
  });

  it("includes persisted travel before normalized stops", () => {
    const end = dateEndMinutes({
      selectedTime: START,
      selectedEntree: null,
      selectedActivities: ACTIVITIES,
      stops: [
        { position: 0, durationMinutes: 45, travelMinutes: 10 },
        { position: 1, durationMinutes: 75, travelMinutes: 20 },
      ],
      itinerary: savedItinerary(),
    });
    expect(end).toBe(21 * 60);
  });

  it("adds travel minutes into stops when provided", () => {
    const end = dateEndMinutes({
      selectedTime: START,
      selectedEntree: null,
      selectedActivities: ACTIVITIES,
      itinerary: null,
      travelMinutes: { Coffee: 10, Drinks: 20 },
    });
    expect(end).toBe(18 * 60 + 30 + 45 + 75 + 30);
  });

  it("falls back to a default length when there are no stops at all", () => {
    const end = dateEndMinutes({
      selectedTime: "19:00",
      selectedEntree: null,
      selectedActivities: [],
      itinerary: null,
    });
    expect(end).toBe(19 * 60 + DEFAULT_DATE_DURATION_MINUTES);
  });

  it("unwraps timeline times past midnight", () => {
    // 10:30 PM start: Movie (120) lands at 10:30 PM, entree at 12:30 AM.
    const end = dateEndMinutes({
      selectedTime: "22:30",
      selectedEntree: ENTREE,
      selectedActivities: ["Movie"],
      itinerary: savedItinerary(["Movie"], ENTREE, "22:30"),
    });
    expect(end).toBe(24 * 60 + 30 + 75); // 12:30 AM + 75m, on the next day
  });

  it("ignores an unparseable timeline time and projects instead", () => {
    const broken = savedItinerary();
    broken.timeline[broken.timeline.length - 1].time = "late evening";
    const end = dateEndMinutes({
      selectedTime: START,
      selectedEntree: ENTREE,
      selectedActivities: ACTIVITIES,
      itinerary: broken,
    });
    expect(end).toBe(21 * 60 + 45);
  });
});

describe("dateEnd / dateEndFromPlan / isDateOver", () => {
  const row = {
    selectedDate: "2026-06-05",
    selectedTime: START,
    selectedEntree: ENTREE,
    selectedActivities: JSON.stringify(ACTIVITIES),
    itinerary: JSON.stringify(savedItinerary()),
  };

  it("lands on the selected date at the computed end time", () => {
    const end = dateEndFromPlan(row);
    expect(end?.toISOString()).toBe("2026-06-05T21:45:00.000Z");
  });

  it("rolls past-midnight ends into the next day", () => {
    const end = dateEnd({
      selectedDate: "2026-06-05",
      selectedTime: "22:30",
      selectedEntree: null,
      selectedActivities: ["Movie"],
      itinerary: null,
    });
    expect(end?.toISOString()).toBe("2026-06-06T00:30:00.000Z");
  });

  it("returns null when no date is selected (plan is never 'over')", () => {
    expect(dateEndFromPlan({ ...row, selectedDate: null })).toBeNull();
    expect(isDateOver({ ...row, selectedDate: null }, new Date(2030, 0, 1))).toBe(false);
  });

  it("survives malformed JSON columns", () => {
    const end = dateEndFromPlan({ ...row, selectedActivities: "not json", itinerary: "{oops" });
    // Activities/itinerary unparseable → only the entree stop (75m) remains.
    expect(end?.toISOString()).toBe("2026-06-05T19:45:00.000Z");
  });

  it("isDateOver flips exactly after the end time", () => {
    expect(isDateOver(row, new Date("2026-06-05T21:44:00Z"))).toBe(false);
    expect(isDateOver(row, new Date("2026-06-05T21:46:00Z"))).toBe(true);
  });

  it("resolves the plan end in its stored timezone", () => {
    const end = dateEndFromPlan({ ...row, timezone: "America/Los_Angeles" });
    expect(end?.toISOString()).toBe("2026-06-06T04:45:00.000Z");
  });
});

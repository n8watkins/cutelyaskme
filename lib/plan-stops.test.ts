import { describe, expect, it } from "vitest";
import type { Venue } from "./venues";
import {
  ENTREE_STOP_KEY,
  buildPlanStopRows,
  itineraryStopsFromPlanStops,
  legacyStopColumns,
  readPlanStops,
  stopDurationsByKey,
  type PlanStop,
} from "./plan-stops";

const coffee: Venue = {
  id: "coffee-1",
  name: "Tiny Cafe",
  address: "1 Main St",
  rating: 4.8,
  priceLevel: 2,
  lat: 34,
  lng: -118,
};

const dinner: Venue = {
  ...coffee,
  id: "dinner-1",
  name: "Dinner Place",
};

describe("buildPlanStopRows", () => {
  it("persists the full order, durations, venues, and incoming leg modes", () => {
    let id = 0;
    const stops = buildPlanStopRows(
      "plan-1",
      {
        selectedActivities: ["Coffee", "Movie"],
        selectedEntree: "Tacos",
        selectedActivityVenues: { Coffee: coffee },
        selectedEntreeVenue: dinner,
        stopOrder: ["Coffee", ENTREE_STOP_KEY, "Movie"],
        stopDurations: { Coffee: 30, [ENTREE_STOP_KEY]: 90, Movie: 150 },
        legModes: {
          "pickup→Coffee": "walk",
          "Coffee→__entree__": "drive",
          "__entree__→Movie": "walk",
        },
      },
      [],
      () => `stop-${++id}`,
    );

    expect(stops).toMatchObject([
      {
        id: "stop-1",
        position: 0,
        kind: "activity",
        activity: "Coffee",
        durationMinutes: 30,
        legMode: "walk",
      },
      {
        id: "stop-2",
        position: 1,
        kind: "entree",
        activity: "Tacos",
        durationMinutes: 90,
        legMode: "drive",
      },
      {
        id: "stop-3",
        position: 2,
        kind: "activity",
        activity: "Movie",
        durationMinutes: 150,
        legMode: "walk",
      },
    ]);
    expect(stops[0].venue).toBe(JSON.stringify(coffee));
    expect(stops[1].venue).toBe(JSON.stringify(dinner));
  });

  it("retains stable ids while reordering and falls back for invalid durations", () => {
    const existing = [
      stop("coffee-id", 0, "activity", "Coffee", 35),
      stop("movie-id", 1, "activity", "Movie", 125),
      stop("meal-id", 2, "entree", "Tacos", 80),
    ];
    const rows = buildPlanStopRows(
      "plan-1",
      {
        selectedActivities: ["Movie", "Coffee"],
        selectedEntree: "Tacos",
        stopOrder: ["Movie", "Coffee", ENTREE_STOP_KEY],
        stopDurations: { Movie: 5, Coffee: 45, [ENTREE_STOP_KEY]: 900 },
      },
      existing,
      () => "unexpected-new-id",
    );

    expect(
      rows.map(({ id, position, durationMinutes, createdAt }) => ({
        id,
        position,
        durationMinutes,
        createdAt,
      })),
    ).toEqual([
      {
        id: "movie-id",
        position: 0,
        durationMinutes: 125,
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "coffee-id",
        position: 1,
        durationMinutes: 45,
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "meal-id",
        position: 2,
        durationMinutes: 80,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ]);
  });
});

describe("compatibility adapters", () => {
  it("reads legacy JSON only when normalized rows are absent", () => {
    const plan = {
      id: "plan-1",
      selectedEntree: "Tacos",
      selectedActivities: JSON.stringify(["Coffee"]),
      selectedEntreeVenue: JSON.stringify(dinner),
      selectedActivityVenues: JSON.stringify({ Coffee: coffee }),
    };

    const legacy = readPlanStops(plan, []);
    expect(legacy.map((value) => value.id)).toEqual([
      "plan-1:legacy:0",
      "plan-1:legacy:1",
    ]);
    expect(stopDurationsByKey(legacy)).toEqual({ Coffee: 45, [ENTREE_STOP_KEY]: 75 });

    const normalized = [stop("normalized-id", 0, "activity", "Movie", 120)];
    expect(readPlanStops(plan, normalized)).toEqual(normalized);
  });

  it("dual-writes normalized rows back to legacy columns", () => {
    const rows = [
      { ...stop("meal-id", 1, "entree", "Tacos", 75), venue: JSON.stringify(dinner) },
      { ...stop("coffee-id", 0, "activity", "Coffee", 45), venue: JSON.stringify(coffee) },
    ];
    const legacy = legacyStopColumns(rows);

    expect(JSON.parse(legacy.selectedActivities)).toEqual(["Coffee"]);
    expect(JSON.parse(legacy.selectedActivityVenues)).toEqual({ Coffee: coffee });
    expect(JSON.parse(legacy.selectedEntreeVenue!)).toEqual(dinner);
    expect(itineraryStopsFromPlanStops(rows)).toEqual([
      {
        key: "Coffee",
        label: "Coffee",
        durationMinutes: 45,
        venue: coffee,
      },
      {
        key: ENTREE_STOP_KEY,
        label: "Tacos",
        durationMinutes: 75,
        venue: dinner,
      },
    ]);
  });
});

function stop(
  id: string,
  position: number,
  kind: "activity" | "entree",
  activity: string,
  durationMinutes: number,
): PlanStop {
  return {
    id,
    planId: "plan-1",
    position,
    kind,
    activity,
    durationMinutes,
    travelMinutes: 0,
    venue: null,
    legMode: "drive",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

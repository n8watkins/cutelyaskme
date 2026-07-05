import { describe, it, expect } from "vitest";
import {
  buildLegNavUrl,
  buildRouteNavUrl,
  buildStopNavUrl,
  navStopValue,
  navTravelMode,
} from "./nav-links";

const CAFE = { name: "Blue Bottle", lat: 34.0537, lng: -118.2428 };
const PIN = { lat: 34.0522, lng: -118.2437 };
const PIER = { name: "Pier 7 & Deck", lat: 33.99, lng: -118.47 };
const PARK = { name: "Grand Park, DTLA", lat: 34.0561, lng: -118.2468 };

describe("navTravelMode", () => {
  it("maps plan leg modes to Maps URL modes, defaulting to driving", () => {
    expect(navTravelMode("walk")).toBe("walking");
    expect(navTravelMode("drive")).toBe("driving");
    expect(navTravelMode(null)).toBe("driving");
    expect(navTravelMode(undefined)).toBe("driving");
  });
});

describe("navStopValue", () => {
  it("prefers name plus coords when a name is present", () => {
    expect(navStopValue(CAFE)).toBe("Blue Bottle, 34.0537,-118.2428");
  });

  it("falls back to bare coords when unnamed or blank", () => {
    expect(navStopValue(PIN)).toBe("34.0522,-118.2437");
    expect(navStopValue({ ...PIN, name: "  " })).toBe("34.0522,-118.2437");
  });

  it("rounds coords to 6 decimals", () => {
    expect(navStopValue({ lat: 34.05372901, lng: -118.24284999 })).toBe("34.053729,-118.24285");
  });
});

describe("buildRouteNavUrl", () => {
  it("is null with fewer than two stops", () => {
    expect(buildRouteNavUrl([])).toBeNull();
    expect(buildRouteNavUrl([CAFE])).toBeNull();
  });

  it("builds a universal link with origin and destination, no waypoints for two stops", () => {
    const url = buildRouteNavUrl([CAFE, PIN])!;
    expect(url.startsWith("https://www.google.com/maps/dir/?api=1")).toBe(true);
    expect(url).toContain("origin=Blue+Bottle%2C+34.0537%2C-118.2428");
    expect(url).toContain("destination=34.0522%2C-118.2437");
    expect(url).not.toContain("waypoints=");
    expect(url).toContain("travelmode=driving");
  });

  it("URL-encodes names with commas and ampersands", () => {
    const url = buildRouteNavUrl([PARK, PIER])!;
    expect(url).toContain("origin=Grand+Park%2C+DTLA%2C+34.0561%2C-118.2468");
    expect(url).toContain("destination=Pier+7+%26+Deck%2C+33.99%2C-118.47");
  });

  it("keeps middle stops as pipe-separated waypoints in order", () => {
    const url = buildRouteNavUrl([CAFE, PIN, PARK, PIER])!;
    const waypoints = new URL(url).searchParams.get("waypoints");
    expect(waypoints).toBe("34.0522,-118.2437|Grand Park, DTLA, 34.0561,-118.2468");
    expect(new URL(url).searchParams.get("origin")).toBe("Blue Bottle, 34.0537,-118.2428");
    expect(new URL(url).searchParams.get("destination")).toBe("Pier 7 & Deck, 33.99,-118.47");
  });

  it("honors the requested travel mode", () => {
    expect(buildRouteNavUrl([CAFE, PIN], "walking")).toContain("travelmode=walking");
  });
});

describe("buildLegNavUrl", () => {
  it("matches the two-stop route link", () => {
    expect(buildLegNavUrl(CAFE, PIER, "walking")).toBe(
      buildRouteNavUrl([CAFE, PIER], "walking"),
    );
  });
});

describe("buildStopNavUrl", () => {
  it("omits the origin so navigation starts from the current location", () => {
    const url = buildStopNavUrl(CAFE);
    expect(url).toContain("destination=Blue+Bottle%2C+34.0537%2C-118.2428");
    expect(url).not.toContain("origin=");
    expect(url).toContain("travelmode=driving");
  });
});

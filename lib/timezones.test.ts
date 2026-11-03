import { describe, expect, it } from "vitest";
import {
  describeTimeZone,
  searchTimeZones,
  supportedTimeZones,
  timeZoneLabel,
} from "./timezones";

const winter = new Date("2026-01-15T12:00:00Z");
const options = ["America/Los_Angeles", "America/New_York", "Europe/Paris", "Asia/Kolkata", "UTC", "America/Argentina/Buenos_Aires"].map(
  (id) => describeTimeZone(id, winter),
);

describe("describeTimeZone", () => {
  it("turns an IANA id into a city, region, long name and offset", () => {
    expect(describeTimeZone("America/Los_Angeles", winter)).toEqual({
      id: "America/Los_Angeles",
      city: "Los Angeles",
      region: "America",
      longName: "Pacific Time",
      offset: "GMT-8",
    });
  });

  it("keeps nested regions readable", () => {
    const zone = describeTimeZone("America/Argentina/Buenos_Aires", winter);
    expect(zone.city).toBe("Buenos Aires");
    expect(zone.region).toBe("America / Argentina");
  });

  it("labels zero-offset zones explicitly", () => {
    expect(describeTimeZone("UTC", winter).offset).toBe("GMT+0");
  });
});

describe("timeZoneLabel", () => {
  it("pairs the city with the zone name people know", () => {
    expect(timeZoneLabel(describeTimeZone("America/New_York", winter))).toBe(
      "New York - Eastern Time",
    );
  });
});

describe("searchTimeZones", () => {
  it("returns nothing for an empty query", () => {
    expect(searchTimeZones("  ", options)).toEqual([]);
  });

  it("matches cities case- and underscore-insensitively", () => {
    expect(searchTimeZones("los ang", options).map((o) => o.id)).toEqual(["America/Los_Angeles"]);
    expect(searchTimeZones("buenos", options).map((o) => o.id)).toEqual([
      "America/Argentina/Buenos_Aires",
    ]);
  });

  it("matches zone names and offsets", () => {
    expect(searchTimeZones("pacific", options).map((o) => o.id)).toEqual(["America/Los_Angeles"]);
    expect(searchTimeZones("gmt-5", options).map((o) => o.id)).toEqual(["America/New_York"]);
  });

  it("ranks city prefix matches ahead of other matches", () => {
    const zones = ["Europe/Paris", "America/Paramaribo", "Asia/Kolkata"].map((id) => describeTimeZone(id, winter));
    expect(searchTimeZones("par", zones).map((o) => o.id)).toEqual([
      "America/Paramaribo",
      "Europe/Paris",
    ]);
  });

  it("caps the result list", () => {
    const all = supportedTimeZones().map((id) => describeTimeZone(id, winter));
    expect(searchTimeZones("america", all, 5)).toHaveLength(5);
  });
});

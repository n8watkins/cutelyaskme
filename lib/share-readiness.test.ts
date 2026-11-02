import { describe, expect, it } from "vitest";
import {
  formatStopList,
  missingVenuesMessage,
  stopNeedsVenue,
  stopsMissingVenues,
} from "./share-readiness";

describe("stopsMissingVenues", () => {
  it("lists stops without a place, in lineup order", () => {
    expect(
      stopsMissingVenues([
        { label: "Bookstore", activity: "Bookstore", hasVenue: true },
        { label: "Photo booth", activity: "Photo booth", hasVenue: false },
        { label: "Pizza", activity: "Pizza", hasVenue: false },
      ]),
    ).toEqual(["Photo booth", "Pizza"]);
  });

  it("never asks for a place for stops that have none", () => {
    expect(stopNeedsVenue("Surprise ending")).toBe(false);
    expect(
      stopsMissingVenues([
        { label: "Surprise ending", activity: "Surprise ending", hasVenue: false },
      ]),
    ).toEqual([]);
  });

  it("is empty when every stop has a place", () => {
    expect(
      stopsMissingVenues([{ label: "Coffee", activity: "Coffee", hasVenue: true }]),
    ).toEqual([]);
  });
});

describe("missingVenuesMessage", () => {
  it("names every missing stop in plain English", () => {
    expect(formatStopList(["Coffee"])).toBe("Coffee");
    expect(formatStopList(["Coffee", "Movie", "Pizza"])).toBe("Coffee, Movie and Pizza");
    expect(missingVenuesMessage(["Photo booth", "Pizza"])).toBe(
      "Pick a spot for Photo booth and Pizza before sharing.",
    );
  });

  it("is null once the plan is ready", () => {
    expect(missingVenuesMessage([])).toBeNull();
  });
});

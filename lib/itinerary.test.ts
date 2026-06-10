import { describe, it, expect } from "vitest";
import {
  buildItineraryStops,
  deterministicTimeline,
  sanitizeItinerary,
  type ItineraryInput,
} from "./itinerary";

const input: ItineraryInput = {
  selectedDateLabel: "Friday, June 12",
  selectedTimeLabel: "6:30 PM",
  selectedTime: "18:30",
  selectedEntree: "Tacos",
  selectedActivities: ["Coffee", "Sunset view"],
  selectedEntreeVenue: { name: "Taco Casa", address: "12 Mission St" },
  selectedActivityVenues: {
    Coffee: { name: "Brew Lab", address: "9 Pine Ave" },
  },
};

describe("buildItineraryStops", () => {
  it("lists activities in order, then the entree", () => {
    const stops = buildItineraryStops(input);
    expect(stops.map((s) => s.label)).toEqual(["Coffee", "Sunset view", "Tacos"]);
    expect(stops[0].venue?.name).toBe("Brew Lab");
    expect(stops[2].key).toBe("__entree__");
  });

  it('skips the entree for "Surprise me" or none', () => {
    expect(
      buildItineraryStops({ ...input, selectedEntree: "Surprise me" }).map((s) => s.label),
    ).toEqual(["Coffee", "Sunset view"]);
    expect(buildItineraryStops({ ...input, selectedEntree: null })).toHaveLength(2);
  });
});

describe("deterministicTimeline", () => {
  it("projects times from default durations and names venues verbatim", () => {
    const tl = deterministicTimeline(buildItineraryStops(input), 18 * 60 + 30);
    expect(tl.map((e) => e.time)).toEqual(["6:30 PM", "7:15 PM", "8:00 PM"]); // Coffee 45m, Sunset view 45m
    expect(tl.map((e) => e.activity)).toEqual([
      "Coffee at Brew Lab",
      "Sunset view",
      "Tacos at Taco Casa",
    ]);
  });
});

describe("sanitizeItinerary", () => {
  it("acceptance: N stops in, N entries out, every venue name matching", () => {
    const raw = {
      title: "Golden Hour & Tacos",
      summary: "A slow, glowy evening.",
      timeline: [
        { time: "6:30 PM", emoji: "☕", activity: "Coffee at Brew Lab", note: "Grab the window seats at Brew Lab." },
        { time: "7:15 PM", emoji: "🛋️", activity: "Cozy Corner coffee and chat", note: "Snuggle into Cozy Corner." },
        { time: "7:45 PM", emoji: "🌅", activity: "Sunset view", note: "Time the Sunset view for golden hour." },
        { time: "8:30 PM", emoji: "🌮", activity: "Dinner at Taco Casa", note: "Order the al pastor at Taco Casa." },
      ],
      tips: ["Make a reservation at Taco Casa.", "Wear comfy shoes."],
    };
    const out = sanitizeItinerary(raw, input);

    expect(out.timeline).toHaveLength(3);
    expect(out.timeline.map((e) => e.activity)).toEqual([
      "Coffee at Brew Lab",
      "Sunset view",
      "Tacos at Taco Casa",
    ]);
    // Notes from matched entries survive; the hallucinated "Cozy Corner" doesn't.
    expect(out.timeline[0].note).toBe("Grab the window seats at Brew Lab.");
    expect(out.timeline[1].note).toBe("Time the Sunset view for golden hour.");
    expect(out.timeline[2].note).toBe("Order the al pastor at Taco Casa.");
    expect(JSON.stringify(out)).not.toContain("Cozy Corner");
    expect(out.title).toBe("Golden Hour & Tacos");
  });

  it("requires the chosen venue's name — a generic activity mention can't smuggle a fake venue", () => {
    const raw = {
      timeline: [
        { time: "6:30 PM", emoji: "☕", activity: "Coffee", note: "Cozy Corner has the best lattes." },
      ],
      tips: [],
    };
    const out = sanitizeItinerary(raw, input);
    // Falls back to the deterministic note (the address), not the fake venue's.
    expect(out.timeline[0].note).toBe("9 Pine Ave");
  });

  it("matches by activity label when no venue is chosen yet", () => {
    const noVenues: ItineraryInput = { ...input, selectedEntreeVenue: null, selectedActivityVenues: {} };
    const raw = {
      timeline: [
        { time: "7:00 PM", emoji: "🌅", activity: "Golden hour sunset view", note: "Bring a blanket." },
      ],
      tips: [],
    };
    const out = sanitizeItinerary(raw, noVenues);
    expect(out.timeline[1].note).toBe("Bring a blanket.");
  });

  it("falls back to the full deterministic itinerary on garbage", () => {
    const out = sanitizeItinerary("not even json-shaped", input);
    expect(out.timeline).toHaveLength(3);
    expect(out.timeline[0].activity).toBe("Coffee at Brew Lab");
    expect(out.title).toBe("Your Date Night");
    expect(out.tips).toEqual([]);
  });

  it("keeps only tips that mention a real stop or venue, capped at 3", () => {
    const raw = {
      timeline: [],
      tips: [
        "Brew Lab parking fills up fast.",        // venue ✓
        "Arrive early and hold hands.",            // generic ✗
        "Catch the sunset right at golden hour.",  // "sunset" stop ✓
        "Taco Casa takes reservations.",           // venue ✓
        "Order extra guac at Taco Casa.",          // ✓ but over the cap
      ],
    };
    const out = sanitizeItinerary(raw, input);
    expect(out.tips).toEqual([
      "Brew Lab parking fills up fast.",
      "Catch the sunset right at golden hour.",
      "Taco Casa takes reservations.",
    ]);
  });

  it("drops non-string tips", () => {
    const out = sanitizeItinerary({ tips: [42, null, { tip: "Brew Lab" }] }, input);
    expect(out.tips).toEqual([]);
  });
});

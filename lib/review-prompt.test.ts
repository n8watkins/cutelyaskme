import { describe, it, expect } from "vitest";
import {
  pickReviewPromptPlan,
  reviewPromptTitle,
  weekdayName,
  type ReviewCandidatePlan,
} from "./review-prompt";

// No itinerary → dateEnd projects from stops: 18:30 + Coffee(45) + Drinks(75)
// + entree(75) = 21:45 on the selected date.
function plan(id: string, overrides: Partial<ReviewCandidatePlan> = {}): ReviewCandidatePlan {
  return {
    id,
    confirmedAt: "2026-06-01 12:00:00",
    canceledAt: null,
    selectedDate: "2026-06-05",
    selectedTime: "18:30",
    timezone: "UTC",
    selectedEntree: "Tacos",
    selectedActivities: JSON.stringify(["Coffee", "Drinks"]),
    itinerary: null,
    ...overrides,
  };
}

const NONE = new Set<string>();
// Well after every test plan's dateEnd.
const LATER = new Date("2026-06-20T12:00:00Z");

describe("pickReviewPromptPlan", () => {
  it("picks an over, confirmed, unreviewed plan", () => {
    expect(pickReviewPromptPlan([plan("a")], NONE, LATER)?.id).toBe("a");
  });

  it("skips unconfirmed plans", () => {
    expect(pickReviewPromptPlan([plan("a", { confirmedAt: null })], NONE, LATER)).toBeNull();
  });

  it("skips canceled plans", () => {
    expect(
      pickReviewPromptPlan([plan("a", { canceledAt: "2026-06-04 09:00:00" })], NONE, LATER),
    ).toBeNull();
  });

  it("skips plans the user already reviewed", () => {
    expect(pickReviewPromptPlan([plan("a")], new Set(["a"]), LATER)).toBeNull();
  });

  it("skips plans that aren't over yet (or have no date)", () => {
    // Date ends 21:45; at 20:00 it's still going.
    expect(
      pickReviewPromptPlan([plan("a")], NONE, new Date("2026-06-05T20:00:00Z")),
    ).toBeNull();
    expect(pickReviewPromptPlan([plan("a", { selectedDate: null })], NONE, LATER)).toBeNull();
  });

  it("prompts about the most recently ended plan when several are eligible", () => {
    const older = plan("old", { selectedDate: "2026-06-01" });
    const newer = plan("new", { selectedDate: "2026-06-05" });
    expect(pickReviewPromptPlan([newer, older], NONE, LATER)?.id).toBe("new");
    expect(pickReviewPromptPlan([older, newer], NONE, LATER)?.id).toBe("new");
  });

  it("falls through to an older plan when the newest was reviewed", () => {
    const older = plan("old", { selectedDate: "2026-06-01" });
    const newer = plan("new", { selectedDate: "2026-06-05" });
    expect(pickReviewPromptPlan([older, newer], new Set(["new"]), LATER)?.id).toBe("old");
  });
});

describe("weekdayName / reviewPromptTitle", () => {
  it("names the local calendar day", () => {
    expect(weekdayName("2026-06-09")).toBe("Tuesday");
    expect(weekdayName("2026-06-05")).toBe("Friday");
  });

  it("returns null for missing or malformed dates", () => {
    expect(weekdayName(null)).toBeNull();
    expect(weekdayName("June 9th")).toBeNull();
  });

  it("builds the headline with a dayless fallback", () => {
    expect(reviewPromptTitle("2026-06-09")).toBe("How did Tuesday's date go? 💘");
    expect(reviewPromptTitle(null)).toBe("How did your date go? 💘");
  });
});

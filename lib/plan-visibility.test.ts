import { describe, expect, it } from "vitest";
import { areRecipientPlanDetailsVisible } from "./plan-visibility";

const base = {
  notificationMode: "surprise" as const,
  confirmedAt: "2026-07-01T00:00:00.000Z",
  revealedAt: null,
  selectedDate: "2026-07-14",
  selectedTime: "19:00",
  timezone: "America/Los_Angeles",
};

describe("areRecipientPlanDetailsVisible", () => {
  it("keeps a confirmed surprise hidden until its local start", () => {
    expect(
      areRecipientPlanDetailsVisible(base, new Date("2026-07-15T01:59:59.000Z")),
    ).toBe(false);
    expect(
      areRecipientPlanDetailsVisible(base, new Date("2026-07-15T02:00:00.000Z")),
    ).toBe(true);
  });

  it("honors an explicit early reveal", () => {
    expect(
      areRecipientPlanDetailsVisible(
        { ...base, revealedAt: "2026-07-14T12:00:00.000Z" },
        new Date("2026-07-14T12:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("shows shared details and hides unconfirmed sender drafts", () => {
    expect(areRecipientPlanDetailsVisible({ ...base, notificationMode: "share" })).toBe(true);
    expect(areRecipientPlanDetailsVisible({ ...base, confirmedAt: null })).toBe(false);
  });
});

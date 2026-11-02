import { describe, expect, it } from "vitest";
import { plannerErrorMessage, readServerMessage } from "./planner-errors";

describe("plannerErrorMessage", () => {
  it("explains an already-shared plan instead of saying try again", () => {
    expect(plannerErrorMessage("save", 409, "This date was already shared")).toBe(
      "This date was already shared. Reload the page to see the latest version.",
    );
  });

  it("passes the share gate's checklist message through", () => {
    expect(
      plannerErrorMessage("share", 422, "Pick a spot for Pizza before sharing."),
    ).toBe("Pick a spot for Pizza before sharing.");
  });

  it("separates offline, signed-out, rate-limited and server failures", () => {
    expect(plannerErrorMessage("save", 0)).toMatch(/Couldn't reach the server/);
    expect(plannerErrorMessage("share", 401)).toBe(
      "You were signed out. Sign in again, then share the plan.",
    );
    expect(plannerErrorMessage("save", 429)).toMatch(/Wait a minute/);
    expect(plannerErrorMessage("save", 500, "Failed to update plan")).toMatch(/on our side/);
  });

  it("falls back to the server's own words for other client errors", () => {
    expect(plannerErrorMessage("save", 400, "Invalid stop order")).toBe(
      "Couldn't save your spots: Invalid stop order.",
    );
    expect(plannerErrorMessage("save", 400)).toBe("Couldn't save your spots. Try again.");
  });
});

describe("readServerMessage", () => {
  it("reads the message field and tolerates non-JSON bodies", async () => {
    expect(await readServerMessage(Response.json({ message: "Nope" }))).toBe("Nope");
    expect(await readServerMessage(new Response("<html>"))).toBeNull();
  });
});

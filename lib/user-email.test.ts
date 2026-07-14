import { describe, expect, it } from "vitest";
import { hasVerifiedEmailAddress } from "./user-email";

describe("hasVerifiedEmailAddress", () => {
  it("matches any verified address without case sensitivity", () => {
    expect(
      hasVerifiedEmailAddress(
        [
          { emailAddress: "primary@example.test", verification: { status: "verified" } },
          { emailAddress: "Invited@Example.Test", verification: { status: "verified" } },
        ],
        "invited@example.test",
      ),
    ).toBe(true);
  });

  it("rejects unverified and unrelated addresses", () => {
    expect(
      hasVerifiedEmailAddress(
        [{ emailAddress: "invited@example.test", verification: { status: "unverified" } }],
        "invited@example.test",
      ),
    ).toBe(false);
    expect(
      hasVerifiedEmailAddress(
        [{ emailAddress: "other@example.test", verification: { status: "verified" } }],
        "invited@example.test",
      ),
    ).toBe(false);
  });
});

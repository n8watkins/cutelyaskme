import { describe, expect, it } from "vitest";
import { validatedLoginReturnPath } from "./login-return";

describe("validatedLoginReturnPath", () => {
  it("accepts only local plan paths", () => {
    expect(validatedLoginReturnPath("/plan/plan_123-abc")).toBe(
      "/plan/plan_123-abc",
    );
    expect(validatedLoginReturnPath("https://attacker.test/plan/1")).toBeUndefined();
    expect(validatedLoginReturnPath("//attacker.test/plan/1")).toBeUndefined();
    expect(validatedLoginReturnPath("/plan/one?admin=true")).toBeUndefined();
    expect(validatedLoginReturnPath(["/plan/one"])).toBeUndefined();
  });
});

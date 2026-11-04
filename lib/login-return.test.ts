import { describe, expect, it } from "vitest";
import { validatedLoginReturnPath } from "./login-return";

describe("validatedLoginReturnPath", () => {
  it("accepts local plan pages and the signed-in pages", () => {
    expect(validatedLoginReturnPath("/plan/plan_123-abc")).toBe("/plan/plan_123-abc");
    expect(validatedLoginReturnPath("/plan/plan_123/memory")).toBe("/plan/plan_123/memory");
    expect(validatedLoginReturnPath("/send")).toBe("/send");
    expect(validatedLoginReturnPath("/dashboard")).toBe("/dashboard");
    expect(validatedLoginReturnPath("/settings")).toBe("/settings");
  });

  it("rejects other sites, query strings and non-strings", () => {
    expect(validatedLoginReturnPath("https://attacker.test/plan/1")).toBeUndefined();
    expect(validatedLoginReturnPath("//attacker.test/plan/1")).toBeUndefined();
    expect(validatedLoginReturnPath("/plan/one?admin=true")).toBeUndefined();
    expect(validatedLoginReturnPath("/plan/one/../../evil")).toBeUndefined();
    expect(validatedLoginReturnPath("/")).toBeUndefined();
    expect(validatedLoginReturnPath(["/plan/one"])).toBeUndefined();
  });
});

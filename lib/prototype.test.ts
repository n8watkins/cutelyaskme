import { describe, expect, it } from "vitest";
import { isPrototypeEnabled, isPrototypePath } from "./prototype";

describe("isPrototypeEnabled", () => {
  it("is on in development and with PROTOTYPE=1 only", () => {
    expect(isPrototypeEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isPrototypeEnabled({ NODE_ENV: "production", PROTOTYPE: "1" })).toBe(true);
    expect(isPrototypeEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isPrototypeEnabled({ NODE_ENV: "production", PROTOTYPE: "true" })).toBe(false);
    expect(isPrototypeEnabled({ NODE_ENV: "test" })).toBe(false);
  });
});

describe("isPrototypePath", () => {
  it("matches /proposal and everything under it, nothing else", () => {
    expect(isPrototypePath("/proposal")).toBe(true);
    expect(isPrototypePath("/proposal/plan")).toBe(true);
    expect(isPrototypePath("/proposals")).toBe(false);
    expect(isPrototypePath("/plan/proposal")).toBe(false);
  });
});

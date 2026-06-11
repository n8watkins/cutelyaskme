import { describe, expect, it } from "vitest";
import { buildShareUrl, findSharedMemory, mintShareToken } from "./memory-share";

describe("findSharedMemory", () => {
  const shared = { shareToken: "tok_abc", authorId: "a" };
  const unshared = { shareToken: null, authorId: "b" };

  it("returns the row whose token matches exactly", () => {
    expect(findSharedMemory([unshared, shared], "tok_abc")).toBe(shared);
  });

  it("returns null when no row matches", () => {
    expect(findSharedMemory([unshared, shared], "tok_other")).toBeNull();
    expect(findSharedMemory([], "tok_abc")).toBeNull();
  });

  it("never matches an empty or missing token", () => {
    expect(findSharedMemory([shared, unshared], "")).toBeNull();
    expect(findSharedMemory([shared, unshared], null)).toBeNull();
    expect(findSharedMemory([shared, unshared], undefined)).toBeNull();
  });

  it("never unlocks a row with sharing off (shareToken null)", () => {
    // Paranoia: even a weird falsy-ish probe must not match a null token.
    expect(findSharedMemory([unshared], "null")).toBeNull();
  });
});

describe("buildShareUrl", () => {
  it("builds origin + memory path + share query", () => {
    expect(buildShareUrl("https://cutelyask.com", "plan1", "tok_abc")).toBe(
      "https://cutelyask.com/plan/plan1/memory?share=tok_abc",
    );
  });

  it("URL-encodes the token", () => {
    expect(buildShareUrl("https://x.test", "p", "a b&c")).toBe(
      "https://x.test/plan/p/memory?share=a%20b%26c",
    );
  });
});

describe("mintShareToken", () => {
  it("mints long, dash-free, unique tokens", () => {
    const a = mintShareToken();
    const b = mintShareToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

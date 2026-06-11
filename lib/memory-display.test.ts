import { describe, expect, it } from "vitest";
import { parsePhotoRefs, pickMemoryForViewer, type MemoryRowLike } from "./memory-display";

function row(overrides: Partial<MemoryRowLike>): MemoryRowLike {
  return {
    authorId: "user_a",
    notes: "notes",
    poem: "poem",
    photoRefs: "[]",
    musicTrack: null,
    updatedAt: "2026-06-01 12:00:00",
    ...overrides,
  };
}

describe("pickMemoryForViewer", () => {
  it("returns null when there are no memories", () => {
    expect(pickMemoryForViewer([], "user_a")).toBeNull();
    expect(pickMemoryForViewer([], null)).toBeNull();
  });

  it("prefers the viewer's own memory", () => {
    const mine = row({ authorId: "me" });
    const theirs = row({ authorId: "them", updatedAt: "2026-06-09 12:00:00" });
    expect(pickMemoryForViewer([theirs, mine], "me")).toBe(mine);
  });

  it("falls back to the other participant's memory", () => {
    const theirs = row({ authorId: "them" });
    expect(pickMemoryForViewer([theirs], "me")).toBe(theirs);
  });

  it("picks the most recently updated when the viewer has none and several exist", () => {
    const older = row({ authorId: "a", updatedAt: "2026-06-01 12:00:00" });
    const newer = row({ authorId: "b", updatedAt: "2026-06-08 09:30:00" });
    expect(pickMemoryForViewer([older, newer], "me")).toBe(newer);
    expect(pickMemoryForViewer([newer, older], "me")).toBe(newer);
  });

  it("handles a null viewer (share-link path) by returning the newest row", () => {
    const older = row({ authorId: "a", updatedAt: "2026-06-01 12:00:00" });
    const newer = row({ authorId: "b", updatedAt: "2026-06-08 09:30:00" });
    expect(pickMemoryForViewer([older, newer], null)).toBe(newer);
  });

  it("does not mutate the input array", () => {
    const older = row({ authorId: "a", updatedAt: "2026-06-01 12:00:00" });
    const newer = row({ authorId: "b", updatedAt: "2026-06-08 09:30:00" });
    const input = [newer, older];
    pickMemoryForViewer(input, "me");
    expect(input[0]).toBe(newer);
  });
});

describe("parsePhotoRefs", () => {
  it("parses a valid array", () => {
    const json = JSON.stringify([{ url: "https://x/a.jpg", publicId: "a" }]);
    expect(parsePhotoRefs(json)).toEqual([{ url: "https://x/a.jpg", publicId: "a" }]);
  });

  it("returns [] for null, bad JSON, and non-arrays", () => {
    expect(parsePhotoRefs(null)).toEqual([]);
    expect(parsePhotoRefs("not json")).toEqual([]);
    expect(parsePhotoRefs('{"url":"x"}')).toEqual([]);
  });

  it("filters out malformed entries", () => {
    const json = JSON.stringify([
      { url: "https://x/a.jpg", publicId: "a" },
      { url: 5, publicId: "b" },
      "nope",
      null,
    ]);
    expect(parsePhotoRefs(json)).toEqual([{ url: "https://x/a.jpg", publicId: "a" }]);
  });
});

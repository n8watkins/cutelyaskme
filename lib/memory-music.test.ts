import { describe, expect, it } from "vitest";
import {
  DEFAULT_MUSIC_TRACK,
  MUSIC_TRACKS,
  isMusicTrack,
  resolveMusicTrack,
} from "./memory-music";

describe("MUSIC_TRACKS", () => {
  it("has 2–3 tracks with unique ids and /audio/ paths", () => {
    expect(MUSIC_TRACKS.length).toBeGreaterThanOrEqual(2);
    expect(MUSIC_TRACKS.length).toBeLessThanOrEqual(3);
    const ids = MUSIC_TRACKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of MUSIC_TRACKS) {
      expect(t.src).toMatch(/^\/audio\/.+\.mp3$/);
      expect(t.attribution).toContain("Kevin MacLeod");
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  it("default track is the first one", () => {
    expect(DEFAULT_MUSIC_TRACK).toBe(MUSIC_TRACKS[0]);
  });
});

describe("isMusicTrack", () => {
  it("accepts every known id", () => {
    for (const t of MUSIC_TRACKS) expect(isMusicTrack(t.id)).toBe(true);
  });

  it("rejects unknown ids and non-strings", () => {
    expect(isMusicTrack("rickroll")).toBe(false);
    expect(isMusicTrack("")).toBe(false);
    expect(isMusicTrack(null)).toBe(false);
    expect(isMusicTrack(undefined)).toBe(false);
    expect(isMusicTrack(42)).toBe(false);
    expect(isMusicTrack({ id: "heartwarming" })).toBe(false);
  });
});

describe("resolveMusicTrack", () => {
  it("resolves a stored id to its track", () => {
    expect(resolveMusicTrack("bittersweet").id).toBe("bittersweet");
  });

  it("falls back to the default for null/undefined/unknown", () => {
    expect(resolveMusicTrack(null)).toBe(DEFAULT_MUSIC_TRACK);
    expect(resolveMusicTrack(undefined)).toBe(DEFAULT_MUSIC_TRACK);
    expect(resolveMusicTrack("nope")).toBe(DEFAULT_MUSIC_TRACK);
  });
});

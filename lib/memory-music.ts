// G1: background music for the keepsake card (/plan/[id]/memory).
//
// Small royalty-free loops bundled in public/audio/ (see ATTRIBUTION.md there —
// all three are Kevin MacLeod, CC BY 4.0, trimmed to ~72s loops). The card's
// <audio loop> plays one of these on tap; `date_memories.music_track` stores a
// track id from this list (null = default). Both the page and the memories API
// validate ids with `isMusicTrack` so a bad value can never reach the DB or
// render a broken <audio> src.

export type MusicTrack = {
  /** Stable id stored in date_memories.music_track. */
  id: string;
  /** Human label shown in the card's track picker. */
  label: string;
  /** Public URL of the bundled loop. */
  src: string;
  /** Credit line (CC BY requires attribution — also in public/audio/ATTRIBUTION.md). */
  attribution: string;
};

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  {
    id: "heartwarming",
    label: "Heartwarming 🎹",
    src: "/audio/heartwarming-loop.mp3",
    attribution:
      '"Heartwarming" Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0',
  },
  {
    id: "wholesome",
    label: "Wholesome 🌿",
    src: "/audio/wholesome-loop.mp3",
    attribution:
      '"Wholesome" Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0',
  },
  {
    id: "bittersweet",
    label: "Bittersweet 🌙",
    src: "/audio/bittersweet-loop.mp3",
    attribution:
      '"Bittersweet" Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0',
  },
] as const;

/** The track played when a memory has no music_track set. */
export const DEFAULT_MUSIC_TRACK = MUSIC_TRACKS[0];

/** Is `value` a valid MUSIC_TRACKS id? (API + page validation.) */
export function isMusicTrack(value: unknown): value is string {
  return typeof value === "string" && MUSIC_TRACKS.some((t) => t.id === value);
}

/** The track for a stored music_track value — unknown/null falls back to the default. */
export function resolveMusicTrack(id: string | null | undefined): MusicTrack {
  return MUSIC_TRACKS.find((t) => t.id === id) ?? DEFAULT_MUSIC_TRACK;
}

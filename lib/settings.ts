import type { CalendarMode } from "@/lib/calendar";

/**
 * B4: per-user app settings (the `/settings` page + `user_settings` table).
 * Pure defaults + validation live here so the API route, the Settings page,
 * and the planner (Task B) all share one source of truth.
 */

/** A2: how the planner map reacts to the mouse wheel. */
export type MapZoomMode = "ctrl" | "plain";
/** localStorage key the planner reads today; Settings mirrors writes into it. */
export const MAP_ZOOM_MODE_KEY = "ca:mapZoomMode";

export function parseMapZoomMode(raw: string | null): MapZoomMode {
  return raw === "plain" ? "plain" : "ctrl";
}

/** B3: Yelp hard-caps search radius at 25 mi; Overpass clamps to match. */
export const RADIUS_LIMIT_MIN_MI = 1;
export const RADIUS_LIMIT_MAX_MI = 25;

export type UserSettings = {
  /** Planner slider's initial value, in miles. Always within [radiusMinMi, radiusMaxMi]. */
  defaultRadiusMi: number;
  /** Planner slider's lower bound (>= 1 mi). */
  radiusMinMi: number;
  /** Planner slider's upper bound (<= 25 mi, the Yelp cap). */
  radiusMaxMi: number;
  mapZoomMode: MapZoomMode;
  /** E3: calendar export shape — one event vs. one event per stop. */
  calendarMode: CalendarMode;
};

export const DEFAULT_SETTINGS: UserSettings = {
  defaultRadiusMi: 5,
  radiusMinMi: RADIUS_LIMIT_MIN_MI,
  radiusMaxMi: RADIUS_LIMIT_MAX_MI,
  mapZoomMode: "ctrl",
  calendarMode: "single",
};

/**
 * Task B one-time migration: before the Settings page existed, zoom +
 * calendar prefs lived only in `ca:` localStorage keys. Given the server's
 * settings and the raw legacy values, return the PATCH body that preserves
 * the old prefs — or null when there's nothing to lift up. Invalid/absent
 * legacy values and values already matching the server are ignored, so the
 * result is safe to PATCH blindly.
 */
export function legacySettingsPatch(
  server: Pick<UserSettings, "mapZoomMode" | "calendarMode">,
  legacy: { mapZoomMode: string | null; calendarMode: string | null },
): Partial<Pick<UserSettings, "mapZoomMode" | "calendarMode">> | null {
  const patch: Partial<Pick<UserSettings, "mapZoomMode" | "calendarMode">> = {};
  if (
    (legacy.mapZoomMode === "ctrl" || legacy.mapZoomMode === "plain") &&
    legacy.mapZoomMode !== server.mapZoomMode
  ) {
    patch.mapZoomMode = legacy.mapZoomMode;
  }
  if (
    (legacy.calendarMode === "single" || legacy.calendarMode === "per-stop") &&
    legacy.calendarMode !== server.calendarMode
  ) {
    patch.calendarMode = legacy.calendarMode;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Validate an untrusted PATCH body into a partial settings object.
 * Unknown keys are ignored; known keys with wrong types/enums are errors.
 * (Range checks happen later, in mergeSettings, against the merged whole.)
 */
export function parseSettingsPatch(body: unknown): Result<Partial<UserSettings>> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Expected a JSON object" };
  }
  const b = body as Record<string, unknown>;
  const patch: Partial<UserSettings> = {};

  for (const key of ["defaultRadiusMi", "radiusMinMi", "radiusMaxMi"] as const) {
    if (b[key] !== undefined) {
      if (!isFiniteNumber(b[key])) return { ok: false, error: `${key} must be a number` };
      patch[key] = b[key];
    }
  }
  if (b.mapZoomMode !== undefined) {
    if (b.mapZoomMode !== "ctrl" && b.mapZoomMode !== "plain") {
      return { ok: false, error: 'mapZoomMode must be "ctrl" or "plain"' };
    }
    patch.mapZoomMode = b.mapZoomMode;
  }
  if (b.calendarMode !== undefined) {
    if (b.calendarMode !== "single" && b.calendarMode !== "per-stop") {
      return { ok: false, error: 'calendarMode must be "single" or "per-stop"' };
    }
    patch.calendarMode = b.calendarMode;
  }
  return { ok: true, value: patch };
}

/**
 * Apply a (validated) partial patch onto base settings and normalize:
 * - bounds rounded + clamped into the 1–25 mi hard limits
 * - min < max required (else error — the only unrecoverable input)
 * - default radius rounded + clamped into the user's own bounds
 */
export function mergeSettings(
  base: UserSettings,
  patch: Partial<UserSettings>,
): Result<UserSettings> {
  const merged = { ...base, ...patch };
  const radiusMinMi = clampInt(merged.radiusMinMi, RADIUS_LIMIT_MIN_MI, RADIUS_LIMIT_MAX_MI);
  const radiusMaxMi = clampInt(merged.radiusMaxMi, RADIUS_LIMIT_MIN_MI, RADIUS_LIMIT_MAX_MI);
  if (radiusMinMi >= radiusMaxMi) {
    return { ok: false, error: "Radius bounds must have min < max (within 1–25 mi)" };
  }
  const defaultRadiusMi = clampInt(merged.defaultRadiusMi, radiusMinMi, radiusMaxMi);
  return {
    ok: true,
    value: {
      defaultRadiusMi,
      radiusMinMi,
      radiusMaxMi,
      mapZoomMode: merged.mapZoomMode,
      calendarMode: merged.calendarMode,
    },
  };
}

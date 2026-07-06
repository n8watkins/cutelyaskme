// D3: pure travel-leg helpers shared by the Google Routes API route and the
// planner timeline (tested in route-legs.test.ts). All network work stays in
// src/app/api/route/route.ts - this module is coord math, response mapping,
// and formatting only.

import { haversineMiles, formatMiles, type LatLng } from "./geo";

export type LegMode = "drive" | "walk";

/**
 * Persisted key for a leg between two stops (plan.legModes JSON). One
 * constructor + parser, since the planner writes these and the recipient
 * view reads them back.
 */
export function legKey(fromId: string, toId: string): string {
  return `${fromId}\u2192${toId}`;
}

export function legKeyFromId(key: string): string {
  return key.split("\u2192")[0];
}

export type LegInfo = {
  distanceMeters: number;
  durationSec: number;
  /** true = haversine fallback, not a real routed value — render with "~". */
  estimate: boolean;
};

/** One hop between consecutive waypoints. `walk` is only set on short legs. */
export type RouteLeg = {
  drive: LegInfo;
  walk: LegInfo | null;
};

export const METERS_PER_MILE = 1609.344;

/** Legs shorter than this (driving distance) also get a walking option. */
export const WALK_THRESHOLD_METERS = 0.8 * METERS_PER_MILE;

// Fallback model: straight line × 1.3 road factor at a city-average speed.
const ROAD_FACTOR = 1.3;
const FALLBACK_SPEED_MPH: Record<LegMode, number> = { drive: 28, walk: 3 };

/** Round to 4 decimals (~11 m) so nearby requests share a cache row. */
export function roundCoord(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/** Coord path "lng,lat;lng,lat;…" (lon first!), rounded to 4 decimals. */
export function coordPath(points: LatLng[]): string {
  return points.map((p) => `${roundCoord(p.lng)},${roundCoord(p.lat)}`).join(";");
}

/** place_cache key for a full waypoint set. */
export function routeCacheKey(points: LatLng[]): string {
  return `routes:${coordPath(points)}`;
}

/** Routes API unreachable → haversine × 1.3 at 28 mph (drive) / 3 mph (walk), flagged. */
export function fallbackLeg(a: LatLng, b: LatLng, mode: LegMode = "drive"): LegInfo {
  const miles = haversineMiles(a, b) * ROAD_FACTOR;
  return {
    distanceMeters: Math.round(miles * METERS_PER_MILE),
    durationSec: Math.round((miles / FALLBACK_SPEED_MPH[mode]) * 3600),
    estimate: true,
  };
}

export function isWalkable(driveDistanceMeters: number): boolean {
  return driveDistanceMeters < WALK_THRESHOLD_METERS;
}

/** One route in a computeRoutes response under the Essentials field mask. */
export type ComputeRoutesRoute = {
  duration?: string;
  distanceMeters?: number;
};

/** Protobuf Duration JSON ("123s", "123.45s") → rounded seconds; null if malformed. */
export function parseDurationSec(duration: string | undefined): number | null {
  if (typeof duration !== "string") return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(duration);
  return match ? Math.round(Number(match[1])) : null;
}

/** computeRoutes route → routed LegInfo; null when the response is unusable. */
export function legInfoFromRoute(route: ComputeRoutesRoute | undefined): LegInfo | null {
  const durationSec = parseDurationSec(route?.duration);
  if (durationSec === null) return null;
  // Proto3 JSON omits zero values, so a missing distance on a parsed route is 0.
  const distance = route?.distanceMeters ?? 0;
  if (typeof distance !== "number" || !Number.isFinite(distance) || distance < 0) return null;
  return { distanceMeters: Math.round(distance), durationSec, estimate: false };
}

/** The numbers to show/use for a leg given the user's chosen mode. */
export function legInfoForMode(leg: RouteLeg, mode: LegMode): LegInfo {
  return mode === "walk" && leg.walk ? leg.walk : leg.drive;
}

/** "4 min", "59 min", "1 hr 5 min" — never under a minute. */
export function formatLegDuration(durationSec: number): string {
  const mins = Math.max(1, Math.round(durationSec / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** "12 min · 4.3 mi" — prefixed "~" when the values are a fallback estimate. */
export function formatLeg(info: LegInfo): string {
  const text = `${formatLegDuration(info.durationSec)} · ${formatMiles(info.distanceMeters / METERS_PER_MILE)}`;
  return info.estimate ? `~${text}` : text;
}

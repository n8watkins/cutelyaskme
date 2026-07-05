/**
 * Registry of every outbound service we count in `api_usage`, with its human
 * labels and real free-tier limits. Google Maps Platform bills per SKU with a
 * per-SKU monthly free cap (March 2025 pricing); the daily budget is a soft
 * pace marker (~cap/31) so a month can't be burned in a weekend. Services
 * with `monthlyCap: null` (NWS, Overpass, OSRM) are free and uncapped.
 *
 * Service names are the shared contract used by every trackApiUsage call:
 * places-search, places-details, places-photos, routes, static-maps,
 * maps-js-loads, plus overpass, osrm, and nws.
 */

export type ApiLimit = {
  service: string;
  label: string;
  /** Compact name for tight table columns. */
  shortLabel: string;
  /** Monthly free-tier cap in calls; null = free, uncapped service. */
  monthlyCap: number | null;
  /** Daily soft budget keeping the month on pace; null for uncapped services. */
  dailyBudget: number | null;
};

export const API_LIMITS: ApiLimit[] = [
  { service: "places-search", label: "Places text search", shortLabel: "Search", monthlyCap: 5000, dailyBudget: 160 },
  { service: "places-details", label: "Places details", shortLabel: "Details", monthlyCap: 1000, dailyBudget: 30 },
  { service: "places-photos", label: "Places photos", shortLabel: "Photos", monthlyCap: 10000, dailyBudget: 320 },
  { service: "routes", label: "Routes (Google)", shortLabel: "Routes", monthlyCap: 10000, dailyBudget: 320 },
  { service: "static-maps", label: "Static maps", shortLabel: "Static", monthlyCap: 10000, dailyBudget: 320 },
  { service: "maps-js-loads", label: "Map loads (Maps JS)", shortLabel: "Maps", monthlyCap: 10000, dailyBudget: 320 },
  { service: "overpass", label: "OpenStreetMap places (free, uncapped)", shortLabel: "OSM", monthlyCap: null, dailyBudget: null },
  { service: "nws", label: "Weather (NWS, free, uncapped)", shortLabel: "Weather", monthlyCap: null, dailyBudget: null },
];

export const TRACKED_SERVICES = API_LIMITS.map((l) => l.service);

/** Services the client may report via POST /api/usage (beacons). Everything
 * else is counted server-side only, so a stray client can't skew the meters. */
export const CLIENT_TRACKED_SERVICES = new Set(["maps-js-loads"]);

export function getApiLimit(service: string): ApiLimit | undefined {
  return API_LIMITS.find((l) => l.service === service);
}

/** Fraction of a cap consumed, clamped to [0, 1]; null when uncapped. */
export function capFraction(count: number, cap: number | null): number | null {
  if (cap === null || cap <= 0) return null;
  return Math.min(1, Math.max(0, count / cap));
}

/**
 * Plan ids ride in as untrusted query params; anything that isn't a plausible
 * id is dropped (returns null) rather than minted into an api_usage row key.
 */
export function sanitizePlanId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : null;
}

/**
 * Row key for api_usage: "service:day" for unattributed calls,
 * "service:day:planId" for calls made while planning a specific date.
 */
export function usageKey(service: string, day: string, planId?: string | null): string {
  return planId ? `${service}:${day}:${planId}` : `${service}:${day}`;
}

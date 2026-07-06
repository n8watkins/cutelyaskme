/**
 * Registry of every outbound service we count in `api_usage`, with its human
 * labels and real free-tier limits. Google Maps Platform bills per SKU with a
 * per-SKU monthly free cap (March 2025 pricing); `dailyCap` mirrors the
 * per-day quota limits actually enforced in the Cloud Console (set July
 * 2026) - hitting one means Google rejects further calls until midnight PT,
 * and the app degrades gracefully. Services with `monthlyCap: null` (NWS,
 * Overpass) are free and uncapped.
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
  /** Per-day quota cap enforced in the Cloud Console; null for uncapped services. */
  dailyBudget: number | null;
};

export const API_LIMITS = [
  { service: "places-search", label: "Places text search", shortLabel: "Search", monthlyCap: 5000, dailyBudget: 150 },
  { service: "places-details", label: "Places details", shortLabel: "Details", monthlyCap: 1000, dailyBudget: 30 },
  { service: "places-photos", label: "Places photos", shortLabel: "Photos", monthlyCap: 1000, dailyBudget: 30 },
  { service: "places-autocomplete", label: "Location autocomplete", shortLabel: "Auto", monthlyCap: 10000, dailyBudget: 300 },
  { service: "routes", label: "Routes (Google)", shortLabel: "Routes", monthlyCap: 10000, dailyBudget: 300 },
  { service: "static-maps", label: "Static maps", shortLabel: "Static", monthlyCap: 10000, dailyBudget: 400 },
  { service: "maps-js-loads", label: "Map loads (Maps JS)", shortLabel: "Maps", monthlyCap: 10000, dailyBudget: 300 },
  { service: "overpass", label: "OpenStreetMap places (free, uncapped)", shortLabel: "OSM", monthlyCap: null, dailyBudget: null },
  { service: "nws", label: "Weather (NWS, free, uncapped)", shortLabel: "Weather", monthlyCap: null, dailyBudget: null },
] as const satisfies readonly ApiLimit[];

/**
 * The service-name union — trackApiUsage only accepts these, so a typo can't
 * silently mint an unmetered service that no dashboard ever reads.
 */
export type TrackedService = (typeof API_LIMITS)[number]["service"];

export const TRACKED_SERVICES: string[] = API_LIMITS.map((l) => l.service);

/** Services the client may report via POST /api/usage (beacons). Everything
 * else is counted server-side only, so a stray client can't skew the meters. */
export const CLIENT_TRACKED_SERVICES = new Set<TrackedService>(["maps-js-loads"]);

/** Narrow an untrusted string to a client-reportable service, else null. */
export function parseClientService(raw: string | undefined): TrackedService | null {
  return raw && CLIENT_TRACKED_SERVICES.has(raw as TrackedService) ? (raw as TrackedService) : null;
}

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
export function usageKey(service: TrackedService, day: string, planId?: string | null): string {
  return planId ? `${service}:${day}:${planId}` : `${service}:${day}`;
}

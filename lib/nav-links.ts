/**
 * Free Google Maps navigation deep links (Maps URLs - no API key, no billing):
 * https://www.google.com/maps/dir/?api=1&origin=…&waypoints=…&destination=…&travelmode=…
 * The universal form opens the native app on mobile and the website on desktop.
 */

export type NavStop = {
  lat: number;
  lng: number;
  /** Place or waypoint name; included alongside the coords when present. */
  name?: string | null;
};

/** The travel modes Google Maps URLs accept. */
export type NavTravelMode = "driving" | "walking" | "bicycling" | "transit";

/** Plan legModes use "drive"/"walk"; Maps URLs use "driving"/"walking". */
export function navTravelMode(legMode: "drive" | "walk" | null | undefined): NavTravelMode {
  return legMode === "walk" ? "walking" : "driving";
}

// 6 decimals is ~0.1 m of precision - keeps URLs tidy without losing accuracy.
function roundCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * One stop as an origin/destination/waypoint value. A name plus coords
 * ("Blue Bottle, 34.0537,-118.2428") pins the exact spot while keeping the
 * place name visible in the Maps UI; bare coords when unnamed.
 */
export function navStopValue(stop: NavStop): string {
  const coords = `${roundCoord(stop.lat)},${roundCoord(stop.lng)}`;
  const name = stop.name?.trim();
  return name ? `${name}, ${coords}` : coords;
}

function navUrl(params: URLSearchParams): string {
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Navigation across an ordered list of stops: first = origin, last =
 * destination, everything between = pipe-separated waypoints.
 * Null when there are fewer than two stops to route between.
 */
export function buildRouteNavUrl(
  stops: NavStop[],
  travelmode: NavTravelMode = "driving",
): string | null {
  if (stops.length < 2) return null;
  const params = new URLSearchParams({ api: "1" });
  params.set("origin", navStopValue(stops[0]));
  params.set("destination", navStopValue(stops[stops.length - 1]));
  const via = stops.slice(1, -1);
  if (via.length > 0) params.set("waypoints", via.map(navStopValue).join("|"));
  params.set("travelmode", travelmode);
  return navUrl(params);
}

/** Navigation for a single leg between two stops. */
export function buildLegNavUrl(
  from: NavStop,
  to: NavStop,
  travelmode: NavTravelMode = "driving",
): string {
  return buildRouteNavUrl([from, to], travelmode) as string;
}

/**
 * Navigation to one stop with no origin - Google Maps starts from the
 * user's current location, which is what you want mid-date.
 */
export function buildStopNavUrl(stop: NavStop, travelmode: NavTravelMode = "driving"): string {
  const params = new URLSearchParams({ api: "1" });
  params.set("destination", navStopValue(stop));
  params.set("travelmode", travelmode);
  return navUrl(params);
}

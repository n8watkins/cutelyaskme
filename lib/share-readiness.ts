import { NO_VENUE_ACTIVITIES } from "./venues";

// A plan can only be shared (or locked in as a surprise) once every stop that
// takes place somewhere has a place picked. Otherwise the person invited gets
// "Photo booth" and "Pizza" with no address and no way to get there.
// Used by the planner to gate the share buttons and by the notify route to
// enforce the same rule server-side.

export type ShareReadinessStop = {
  /** What the person invited sees for the stop, like "Photo booth" or "Pizza". */
  label: string;
  /** The activity key; for the meal stop, the cuisine. */
  activity: string;
  hasVenue: boolean;
};

export function stopNeedsVenue(activity: string): boolean {
  return !NO_VENUE_ACTIVITIES.has(activity);
}

/** Labels of the stops that still need a place, in lineup order. */
export function stopsMissingVenues(stops: readonly ShareReadinessStop[]): string[] {
  return stops
    .filter((stop) => stopNeedsVenue(stop.activity) && !stop.hasVenue)
    .map((stop) => stop.label);
}

/** "Coffee", "Coffee and Pizza", "Coffee, Movie and Pizza" */
export function formatStopList(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

export function missingVenuesMessage(labels: readonly string[]): string | null {
  if (labels.length === 0) return null;
  return `Pick a spot for ${formatStopList(labels)} before sharing.`;
}

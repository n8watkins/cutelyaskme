// F1/F2: when does the date actually END? — pure helpers, tested in
// date-end.test.ts.
//
// dateEnd = selected date + the last stop's end time, derived from the saved
// deterministic timeline (E1): last entry's start time + that stop's duration.
// Travel legs are client-side only (OSRM results aren't persisted), so callers
// that have them can pass `travelMinutes`; server-side they simply count as 0
// — same approximation `projectedStarts` makes for un-routed legs.
//
// Everything degrades gracefully: no timeline → project from stop durations;
// no stops → a default date length; no selected date → null (never "over").

import type { ItineraryJson } from "./db/schema";
import { parseTimeToMinutes } from "./datetime";
import { DEFAULT_STOP_DURATIONS } from "./venues";

/** With no stops to go on, assume a date lasts this long. */
export const DEFAULT_DATE_DURATION_MINUTES = 180;

const ENTREE_KEY = "__entree__";

export type DateEndInput = {
  /** "YYYY-MM-DD" — the selected calendar date. */
  selectedDate: string | null;
  /** "HH:MM" (24h) — the selected start time. */
  selectedTime: string | null;
  selectedEntree: string | null;
  /** Stop keys in lineup order (activity names). */
  selectedActivities: string[];
  /** The saved itinerary (its timeline carries the deterministic times). */
  itinerary: ItineraryJson | null;
  /** Travel minutes INTO each stop, when known (client-side OSRM legs). */
  travelMinutes?: Record<string, number>;
};

/** The plan row columns dateEnd needs — raw JSON strings straight from the DB. */
export type DateEndPlanRow = {
  selectedDate: string | null;
  selectedTime: string | null;
  selectedEntree: string | null;
  selectedActivities: string | null;
  itinerary: string | null;
};

/** The stop keys an itinerary covers, in lineup order (mirrors buildItineraryStops). */
export function dateStopKeys(
  selectedActivities: string[],
  selectedEntree: string | null,
): string[] {
  const keys = [...selectedActivities];
  if (selectedEntree && selectedEntree !== "Surprise me") keys.push(ENTREE_KEY);
  return keys;
}

/** Parse a timeline label like "7:45 PM" / "12:05 am" to minute-of-day, or null. */
export function parseClockLabel(label: string): number | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*$/i.exec(label);
  if (!m) return null;
  const rawH = parseInt(m[1], 10);
  const mins = parseInt(m[2] ?? "0", 10);
  if (rawH < 1 || rawH > 12 || mins > 59) return null;
  const pm = m[3].toUpperCase() === "PM";
  const h = (rawH % 12) + (pm ? 12 : 0);
  return h * 60 + mins;
}

/**
 * Minutes after the start of `selectedDate` when the date ends. Can exceed
 * 1440 when the night runs past midnight.
 *
 * Preferred source: the saved timeline's last entry (its time is the last
 * stop's deterministic start) + that stop's duration. Fallback: project the
 * stops from durations (+ travel where given). Last resort: a default length.
 */
export function dateEndMinutes(input: Omit<DateEndInput, "selectedDate">): number {
  const startMinutes = parseTimeToMinutes(input.selectedTime);
  const stops = dateStopKeys(input.selectedActivities, input.selectedEntree);
  const travel = input.travelMinutes ?? {};

  // The saved deterministic timeline, when parseable.
  const timeline = input.itinerary?.timeline;
  if (Array.isArray(timeline) && timeline.length > 0) {
    const last = timeline[timeline.length - 1];
    const lastStart = typeof last?.time === "string" ? parseClockLabel(last.time) : null;
    if (lastStart !== null) {
      // E1 guarantees one entry per stop in order, so the last entry is the
      // last stop; formatTime wraps at midnight, so unwrap relative to start.
      const lastKey = stops.length === timeline.length ? stops[timeline.length - 1] : null;
      const duration = (lastKey && DEFAULT_STOP_DURATIONS[lastKey]) || 60;
      const unwrapped = lastStart < startMinutes ? lastStart + 24 * 60 : lastStart;
      return unwrapped + duration;
    }
  }

  // No usable timeline yet — project straight from the selected stops.
  if (stops.length > 0) {
    let t = startMinutes;
    for (const key of stops) {
      t += (travel[key] ?? 0) + (DEFAULT_STOP_DURATIONS[key] ?? 60);
    }
    return t;
  }

  return startMinutes + DEFAULT_DATE_DURATION_MINUTES;
}

/**
 * The Date the plan ends (server-local clock), or null when no date is
 * selected yet — an unscheduled plan is never "over".
 */
export function dateEnd(input: DateEndInput): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.selectedDate ?? "");
  if (!m) return null;
  const end = dateEndMinutes(input);
  // Minutes > 1440 simply roll into the next day.
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 0, end);
}

/** dateEnd straight from a plan row's raw JSON columns (server-side use). */
export function dateEndFromPlan(plan: DateEndPlanRow): Date | null {
  return dateEnd({
    selectedDate: plan.selectedDate,
    selectedTime: plan.selectedTime,
    selectedEntree: plan.selectedEntree,
    selectedActivities: safeParse<string[]>(plan.selectedActivities, []),
    itinerary: safeParse<ItineraryJson | null>(plan.itinerary, null),
  });
}

/** F1 gate: has the date's end time passed? false when no date is selected. */
export function isDateOver(plan: DateEndPlanRow, now: Date = new Date()): boolean {
  const end = dateEndFromPlan(plan);
  return end !== null && now.getTime() > end.getTime();
}

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

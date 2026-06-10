// D2: sunset-aware schedule ordering — pure helpers, tested in schedule.test.ts.
//
// Given the lineup, per-stop durations, and the day's sun times, project when
// each stop actually starts; if a sun-sensitive stop ("Sunset view",
// "Stargazing", daylight activities) lands outside its window, propose a
// one-tap reorder that fixes it.

import { formatTime } from "./datetime";
import { SUN_SENSITIVE, sunWarning } from "./sun";

export type SunTimes = { sunset: number; dusk: number };

export type OrderSuggestion = {
  /** The sun-sensitive stop that lands outside its window. */
  stopKey: string;
  /** Inline banner copy, e.g. "🌅 Sunset view works best ~7:45–8:20 PM — move it to the end?" */
  message: string;
  /** The proposed full stop order (apply with one tap). */
  order: string[];
};

export type ScheduleOptions = {
  /** Minute-of-day the date starts (e.g. 6:30 PM = 1110). */
  startMinutes: number;
  /**
   * Travel time (minutes) INTO each stop, keyed by stop. Optional — legs that
   * haven't been routed yet simply count as zero. Approximation note: when we
   * evaluate a candidate order, each stop keeps its incoming-travel estimate.
   */
  travelMinutes?: Record<string, number>;
};

/** Projected start minute for every stop: travel-in + previous durations. */
export function projectedStarts(
  stops: string[],
  durations: Record<string, number>,
  startMinutes: number,
  travelMinutes: Record<string, number> = {},
): Record<string, number> {
  const starts: Record<string, number> = {};
  let t = startMinutes;
  for (const key of stops) {
    t += travelMinutes[key] ?? 0;
    starts[key] = t;
    t += durations[key] ?? 60;
  }
  return starts;
}

/**
 * Suggest a reorder when a sun-sensitive stop is scheduled outside its window.
 *
 * Strategy: find the first stop whose projected start trips `sunWarning`, then
 * try moving it later (sunset/stars want the evening — latest position first,
 * so "the end" wins when it works) or earlier (daylight activities). The first
 * candidate that clears the stop's warning without leaving the lineup worse
 * off wins; if nothing helps, return null and let the per-stop warnings speak.
 */
export function suggestOrder(
  stops: string[],
  durations: Record<string, number>,
  sun: SunTimes | null,
  opts: ScheduleOptions,
): OrderSuggestion | null {
  if (!sun || stops.length < 2) return null;
  const travel = opts.travelMinutes ?? {};

  const starts = projectedStarts(stops, durations, opts.startMinutes, travel);
  const warned = stops.filter((k) => sunWarning(k, starts[k], sun) !== null);
  const offender = warned[0];
  if (!offender) return null;

  const kind = SUN_SENSITIVE[offender];
  const from = stops.indexOf(offender);

  // Candidate positions, best-first: daylight stops move toward the start;
  // sunset/dark stops move toward the end.
  const candidates: number[] = [];
  if (kind === "daylight") {
    for (let p = 0; p < from; p++) candidates.push(p);
  } else {
    for (let p = stops.length - 1; p > from; p--) candidates.push(p);
  }

  for (const p of candidates) {
    const next = [...stops];
    next.splice(from, 1);
    next.splice(p, 0, offender);
    const nextStarts = projectedStarts(next, durations, opts.startMinutes, travel);
    if (sunWarning(offender, nextStarts[offender], sun) !== null) continue;
    const nextWarned = next.filter((k) => sunWarning(k, nextStarts[k], sun) !== null);
    if (nextWarned.length >= warned.length) continue; // must be a net improvement
    return {
      stopKey: offender,
      message: buildMessage(offender, kind, sun, p === stops.length - 1, p === 0),
      order: next,
    };
  }
  return null;
}

/** "~7:45–8:20 PM" — the friendly golden-hour window around sunset. */
export function sunsetWindowLabel(sun: SunTimes): string {
  const start = formatTime(roundTo5(sun.sunset - 20));
  const end = formatTime(roundTo5(sun.sunset + 15));
  // Drop the first meridiem when both match: "7:45 PM–8:20 PM" → "7:45–8:20 PM".
  const sharedMeridiem = start.slice(-2) === end.slice(-2);
  return `~${sharedMeridiem ? start.slice(0, -3) : start}–${end}`;
}

function roundTo5(minutes: number): number {
  return Math.round(minutes / 5) * 5;
}

function buildMessage(
  stop: string,
  kind: (typeof SUN_SENSITIVE)[string] | undefined,
  sun: SunTimes,
  toEnd: boolean,
  toStart: boolean,
): string {
  if (kind === "atSunset") {
    return `🌅 ${stop} works best ${sunsetWindowLabel(sun)} — move it ${toEnd ? "to the end" : "later"}?`;
  }
  if (kind === "needsDark") {
    return `🌌 ${stop} needs dark skies (after ~${formatTime(roundTo5(sun.dusk))}) — move it ${toEnd ? "to the end" : "later"}?`;
  }
  return `🌞 ${stop} wants daylight (sun sets ~${formatTime(roundTo5(sun.sunset))}) — move it ${toStart ? "to the start" : "earlier"}?`;
}

import { formatTime } from "@/lib/datetime";
import {
  buildLegNavUrl,
  buildRouteNavUrl,
  buildStopNavUrl,
  navTravelMode,
  type NavStop,
} from "@/lib/nav-links";

/**
 * E3: shape of the calendar export. A user setting (B4/WP-H) stored in
 * localStorage under `ca:calendarMode` until the Settings page exists:
 * - "single"   — one event spanning the whole date window
 * - "per-stop" — every stop becomes its own event at its own time/venue
 */
export type CalendarMode = "single" | "per-stop";
export const CALENDAR_MODE_KEY = "ca:calendarMode";

export function parseCalendarMode(raw: string | null): CalendarMode {
  return raw === "per-stop" ? "per-stop" : "single";
}

type ItineraryStop = {
  startMinutes: number;
  icon: string;
  label: string;
  venue: { name: string; lat?: number; lng?: number } | null;
  /** Preformatted travel into this stop ("🚗 12 min · 4.3 mi"); null/absent when unrouted. */
  travelIn?: string | null;
};

/** A timeline stop with everything the calendar exports need. */
export type CalendarStop = {
  key: string;
  startMinutes: number;
  endMinutes: number;
  icon: string;
  label: string;
  venue: { name: string; address: string; lat?: number; lng?: number } | null;
  travelIn?: string | null;
  /** Chosen mode for the leg into this stop; drives the nav link's travelmode. */
  legMode?: "drive" | "walk" | null;
};

/** The venue as a nav-link stop; null when it has no coords (older plans). */
function venueNavStop(venue: { name: string; lat?: number; lng?: number } | null): NavStop | null {
  if (!venue || venue.lat == null || venue.lng == null) return null;
  return { name: venue.name, lat: venue.lat, lng: venue.lng };
}

// Plain-text version of the whole lineup, for calendar event descriptions.
// Travel legs (when routed) are interleaved before the stop they lead into,
// and a Google Maps navigation link for the route closes it out.
export function buildItineraryText(timeline: ItineraryStop[], planLink: string): string {
  const lines: string[] = [];
  const navStops: NavStop[] = [];
  for (const s of timeline) {
    if (!s.venue) continue;
    if (s.travelIn) lines.push(`  ↓ ${s.travelIn}`);
    lines.push(`${formatTime(s.startMinutes)} — ${s.icon} ${s.label} @ ${s.venue.name}`);
    const nav = venueNavStop(s.venue);
    if (nav) navStops.push(nav);
  }
  const out = ["Your date plan 💕", ...lines, "", `Full plan: ${planLink}`];
  const routeNav =
    navStops.length >= 2
      ? buildRouteNavUrl(navStops)
      : navStops.length === 1
        ? buildStopNavUrl(navStops[0])
        : null;
  if (routeNav) out.push(`Navigate the route: ${routeNav}`);
  return out.join("\n");
}

/**
 * "Navigate to this stop" line for the i-th venue stop: a leg link from the
 * previous venue, or a from-current-location link for the first one. Null
 * when the venue has no coords.
 */
function stopNavLine(withVenue: CalendarStop[], i: number): string | null {
  const to = venueNavStop(withVenue[i].venue);
  if (!to) return null;
  const mode = navTravelMode(withVenue[i].legMode);
  const from = i > 0 ? venueNavStop(withVenue[i - 1].venue) : null;
  const url = from ? buildLegNavUrl(from, to, mode) : buildStopNavUrl(to, mode);
  return `Navigate to this stop: ${url}`;
}

// Escape a value for an iCalendar text field.
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildGCalLink(
  title: string,
  startMinutes: number,
  endMinutes: number,
  location: string,
  selectedDate: string | null,
  details: string,
): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const text = encodeURIComponent(title);
  const loc = encodeURIComponent(location);
  const det = encodeURIComponent(details);

  if (!selectedDate) {
    return `${base}&text=${text}&location=${loc}&details=${det}`;
  }

  const datePart = selectedDate.replace(/-/g, "");
  const start = `${datePart}T${gcalTime(startMinutes)}`;
  const end = `${datePart}T${gcalTime(endMinutes)}`;

  return `${base}&text=${text}&dates=${start}/${end}&location=${loc}&details=${det}`;
}

function gcalTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}${m.toString().padStart(2, "0")}00`;
}

const SINGLE_EVENT_TITLE = "💕 Date night";

/** The whole-evening window across stops with a venue; null when none chosen. */
export function dateWindow(
  timeline: { startMinutes: number; endMinutes: number; venue: unknown }[],
): { startMinutes: number; endMinutes: number } | null {
  const withVenue = timeline.filter((s) => s.venue);
  if (withVenue.length === 0) return null;
  return {
    startMinutes: withVenue[0].startMinutes,
    endMinutes: withVenue[withVenue.length - 1].endMinutes,
  };
}

/**
 * The Google Calendar links for the chosen mode (GCal web links are one
 * event per click, so per-stop mode yields one pre-filled link per stop).
 * Every event's description carries the full itinerary + plan link.
 */
export function buildGCalLinks(
  timeline: CalendarStop[],
  opts: { mode: CalendarMode; selectedDate: string | null; planLink: string },
): { key: string; label: string; url: string }[] {
  const details = buildItineraryText(timeline, opts.planLink);
  const withVenue = timeline.filter((s) => s.venue);
  if (withVenue.length === 0) return [];

  if (opts.mode === "single") {
    const window = dateWindow(timeline)!;
    return [
      {
        key: "all",
        label: SINGLE_EVENT_TITLE,
        url: buildGCalLink(
          SINGLE_EVENT_TITLE,
          window.startMinutes,
          window.endMinutes,
          withVenue[0].venue!.address,
          opts.selectedDate,
          details,
        ),
      },
    ];
  }

  return withVenue.map((stop, i) => {
    const nav = stopNavLine(withVenue, i);
    return {
      key: stop.key,
      label: `${stop.icon} ${stop.label}`,
      url: buildGCalLink(
        `${stop.icon} ${stop.label} — ${stop.venue!.name}`,
        stop.startMinutes,
        stop.endMinutes,
        stop.venue!.address,
        opts.selectedDate,
        nav ? `${details}\n${nav}` : details,
      ),
    };
  });
}

function icsDateTime(datePart: string, minutes: number): string {
  return `${datePart}T${gcalTime(minutes)}`;
}

/**
 * The full .ics file content for the chosen mode — one all-evening VEVENT
 * ("single") or one VEVENT per stop ("per-stop"), in a single calendar.
 */
export function buildICS(
  timeline: CalendarStop[],
  opts: { mode: CalendarMode; selectedDate: string | null; planId: string; planLink: string },
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cutely Ask Me//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const datePart = (opts.selectedDate ?? new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const description = icsEscape(buildItineraryText(timeline, opts.planLink));
  const withVenue = timeline.filter((s) => s.venue);

  if (opts.mode === "single") {
    const window = dateWindow(timeline);
    if (window) {
      lines.push(
        "BEGIN:VEVENT",
        `DTSTART:${icsDateTime(datePart, window.startMinutes)}`,
        `DTEND:${icsDateTime(datePart, window.endMinutes)}`,
        `SUMMARY:${icsEscape(SINGLE_EVENT_TITLE)}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${icsEscape(withVenue[0].venue!.address)}`,
        `UID:date-${opts.planId}@cutelyask`,
        "END:VEVENT",
      );
    }
  } else {
    withVenue.forEach((stop, i) => {
      const nav = stopNavLine(withVenue, i);
      lines.push(
        "BEGIN:VEVENT",
        `DTSTART:${icsDateTime(datePart, stop.startMinutes)}`,
        `DTEND:${icsDateTime(datePart, stop.endMinutes)}`,
        `SUMMARY:${icsEscape(`${stop.icon} ${stop.label} — ${stop.venue!.name}`)}`,
        `DESCRIPTION:${nav ? `${description}\\n${icsEscape(nav)}` : description}`,
        `LOCATION:${icsEscape(stop.venue!.address)}`,
        `UID:${stop.key}-${opts.planId}@cutelyask`,
        "END:VEVENT",
      );
    });
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

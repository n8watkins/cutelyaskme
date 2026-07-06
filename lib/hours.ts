// Venue business-hours helpers (C4) — pure, tested in hours.test.ts.

import { formatTime } from "@/lib/datetime";

/** One opening window from venue details. Days: 0=Mon … 6=Sun. */
export type OpenSlot = {
  day: number;
  start: string; // "1700"
  end: string; // "2300"
  is_overnight: boolean;
};

export type VenueDetails = {
  hours: OpenSlot[];
  isOpenNow: boolean | null;
  url?: string;
  /** The venue's own site — menus, tickets, reservations. */
  website?: string;
  phone?: string;
  reviews: { rating: number; text: string; author: string; date: string }[];
};

/** "2026-06-20" → day index (0=Mon). */
export function dayIndexFromDate(dateStr: string): number | null {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getDay() + 6) % 7; // JS 0=Sun → 0=Mon
}

/** "1730" → minutes since midnight (1050). */
export function slotMinutes(t: string): number {
  return parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(2), 10);
}

/** Opening windows for a day, ends extended past midnight for overnight slots. */
export function daySlots(slots: OpenSlot[], day: number): { start: number; end: number }[] {
  return slots
    .filter((s) => s.day === day)
    .map((s) => {
      const start = slotMinutes(s.start);
      let end = slotMinutes(s.end);
      if (s.is_overnight || end <= start) end += 1440;
      return { start, end };
    })
    .sort((a, b) => a.start - b.start);
}

/** "5:00 PM – 11:00 PM, …" for a day, or "Closed". */
export function formatDayHours(slots: OpenSlot[], day: number): string {
  const ranges = daySlots(slots, day);
  if (!ranges.length) return "Closed";
  return ranges.map((r) => `${formatTime(r.start)} – ${formatTime(r.end)}`).join(", ");
}

export type OpenBadge = {
  state: "open" | "closes-early" | "opens-late" | "closed" | "unknown";
  label: string;
};

/**
 * Does the venue's schedule cover the planned stop window?
 * Window minutes may exceed 1440 when the timeline wraps past midnight.
 */
export function openBadge(
  slots: OpenSlot[],
  day: number | null,
  startMin: number,
  endMin: number,
): OpenBadge {
  if (day == null || !slots.length) return { state: "unknown", label: "Hours unknown" };
  const ranges = daySlots(slots, day);
  if (!ranges.length) return { state: "closed", label: "Closed that day" };

  for (const r of ranges) {
    if (startMin >= r.start && endMin <= r.end) {
      return { state: "open", label: "Open during your stop" };
    }
  }
  // Partial overlaps → say what clips the plan.
  for (const r of ranges) {
    if (startMin < r.end && endMin > r.start) {
      if (endMin > r.end) {
        return { state: "closes-early", label: `Closes ${formatTime(r.end)}` };
      }
      return { state: "opens-late", label: `Opens ${formatTime(r.start)}` };
    }
  }
  return {
    state: "closed",
    label: `Closed then (open ${formatTime(ranges[0].start)} – ${formatTime(ranges[0].end)})`,
  };
}

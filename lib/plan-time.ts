// Timezone-aware calendar helpers for plan lifecycle and dashboard grouping.
//
// Plans store a local date, a local time, and an IANA timezone. These helpers
// turn that wall-clock intent into an instant without depending on the server's
// timezone. They also make daylight-saving gaps and repeated times explicit.

export type ZonedDateTimeDisambiguation = "earlier" | "later" | "reject";

export type ZonedDateTimeFailureReason =
  | "invalid-date"
  | "invalid-time"
  | "invalid-time-zone"
  | "nonexistent-time"
  | "ambiguous-time";

export type ZonedDateTimeResolution =
  | {
      ok: true;
      instant: Date;
      ambiguous: boolean;
    }
  | {
      ok: false;
      reason: ZonedDateTimeFailureReason;
    };

export type LocalDateClassification = "past" | "today" | "future" | "unscheduled" | "invalid";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type DateTimeParts = DateParts & {
  hour: number;
  minute: number;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const OFFSET_SAMPLE_RANGE_MS = 3 * 24 * 60 * 60 * 1000;
const OFFSET_SAMPLE_STEP_MS = 6 * 60 * 60 * 1000;

/** True only for IANA timezones supported by the current JavaScript runtime. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a local wall time to an absolute instant.
 *
 * Spring-forward times that never occur are rejected. Fall-back times occur
 * twice and default to the earlier instant unless the caller chooses otherwise.
 */
export function resolveZonedDateTime(
  date: string,
  time: string,
  timeZone: string,
  disambiguation: ZonedDateTimeDisambiguation = "earlier",
): ZonedDateTimeResolution {
  const dateParts = parseDate(date);
  if (!dateParts) return { ok: false, reason: "invalid-date" };

  const timeParts = parseTime(time);
  if (!timeParts) return { ok: false, reason: "invalid-time" };

  const formatter = makeFormatter(timeZone);
  if (!formatter) return { ok: false, reason: "invalid-time-zone" };

  const target: DateTimeParts = { ...dateParts, ...timeParts };
  const targetAsUtc = utcTimestamp(target);
  const offsets = offsetsNear(targetAsUtc, formatter);
  const matches = [...offsets]
    .map((offset) => targetAsUtc - offset)
    .filter((timestamp) => sameDateTime(partsAt(timestamp, formatter), target))
    .filter((timestamp, index, values) => values.indexOf(timestamp) === index)
    .sort((a, b) => a - b);

  if (matches.length === 0) return { ok: false, reason: "nonexistent-time" };
  if (matches.length > 1 && disambiguation === "reject") {
    return { ok: false, reason: "ambiguous-time" };
  }

  const timestamp = disambiguation === "later" ? matches[matches.length - 1] : matches[0];
  return {
    ok: true,
    instant: new Date(timestamp),
    ambiguous: matches.length > 1,
  };
}

/** Resolve a plan-local wall time, returning null for any invalid input. */
export function zonedDateTimeToInstant(
  date: string,
  time: string,
  timeZone: string,
  disambiguation: ZonedDateTimeDisambiguation = "earlier",
): Date | null {
  const result = resolveZonedDateTime(date, time, timeZone, disambiguation);
  return result.ok ? result.instant : null;
}

/** Add the plan's elapsed duration to its timezone-resolved start instant. */
export function planEndInstant(
  selectedDate: string | null,
  selectedTime: string | null,
  endMinutes: number,
  timeZone: string,
  disambiguation: ZonedDateTimeDisambiguation = "earlier",
): Date | null {
  const time = parseTime(selectedTime ?? "");
  if (!selectedDate || !time || !Number.isInteger(endMinutes)) return null;
  const startMinutes = time.hour * 60 + time.minute;
  const elapsedMinutes = endMinutes - startMinutes;
  if (elapsedMinutes < 0) return null;

  const start = zonedDateTimeToInstant(
    selectedDate,
    selectedTime!,
    timeZone,
    disambiguation,
  );
  return start ? new Date(start.getTime() + elapsedMinutes * 60 * 1000) : null;
}

/** Return the YYYY-MM-DD calendar key for an instant in an IANA timezone. */
export function dateKeyInTimeZone(instant: Date, timeZone: string): string | null {
  if (Number.isNaN(instant.getTime())) return null;
  const formatter = makeFormatter(timeZone);
  if (!formatter) return null;
  return formatDate(partsAt(instant.getTime(), formatter));
}

/** Group a stored plan date against today's date in that plan's timezone. */
export function classifyPlanDate(
  selectedDate: string | null,
  timeZone: string,
  now: Date = new Date(),
): LocalDateClassification {
  if (selectedDate === null) return "unscheduled";
  if (!parseDate(selectedDate)) return "invalid";

  const today = dateKeyInTimeZone(now, timeZone);
  if (!today) return "invalid";
  if (selectedDate === today) return "today";
  return selectedDate < today ? "past" : "future";
}

function parseDate(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const normalized = addCalendarDays(parts, 0);
  return sameDate(parts, normalized) ? parts : null;
}

function parseTime(value: string): Pick<DateTimeParts, "hour" | "minute"> | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

function makeFormatter(timeZone: string): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return null;
  }
}

function offsetsNear(targetAsUtc: number, formatter: Intl.DateTimeFormat): Set<number> {
  const offsets = new Set<number>();
  for (
    let sample = targetAsUtc - OFFSET_SAMPLE_RANGE_MS;
    sample <= targetAsUtc + OFFSET_SAMPLE_RANGE_MS;
    sample += OFFSET_SAMPLE_STEP_MS
  ) {
    const parts = partsAt(sample, formatter);
    offsets.add(utcTimestamp(parts) - sample);
  }
  return offsets;
}

function partsAt(timestamp: number, formatter: Intl.DateTimeFormat): DateTimeParts {
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of formatter.formatToParts(new Date(timestamp))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
  };
}

function utcTimestamp(parts: DateTimeParts): number {
  const instant = new Date(0);
  instant.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  instant.setUTCHours(parts.hour, parts.minute, 0, 0);
  return instant.getTime();
}

function addCalendarDays(date: DateParts, days: number): DateParts {
  const instant = new Date(0);
  instant.setUTCFullYear(date.year, date.month - 1, date.day + days);
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
  };
}

function sameDate(a: DateParts, b: DateParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function sameDateTime(a: DateTimeParts, b: DateTimeParts): boolean {
  return sameDate(a, b) && a.hour === b.hour && a.minute === b.minute;
}

function formatDate(date: DateParts): string {
  return `${date.year.toString().padStart(4, "0")}-${pad2(date.month)}-${pad2(date.day)}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

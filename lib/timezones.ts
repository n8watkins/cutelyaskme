// Timezone helpers for the recipient's "Lock it in" step. The date's timezone
// defaults to the browser's own zone; the searchable picker is only an
// override, so these helpers turn raw IANA ids into names people recognize
// ("Los Angeles - Pacific Time") and rank matches for a typed query.

export type TimeZoneOption = {
  id: string;
  city: string;
  region: string;
  longName: string;
  offset: string;
};

export function detectBrowserTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && zone !== "Etc/Unknown" ? zone : null;
  } catch {
    return null;
  }
}

export function supportedTimeZones(): string[] {
  try {
    const zones = Intl.supportedValuesOf?.("timeZone") ?? [];
    return zones.includes("UTC") ? zones : [...zones, "UTC"];
  } catch {
    return ["UTC"];
  }
}

function zoneName(id: string, now: Date, style: "longGeneric" | "shortOffset"): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: id, timeZoneName: style })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}

export function describeTimeZone(id: string, now: Date = new Date()): TimeZoneOption {
  const segments = id.split("/");
  const city = (segments.at(-1) ?? id).replaceAll("_", " ");
  const region = segments.length > 1 ? segments.slice(0, -1).join(" / ").replaceAll("_", " ") : "";
  const offset = zoneName(id, now, "shortOffset");
  return {
    id,
    city,
    region,
    longName: zoneName(id, now, "longGeneric"),
    offset: offset === "GMT" ? "GMT+0" : offset,
  };
}

/** "Los Angeles - Pacific Time" */
export function timeZoneLabel(option: TimeZoneOption): string {
  return option.longName && option.longName !== option.city
    ? `${option.city} - ${option.longName}`
    : option.city;
}

function normalize(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

/**
 * Rank zones for a typed query. City prefix beats city substring beats a
 * match on the region, the long name ("pacific", "central european") or the
 * offset ("gmt-5"). An empty query returns nothing: the picker shows the
 * detected zone until the person starts typing.
 */
export function searchTimeZones(
  query: string,
  options: TimeZoneOption[],
  limit = 8,
): TimeZoneOption[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { option: TimeZoneOption; score: number }[] = [];
  for (const option of options) {
    const city = normalize(option.city);
    const longName = normalize(option.longName);
    const haystack = `${normalize(option.region)} ${normalize(option.id)} ${longName} ${normalize(option.offset)}`;
    let score = -1;
    if (city.startsWith(q)) score = 0;
    else if (city.includes(q)) score = 1;
    else if (longName.startsWith(q)) score = 2;
    else if (haystack.includes(q)) score = 3;
    if (score >= 0) scored.push({ option, score });
  }
  scored.sort((a, b) => a.score - b.score || a.option.city.localeCompare(b.option.city));
  return scored.slice(0, limit).map((entry) => entry.option);
}

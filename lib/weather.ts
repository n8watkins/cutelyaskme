// NWS (api.weather.gov) forecast helpers — pure, tested in weather.test.ts.

/** One forecast period from the NWS daily forecast (roughly 12h each). */
export type NwsPeriod = {
  startTime: string; // ISO with offset, e.g. "2026-07-11T06:00:00-07:00"
  isDaytime: boolean;
  temperature: number; // °F
  shortForecast: string; // "Sunny", "Chance Rain Showers", …
  probabilityOfPrecipitation?: { value: number | null };
};

export type DayForecast = {
  tempF: number;
  shortForecast: string;
  /** 0-100, null when NWS doesn't provide one */
  precipChance: number | null;
};

/** Emoji for an NWS shortForecast string — coarse on purpose. */
export function forecastEmoji(shortForecast: string): string {
  const s = shortForecast.toLowerCase();
  if (s.includes("thunder")) return "⛈️";
  if (s.includes("snow") || s.includes("flurr")) return "❄️";
  if (s.includes("rain") || s.includes("shower") || s.includes("drizzle")) return "🌧️";
  if (s.includes("fog") || s.includes("haze") || s.includes("smoke")) return "🌫️";
  if (s.includes("partly") || s.includes("mostly sunny")) return "🌤️";
  if (s.includes("cloud") || s.includes("overcast")) return "☁️";
  if (s.includes("sunny") || s.includes("clear")) return "☀️";
  return "🌡️";
}

/**
 * The daytime period for a "YYYY-MM-DD" date, from NWS `periods`.
 * Uses the period's own local date (its ISO offset), not the server's zone.
 * Null when the date is outside the forecast window (~7 days).
 */
export function pickDayForecast(periods: NwsPeriod[], date: string): DayForecast | null {
  const period = periods.find((p) => p.isDaytime && p.startTime.slice(0, 10) === date);
  if (!period) return null;
  return {
    tempF: period.temperature,
    shortForecast: period.shortForecast,
    precipChance: period.probabilityOfPrecipitation?.value ?? null,
  };
}

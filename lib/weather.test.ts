import { describe, it, expect } from "vitest";
import { forecastEmoji, pickDayForecast, type NwsPeriod } from "./weather";

const periods: NwsPeriod[] = [
  {
    startTime: "2026-07-11T06:00:00-07:00",
    isDaytime: true,
    temperature: 74,
    shortForecast: "Mostly Sunny",
    probabilityOfPrecipitation: { value: 10 },
  },
  {
    startTime: "2026-07-11T18:00:00-07:00",
    isDaytime: false,
    temperature: 58,
    shortForecast: "Clear",
    probabilityOfPrecipitation: { value: null },
  },
  {
    startTime: "2026-07-12T06:00:00-07:00",
    isDaytime: true,
    temperature: 68,
    shortForecast: "Chance Rain Showers",
  },
];

describe("pickDayForecast", () => {
  it("returns the daytime period for the date", () => {
    expect(pickDayForecast(periods, "2026-07-11")).toEqual({
      tempF: 74,
      shortForecast: "Mostly Sunny",
      precipChance: 10,
    });
  });
  it("null precip when NWS omits it", () => {
    expect(pickDayForecast(periods, "2026-07-12")?.precipChance).toBeNull();
  });
  it("null when the date is outside the forecast window", () => {
    expect(pickDayForecast(periods, "2026-07-20")).toBeNull();
    expect(pickDayForecast([], "2026-07-11")).toBeNull();
  });
});

describe("forecastEmoji", () => {
  it("maps common forecasts", () => {
    expect(forecastEmoji("Sunny")).toBe("☀️");
    expect(forecastEmoji("Mostly Sunny")).toBe("🌤️");
    expect(forecastEmoji("Chance Rain Showers")).toBe("🌧️");
    expect(forecastEmoji("Severe Thunderstorms")).toBe("⛈️");
    expect(forecastEmoji("Patchy Fog")).toBe("🌫️");
    expect(forecastEmoji("Who Knows")).toBe("🌡️");
  });
});

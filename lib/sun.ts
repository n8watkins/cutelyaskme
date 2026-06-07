import { formatTime } from "@/lib/datetime";

export const SUN_SENSITIVE: Record<string, "atSunset" | "needsDark" | "daylight"> = {
  "Sunset view": "atSunset",
  Stargazing: "needsDark",
  "Scenic drive": "daylight",
  "Park picnic": "daylight",
};

// Flag a stop whose scheduled time fights the daylight (sunset is computed exactly).
export function sunWarning(
  key: string,
  startMin: number,
  sun: { sunset: number; dusk: number } | null,
): string | null {
  if (!sun) return null;
  const kind = SUN_SENSITIVE[key];
  if (!kind) return null;
  if (kind === "atSunset") {
    if (startMin > sun.sunset + 30) return `🌃 sun sets ~${formatTime(sun.sunset)} — it'll be dark`;
    if (startMin < sun.sunset - 90) return `still bright — sunset's ~${formatTime(sun.sunset)}`;
    return null;
  }
  if (kind === "needsDark") {
    if (startMin < sun.dusk) return `🌅 too early for stars — dark ~${formatTime(sun.dusk)}`;
    return null;
  }
  if (startMin > sun.sunset) return `🌃 sun's down by then (~${formatTime(sun.sunset)})`;
  return null;
}

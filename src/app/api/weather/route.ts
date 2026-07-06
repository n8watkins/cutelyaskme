import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/place-cache";
import { pickDayForecast, type DayForecast, type NwsPeriod } from "@/lib/weather";
import { trackApiUsage } from "@/lib/api-usage";
import { sanitizePlanId } from "@/lib/api-limits";

// NWS asks for an identifying User-Agent (app + contact) instead of an API key.
const NWS_UA = "cutelyaskme (https://cutelyaskme.vercel.app; nathancwatkins23@gmail.com)";
const HOUR_MS = 60 * 60 * 1000;

/**
 * Forecast for the date at the plan's map center — free NWS data, US-only.
 * Returns 404 whenever a forecast isn't available (non-US, >7 days out,
 * NWS down); callers just hide the weather chip.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const date = searchParams.get("date") ?? "";
  const planId = sanitizePlanId(searchParams.get("plan"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  // ~1km cache buckets — a date happens in one city, no need for precision.
  const cacheKey = `nws:${lat.toFixed(2)},${lng.toFixed(2)}:${date}`;

  const hit = await cacheGet<DayForecast | null>(cacheKey);
  if (hit !== undefined) {
    return hit
      ? NextResponse.json(hit)
      : NextResponse.json({ message: "No forecast" }, { status: 404 });
  }

  let forecast: DayForecast | null = null;
  try {
    // NWS is free and uncapped; counted anyway so the dashboard sees everything.
    void trackApiUsage("nws", 1, planId);
    const pointsRes = await fetch(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
      { headers: { "User-Agent": NWS_UA } },
    );
    if (!pointsRes.ok) return NextResponse.json({ message: "No forecast" }, { status: 404 });
    const points = (await pointsRes.json()) as { properties?: { forecast?: string } };
    const forecastUrl = points.properties?.forecast;
    if (!forecastUrl) return NextResponse.json({ message: "No forecast" }, { status: 404 });

    void trackApiUsage("nws", 1, planId);
    const forecastRes = await fetch(forecastUrl, { headers: { "User-Agent": NWS_UA } });
    if (!forecastRes.ok) return NextResponse.json({ message: "No forecast" }, { status: 404 });
    const data = (await forecastRes.json()) as { properties?: { periods?: NwsPeriod[] } };
    forecast = pickDayForecast(data.properties?.periods ?? [], date);
  } catch {
    return NextResponse.json({ message: "Weather unreachable" }, { status: 502 });
  }

  // Cache hits and misses alike (a miss usually means the date is still >7
  // days out — no point re-asking NWS every page view). Misses expire sooner.
  await cacheSet(cacheKey, forecast, (forecast ? 3 : 1) * HOUR_MS);

  return forecast
    ? NextResponse.json(forecast)
    : NextResponse.json({ message: "No forecast" }, { status: 404 });
}

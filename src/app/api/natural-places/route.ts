import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { placeCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Venue } from "@/lib/venues";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const USER_AGENT = "DateNightApp/1.0 (https://github.com/user/date-planner)";

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function buildQuery(type: string, lat: number, lng: number, radius: number): string {
  const around = `(around:${radius},${lat},${lng})`;
  switch (type) {
    case "park":
      return `[out:json][timeout:15];(node["leisure"="park"]${around};way["leisure"="park"]${around};node["leisure"="garden"]${around};way["leisure"="garden"]${around};);out center 10;`;
    case "viewpoint":
      return `[out:json][timeout:15];(node["tourism"="viewpoint"]${around};node["natural"="peak"]${around};way["natural"="peak"]${around};);out center 10;`;
    case "stargazing":
      return `[out:json][timeout:15];(node["tourism"="viewpoint"]${around};node["amenity"="observatory"]${around};node["leisure"="nature_reserve"]${around};way["leisure"="nature_reserve"]${around};node["natural"="peak"]${around};);out center 10;`;
    case "scenic_drive":
      // Drive-to destinations: mountain passes, viewpoints, peaks.
      return `[out:json][timeout:15];(node["mountain_pass"="yes"]${around};node["tourism"="viewpoint"]${around};node["natural"="peak"]${around};way["natural"="peak"]${around};);out center 10;`;
    default:
      return `[out:json][timeout:15];(node["leisure"="park"]${around};way["leisure"="park"]${around};);out center 10;`;
  }
}

function toVenue(el: OverpassElement): Venue | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const name = el.tags?.name;
  if (!lat || !lon || !name) return null;

  const street = el.tags?.["addr:street"] ?? "";
  const city = el.tags?.["addr:city"] ?? el.tags?.["addr:suburb"] ?? "";
  const address = [street, city].filter(Boolean).join(", ") || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    address,
    rating: 0,
    priceLevel: 1,
    lat,
    lng: lon,
  };
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ venues: [] }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const activity = searchParams.get("activity")?.trim(); // "park" | "viewpoint" | "stargazing"
  const location = searchParams.get("location")?.trim();
  const radius = Math.min(parseInt(searchParams.get("radius") ?? "8000", 10), 40000);

  if (!activity || !location) {
    return NextResponse.json({ venues: [] });
  }

  // Geocode location string → lat/lng via Nominatim
  let lat: number;
  let lng: number;

  const latLngMatch = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/.exec(location);
  if (latLngMatch) {
    lat = parseFloat(latLngMatch[1]);
    lng = parseFloat(latLngMatch[2]);
  } else {
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
        { headers: { "User-Agent": USER_AGENT } },
      );
      const geoData = (await geoRes.json()) as { lat: string; lon: string }[];
      if (!geoData[0]) return NextResponse.json({ venues: [] });
      lat = parseFloat(geoData[0].lat);
      lng = parseFloat(geoData[0].lon);
    } catch {
      return NextResponse.json({ venues: [] });
    }
  }

  const cacheKey = `overpass:${activity}:${lat.toFixed(3)}:${lng.toFixed(3)}:r${radius}`;
  const now = new Date().toISOString();

  try {
    const [cached] = await db
      .select()
      .from(placeCache)
      .where(eq(placeCache.cacheKey, cacheKey))
      .limit(1);

    if (cached && cached.expiresAt > now) {
      return NextResponse.json({ venues: JSON.parse(cached.results) as Venue[] });
    }
  } catch {}

  const query = buildQuery(activity, lat, lng, radius);
  let venues: Venue[] = [];

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (res.ok) {
      const data = (await res.json()) as { elements: OverpassElement[] };
      venues = data.elements.map(toVenue).filter((v): v is Venue => v !== null).slice(0, 10);
    }
  } catch {
    return NextResponse.json({ venues: [] });
  }

  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  await db
    .insert(placeCache)
    .values({ id: crypto.randomUUID(), cacheKey, results: JSON.stringify(venues), expiresAt })
    .onConflictDoUpdate({
      target: placeCache.cacheKey,
      set: { results: JSON.stringify(venues), expiresAt },
    })
    .catch(() => null);

  return NextResponse.json({ venues });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { placeCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Venue } from "@/lib/venues";
import { haversineMiles } from "@/lib/geo";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const USER_AGENT = "DateNightApp/1.0 (https://github.com/user/date-planner)";
// overpass-api.de 406s requests without a User-Agent and rate-limits bursts —
// try mirrors in order (C6).
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// "out center 40": fetch generously, then rank/filter ourselves — the old
// "out 10" capped BEFORE the name filter, so unnamed elements ate the quota.
function buildQuery(type: string, lat: number, lng: number, radius: number): string {
  const around = `(around:${radius},${lat},${lng})`;
  switch (type) {
    case "park":
      return `[out:json][timeout:15];(node["leisure"="park"]${around};way["leisure"="park"]${around};node["leisure"="garden"]${around};way["leisure"="garden"]${around};);out center 40;`;
    case "viewpoint":
      // Sunset-worthy: viewpoints, peaks, cliffs, beaches (C6).
      return `[out:json][timeout:15];(node["tourism"="viewpoint"]${around};node["natural"="peak"]${around};way["natural"="peak"]${around};node["natural"="cliff"]${around};way["natural"="cliff"]${around};node["natural"="beach"]${around};way["natural"="beach"]${around};);out center 40;`;
    case "stargazing":
      return `[out:json][timeout:15];(node["tourism"="viewpoint"]${around};node["amenity"="observatory"]${around};node["leisure"="nature_reserve"]${around};way["leisure"="nature_reserve"]${around};node["natural"="peak"]${around};);out center 40;`;
    case "scenic_drive":
      // Drive-to destinations: mountain passes, viewpoints, peaks.
      return `[out:json][timeout:15];(node["mountain_pass"="yes"]${around};node["tourism"="viewpoint"]${around};node["natural"="peak"]${around};way["natural"="peak"]${around};);out center 40;`;
    default:
      return `[out:json][timeout:15];(node["leisure"="park"]${around};way["leisure"="park"]${around};);out center 40;`;
  }
}

// Many great OSM spots are unnamed — give them a human label instead of
// throwing them away.
function fallbackName(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null;
  if (tags.tourism === "viewpoint") return "Scenic viewpoint";
  if (tags.natural === "peak") return tags.ele ? `Peak (${tags.ele} m)` : "Hilltop peak";
  if (tags.natural === "cliff") return "Cliff lookout";
  if (tags.natural === "beach") return "Beach";
  if (tags.mountain_pass === "yes") return "Mountain pass";
  if (tags.amenity === "observatory") return "Observatory";
  return null;
}

function toVenue(el: OverpassElement): (Venue & { named: boolean }) | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!lat || !lon) return null;
  const realName = el.tags?.name;
  const name = realName ?? fallbackName(el.tags);
  if (!name) return null;

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
    named: !!realName,
  };
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ venues: [] }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const activity = searchParams.get("activity")?.trim(); // "park" | "viewpoint" | "stargazing"
  const location = searchParams.get("location")?.trim();
  const radius = Math.min(parseInt(searchParams.get("radius") ?? "8000", 10), 100000);

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
  let fetchSucceeded = false;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // overpass-api.de 406s UA-less requests — this was the "seemingly
          // not connected" bug (C6).
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) continue;

      const data = (await res.json()) as { elements: OverpassElement[] };
      const center = { lat, lng };
      venues = data.elements
        .map(toVenue)
        .filter((v): v is Venue & { named: boolean } => v !== null)
        // Named spots first, then closest first.
        .sort(
          (a, b) =>
            Number(b.named) - Number(a.named) ||
            haversineMiles(center, a) - haversineMiles(center, b),
        )
        .slice(0, 10)
        .map((v) => {
          const { named: _ignored, ...rest } = v;
          void _ignored;
          return rest;
        });
      fetchSucceeded = true;
      break;
    } catch {
      // try the next mirror
    }
  }

  // Never cache a failure — the old code cached [] for 24h after one bad
  // Overpass response, making whole areas look permanently empty.
  if (!fetchSucceeded) {
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

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { trackApiUsage } from "@/lib/api-usage";
import {
  fallbackLeg,
  isWalkable,
  legInfoFromRoute,
  roundCoord,
  routeCacheKey,
  type ComputeRoutesRoute,
  type LegInfo,
  type LegMode,
  type RouteLeg,
} from "@/lib/route-legs";
import type { LatLng } from "@/lib/geo";

// D3: per-leg travel distance + time for an ordered waypoint set
// (pickup -> stop1 -> ... -> stopN). One Google Routes computeRoutes call per
// leg (the Essentials field mask carries no per-leg fields); legs under
// 0.8 mi also get a WALK-mode call. Cached in place_cache for 30 days by
// rounded (4-decimal) coords. API unreachable -> haversine x 1.3 estimate, flagged.

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
// Essentials SKU only: never add traffic-aware routing, waypoint optimization,
// or location modifiers - each of those bumps the call to a pricier SKU.
const FIELD_MASK = "routes.duration,routes.distanceMeters";
const TRAVEL_MODE: Record<LegMode, string> = { drive: "DRIVE", walk: "WALK" };
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_POINTS = 12;

type ComputeRoutesResponse = { routes?: ComputeRoutesRoute[] };

/** Rounded like the cache key, so routed values match the row they're stored under. */
function waypoint(p: LatLng) {
  return { location: { latLng: { latitude: roundCoord(p.lat), longitude: roundCoord(p.lng) } } };
}

/** One computeRoutes call for a single leg; null on any failure (never cached). */
async function fetchRoutesLeg(mode: LegMode, from: LatLng, to: LatLng): Promise<LegInfo | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  try {
    void trackApiUsage("routes"); // outbound call (cache hits return before this)
    const res = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        origin: waypoint(from),
        destination: waypoint(to),
        travelMode: TRAVEL_MODE[mode],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ComputeRoutesResponse;
    return legInfoFromRoute(data.routes?.[0]);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { points?: unknown } | null;
  const raw = Array.isArray(body?.points) ? body.points : [];
  const points: LatLng[] = [];
  for (const p of raw) {
    const { lat, lng } = (p ?? {}) as { lat?: unknown; lng?: unknown };
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ message: "Invalid waypoint" }, { status: 400 });
    }
    points.push({ lat, lng });
  }
  if (points.length < 2 || points.length > MAX_POINTS) {
    return NextResponse.json(
      { message: `Provide 2–${MAX_POINTS} waypoints` },
      { status: 400 },
    );
  }

  const cacheKey = routeCacheKey(points);
  const now = new Date().toISOString();

  try {
    const [cached] = await db
      .select()
      .from(placeCache)
      .where(eq(placeCache.cacheKey, cacheKey))
      .limit(1);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({ legs: JSON.parse(cached.results) as RouteLeg[] });
    }
  } catch {
    // Cache miss - fall through to fetch
  }

  const drives = await Promise.all(
    points.slice(0, -1).map((from, i) => fetchRoutesLeg("drive", from, points[i + 1])),
  );
  const routed = drives.every((d) => d !== null);

  const legs: RouteLeg[] = points.slice(0, -1).map((from, i) => ({
    drive: drives[i] ?? fallbackLeg(from, points[i + 1], "drive"),
    walk: null,
  }));

  // Short hops also get a walking option (one WALK-mode call per such leg).
  await Promise.all(
    legs.map(async (leg, i) => {
      if (!isWalkable(leg.drive.distanceMeters)) return;
      const walk = drives[i] ? await fetchRoutesLeg("walk", points[i], points[i + 1]) : null;
      leg.walk = walk ?? fallbackLeg(points[i], points[i + 1], "walk");
    }),
  );

  // Only cache fully routed results - never lock in a 30-day fallback for an
  // unreachable API.
  if (routed) {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    await db
      .insert(placeCache)
      .values({ id: crypto.randomUUID(), cacheKey, results: JSON.stringify(legs), expiresAt })
      .onConflictDoUpdate({
        target: placeCache.cacheKey,
        set: { results: JSON.stringify(legs), expiresAt },
      })
      .catch(() => null);
  }

  return NextResponse.json({ legs });
}

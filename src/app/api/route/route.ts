import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { trackApiUsage } from "@/lib/api-usage";
import {
  fallbackLeg,
  isWalkable,
  osrmCoordPath,
  plausibleWalk,
  routeCacheKey,
  type RouteLeg,
} from "@/lib/route-legs";
import type { LatLng } from "@/lib/geo";

// D3: per-leg travel distance + time for an ordered waypoint set
// (pickup → stop1 → … → stopN). One OSRM driving call per set; legs under
// 0.8 mi also fetch the walking profile. Cached in place_cache for 30 days by
// rounded (4-decimal) coords. OSRM down → haversine × 1.3 estimate, flagged.

const OSRM_BASE = "https://router.project-osrm.org/route/v1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_POINTS = 12;

type OsrmLeg = { distance: number; duration: number };
type OsrmResponse = { code?: string; routes?: { legs?: OsrmLeg[] }[] };

/** One OSRM call for the whole point list; null on any failure (never cached). */
async function fetchOsrmLegs(
  profile: "driving" | "foot",
  points: LatLng[],
): Promise<OsrmLeg[] | null> {
  try {
    void trackApiUsage("osrm"); // outbound call (cache hits return before this)
    const res = await fetch(`${OSRM_BASE}/${profile}/${osrmCoordPath(points)}?overview=false`, {
      headers: { "User-Agent": "CutelyAsk/1.0 (date planner)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OsrmResponse;
    const legs = data.code === "Ok" ? (data.routes?.[0]?.legs ?? null) : null;
    if (!legs || legs.length !== points.length - 1) return null;
    return legs;
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
    // Cache miss — fall through to fetch
  }

  const driving = await fetchOsrmLegs("driving", points);

  const legs: RouteLeg[] = points.slice(0, -1).map((from, i) => ({
    drive: driving
      ? {
          distanceMeters: Math.round(driving[i].distance),
          durationSec: Math.round(driving[i].duration),
          estimate: false,
        }
      : fallbackLeg(from, points[i + 1], "drive"),
    walk: null,
  }));

  // Short hops also get a walking option (one foot-profile call per such leg).
  for (let i = 0; i < legs.length; i++) {
    if (!isWalkable(legs[i].drive.distanceMeters)) continue;
    const pair = [points[i], points[i + 1]];
    const foot = driving ? await fetchOsrmLegs("foot", pair) : null;
    legs[i].walk = foot
      ? plausibleWalk(
          legs[i].drive,
          { distanceMeters: Math.round(foot[0].distance), durationSec: Math.round(foot[0].duration), estimate: false },
          pair[0],
          pair[1],
        )
      : fallbackLeg(pair[0], pair[1], "walk");
  }

  // Only cache routed results — never lock in a 30-day fallback for a down server.
  if (driving) {
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

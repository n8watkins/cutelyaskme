import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { trackApiUsage } from "@/lib/api-usage";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PlaceGeo = { lat: number; lng: number; label: string };

/**
 * Resolve an autocomplete pick to coordinates. Terminates the autocomplete
 * session (same token) so the whole type-ahead interaction bills as one
 * Essentials-tier Details call. Cheap fields only — never request anything
 * that would bump the SKU here.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "Not configured" }, { status: 503 });

  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id")?.trim();
  const session = searchParams.get("session")?.trim();
  if (!id) return NextResponse.json({ message: "Bad request" }, { status: 400 });

  const cacheKey = `gp-geo:${id}`;
  const now = new Date().toISOString();
  try {
    const [cached] = await db
      .select()
      .from(placeCache)
      .where(eq(placeCache.cacheKey, cacheKey))
      .limit(1);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(JSON.parse(cached.results) as PlaceGeo);
    }
  } catch {}

  void trackApiUsage("places-autocomplete");
  let payload: PlaceGeo;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}${
        session ? `?sessionToken=${encodeURIComponent(session)}` : ""
      }`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "location,formattedAddress,displayName",
        },
      },
    );
    if (!res.ok) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const data = (await res.json()) as {
      location?: { latitude: number; longitude: number };
      formattedAddress?: string;
      displayName?: { text?: string };
    };
    if (!data.location) return NextResponse.json({ message: "No location" }, { status: 404 });
    payload = {
      lat: data.location.latitude,
      lng: data.location.longitude,
      label: data.displayName?.text || data.formattedAddress || "",
    };
  } catch {
    return NextResponse.json({ message: "Unreachable" }, { status: 502 });
  }

  const expiresAt = new Date(Date.now() + 30 * DAY_MS).toISOString();
  await db
    .insert(placeCache)
    .values({ id: crypto.randomUUID(), cacheKey, results: JSON.stringify(payload), expiresAt })
    .onConflictDoUpdate({
      target: placeCache.cacheKey,
      set: { results: JSON.stringify(payload), expiresAt },
    })
    .catch(() => null);

  return NextResponse.json(payload);
}

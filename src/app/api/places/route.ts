import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Venue } from "@/lib/venues";

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  priceLevel?: string;
  location?: { latitude: number; longitude: number };
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
};

function mapPriceLevel(level: string | undefined): 1 | 2 | 3 | 4 {
  if (!level) return 2;
  if (level === "PRICE_LEVEL_FREE" || level === "PRICE_LEVEL_INEXPENSIVE") return 1;
  if (level === "PRICE_LEVEL_MODERATE") return 2;
  if (level === "PRICE_LEVEL_EXPENSIVE") return 3;
  if (level === "PRICE_LEVEL_VERY_EXPENSIVE") return 4;
  return 2;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ venues: [] });
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const location = searchParams.get("location")?.trim();

  if (!q || !location) {
    return NextResponse.json({ venues: [] });
  }

  const cacheKey = `${q.toLowerCase()}:${location.toLowerCase()}`;
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
  } catch {
    // Cache miss — fall through to fetch
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.location",
      },
      body: JSON.stringify({
        textQuery: `${q} near ${location}`,
        maxResultCount: 5,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ venues: [] });
    }

    const data = (await response.json()) as GooglePlacesResponse;
    const venues: Venue[] = (data.places ?? []).map((p) => ({
      id: p.id,
      name: p.displayName?.text ?? "Unknown",
      address: p.formattedAddress ?? "",
      rating: p.rating ?? 4.0,
      priceLevel: mapPriceLevel(p.priceLevel),
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
    }));

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const id = crypto.randomUUID();

    await db
      .insert(placeCache)
      .values({ id, cacheKey, results: JSON.stringify(venues), expiresAt })
      .onConflictDoUpdate({
        target: placeCache.cacheKey,
        set: { results: JSON.stringify(venues), expiresAt },
      })
      .catch(() => null);

    return NextResponse.json({ venues });
  } catch {
    return NextResponse.json({ venues: [] });
  }
}

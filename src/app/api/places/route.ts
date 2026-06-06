import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Venue } from "@/lib/venues";

type YelpBusiness = {
  id: string;
  name: string;
  location: { display_address: string[] };
  rating: number;
  price?: string;
  coordinates: { latitude: number; longitude: number };
  image_url?: string;
};

type YelpSearchResponse = {
  businesses?: YelpBusiness[];
};

function mapPrice(price: string | undefined): 1 | 2 | 3 | 4 {
  if (!price) return 2;
  const len = price.replace(/[^$]/g, "").length;
  return (Math.min(Math.max(len, 1), 4) as 1 | 2 | 3 | 4);
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ venues: [] }, { status: 401 });
  }

  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ venues: [] });
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const location = searchParams.get("location")?.trim();
  const radius = Math.min(parseInt(searchParams.get("radius") ?? "8000", 10), 40000);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "5", 10)), 10);

  if (!q || !location) {
    return NextResponse.json({ venues: [] });
  }

  const cacheKey = `yelp:${q.toLowerCase()}:${location.toLowerCase()}:r${radius}:o${offset}:l${limit}`;
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
    const url = new URL("https://api.yelp.com/v3/businesses/search");
    url.searchParams.set("term", q);
    url.searchParams.set("location", location);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("sort_by", "rating");
    url.searchParams.set("radius", String(radius));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return NextResponse.json({ venues: [] });
    }

    const data = (await response.json()) as YelpSearchResponse;
    const venues: Venue[] = (data.businesses ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      address: b.location.display_address.join(", "),
      rating: b.rating ?? 0,
      priceLevel: mapPrice(b.price),
      lat: b.coordinates.latitude,
      lng: b.coordinates.longitude,
      imageUrl: b.image_url || undefined,
    }));

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db
      .insert(placeCache)
      .values({ id: crypto.randomUUID(), cacheKey, results: JSON.stringify(venues), expiresAt })
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

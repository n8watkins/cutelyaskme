import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { mapPriceLevel, type Venue } from "@/lib/venues";
import { trackApiUsage } from "@/lib/api-usage";
import { sanitizePlanId } from "@/lib/api-limits";

const PLACES_BASE = "https://places.googleapis.com/v1";

// Pro-tier fields only — adding Enterprise fields here would bump the whole
// search into a pricier SKU with a much smaller free tier.
const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.priceLevel",
  "places.location",
  "places.photos",
].join(",");

const GOOGLE_PRICE_LEVELS = [
  "PRICE_LEVEL_INEXPENSIVE",
  "PRICE_LEVEL_MODERATE",
  "PRICE_LEVEL_EXPENSIVE",
  "PRICE_LEVEL_VERY_EXPENSIVE",
] as const;

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  priceLevel?: string;
  location?: { latitude: number; longitude: number };
  photos?: { name: string }[];
};

type SearchTextResponse = {
  places?: GooglePlace[];
};

/** Resolve a photo resource name to a public googleusercontent URL (server-side, key never reaches the client). */
async function resolvePhotoUri(photoName: string, apiKey: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `${PLACES_BASE}/${photoName}/media?maxWidthPx=600&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey } },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { photoUri?: string };
    return data.photoUri || undefined;
  } catch {
    return undefined;
  }
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ venues: [] }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ venues: [] });
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const location = searchParams.get("location")?.trim();
  const radius = Math.min(parseInt(searchParams.get("radius") ?? "8000", 10), 40000);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "5", 10)), 10);
  // Optional per-stop price level (C3): 1-4, mapped to Google priceLevels.
  const priceRaw = parseInt(searchParams.get("price") ?? "0", 10);
  const price = priceRaw >= 1 && priceRaw <= 4 ? priceRaw : null;
  // Attribute this search to the date plan being built (usage analytics).
  const planId = sanitizePlanId(searchParams.get("plan"));

  if (!q || !location) {
    return NextResponse.json({ venues: [] });
  }

  const cacheKey = `gp:${q.toLowerCase()}:${location.toLowerCase()}:r${radius}:o${offset}:l${limit}:p${price ?? "any"}`;
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
    // Google has no offset pagination; over-fetch to offset+limit (max 20)
    // and slice. One search request bills the same regardless of pageSize.
    const pageSize = Math.min(offset + limit, 20);
    const body: Record<string, unknown> = {
      textQuery: `${q} near ${location}`,
      pageSize,
      rankPreference: "RELEVANCE",
    };
    if (price) {
      // Include everything at or below the requested level — matches how the
      // Yelp price param was used as a ceiling on the stop's budget.
      body.priceLevels = GOOGLE_PRICE_LEVELS.slice(0, price);
    }

    void trackApiUsage("places-search", 1, planId); // outbound call (cache hits return above)
    const response = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ venues: [] });
    }

    const data = (await response.json()) as SearchTextResponse;
    const page = (data.places ?? []).slice(offset, offset + limit);

    const venues: Venue[] = await Promise.all(
      page.map(async (p) => ({
        id: p.id,
        name: p.displayName?.text ?? "",
        address: p.formattedAddress ?? "",
        rating: p.rating ?? 0,
        priceLevel: mapPriceLevel(p.priceLevel),
        lat: p.location?.latitude ?? 0,
        lng: p.location?.longitude ?? 0,
        imageUrl: p.photos?.[0]?.name
          ? await resolvePhotoUri(p.photos[0].name, apiKey)
          : undefined,
      })),
    );
    const photoCalls = page.filter((p) => p.photos?.[0]?.name).length;
    if (photoCalls) void trackApiUsage("places-photos", photoCalls, planId);

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

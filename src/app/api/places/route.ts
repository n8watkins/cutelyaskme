import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/place-cache";
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
  // Bias circle: the map's search center, so "coffee" near a dragged pin
  // means that pin, not whatever Google geocodes the location text to.
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const bias = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  // Attribute this search to the date plan being built (usage analytics).
  const planId = sanitizePlanId(searchParams.get("plan"));

  if (!q || !location) {
    return NextResponse.json({ venues: [] });
  }

  // One Google call fetches the full 20-result pool per query; offset/limit
  // slice the CACHED pool, so "Load 5 more" never re-bills a search or its
  // photo lookups. Past the pool there simply isn't more (hasMore: false).
  const POOL_SIZE = 20;
  const biasKey = bias ? `${bias.lat.toFixed(3)},${bias.lng.toFixed(3)}` : "none";
  const cacheKey = `gp:${q.toLowerCase()}:${location.toLowerCase()}:r${radius}:b${biasKey}:p${price ?? "any"}`;

  const page = (pool: Venue[]) =>
    NextResponse.json({
      venues: pool.slice(offset, offset + limit),
      hasMore: offset + limit < pool.length,
    });

  const cached = await cacheGet<Venue[]>(cacheKey);
  if (cached !== undefined) {
    return page(cached);
  }

  try {
    const body: Record<string, unknown> = {
      textQuery: `${q} near ${location}`,
      pageSize: POOL_SIZE,
      rankPreference: "RELEVANCE",
    };
    if (bias) {
      body.locationBias = {
        circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius },
      };
    }
    if (price) {
      // Everything at or below the requested ceiling. Known Google limitation
      // (verified live): PRICE_LEVEL_FREE is rejected as a filter value, so
      // free venues only appear in unfiltered searches.
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
      return NextResponse.json({ venues: [], hasMore: false });
    }

    const data = (await response.json()) as SearchTextResponse;
    const places = data.places ?? [];

    // Photos go through /api/photo (on-demand proxy) so GetPhotoMedia is
    // only billed for images a browser actually renders.
    const pool: Venue[] = places.map((p) => ({
      id: p.id,
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
      rating: p.rating ?? 0,
      priceLevel: mapPriceLevel(p.priceLevel),
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
      imageUrl: p.photos?.[0]?.name
        ? `/api/photo?name=${encodeURIComponent(p.photos[0].name)}`
        : undefined,
    }));
    // Yelp searches were rating-sorted; Google only ranks by relevance, so
    // restore best-first ordering within the pool.
    pool.sort((a, b) => b.rating - a.rating);

    await cacheSet(cacheKey, pool, 24 * 60 * 60 * 1000);

    return page(pool);
  } catch {
    return NextResponse.json({ venues: [], hasMore: false });
  }
}

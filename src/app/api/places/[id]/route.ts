import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeCache, venueVerdicts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { trackApiUsage } from "@/lib/api-usage";
import type { VenueDetails, YelpOpenSlot } from "@/lib/hours";

const DAY_MS = 24 * 60 * 60 * 1000;

type YelpDetailsResponse = {
  hours?: { open: YelpOpenSlot[]; is_open_now?: boolean }[];
  url?: string;
};

type YelpReviewsResponse = {
  reviews?: {
    rating: number;
    text: string;
    time_created: string;
    user?: { name?: string };
  }[];
};

/**
 * C4 + C5: business hours + 3 review excerpts for one Yelp venue, fetched
 * on-demand when a venue is selected. Cached 7 days — 30 when the requesting
 * user has 👍'd the place (you'll keep going back; its hours matter longer).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "Yelp not configured" }, { status: 503 });

  const { id } = await params;
  if (!id || id.startsWith("osm-") || id.startsWith("custom-")) {
    return NextResponse.json({ message: "Not a Yelp venue" }, { status: 400 });
  }

  const cacheKey = `yelp-detail:${id}`;
  const now = new Date().toISOString();

  try {
    const [cached] = await db
      .select()
      .from(placeCache)
      .where(eq(placeCache.cacheKey, cacheKey))
      .limit(1);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(JSON.parse(cached.results) as VenueDetails);
    }
  } catch {}

  // Two Yelp calls (details + reviews) — count them both.
  void trackApiUsage("yelp", 2);

  let detailsRes: Response;
  let reviewsRes: Response;
  try {
    [detailsRes, reviewsRes] = await Promise.all([
      fetch(`https://api.yelp.com/v3/businesses/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      fetch(`https://api.yelp.com/v3/businesses/${encodeURIComponent(id)}/reviews?limit=3&sort_by=yelp_sort`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    ]);
  } catch {
    return NextResponse.json({ message: "Yelp unreachable" }, { status: 502 });
  }

  if (!detailsRes.ok) {
    return NextResponse.json({ message: "Venue not found" }, { status: 404 });
  }

  const details = (await detailsRes.json()) as YelpDetailsResponse;
  const reviews = reviewsRes.ok
    ? ((await reviewsRes.json()) as YelpReviewsResponse)
    : { reviews: [] };

  const payload: VenueDetails = {
    hours: details.hours?.[0]?.open ?? [],
    isOpenNow: details.hours?.[0]?.is_open_now ?? null,
    url: details.url,
    reviews: (reviews.reviews ?? []).map((r) => ({
      rating: r.rating,
      text: r.text,
      author: r.user?.name ?? "Yelp user",
      date: r.time_created?.slice(0, 10) ?? "",
    })),
  };

  // Liked places stay cached longer — never fetch a failure into the cache.
  let liked = false;
  try {
    const [verdict] = await db
      .select({ status: venueVerdicts.status })
      .from(venueVerdicts)
      .where(
        and(
          eq(venueVerdicts.userId, userId),
          eq(venueVerdicts.venueId, id),
          eq(venueVerdicts.status, "liked"),
        ),
      )
      .limit(1);
    liked = !!verdict;
  } catch {}

  const expiresAt = new Date(Date.now() + (liked ? 30 : 7) * DAY_MS).toISOString();
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

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeCache, venueVerdicts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { trackApiUsage } from "@/lib/api-usage";
import { sanitizePlanId } from "@/lib/api-limits";
import type { VenueDetails, OpenSlot } from "@/lib/hours";

const DAY_MS = 24 * 60 * 60 * 1000;

// Enterprise + Atmosphere SKU (reviews). One call replaces Yelp's two,
// but it draws from the smallest free tier (1,000/month) — keep the cache warm.
const DETAILS_FIELD_MASK = [
  "regularOpeningHours",
  "currentOpeningHours.openNow",
  "googleMapsUri",
  "reviews",
].join(",");

type GooglePeriodPoint = { day: number; hour: number; minute: number };

type GoogleDetailsResponse = {
  regularOpeningHours?: {
    periods?: { open: GooglePeriodPoint; close?: GooglePeriodPoint }[];
  };
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  reviews?: {
    rating?: number;
    text?: { text?: string };
    authorAttribution?: { displayName?: string };
    publishTime?: string;
  }[];
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Google periods (day 0=Sun, hour/minute ints) → our OpenSlot (day 0=Mon, "HHMM"). */
function toOpenSlots(periods: { open: GooglePeriodPoint; close?: GooglePeriodPoint }[]): OpenSlot[] {
  return periods
    .filter((p) => p.close) // a missing close means "open 24/7" — no per-day slot to show
    .map((p) => {
      const day = (p.open.day + 6) % 7;
      const closeDay = (p.close!.day + 6) % 7;
      return {
        day,
        start: `${pad(p.open.hour)}${pad(p.open.minute)}`,
        end: `${pad(p.close!.hour)}${pad(p.close!.minute)}`,
        is_overnight: closeDay !== day,
      };
    });
}

/**
 * C4 + C5: business hours + review excerpts for one Google Places venue,
 * fetched on-demand when a venue is selected. Cached 7 days — 30 when the
 * requesting user has 👍'd the place (you'll keep going back; its hours
 * matter longer).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "Places not configured" }, { status: 503 });

  const { id } = await params;
  if (!id || id.startsWith("osm-") || id.startsWith("custom-")) {
    return NextResponse.json({ message: "Not a Places venue" }, { status: 400 });
  }

  const cacheKey = `gp-detail:${id}`;
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

  // The scarcest SKU (1,000/month free) — attributed to the plan when known.
  void trackApiUsage("places-details", 1, sanitizePlanId(request.nextUrl.searchParams.get("plan")));

  let detailsRes: Response;
  try {
    detailsRes = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": DETAILS_FIELD_MASK,
        },
      },
    );
  } catch {
    return NextResponse.json({ message: "Places unreachable" }, { status: 502 });
  }

  if (!detailsRes.ok) {
    // Legacy Yelp IDs stored in old plans land here — degrade gracefully.
    return NextResponse.json({ message: "Venue not found" }, { status: 404 });
  }

  const details = (await detailsRes.json()) as GoogleDetailsResponse;

  const payload: VenueDetails = {
    hours: toOpenSlots(details.regularOpeningHours?.periods ?? []),
    isOpenNow: details.currentOpeningHours?.openNow ?? null,
    url: details.googleMapsUri,
    reviews: (details.reviews ?? []).slice(0, 3).map((r) => ({
      rating: r.rating ?? 0,
      text: r.text?.text ?? "",
      author: r.authorAttribution?.displayName ?? "Google user",
      date: r.publishTime?.slice(0, 10) ?? "",
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

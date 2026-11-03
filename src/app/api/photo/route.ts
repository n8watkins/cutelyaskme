import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/place-cache";
import { trackApiUsage } from "@/lib/api-usage";
import { reserveTrackedApiCall } from "@/lib/api-budget";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const PHOTO_PLACEHOLDER_PATH = "/assets/venue-placeholder.svg";
const QUOTA_FLAG_KEY = "gp-photo:quota-exhausted";

type FallbackReason = "quota" | "missing" | "unavailable";

/**
 * Every failure an <img> can hit becomes a redirect to a friendly placeholder
 * instead of a broken-image icon. The reason travels in a header for
 * debugging; a short private cache keeps the browser from hammering us.
 */
function placeholder(request: NextRequest, reason: FallbackReason): NextResponse {
  const response = NextResponse.redirect(new URL(PHOTO_PLACEHOLDER_PATH, request.url), 302);
  response.headers.set("Cache-Control", "private, max-age=900");
  response.headers.set("X-Photo-Fallback", reason);
  return response;
}

function photo(uri: string): NextResponse {
  const response = NextResponse.redirect(uri, 302);
  // The browser keeps the redirect for a day, so scrolling back through
  // results or re-rendering a card never costs another lookup.
  response.headers.set("Cache-Control", "private, max-age=86400");
  return response;
}

/** places/{placeId}/photos/{ref} -> placeId. Photo refs differ between
 * searches for the same place, so the place id is the stable cache key. */
function placeIdOf(name: string): string {
  return name.split("/")[1];
}

/**
 * On-demand venue photo proxy. Search results carry /api/photo?name=… URLs
 * instead of resolved media URIs, so GetPhotoMedia (1,000/month — the
 * scarcest pool alongside details) is billed only for photos a browser
 * actually renders, not for every venue in a cached search pool. When the
 * daily photo quota runs out, cards fall back to a placeholder.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse(null, { status: 401 });

  const name = request.nextUrl.searchParams.get("name") ?? "";
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) {
    return new NextResponse(null, { status: 400 });
  }

  const cacheKey = `gp-photo:place:${placeIdOf(name)}`;
  const cached = await cacheGet<string | null>(cacheKey);
  if (typeof cached === "string") return photo(cached);
  if (cached === null) return placeholder(request, "missing");

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return placeholder(request, "unavailable");

  // Google said the console quota is spent: skip the call until the flag
  // expires instead of spending our own budget on guaranteed failures.
  if ((await cacheGet<boolean>(QUOTA_FLAG_KEY)) === true) {
    return placeholder(request, "quota");
  }
  if (!(await reserveTrackedApiCall("places-photos", userId))) {
    return placeholder(request, "quota");
  }

  void trackApiUsage("places-photos");
  let photoUri: string | undefined;
  let upstreamStatus = 0;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=600&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey } },
    );
    upstreamStatus = res.status;
    if (res.ok) {
      photoUri = ((await res.json()) as { photoUri?: string }).photoUri || undefined;
    }
  } catch {}

  if (photoUri) {
    // googleusercontent URIs are stable for days; 7d matches the details cache.
    await cacheSet(cacheKey, photoUri, 7 * DAY_MS);
    return photo(photoUri);
  }
  if (upstreamStatus === 429) {
    await cacheSet(QUOTA_FLAG_KEY, true, HOUR_MS);
    return placeholder(request, "quota");
  }
  if (upstreamStatus === 200 || upstreamStatus === 400 || upstreamStatus === 404) {
    // This place has no usable photo: remember that for a day.
    await cacheSet(cacheKey, null, DAY_MS);
    return placeholder(request, "missing");
  }
  return placeholder(request, "unavailable");
}

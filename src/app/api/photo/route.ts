import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/place-cache";
import { trackApiUsage } from "@/lib/api-usage";
import { reserveTrackedApiCall } from "@/lib/api-budget";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * On-demand venue photo proxy. Search results carry /api/photo?name=… URLs
 * instead of resolved media URIs, so GetPhotoMedia (1,000/month — the
 * scarcest pool alongside details) is billed only for photos a browser
 * actually renders, not for every venue in a cached search pool.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse(null, { status: 401 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return new NextResponse(null, { status: 503 });

  const name = request.nextUrl.searchParams.get("name") ?? "";
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) {
    return new NextResponse(null, { status: 400 });
  }

  const cacheKey = `gp-photo:${name}`;
  const cached = await cacheGet<string>(cacheKey);
  if (cached !== undefined) {
    return NextResponse.redirect(cached, 302);
  }

  if (!(await reserveTrackedApiCall("places-photos", userId))) {
    return new NextResponse(null, { status: 429 });
  }

  void trackApiUsage("places-photos");
  let photoUri: string | undefined;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=600&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey } },
    );
    if (res.ok) {
      photoUri = ((await res.json()) as { photoUri?: string }).photoUri || undefined;
    }
  } catch {}
  if (!photoUri) return new NextResponse(null, { status: 404 });

  // googleusercontent URIs are stable for days; 7d matches the details cache.
  await cacheSet(cacheKey, photoUri, 7 * DAY_MS);

  return NextResponse.redirect(photoUri, 302);
}

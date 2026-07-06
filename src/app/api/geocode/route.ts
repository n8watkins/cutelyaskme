import { auth } from "@clerk/nextjs/server";
import { cacheGet, cacheSet } from "@/lib/place-cache";
import { NextRequest, NextResponse } from "next/server";

// Server-side geocoding so the browser never calls Nominatim directly (browsers
// drop the required User-Agent header, and OSM rate-limits per client IP).
const USER_AGENT = "CutelyAsk/1.0 (https://cutelyask.me)";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — addresses don't move

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  try {
    // Reverse: lat/lng → a short place label.
    if (lat && lng) {
      const key = `geocode:rev:${parseFloat(lat).toFixed(3)}:${parseFloat(lng).toFixed(3)}`;
      const hit = await cacheGet(key);
      if (hit) return NextResponse.json(hit);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { "User-Agent": USER_AGENT } },
      );
      if (!res.ok) return NextResponse.json({ label: null });
      const data = (await res.json()) as {
        address?: { city?: string; town?: string; village?: string; suburb?: string; county?: string };
        display_name?: string;
      };
      const a = data.address ?? {};
      const label =
        a.suburb ?? a.city ?? a.town ?? a.village ?? a.county ?? data.display_name?.split(",")[0] ?? null;
      const result = { label, lat: parseFloat(lat), lng: parseFloat(lng) };
      if (label) await cacheSet(key, result, CACHE_TTL_MS);
      return NextResponse.json(result);
    }

    // Forward: query → lat/lng.
    if (q) {
      const key = `geocode:fwd:${q.toLowerCase()}`;
      const hit = await cacheGet(key);
      if (hit) return NextResponse.json(hit);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
        { headers: { "User-Agent": USER_AGENT } },
      );
      if (!res.ok) return NextResponse.json({ lat: null, lng: null });
      const data = (await res.json()) as { lat: string; lon: string; display_name?: string }[];
      if (!data[0]) return NextResponse.json({ lat: null, lng: null });
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: data[0].display_name?.split(",")[0] ?? q,
      };
      await cacheSet(key, result, CACHE_TTL_MS);
      return NextResponse.json(result);
    }
  } catch {
    return NextResponse.json({ lat: null, lng: null, label: null });
  }

  return NextResponse.json({ message: "Missing q or lat/lng" }, { status: 400 });
}

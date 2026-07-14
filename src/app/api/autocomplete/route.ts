import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { trackApiUsage } from "@/lib/api-usage";
import { reserveTrackedApiCall } from "@/lib/api-budget";

type GoogleSuggestion = {
  placePrediction?: {
    placeId?: string;
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
    text?: { text?: string };
  };
};

export type AutocompleteSuggestion = {
  placeId: string;
  main: string;
  secondary: string;
};

/**
 * Location autocomplete, proxied server-side so the Places key never reaches
 * the browser and Clerk auth gates the quota. Session-token pricing: all
 * keystrokes in one session + the terminating /api/place-geo call bill as a
 * single cheap Details call.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ suggestions: [] }, { status: 401 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestions: [] });

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const session = searchParams.get("session")?.trim();
  if (!q || q.length < 3 || !session) {
    return NextResponse.json({ suggestions: [] });
  }

  if (!(await reserveTrackedApiCall("places-autocomplete", userId))) {
    return NextResponse.json({ suggestions: [] }, { status: 429 });
  }

  void trackApiUsage("places-autocomplete");
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input: q,
        sessionToken: session,
      }),
    });
    if (!res.ok) return NextResponse.json({ suggestions: [] });

    const data = (await res.json()) as { suggestions?: GoogleSuggestion[] };
    const suggestions: AutocompleteSuggestion[] = (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .slice(0, 5)
      .map((p) => ({
        placeId: p.placeId!,
        main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      }));

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}

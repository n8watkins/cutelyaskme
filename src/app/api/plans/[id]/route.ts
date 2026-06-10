import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { datePlans } from "@/lib/db/schema";
import { generateItinerary } from "@/lib/itinerary";
import type { Venue } from "@/lib/venues";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const {
    selectedEntreeVenue,
    selectedActivityVenues,
    activityOrder,
    startPoint,
    pickupPoint,
    legModes,
  } = body ?? {};

  // Load the plan first — we need its date/time/entree to regenerate the itinerary,
  // and it also enforces ownership before we do any work.
  const [plan] = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.id, id), eq(datePlans.senderId, userId)))
    .limit(1);

  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  const entreeVenue = (selectedEntreeVenue ?? null) as Venue | null;
  const activityVenues = (selectedActivityVenues ?? {}) as Record<string, Venue>;
  const activities = Array.isArray(activityOrder)
    ? (activityOrder as string[])
    : safeParse<string[]>(plan.selectedActivities, []);

  const updateValues: Record<string, string | null> = {
    selectedEntreeVenue: entreeVenue ? JSON.stringify(entreeVenue) : null,
    selectedActivityVenues: JSON.stringify(activityVenues),
    startPoint: startPoint ? JSON.stringify(startPoint) : null,
    pickupPoint: pickupPoint ? JSON.stringify(pickupPoint) : null,
  };

  if (Array.isArray(activityOrder)) {
    updateValues.selectedActivities = JSON.stringify(activities);
  }

  // D3: per-leg drive/walk choices. Only persist well-formed entries.
  if (legModes && typeof legModes === "object" && !Array.isArray(legModes)) {
    const modes = Object.fromEntries(
      Object.entries(legModes as Record<string, unknown>).filter(
        ([, v]) => v === "drive" || v === "walk",
      ),
    );
    updateValues.legModes = JSON.stringify(modes);
  }

  // Regenerate the itinerary so it reflects the venues the sender just chose.
  // Returns null when GEMINI_API_KEY is unset or the call fails — in that case we
  // keep the existing itinerary rather than wiping it.
  const itinerary = await generateItinerary({
    selectedDateLabel: plan.selectedDateLabel,
    selectedTimeLabel: plan.selectedTimeLabel,
    selectedTime: plan.selectedTime,
    selectedEntree: plan.selectedEntree,
    selectedActivities: activities,
    selectedEntreeVenue: entreeVenue,
    selectedActivityVenues: activityVenues,
  });

  if (itinerary) {
    updateValues.itinerary = JSON.stringify(itinerary);
    updateValues.itineraryGeneratedAt = new Date().toISOString();
  }

  await db
    .update(datePlans)
    .set(updateValues)
    .where(and(eq(datePlans.id, id), eq(datePlans.senderId, userId)));

  return NextResponse.json({ ok: true, itineraryUpdated: !!itinerary });
}

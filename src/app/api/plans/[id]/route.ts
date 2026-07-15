import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { datePlans, planStops } from "@/lib/db/schema";
import { generateItinerary } from "@/lib/itinerary";
import { requireRouteSender } from "@/lib/plan-route-access";
import {
  buildPlanStopRows,
  itineraryStopsFromPlanStops,
  legacyStopColumns,
} from "@/lib/plan-stops";
import type { Venue } from "@/lib/venues";
import { and, asc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { reserveGeminiCall } from "@/lib/gemini-budget";

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
    stopOrder,
    stopDurations,
    stopTravelMinutes,
  } = body ?? {};

  // Load the plan first. We need its date/time/entree to regenerate the itinerary,
  // and it also enforces ownership before we do any work.
  const [plan] = await db
    .select()
    .from(datePlans)
    .where(eq(datePlans.id, id))
    .limit(1);

  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }
  try {
    requireRouteSender(plan, userId);
  } catch {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  // Confirmed and canceled plans are frozen so shared details cannot drift.
  if (plan.canceledAt) {
    return NextResponse.json({ message: "This date was canceled" }, { status: 409 });
  }
  if (plan.confirmedAt) {
    return NextResponse.json({ message: "This date was already shared" }, { status: 409 });
  }

  const entreeVenue = (selectedEntreeVenue ?? null) as Venue | null;
  const activityVenues = (selectedActivityVenues ?? {}) as Record<string, Venue>;
  const activities = Array.isArray(activityOrder)
    ? activityOrder.filter((value): value is string => typeof value === "string")
    : safeParse<string[]>(plan.selectedActivities, []);
  const modes =
    legModes && typeof legModes === "object" && !Array.isArray(legModes)
      ? Object.fromEntries(
          Object.entries(legModes as Record<string, unknown>).filter(
            ([, value]) => value === "drive" || value === "walk",
          ),
        )
      : undefined;

  const existingStops = await db
    .select()
    .from(planStops)
    .where(eq(planStops.planId, id))
    .orderBy(asc(planStops.position));
  const normalizedStops = buildPlanStopRows(
    id,
    {
      selectedActivities: activities,
      selectedEntree: plan.selectedEntree,
      selectedActivityVenues: activityVenues,
      selectedEntreeVenue: entreeVenue,
      stopOrder: Array.isArray(stopOrder)
        ? stopOrder.filter((value): value is string => typeof value === "string")
        : undefined,
      stopDurations:
        stopDurations && typeof stopDurations === "object" && !Array.isArray(stopDurations)
          ? (stopDurations as Record<string, number>)
          : undefined,
      stopTravelMinutes:
        stopTravelMinutes &&
        typeof stopTravelMinutes === "object" &&
        !Array.isArray(stopTravelMinutes)
          ? (stopTravelMinutes as Record<string, number>)
          : undefined,
      legModes: modes,
    },
    existingStops,
  );
  const legacyStops = legacyStopColumns(normalizedStops);

  const updateValues: Record<string, string | null> = {
    ...legacyStops,
    startPoint: startPoint ? JSON.stringify(startPoint) : null,
    pickupPoint: pickupPoint ? JSON.stringify(pickupPoint) : null,
  };

  // D3: per-leg drive/walk choices. Only persist well-formed entries.
  if (modes) {
    updateValues.legModes = JSON.stringify(modes);
  }

  // Regenerate the itinerary so it reflects the venues the sender just chose.
  // Returns null when GEMINI_API_KEY is unset or the call fails. In that case we
  // keep the existing itinerary rather than wiping it.
  const canGenerateItinerary = await reserveGeminiCall("itinerary", userId);
  const itinerary = canGenerateItinerary ? await generateItinerary({
    selectedDateLabel: plan.selectedDateLabel,
    selectedTimeLabel: plan.selectedTimeLabel,
    selectedTime: plan.selectedTime,
    selectedEntree: plan.selectedEntree,
    selectedActivities: activities,
    selectedEntreeVenue: entreeVenue,
    selectedActivityVenues: activityVenues,
    orderedStops: itineraryStopsFromPlanStops(normalizedStops),
  }) : null;

  if (itinerary) {
    updateValues.itinerary = JSON.stringify(itinerary);
    updateValues.itineraryGeneratedAt = new Date().toISOString();
  }

  let frozenDuringUpdate = false;
  try {
    await db.transaction(async (tx) => {
      const updated = await tx
      .update(datePlans)
      .set(updateValues)
        .where(
          and(
            eq(datePlans.id, id),
            eq(datePlans.senderId, userId),
            isNull(datePlans.canceledAt),
            isNull(datePlans.confirmedAt),
          ),
        );
      if (updated.rowsAffected !== 1) {
        frozenDuringUpdate = true;
        throw new Error("frozen_during_update");
      }

      await tx.delete(planStops).where(eq(planStops.planId, id));
      if (normalizedStops.length > 0) {
        await tx.insert(planStops).values(normalizedStops);
      }
    });
  } catch {
    if (frozenDuringUpdate) {
      return NextResponse.json({ message: "This date can no longer be edited" }, { status: 409 });
    }
    return NextResponse.json({ message: "Failed to update plan" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, itineraryUpdated: !!itinerary });
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { invites, datePlans, notificationJobs, planStops } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { generateItinerary } from "@/lib/itinerary";
import { mintPlanCapability } from "@/lib/plan-capability";
import { planCapabilityCookieName } from "@/lib/plan-route-access";
import {
  buildPlanStopRows,
  itineraryStopsFromPlanStops,
  legacyStopColumns,
} from "@/lib/plan-stops";
import { isValidTimeZone, resolveZonedDateTime } from "@/lib/plan-time";
import { reserveGeminiCall } from "@/lib/gemini-budget";
import { deliverPlanNotificationJobs } from "@/lib/notification-delivery";
import { hasVerifiedEmailAddress } from "@/lib/user-email";

const CAPABILITY_TTL_SECONDS = 90 * 24 * 60 * 60;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  const body = await request.json().catch(() => null);
  const {
    inviteToken,
    selectedDate,
    selectedDateLabel,
    selectedTime,
    selectedTimeLabel,
    selectedEntree,
    selectedActivities,
    dressVibe,
    timezone: requestedTimezone,
  } = body ?? {};

  if (!inviteToken) {
    return NextResponse.json({ message: "Missing invite token" }, { status: 400 });
  }

  const timezone = typeof requestedTimezone === "string" ? requestedTimezone : "UTC";
  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ message: "Invalid timezone" }, { status: 400 });
  }
  if (
    typeof selectedDate === "string" &&
    typeof selectedTime === "string" &&
    !resolveZonedDateTime(selectedDate, selectedTime, timezone).ok
  ) {
    return NextResponse.json({ message: "Invalid date or time" }, { status: 400 });
  }

  const activities = Array.isArray(selectedActivities)
    ? selectedActivities.filter((value): value is string => typeof value === "string")
    : [];
  const entree = typeof selectedEntree === "string" ? selectedEntree : null;

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, inviteToken))
    .limit(1);

  if (!invite) {
    return NextResponse.json({ message: "Invite not found" }, { status: 404 });
  }

  // Fast-path exit to avoid wasting work on a definitely-completed invite.
  // The transaction below is the authoritative race-safe check.
  if (invite.status === "completed") {
    return NextResponse.json({ message: "Invite already completed" }, { status: 409 });
  }

  if (userId) {
    const user = await currentUser();
    if (!user || !hasVerifiedEmailAddress(user.emailAddresses, invite.recipientEmail)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const capabilitySecret = process.env.PLAN_CAPABILITY_SECRET;
  if (!userId && !capabilitySecret) {
    return NextResponse.json({ message: "Anonymous plan access is unavailable" }, { status: 500 });
  }

  const planId = crypto.randomUUID();
  const normalizedStops = buildPlanStopRows(planId, {
    selectedActivities: activities,
    selectedEntree: entree,
  });
  const legacyStops = legacyStopColumns(normalizedStops);
  const scheduledStart =
    typeof selectedDate === "string" && typeof selectedTime === "string"
      ? resolveZonedDateTime(selectedDate, selectedTime, timezone)
      : null;
  const capabilityExpiresAt = Math.max(
    Date.now() + CAPABILITY_TTL_SECONDS * 1000,
    scheduledStart?.ok
      ? scheduledStart.instant.getTime() + 30 * 24 * 60 * 60 * 1000
      : 0,
  );
  let capabilityToken: string | null = null;
  if (!userId && capabilitySecret) {
    try {
      capabilityToken = mintPlanCapability(
        {
          planId,
          inviteId: invite.id,
          capabilityVersion: invite.capabilityVersion,
          expiresAt: capabilityExpiresAt,
        },
        capabilitySecret,
      );
    } catch {
      return NextResponse.json({ message: "Anonymous plan access is unavailable" }, { status: 500 });
    }
  }
  let alreadyCompleted = false;

  try {
    await db.transaction(async (tx) => {
      // Atomically claim the invite - only one concurrent request can win this.
      const updated = await tx
        .update(invites)
        .set({ status: "completed" })
        .where(and(eq(invites.id, invite.id), eq(invites.status, "pending")));

      if (updated.rowsAffected === 0) {
        alreadyCompleted = true;
        throw new Error("already_completed");
      }

      await tx.insert(datePlans).values({
        id: planId,
        inviteId: invite.id,
        senderId: invite.senderId,
        recipientId: userId ?? null,
        selectedDate: typeof selectedDate === "string" ? selectedDate : null,
        selectedDateLabel: typeof selectedDateLabel === "string" ? selectedDateLabel : null,
        selectedTime: typeof selectedTime === "string" ? selectedTime : null,
        selectedTimeLabel: typeof selectedTimeLabel === "string" ? selectedTimeLabel : null,
        timezone,
        selectedEntree: entree,
        selectedActivities: legacyStops.selectedActivities,
        selectedEntreeVenue: legacyStops.selectedEntreeVenue,
        selectedActivityVenues: legacyStops.selectedActivityVenues,
        itinerary: null,
        itineraryGeneratedAt: null,
        dressVibe: dressVibe ?? null,
        completedAt: new Date().toISOString(),
      });
      if (normalizedStops.length > 0) {
        await tx.insert(planStops).values(normalizedStops);
      }
      await tx
        .insert(notificationJobs)
        .values({
          id: crypto.randomUUID(),
          planId,
          channel: "email",
          targetId: "email",
          kind: "sender_plan_completed",
        })
        .onConflictDoNothing();
    });
  } catch (error) {
    if (alreadyCompleted) {
      return NextResponse.json({ message: "Invite already completed" }, { status: 409 });
    }
    console.error("Failed to save plan:", error);
    return NextResponse.json({ message: "Failed to save plan" }, { status: 500 });
  }

  // Run Gemini and sender notification in parallel after the transaction commits -
  // neither should block the response or roll back the plan if they fail.
  const canGenerateItinerary = await reserveGeminiCall(
    "itinerary",
    userId ?? `invite:${invite.id}`,
  );
  const [itinerary] = await Promise.all([
    canGenerateItinerary ? generateItinerary({
      selectedDateLabel,
      selectedTimeLabel,
      selectedTime,
      selectedEntree,
      selectedActivities: activities,
      selectedEntreeVenue: null,
      selectedActivityVenues: {},
      orderedStops: itineraryStopsFromPlanStops(normalizedStops),
    }).catch(() => null) : Promise.resolve(null),
    deliverPlanNotificationJobs(planId, "sender_plan_completed").catch(() => null),
  ]);

  if (itinerary) {
    await db
      .update(datePlans)
      .set({
        itinerary: JSON.stringify(itinerary),
        itineraryGeneratedAt: new Date().toISOString(),
      })
      .where(eq(datePlans.id, planId))
      .catch(() => null);
  }

  const response = NextResponse.json({ planId });
  if (capabilityToken) {
    response.cookies.set(planCapabilityCookieName(planId), capabilityToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor((capabilityExpiresAt - Date.now()) / 1000),
      expires: new Date(capabilityExpiresAt),
    });
  }

  return response;
}

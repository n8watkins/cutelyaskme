import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { venueVerdicts } from "@/lib/db/schema";
import type { Venue } from "@/lib/venues";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Record (or update) a "would we go back?" verdict for one venue.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const planId = body?.planId as string | undefined;
  const activity = (body?.activity as string | undefined) ?? null;
  const venue = body?.venue as Venue | undefined;
  const liked = body?.liked;

  if (!planId || !venue?.id || typeof liked !== "boolean") {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const now = new Date().toISOString();

  await db
    .insert(venueVerdicts)
    .values({
      id: crypto.randomUUID(),
      userId,
      planId,
      activity,
      venueId: venue.id,
      venue: JSON.stringify(venue),
      liked,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [venueVerdicts.userId, venueVerdicts.venueId],
      set: { liked, planId, activity, venue: JSON.stringify(venue), createdAt: now },
    });

  return NextResponse.json({ ok: true });
}

// Clear a verdict (toggling the swipe back off).
export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const venueId = body?.venueId as string | undefined;
  if (!venueId) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  await db
    .delete(venueVerdicts)
    .where(and(eq(venueVerdicts.userId, userId), eq(venueVerdicts.venueId, venueId)));

  return NextResponse.json({ ok: true });
}

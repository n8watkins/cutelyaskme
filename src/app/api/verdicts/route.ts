import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { venueVerdicts } from "@/lib/db/schema";
import type { Venue } from "@/lib/venues";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const STATUSES = ["liked", "disliked", "neutral"] as const;
type VerdictStatus = (typeof STATUSES)[number];

// List the current user's verdicts (optionally only liked ones), newest first.
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ verdicts: [] }, { status: 401 });
  }

  const likedOnly = request.nextUrl.searchParams.get("liked") === "true";

  const rows = await db
    .select()
    .from(venueVerdicts)
    .where(
      likedOnly
        ? and(eq(venueVerdicts.userId, userId), eq(venueVerdicts.status, "liked"))
        : eq(venueVerdicts.userId, userId),
    );

  const verdicts = rows
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((r) => ({
      activity: r.activity,
      status: r.status,
      venue: JSON.parse(r.venue) as Venue,
    }));

  return NextResponse.json({ verdicts });
}

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
  const status = body?.status as VerdictStatus | undefined;

  if (!planId || !venue?.id || !status || !STATUSES.includes(status)) {
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
      status,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [venueVerdicts.userId, venueVerdicts.venueId],
      set: { status, planId, activity, venue: JSON.stringify(venue), createdAt: now },
    });

  return NextResponse.json({ ok: true });
}

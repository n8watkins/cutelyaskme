import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { datePlans } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

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
  const { selectedEntreeVenue, selectedActivityVenues, activityOrder } = body ?? {};

  const updateValues: Record<string, string | null> = {
    selectedEntreeVenue: selectedEntreeVenue ? JSON.stringify(selectedEntreeVenue) : null,
    selectedActivityVenues: JSON.stringify(selectedActivityVenues ?? {}),
  };

  if (Array.isArray(activityOrder)) {
    updateValues.selectedActivities = JSON.stringify(activityOrder);
  }

  const updated = await db
    .update(datePlans)
    .set(updateValues)
    .where(and(eq(datePlans.id, id), eq(datePlans.senderId, userId)));

  if (updated.rowsAffected === 0) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

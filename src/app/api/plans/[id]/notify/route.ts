import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { datePlans, invites } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { sendSpotReadyEmail } from "@/lib/email";
import type { Venue } from "@/lib/venues";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const mode: "share" | "surprise" = body?.mode === "share" ? "share" : "surprise";

  const [plan] = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.id, id), eq(datePlans.senderId, userId)))
    .limit(1);

  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  if (!plan.inviteId) {
    return NextResponse.json({ message: "No invite linked to this plan" }, { status: 400 });
  }

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.id, plan.inviteId))
    .limit(1);

  if (!invite) {
    return NextResponse.json({ message: "Invite not found" }, { status: 404 });
  }

  // Get sender's display name
  let senderName = "Someone special";
  try {
    const clerk = await clerkClient();
    const sender = await clerk.users.getUser(userId);
    senderName =
      sender.firstName ??
      sender.emailAddresses[0]?.emailAddress?.split("@")[0] ??
      "Someone special";
  } catch {}

  // Build venue list for share mode
  let venues: { name: string; address: string }[] = [];
  if (mode === "share") {
    try {
      const activityVenues = JSON.parse(plan.selectedActivityVenues) as Record<string, Venue>;
      const entreeVenue = plan.selectedEntreeVenue
        ? (JSON.parse(plan.selectedEntreeVenue) as Venue)
        : null;
      const activities = JSON.parse(plan.selectedActivities) as string[];
      venues = [
        ...activities.map((a) => activityVenues[a]).filter(Boolean).map((v) => ({ name: v.name, address: v.address })),
        ...(entreeVenue ? [{ name: entreeVenue.name, address: entreeVenue.address }] : []),
      ];
    } catch {}
  }

  try {
    await sendSpotReadyEmail({
      mode,
      recipientEmail: invite.recipientEmail,
      recipientName: invite.recipientName,
      senderName,
      selectedDateLabel: plan.selectedDateLabel,
      selectedTimeLabel: plan.selectedTimeLabel,
      planId: plan.id,
      venues,
    });
  } catch {
    return NextResponse.json({ message: "Failed to send notification" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

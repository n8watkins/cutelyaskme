import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { invites, datePlans } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { generateItinerary } from "@/lib/itinerary";
import { sendPlanNotificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

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
  } = body ?? {};

  if (!inviteToken) {
    return NextResponse.json({ message: "Missing invite token" }, { status: 400 });
  }

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, inviteToken))
    .limit(1);

  if (!invite) {
    return NextResponse.json({ message: "Invite not found" }, { status: 404 });
  }

  // Fast-path exit to avoid a Gemini call on a definitely-completed invite.
  // The transaction below is the authoritative race-safe check.
  if (invite.status === "completed") {
    return NextResponse.json({ message: "Invite already completed" }, { status: 409 });
  }

  const itinerary = await generateItinerary({
    selectedDateLabel,
    selectedTimeLabel,
    selectedEntree,
    selectedActivities: selectedActivities ?? [],
  }).catch(() => null);

  let planId!: string;
  let alreadyCompleted = false;

  try {
    await db.transaction(async (tx) => {
      const now = new Date().toISOString();

      // Atomically claim the invite — only one concurrent request can win this.
      const updated = await tx
        .update(invites)
        .set({ status: "completed" })
        .where(and(eq(invites.id, invite.id), eq(invites.status, "pending")));

      if (updated.rowsAffected === 0) {
        alreadyCompleted = true;
        throw new Error("already_completed");
      }

      planId = crypto.randomUUID();
      await tx.insert(datePlans).values({
        id: planId,
        inviteId: invite.id,
        senderId: invite.senderId,
        recipientId: userId,
        selectedDate: selectedDate ?? null,
        selectedDateLabel: selectedDateLabel ?? null,
        selectedTime: selectedTime ?? null,
        selectedTimeLabel: selectedTimeLabel ?? null,
        selectedEntree: selectedEntree ?? null,
        selectedActivities: JSON.stringify(selectedActivities ?? []),
        itinerary: itinerary ? JSON.stringify(itinerary) : null,
        itineraryGeneratedAt: itinerary ? now : null,
        dressVibe: dressVibe ?? null,
        completedAt: now,
      });
    });
  } catch {
    if (alreadyCompleted) {
      return NextResponse.json({ message: "Invite already completed" }, { status: 409 });
    }
    return NextResponse.json({ message: "Failed to save plan" }, { status: 500 });
  }

  try {
    const clerk = await clerkClient();
    const senderUser = await clerk.users.getUser(invite.senderId);
    const senderEmail = senderUser.emailAddresses[0]?.emailAddress;
    if (senderEmail) {
      await sendPlanNotificationEmail({
        senderEmail,
        recipientName: invite.recipientName,
        selectedDateLabel: selectedDateLabel ?? null,
        planId,
      });
    }
  } catch {
    // Non-blocking
  }

  return NextResponse.json({ planId });
}

import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { invites, datePlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { generateItinerary } from "@/lib/itinerary";
import { sendPlanNotificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
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

  if (invite.status === "completed") {
    return NextResponse.json({ message: "Invite already completed" }, { status: 409 });
  }

  const { userId } = await auth();

  const itinerary = await generateItinerary({
    selectedDateLabel,
    selectedTimeLabel,
    selectedEntree,
    selectedActivities: selectedActivities ?? [],
  }).catch(() => null);

  const now = new Date().toISOString();
  const planId = crypto.randomUUID();

  await db.insert(datePlans).values({
    id: planId,
    inviteId: invite.id,
    senderId: invite.senderId,
    recipientId: userId ?? null,
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

  await db
    .update(invites)
    .set({ status: "completed" })
    .where(eq(invites.id, invite.id));

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

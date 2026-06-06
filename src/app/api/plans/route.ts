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

  // Fast-path exit to avoid wasting work on a definitely-completed invite.
  // The transaction below is the authoritative race-safe check.
  if (invite.status === "completed") {
    return NextResponse.json({ message: "Invite already completed" }, { status: 409 });
  }

  let planId!: string;
  let alreadyCompleted = false;

  try {
    await db.transaction(async (tx) => {
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
        itinerary: null,
        itineraryGeneratedAt: null,
        dressVibe: dressVibe ?? null,
        completedAt: new Date().toISOString(),
      });
    });
  } catch {
    if (alreadyCompleted) {
      return NextResponse.json({ message: "Invite already completed" }, { status: 409 });
    }
    return NextResponse.json({ message: "Failed to save plan" }, { status: 500 });
  }

  // Run Gemini and sender notification in parallel after the transaction commits —
  // neither should block the response or roll back the plan if they fail.
  const [itinerary] = await Promise.all([
    generateItinerary({
      selectedDateLabel,
      selectedTimeLabel,
      selectedEntree,
      selectedActivities: selectedActivities ?? [],
    }).catch(() => null),
    clerkClient()
      .then((clerk) => clerk.users.getUser(invite.senderId))
      .then(async (senderUser) => {
        const senderEmail = senderUser.emailAddresses[0]?.emailAddress;
        if (senderEmail) {
          await sendPlanNotificationEmail({
            senderEmail,
            recipientName: invite.recipientName,
            selectedDateLabel: selectedDateLabel ?? null,
            planId,
          });
        }
      })
      .catch(() => null),
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

  return NextResponse.json({ planId });
}

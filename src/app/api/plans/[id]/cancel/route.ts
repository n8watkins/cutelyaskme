import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { datePlans, invites } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendDateCanceledEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

// F4: the sender calls the date off. Freezes the plan (canceledAt) and — if it
// was already shared with the recipient — gently lets them know (best-effort:
// notification failures never fail the cancel).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [plan] = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.id, id), eq(datePlans.senderId, userId)))
    .limit(1);

  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  // Already canceled → nothing to do (idempotent, no duplicate notifications).
  if (plan.canceledAt) {
    return NextResponse.json({ ok: true, alreadyCanceled: true });
  }

  await db
    .update(datePlans)
    .set({ canceledAt: new Date().toISOString() })
    .where(and(eq(datePlans.id, id), eq(datePlans.senderId, userId)));

  // Notify the other person only if the plan was actually shared/sent —
  // confirmedAt is set when the sender hits Share/Surprise.
  const wasShared = !!plan.confirmedAt;
  if (wasShared) {
    let senderName = "Someone special";
    try {
      const clerk = await clerkClient();
      const sender = await clerk.users.getUser(userId);
      senderName =
        sender.firstName ??
        sender.emailAddresses[0]?.emailAddress?.split("@")[0] ??
        "Someone special";
    } catch {}

    // Push (if she's signed in + subscribed) — gentle copy, no guilt.
    if (plan.recipientId) {
      await sendPushToUser(plan.recipientId, {
        title: "A little change of plans 💌",
        body: "Tonight's plan was called off — more soon 💌",
        url: `/plan/${plan.id}`,
      }).catch(() => 0);
    }

    // Email via the invite's address.
    if (plan.inviteId) {
      try {
        const [invite] = await db
          .select()
          .from(invites)
          .where(eq(invites.id, plan.inviteId))
          .limit(1);
        if (invite) {
          await sendDateCanceledEmail({
            recipientEmail: invite.recipientEmail,
            recipientName: invite.recipientName,
            senderName,
            selectedDateLabel: plan.selectedDateLabel,
          });
        }
      } catch {}
    }
  }

  return NextResponse.json({ ok: true });
}

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { invites, notificationJobs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { deliverInviteNotificationJobs } from "@/lib/notification-delivery";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { recipientName, recipientEmail, location, senderAvatarSrc } = body ?? {};

  if (
    typeof recipientName !== "string" ||
    typeof recipientEmail !== "string" ||
    !recipientName.trim() ||
    !EMAIL_RE.test(recipientEmail.trim())
  ) {
    return NextResponse.json({ message: "Missing or invalid fields" }, { status: 400 });
  }

  const locationValue =
    typeof location === "string" && location.trim() ? location.trim() : null;

  if (!(await checkRateLimit(`invites:${userId}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ message: "Too many invites. Try again later." }, { status: 429 });
  }

  const id = crypto.randomUUID();
  const token = crypto.randomUUID();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(invites).values({
        id,
        token,
        senderId: userId,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim().toLowerCase(),
        location: locationValue,
        senderAvatarSrc:
          typeof senderAvatarSrc === "string" && senderAvatarSrc.startsWith("data:image/")
            ? senderAvatarSrc
            : null,
      });
      await tx
        .insert(notificationJobs)
        .values({
          id: crypto.randomUUID(),
          inviteId: id,
          channel: "email",
          targetId: "email",
          kind: "invite_created",
        })
        .onConflictDoNothing();
    });
  } catch {
    return NextResponse.json({ message: "Failed to create invite" }, { status: 500 });
  }

  await deliverInviteNotificationJobs(id).catch(() => null);

  return NextResponse.json({ token });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(invites)
    .where(eq(invites.senderId, userId))
    .orderBy(desc(invites.createdAt));

  return NextResponse.json({ invites: rows });
}

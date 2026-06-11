import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { dateMemories, datePlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type PhotoRef = { url: string; publicId: string };

// Persist the full photo list for this user's memory (client manages the array).
export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const planId = body?.planId as string | undefined;
  const incoming = body?.photoRefs as PhotoRef[] | undefined;

  if (!planId || !Array.isArray(incoming)) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const photoRefs = incoming
    .filter((p) => p && typeof p.url === "string" && typeof p.publicId === "string")
    .slice(0, 20)
    .map((p) => ({ url: p.url, publicId: p.publicId }));

  const [plan] = await db.select().from(datePlans).where(eq(datePlans.id, planId)).limit(1);
  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  const isParticipant =
    userId === plan.senderId || userId === plan.recipientId || plan.recipientId === null;
  if (!isParticipant) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // F4: a canceled date never happened — nothing about it can be written.
  if (plan.canceledAt) {
    return NextResponse.json({ message: "This date was canceled" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const serialized = JSON.stringify(photoRefs);

  await db
    .insert(dateMemories)
    .values({
      id: crypto.randomUUID(),
      planId,
      authorId: userId,
      notes: null,
      poem: null,
      photoRefs: serialized,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dateMemories.planId, dateMemories.authorId],
      set: { photoRefs: serialized, updatedAt: now },
    });

  return NextResponse.json({ ok: true });
}

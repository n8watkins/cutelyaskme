import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { datePlans, dateRatings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { planId, score, note } = body ?? {};

  if (!planId || typeof score !== "number" || score < 1 || score > 5) {
    return NextResponse.json({ message: "Invalid rating" }, { status: 400 });
  }

  const [plan] = await db
    .select({ senderId: datePlans.senderId, recipientId: datePlans.recipientId })
    .from(datePlans)
    .where(eq(datePlans.id, planId))
    .limit(1);

  if (!plan || (plan.senderId !== userId && plan.recipientId !== userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await db
    .insert(dateRatings)
    .values({
      id: crypto.randomUUID(),
      planId,
      raterId: userId,
      score,
      note: note ?? null,
    })
    .onConflictDoUpdate({
      target: [dateRatings.planId, dateRatings.raterId],
      set: { score, note: note ?? null },
    });

  return NextResponse.json({ ok: true });
}

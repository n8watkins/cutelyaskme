import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { datePlans, dateRatings } from "@/lib/db/schema";
import { isDateOver } from "@/lib/date-end";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { planId, score, note } = body ?? {};

  if (!planId || typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json({ message: "Invalid rating" }, { status: 400 });
  }

  const [plan] = await db
    .select()
    .from(datePlans)
    .where(eq(datePlans.id, planId))
    .limit(1);

  if (!plan || (plan.senderId !== userId && plan.recipientId !== userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // F4: a canceled date never happened — nothing about it can be written.
  if (plan.canceledAt) {
    return NextResponse.json({ message: "This date was canceled" }, { status: 409 });
  }

  // F1: ratings only open up once the date's end time has passed.
  if (!isDateOver(plan)) {
    return NextResponse.json({ message: "Come back after your date 💞" }, { status: 403 });
  }

  try {
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
  } catch {
    return NextResponse.json({ message: "Failed to save rating" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

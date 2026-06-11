import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { dateMemories, datePlans, invites } from "@/lib/db/schema";
import { isDateOver } from "@/lib/date-end";
import { generateMemoryPoem } from "@/lib/memory-poem";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// Save the author's notes and (re)generate the keepsake poem.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const planId = body?.planId as string | undefined;
  const notes = ((body?.notes as string | undefined) ?? "").trim();

  if (!planId || !notes) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const [plan] = await db.select().from(datePlans).where(eq(datePlans.id, planId)).limit(1);
  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  // Only the date's participants may write a memory.
  const isParticipant =
    userId === plan.senderId || userId === plan.recipientId || plan.recipientId === null;
  if (!isParticipant) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // F1: keepsakes only open up once the date's end time has passed.
  if (!isDateOver(plan)) {
    return NextResponse.json({ message: "Come back after your date 💞" }, { status: 403 });
  }

  let recipientName: string | null = null;
  if (plan.inviteId) {
    const [inv] = await db
      .select({ recipientName: invites.recipientName })
      .from(invites)
      .where(eq(invites.id, plan.inviteId))
      .limit(1);
    recipientName = inv?.recipientName ?? null;
  }

  const poem = await generateMemoryPoem({
    notes,
    recipientName,
    selectedDateLabel: plan.selectedDateLabel,
    selectedEntree: plan.selectedEntree,
    activities: safeParse<string[]>(plan.selectedActivities, []),
  });

  const now = new Date().toISOString();

  // On update, only overwrite the poem if generation succeeded (don't wipe a
  // good poem when Gemini is unset or fails).
  const setValues: Record<string, string | null> = { notes, updatedAt: now };
  if (poem) setValues.poem = poem;

  await db
    .insert(dateMemories)
    .values({
      id: crypto.randomUUID(),
      planId,
      authorId: userId,
      notes,
      poem: poem ?? null,
      photoRefs: "[]",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dateMemories.planId, dateMemories.authorId],
      set: setValues,
    });

  return NextResponse.json({ ok: true, poem: poem ?? null, poemGenerated: !!poem });
}

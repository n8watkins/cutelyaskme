import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { dateMemories, datePlans } from "@/lib/db/schema";
import { isMusicTrack } from "@/lib/memory-music";
import { mintShareToken } from "@/lib/memory-share";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// G1 Task B: per-memory settings on the caller's OWN memory row — the public
// share link (share: true mints/keeps a token, share: false revokes it) and
// the keepsake's music track. PATCH because the row itself is created by the
// notes/photos routes; this only tweaks fields on an existing memory.
export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const planId = body?.planId as string | undefined;
  const share = body?.share as unknown;
  const musicTrack = body?.musicTrack as unknown;

  const hasShare = share !== undefined;
  const hasTrack = musicTrack !== undefined;
  if (
    !planId ||
    (!hasShare && !hasTrack) ||
    (hasShare && typeof share !== "boolean") ||
    (hasTrack && !isMusicTrack(musicTrack))
  ) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const [plan] = await db.select().from(datePlans).where(eq(datePlans.id, planId)).limit(1);
  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  // Only the date's participants may touch a memory.
  const isParticipant =
    userId === plan.senderId || userId === plan.recipientId || plan.recipientId === null;
  if (!isParticipant) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // F4: a canceled date never happened — nothing about it can be written.
  if (plan.canceledAt) {
    return NextResponse.json({ message: "This date was canceled" }, { status: 409 });
  }

  // Author-only: this route operates on the caller's own row (unique
  // (plan_id, author_id)) — you can't share or re-score your partner's memory.
  const [memory] = await db
    .select()
    .from(dateMemories)
    .where(and(eq(dateMemories.planId, planId), eq(dateMemories.authorId, userId)))
    .limit(1);
  if (!memory) {
    return NextResponse.json({ message: "No keepsake to update yet" }, { status: 404 });
  }

  let shareToken = memory.shareToken;
  const set: Record<string, string | null> = { updatedAt: new Date().toISOString() };
  if (share === true) {
    // Mint once and keep — toggling share off/on later issues a NEW link
    // (revocation must actually revoke).
    shareToken = memory.shareToken ?? mintShareToken();
    set.shareToken = shareToken;
  } else if (share === false) {
    shareToken = null;
    set.shareToken = null;
  }
  if (hasTrack) {
    set.musicTrack = musicTrack as string;
  }

  await db.update(dateMemories).set(set).where(eq(dateMemories.id, memory.id));

  return NextResponse.json({ ok: true, shareToken });
}

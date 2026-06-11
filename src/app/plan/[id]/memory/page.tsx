// G1: /plan/[id]/memory — the keepsake as a standalone designed card.
// Server side: gate access, pick the memory row to show, hand clean props to
// the client <KeepsakeCard />.

import { auth } from "@clerk/nextjs/server";
import { Playfair_Display } from "next/font/google";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dateMemories, datePlans } from "@/lib/db/schema";
import type { ItineraryJson } from "@/lib/db/schema";
import { parsePhotoRefs, pickMemoryForViewer } from "@/lib/memory-display";
import { findSharedMemory } from "@/lib/memory-share";
import { resolveMusicTrack } from "@/lib/memory-music";
import { KeepsakeCard } from "@/components/memory/KeepsakeCard";

// Display serif for the poem centerpiece + title.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Your keepsake 💌 — Cutely Ask",
};

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export default async function MemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string | string[] }>;
}) {
  const { id } = await params;
  const { share } = await searchParams;
  const shareParam = typeof share === "string" ? share : null;

  const [plan] = await db.select().from(datePlans).where(eq(datePlans.id, id)).limit(1);
  if (!plan) notFound();

  // F4: a canceled date never happened — there is no keepsake for it,
  // shared link or not.
  if (plan.canceledAt) notFound();

  const rows = await db.select().from(dateMemories).where(eq(dateMemories.planId, id));

  // ────────────────────────────────────────────────────────────────────────
  // ACCESS: participants, or anyone holding a valid `?share=<token>` link.
  // A matching token unlocks exactly the memory it belongs to — logged out
  // (userId null) or logged in as a non-participant alike, it's a public
  // card link. /plan(.*) is public in src/proxy.ts, so the share path
  // is reachable without an account.
  // ────────────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  const sharedMemory = findSharedMemory(rows, shareParam);
  if (!sharedMemory) {
    if (!userId) {
      // A participant who isn't signed in yet — same /login flow as elsewhere.
      redirect(`/login?redirect_url=/plan/${id}/memory`);
    }
    // Mirrors the memories API: sender, recipient, or an unclaimed plan
    // (recipientId null — the recipient may not have linked her account yet).
    const isParticipant =
      userId === plan.senderId || userId === plan.recipientId || plan.recipientId === null;
    if (!isParticipant) notFound();
  }

  // The memory to show: a share link shows THE shared row; otherwise the
  // viewer's own if they wrote one, else their partner's (one row per
  // (plan, author)).
  const memory = sharedMemory ?? pickMemoryForViewer(rows, userId);

  if (!memory) {
    // Friendly empty state — nothing written yet (or the date isn't over).
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-[#fff7fb] to-[#ffeaf3] px-4">
        <div className="max-w-md rounded-[28px] border-2 border-[#ffd6e8] bg-white/90 p-8 text-center shadow-sm">
          <div className="mb-2 text-5xl">💌</div>
          <h1 className="text-2xl font-black text-[#3a2530]">No keepsake yet</h1>
          <p className="mt-2 text-sm text-[#8a6a78]">
            Once the night wraps up, jot down your favorite moments on the plan
            page and we&apos;ll turn them into a little card to keep.
          </p>
          <Link
            href={`/plan/${id}`}
            className="mt-5 inline-block rounded-full bg-[#ff7aaa] px-6 py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] hover:brightness-105"
          >
            Back to the plan ✨
          </Link>
        </div>
      </main>
    );
  }

  const itinerary = safeParse<ItineraryJson | null>(plan.itinerary, null);
  const track = resolveMusicTrack(memory.musicTrack);
  // Author-only controls (track picker, share toggle) — never shown on the
  // share-link path or to the partner viewing this author's memory.
  const isAuthor = userId !== null && memory.authorId === userId;

  return (
    <div className={playfair.variable}>
      <KeepsakeCard
        planId={id}
        title={itinerary?.title ?? "Our Date"}
        dateLabel={plan.selectedDateLabel}
        poem={memory.poem}
        notes={memory.notes}
        photos={parsePhotoRefs(memory.photoRefs)}
        initialTrackId={track.id}
        canPickTrack={isAuthor}
        canShare={isAuthor}
        initialShareToken={isAuthor ? memory.shareToken : null}
        serifClass={playfair.className}
      />
    </div>
  );
}

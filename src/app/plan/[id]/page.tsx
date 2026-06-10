import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { datePlans, invites, dateRatings, venueVerdicts, dateMemories } from "@/lib/db/schema";
import type { ItineraryJson } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Venue } from "@/lib/venues";
import { RatingWidget } from "@/components/RatingWidget";
import { VenueVerdicts, type VerdictStop, type VerdictStatus } from "@/components/VenueVerdicts";
import { MemoryKeepsake } from "@/components/MemoryKeepsake";
import { SenderPlanningView } from "@/components/sender/SenderPlanningView";

type PlanPageProps = {
  params: Promise<{ id: string }>;
};

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export default async function PlanPage({ params }: PlanPageProps) {
  const { id } = await params;
  const { userId } = await auth();

  const [plan] = await db
    .select()
    .from(datePlans)
    .where(eq(datePlans.id, id))
    .limit(1);

  if (!plan) notFound();

  const isSender = userId === plan.senderId;

  // Block logged-in non-participants from viewing plans where the recipient is known
  if (userId && !isSender && plan.recipientId !== null && plan.recipientId !== userId) {
    notFound();
  }

  // Claim the plan for the recipient when she opens it signed in with the invited
  // email — links it to her account so it shows on her dashboard.
  if (userId && !isSender && plan.recipientId === null && plan.inviteId) {
    const me = await currentUser();
    const myEmail = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
    if (myEmail) {
      const [inv] = await db
        .select({ email: invites.recipientEmail })
        .from(invites)
        .where(eq(invites.id, plan.inviteId))
        .limit(1);
      if (inv && inv.email.toLowerCase() === myEmail) {
        await db.update(datePlans).set({ recipientId: userId }).where(eq(datePlans.id, id));
        plan.recipientId = userId;
      }
    }
  }

  const itinerary = safeParse<ItineraryJson | null>(plan.itinerary, null);
  const activities = safeParse<string[]>(plan.selectedActivities, []);
  const ratings = await db.select().from(dateRatings).where(eq(dateRatings.planId, id));
  const userRating = ratings.find((r) => r.raterId === userId) ?? null;

  // Chosen venues + this user's "would we go back?" swipes (for both views).
  const entreeVenue = safeParse<Venue | null>(plan.selectedEntreeVenue ?? null, null);
  const activityVenues = safeParse<Record<string, Venue>>(plan.selectedActivityVenues, {});
  const verdictStops: VerdictStop[] = [
    ...activities
      .filter((a) => activityVenues[a])
      .map((a) => ({ activity: a, venue: activityVenues[a] })),
    ...(entreeVenue ? [{ activity: "__entree__", venue: entreeVenue }] : []),
  ];
  let userVerdicts: Record<string, VerdictStatus> = {};
  if (userId && verdictStops.length > 0) {
    const rows = await db
      .select()
      .from(venueVerdicts)
      .where(and(eq(venueVerdicts.userId, userId), eq(venueVerdicts.planId, id)));
    userVerdicts = Object.fromEntries(rows.map((r) => [r.venueId, r.status]));
  }

  // Reviews + keepsake unlock only once the sender has confirmed the plan.
  const isConfirmed = plan.confirmedAt !== null;

  // This user's keepsake (notes + poem + photos) for the date.
  let userMemory: {
    notes: string;
    poem: string | null;
    photos: { url: string; publicId: string }[];
  } | null = null;
  if (userId) {
    const [mem] = await db
      .select()
      .from(dateMemories)
      .where(and(eq(dateMemories.planId, id), eq(dateMemories.authorId, userId)))
      .limit(1);
    if (mem) {
      userMemory = {
        notes: mem.notes ?? "",
        poem: mem.poem,
        photos: safeParse<{ url: string; publicId: string }[]>(mem.photoRefs, []),
      };
    }
  }

  if (isSender) {
    const invite = plan.inviteId
      ? (await db
          .select({ recipientName: invites.recipientName, location: invites.location })
          .from(invites)
          .where(eq(invites.id, plan.inviteId))
          .limit(1))[0]
      : undefined;

    return (
      <>
        <SenderPlanningView
          planId={id}
          plan={{
            selectedDate: plan.selectedDate,
            selectedDateLabel: plan.selectedDateLabel,
            selectedTime: plan.selectedTime,
            selectedTimeLabel: plan.selectedTimeLabel,
            selectedEntree: plan.selectedEntree,
            selectedActivities: activities,
            dressVibe: plan.dressVibe,
            recipientName: invite?.recipientName ?? "her",
            location: invite?.location ?? null,
            selectedEntreeVenue: entreeVenue,
            selectedActivityVenues: activityVenues,
            startPoint: safeParse<{ label: string; lat: number; lng: number } | null>(plan.startPoint, null),
            pickupPoint: safeParse<{ label: string; lat: number; lng: number } | null>(plan.pickupPoint, null),
            legModes: safeParse<Record<string, "drive" | "walk">>(plan.legModes, {}),
          }}
        />
        <div className="mx-auto max-w-lg px-4 pb-12">
          <ItinerarySection itinerary={itinerary} />
          <div className="mt-8">
            <h2 className="mb-3 text-center font-black text-[#3a2530]">How did it go?</h2>
            <RatingWidget planId={id} existingRating={userRating} allRatings={ratings} />
          </div>
          {isConfirmed && (
            <>
              {verdictStops.length > 0 && (
                <div className="mt-8">
                  <VenueVerdicts planId={id} stops={verdictStops} initial={userVerdicts} />
                </div>
              )}
              <div className="mt-8">
                <MemoryKeepsake
                  planId={id}
                  initialNotes={userMemory?.notes ?? ""}
                  initialPoem={userMemory?.poem ?? null}
                  initialPhotos={userMemory?.photos ?? []}
                />
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  // Recipient / shared view
  let senderName = "someone special";
  try {
    const clerk = await clerkClient();
    const sender = await clerk.users.getUser(plan.senderId);
    senderName =
      sender.firstName ??
      sender.emailAddresses[0]?.emailAddress?.split("@")[0] ??
      "someone special";
  } catch {}

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mb-2 text-5xl">🗓️</div>
        <h1 className="text-3xl font-black text-[#3a2530]">
          {itinerary?.title ?? "The Plan"}
        </h1>
        {itinerary?.summary && (
          <p className="mt-1 text-[#8a6a78]">{itinerary.summary}</p>
        )}
      </div>

      <div className="mb-6 rounded-[24px] border-2 border-[#ffd6e8] bg-white/90 p-5 shadow-sm">
        <dl className="grid gap-3">
          <PlanRow icon="📅" label="Date" value={plan.selectedDateLabel ?? "—"} />
          <PlanRow icon="🕰️" label="Time" value={plan.selectedTimeLabel ?? "—"} />
          <PlanRow icon="💌" label="Activities" value={activities.join(" + ") || "—"} />
          <PlanRow icon="🍽️" label="Dinner" value={plan.selectedEntree ?? "—"} />
        </dl>
        <div className="mt-4 flex gap-2 text-xs text-[#c0a0b0]">
          <span>Planned by {senderName}</span>
        </div>
      </div>

      <ItinerarySection itinerary={itinerary} />

      {userId && (
        <div className="mt-8">
          <h2 className="mb-3 text-center font-black text-[#3a2530]">How did it go?</h2>
          <RatingWidget planId={id} existingRating={userRating} allRatings={ratings} />
        </div>
      )}

      {userId && isConfirmed && verdictStops.length > 0 && (
        <div className="mt-8">
          <VenueVerdicts planId={id} stops={verdictStops} initial={userVerdicts} />
        </div>
      )}

      {userId && isConfirmed && (
        <div className="mt-8">
          <MemoryKeepsake
            planId={id}
            initialNotes={userMemory?.notes ?? ""}
            initialPoem={userMemory?.poem ?? null}
            initialPhotos={userMemory?.photos ?? []}
          />
        </div>
      )}
    </main>
  );
}

function ItinerarySection({ itinerary }: { itinerary: ItineraryJson | null }) {
  if (!itinerary) return null;
  return (
    <>
      {itinerary.timeline && itinerary.timeline.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-black text-[#3a2530]">Tonight&apos;s lineup</h2>
          <div className="grid gap-3">
            {itinerary.timeline.map((entry, i) => (
              <div
                key={i}
                className="flex gap-4 rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4"
              >
                <div className="shrink-0 text-center">
                  <div className="text-2xl">{entry.emoji}</div>
                  <div className="mt-1 text-xs font-black text-[#c0a0b0]">{entry.time}</div>
                </div>
                <div>
                  <p className="font-black text-[#3a2530]">{entry.activity}</p>
                  <p className="mt-0.5 text-sm text-[#8a6a78]">{entry.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {itinerary.tips && itinerary.tips.length > 0 && (
        <div className="mb-6 rounded-[24px] border-2 border-[#ffd6e8] bg-[#fff7fb] p-5">
          <h2 className="mb-2 font-black text-[#3a2530]">Tips for tonight ✨</h2>
          <ul className="grid gap-1.5">
            {itinerary.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#8a6a78]">
                <span>•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function PlanRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff7fb] text-xl">
        {icon}
      </span>
      <div>
        <dt className="text-xs font-black uppercase tracking-[0.14em] text-[#c0a0b0]">{label}</dt>
        <dd className="font-black text-[#3a2530]">{value}</dd>
      </div>
    </div>
  );
}

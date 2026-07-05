import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { datePlans, invites, dateRatings, venueVerdicts, dateMemories } from "@/lib/db/schema";
import type { ItineraryJson } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Venue } from "@/lib/venues";
import { RatingWidget } from "@/components/RatingWidget";
import { RouteNavLinks, type RouteNavStop } from "@/components/RouteNavLinks";
import { VenueVerdicts, type VerdictStop, type VerdictStatus } from "@/components/VenueVerdicts";
import { MemoryKeepsake } from "@/components/MemoryKeepsake";
import { SenderPlanningView } from "@/components/sender/SenderPlanningView";
import { CancelDateButton } from "@/components/sender/CancelDateButton";
import { DateMap } from "@/components/sender/DateMap";
import { isDateOver } from "@/lib/date-end";
import { getUserSettingsState } from "@/lib/user-settings";

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

  // F1: reviews + keepsake unlock only once the date's end time has passed
  // (selected date + last stop's end, from the deterministic timeline).
  const dateOver = isDateOver(plan);

  // F4: a canceled plan is frozen — both sides see a graceful called-off state,
  // never the planner or the post-date widgets.
  const canceled = plan.canceledAt !== null;

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

  const startPoint = safeParse<{ label: string; lat: number; lng: number } | null>(plan.startPoint, null);
  const pickupPoint = safeParse<{ label: string; lat: number; lng: number } | null>(plan.pickupPoint, null);
  const legModes = safeParse<Record<string, "drive" | "walk">>(plan.legModes, {});

  if (isSender) {
    const invite = plan.inviteId
      ? (await db
          .select({ recipientName: invites.recipientName, location: invites.location })
          .from(invites)
          .where(eq(invites.id, plan.inviteId))
          .limit(1))[0]
      : undefined;

    // F4: canceled → a quiet called-off state. No planner, no widgets, no edits.
    if (canceled) {
      return (
        <main className="mx-auto max-w-lg px-4 py-10">
          <div className="mb-6 text-center">
            <div className="mb-2 text-5xl">💔</div>
            <h1 className="text-3xl font-black text-[#3a2530]">This one&apos;s been called off</h1>
            <p className="mt-1 text-[#8a6a78]">
              You canceled this date{invite?.recipientName ? ` with ${invite.recipientName}` : ""}. More soon 💌
            </p>
          </div>
          <div className="mb-6 rounded-[24px] border-2 border-[#ffd6e8] bg-white/90 p-5 opacity-70 shadow-sm">
            <dl className="grid gap-3">
              <PlanRow icon="📅" label="Date" value={plan.selectedDateLabel ?? "—"} />
              <PlanRow icon="🕰️" label="Time" value={plan.selectedTimeLabel ?? "—"} />
              <PlanRow icon="💌" label="Activities" value={activities.join(" + ") || "—"} />
              <PlanRow icon="🍽️" label="Dinner" value={plan.selectedEntree ?? "—"} />
            </dl>
          </div>
          <p className="text-center">
            <a
              href="/send"
              className="inline-block rounded-full bg-[#ff7aaa] px-6 py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] hover:brightness-105"
            >
              Plan a new one ✨
            </a>
          </p>
        </main>
      );
    }

    // B4/Task B: the sender's saved settings drive the planner's radius
    // slider (default + bounds), map zoom mode, and calendar export mode.
    // `persisted` is false when no settings row exists yet — the client then
    // migrates any legacy `ca:` localStorage prefs up exactly once.
    const { settings, persisted } = await getUserSettingsState(plan.senderId);

    // F2: a past date is a memory, not a draft — render the read-only
    // reflection view instead of the planner. No editing, no regeneration.
    if (dateOver) {
      const mapWaypoints = [
        ...(startPoint ? [{ id: "start", label: startPoint.label, lat: startPoint.lat, lng: startPoint.lng, kind: "start" as const }] : []),
        ...(pickupPoint ? [{ id: "pickup", label: pickupPoint.label, lat: pickupPoint.lat, lng: pickupPoint.lng, kind: "pickup" as const }] : []),
      ];
      const mapStops = verdictStops.map((s) => s.venue);

      return (
        <main className="mx-auto max-w-lg px-4 py-10">
          <div className="mb-6 text-center">
            <div className="mb-2 text-5xl">💞</div>
            <h1 className="text-3xl font-black text-[#3a2530]">
              {itinerary?.title ?? "Your Date"}
            </h1>
            <p className="mt-1 text-[#8a6a78]">
              How it went with {invite?.recipientName ?? "your date"} ✨
            </p>
          </div>

          <div className="mb-6 rounded-[24px] border-2 border-[#ffd6e8] bg-white/90 p-5 shadow-sm">
            <dl className="grid gap-3">
              <PlanRow icon="📅" label="Date" value={plan.selectedDateLabel ?? "—"} />
              <PlanRow icon="🕰️" label="Time" value={plan.selectedTimeLabel ?? "—"} />
              <PlanRow icon="💌" label="Activities" value={activities.join(" + ") || "—"} />
              <PlanRow icon="🍽️" label="Dinner" value={plan.selectedEntree ?? "—"} />
            </dl>
          </div>

          {(mapStops.length > 0 || mapWaypoints.length > 0) && (
            <div className="mb-6 h-[300px]">
              <DateMap stops={mapStops} waypoints={mapWaypoints} wheelZoomMode={settings.mapZoomMode} />
            </div>
          )}

          <ItinerarySection itinerary={itinerary} />

          <div className="mt-8">
            <h2 className="mb-3 text-center font-black text-[#3a2530]">How did it go?</h2>
            <RatingWidget planId={id} existingRating={userRating} allRatings={ratings} />
          </div>
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
              askExtraStop
            />
          </div>
        </main>
      );
    }

    return (
      <>
        <SenderPlanningView
          planId={id}
          settings={settings}
          settingsPersisted={persisted}
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
            startPoint,
            pickupPoint,
            legModes,
          }}
        />
        <div className="mx-auto max-w-lg px-4 pb-12">
          <ItinerarySection itinerary={itinerary} />
          {/* F1: ratings, verdicts, and the keepsake stay locked until dateEnd. */}
          <LockedUntilAfterDate />
          {/* F4: quietly tucked under the planner — confirm before it does anything. */}
          <CancelDateButton planId={id} />
        </div>
      </>
    );
  }

  // Recipient / shared view

  // F4: canceled → a gentle called-off state instead of the plan. No details,
  // no itinerary, no post-date widgets.
  if (canceled) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-[24px] border-2 border-[#ffd6e8] bg-white/90 p-8 text-center shadow-sm">
          <div className="mb-2 text-5xl">💔</div>
          <h1 className="text-3xl font-black text-[#3a2530]">
            This one&apos;s been called off
          </h1>
          <p className="mt-2 text-[#8a6a78]">
            Tonight&apos;s plan was called off — more soon 💌
          </p>
        </div>
      </main>
    );
  }

  // Her route for the night: pickup → each activity venue (in order) → dinner.
  // The sender's start point stays off her view. Same stop order as the
  // planner's buildStops: activities first, entree last.
  const navStops: RouteNavStop[] = [
    ...(pickupPoint && pickupPoint.lat
      ? [{ id: "pickup", name: pickupPoint.label, lat: pickupPoint.lat, lng: pickupPoint.lng }]
      : []),
    ...activities
      .filter((a) => activityVenues[a])
      .map((a) => ({
        id: a,
        name: activityVenues[a].name,
        lat: activityVenues[a].lat,
        lng: activityVenues[a].lng,
      })),
    ...(entreeVenue
      ? [{ id: "__entree__", name: entreeVenue.name, lat: entreeVenue.lat, lng: entreeVenue.lng }]
      : []),
  ];

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

      {!dateOver && <RouteNavLinks stops={navStops} legModes={legModes} />}

      {userId && dateOver && (
        <div className="mt-8">
          <h2 className="mb-3 text-center font-black text-[#3a2530]">How did it go?</h2>
          <RatingWidget planId={id} existingRating={userRating} allRatings={ratings} />
        </div>
      )}

      {userId && dateOver && verdictStops.length > 0 && (
        <div className="mt-8">
          <VenueVerdicts planId={id} stops={verdictStops} initial={userVerdicts} />
        </div>
      )}

      {userId && dateOver && (
        <div className="mt-8">
          <MemoryKeepsake
            planId={id}
            initialNotes={userMemory?.notes ?? ""}
            initialPoem={userMemory?.poem ?? null}
            initialPhotos={userMemory?.photos ?? []}
          />
        </div>
      )}

      {/* F1: ratings, verdicts, and the keepsake stay locked until dateEnd. */}
      {userId && !dateOver && <LockedUntilAfterDate />}
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

// F1: shown in place of ratings/verdicts/keepsake until the date's end time passes.
function LockedUntilAfterDate() {
  return (
    <div className="mt-8 rounded-[24px] border-2 border-dashed border-[#ffd6e8] bg-[#fff7fb] p-6 text-center">
      <div className="mb-1 text-3xl">🔒</div>
      <p className="font-black text-[#3a2530]">Come back after your date 💞</p>
      <p className="mt-1 text-sm text-[#8a6a78]">
        Ratings, venue verdicts, and your keepsake unlock once the night wraps up.
      </p>
    </div>
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

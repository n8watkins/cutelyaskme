import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { invites, datePlans, venueVerdicts, savedAddresses } from "@/lib/db/schema";
import { and, eq, ne, or, inArray, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { EnableNotifications } from "@/components/EnableNotifications";
import { HistoryMap, type HistoryPoint } from "@/components/HistoryMap";
import { SavedAddresses } from "@/components/SavedAddresses";
import { ACTIVITY_ICONS, type Venue } from "@/lib/venues";

function parseJson<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const me = await currentUser();
  const myEmail = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? null;

  const [sentInvites, myPlans] = await Promise.all([
    db
      .select()
      .from(invites)
      .where(eq(invites.senderId, userId))
      .orderBy(desc(invites.createdAt)),
    db
      .select()
      .from(datePlans)
      .where(
        or(eq(datePlans.senderId, userId), eq(datePlans.recipientId, userId)),
      )
      .orderBy(desc(datePlans.completedAt)),
  ]);

  const completedPlans = myPlans.filter((p) => p.completedAt !== null);
  // Split by the date itself: upcoming (today or later) vs past.
  // F4: canceled plans never count as upcoming — they live in Past, badged.
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingPlans = completedPlans.filter(
    (p) => !p.canceledAt && p.selectedDate && p.selectedDate >= todayStr,
  );
  const pastPlans = completedPlans.filter(
    (p) => p.canceledAt || !p.selectedDate || p.selectedDate < todayStr,
  );

  const planByInvite = Object.fromEntries(
    completedPlans
      .filter((p) => p.inviteId)
      .map((p) => [p.inviteId!, p.id]),
  );

  // Fetch invite details for completed plans so we can show recipient names
  const inviteIds = completedPlans.map((p) => p.inviteId).filter(Boolean) as string[];
  const planInvites = inviteIds.length
    ? await db
        .select({ id: invites.id, recipientName: invites.recipientName })
        .from(invites)
        .where(inArray(invites.id, inviteIds))
    : [];
  const inviteRecipientName = Object.fromEntries(planInvites.map((i) => [i.id, i.recipientName]));

  // Dates I've been invited to — matched by the email the sender used.
  const invitedToMe = myEmail
    ? await db
        .select()
        .from(invites)
        .where(and(sql`lower(${invites.recipientEmail}) = ${myEmail}`, ne(invites.senderId, userId)))
        .orderBy(desc(invites.createdAt))
    : [];
  const invitedInviteIds = invitedToMe.map((i) => i.id);
  const invitedPlans = invitedInviteIds.length
    ? await db
        .select({ id: datePlans.id, inviteId: datePlans.inviteId })
        .from(datePlans)
        .where(inArray(datePlans.inviteId, invitedInviteIds))
    : [];
  const myPlanByInvite = Object.fromEntries(
    invitedPlans.filter((p) => p.inviteId).map((p) => [p.inviteId!, p.id]),
  );

  // Your verdicts → "Your places" + status overlay on the map.
  const myAddresses = await db
    .select()
    .from(savedAddresses)
    .where(eq(savedAddresses.userId, userId))
    .orderBy(desc(savedAddresses.createdAt));

  const myVerdicts = await db
    .select()
    .from(venueVerdicts)
    .where(eq(venueVerdicts.userId, userId))
    .orderBy(desc(venueVerdicts.createdAt));
  const statusByVenueId = new Map(myVerdicts.map((v) => [v.venueId, v.status]));

  type PlaceItem = { venue: Venue; activity: string | null };
  const likedPlaces: PlaceItem[] = myVerdicts
    .filter((v) => v.status === "liked")
    .map((v) => ({ venue: parseJson<Venue>(v.venue, {} as Venue), activity: v.activity }));
  const dislikedPlaces: PlaceItem[] = myVerdicts
    .filter((v) => v.status === "disliked")
    .map((v) => ({ venue: parseJson<Venue>(v.venue, {} as Venue), activity: v.activity }));

  // "Our map" — every venue from your plans that has coordinates.
  const mapPoints: HistoryPoint[] = [];
  for (const plan of myPlans) {
    const activityVenues = parseJson<Record<string, Venue>>(plan.selectedActivityVenues, {});
    const entreeVenue = parseJson<Venue | null>(plan.selectedEntreeVenue ?? null, null);
    const entries: { activity: string; venue: Venue }[] = [
      ...Object.entries(activityVenues).map(([activity, venue]) => ({ activity, venue })),
      ...(entreeVenue ? [{ activity: plan.selectedEntree ?? "Dinner", venue: entreeVenue }] : []),
    ];
    for (const { activity, venue } of entries) {
      if (venue && typeof venue.lat === "number" && typeof venue.lng === "number") {
        mapPoints.push({
          id: `${plan.id}-${venue.id}`,
          name: venue.name,
          address: venue.address,
          lat: venue.lat,
          lng: venue.lng,
          dateLabel: plan.selectedDateLabel,
          activity,
          status: statusByVenueId.get(venue.id) ?? "neutral",
        });
      }
    }
  }

  // Profile stats.
  function mode(arr: string[]): string | null {
    const counts: Record<string, number> = {};
    let best: string | null = null;
    let bestN = 0;
    for (const x of arr) {
      counts[x] = (counts[x] ?? 0) + 1;
      if (counts[x] > bestN) {
        bestN = counts[x];
        best = x;
      }
    }
    return best;
  }
  const totalDates = completedPlans.length;
  const favCuisine = mode(
    completedPlans.map((p) => p.selectedEntree).filter((e): e is string => !!e && e !== "Surprise me"),
  );
  const allActivities: string[] = [];
  for (const p of completedPlans) {
    try {
      allActivities.push(...(JSON.parse(p.selectedActivities) as string[]));
    } catch {}
  }
  const favActivity = mode(allActivities);

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-black text-[#3a2530]">Your dates 💌</h1>
        <Link
          href="/send"
          className="rounded-full bg-[#ff7aaa] px-5 py-2.5 text-sm font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] hover:brightness-105"
        >
          + New invite
        </Link>
      </div>

      <div className="mb-8">
        <EnableNotifications />
      </div>

      {totalDates > 0 && (
        <section className="mb-8">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <Stat icon="💞" value={totalDates} label={totalDates === 1 ? "date" : "dates"} />
            <Stat icon="📍" value={mapPoints.length} label="places" />
            <Stat icon="❤️" value={likedPlaces.length} label="loved" />
            {favCuisine && <Stat icon="🍽️" value={favCuisine} label="go-to" />}
            {favActivity && <Stat icon="🎯" value={favActivity} label="favorite" />}
          </div>
        </section>
      )}

      {mapPoints.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
              💞 Your map
            </h2>
            <span className="text-xs font-black text-[#c0a0b0]">{mapPoints.length} spots</span>
          </div>
          <div className="h-[300px] overflow-hidden rounded-[24px] border-2 border-[#ffd6e8] shadow-sm">
            <HistoryMap points={mapPoints} />
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-black text-[#c0a0b0]">
            <span>🟢 loved</span>
            <span>🔴 nope</span>
            <span>🩷 been there</span>
          </p>
        </section>
      )}

      {invitedToMe.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
            Dates you&apos;re invited to
          </h2>
          <div className="grid gap-3">
            {invitedToMe.map((invite) => {
              const planId = myPlanByInvite[invite.id];
              return (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-3 rounded-[20px] border-2 border-[#e7d9ff] bg-[#faf7ff] p-4"
                >
                  <div className="min-w-0">
                    <p className="font-black text-[#3a2530]">Someone asked you on a date 💌</p>
                    {invite.location && (
                      <p className="truncate text-xs text-[#c0a0b0]">📍 {invite.location}</p>
                    )}
                  </div>
                  {planId ? (
                    <Link
                      href={`/plan/${planId}`}
                      className="shrink-0 rounded-full bg-[#c7a6ff] px-3 py-1 text-xs font-black text-white"
                    >
                      View →
                    </Link>
                  ) : (
                    <Link
                      href={`/invite/${invite.token}`}
                      className="shrink-0 rounded-full bg-[#ff7aaa] px-3 py-1 text-xs font-black text-white"
                    >
                      Respond →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
          Sent invites
        </h2>
        {!sentInvites.length ? (
          <p className="text-sm text-[#c0a0b0]">No invites yet.</p>
        ) : (
          <div className="grid gap-3">
            {sentInvites.map((invite) => {
              const planId = planByInvite[invite.id];
              return (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-3 rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="font-black text-[#3a2530]">{invite.recipientName}</p>
                    <p className="truncate text-xs text-[#c0a0b0]">{invite.recipientEmail}</p>
                    {invite.location && (
                      <p className="truncate text-xs text-[#c0a0b0]">📍 {invite.location}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={invite.status} />
                    {planId ? (
                      <Link
                        href={`/plan/${planId}`}
                        className="rounded-full bg-[#ff7aaa] px-3 py-1 text-xs font-black text-white"
                      >
                        View plan →
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/invite/${invite.token}`}
                          className="rounded-full border-2 border-[#ffd6e8] px-3 py-1 text-xs font-black text-[#8a6a78]"
                        >
                          Preview →
                        </Link>
                        <CopyLinkButton token={invite.token} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {upcomingPlans.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
            Upcoming dates
          </h2>
          <div className="grid gap-3">
            {upcomingPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSender={plan.senderId === userId}
                recipientName={plan.inviteId ? inviteRecipientName[plan.inviteId] ?? null : null}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
          Past dates
        </h2>
        {!pastPlans.length ? (
          <p className="text-sm text-[#c0a0b0]">No past dates yet.</p>
        ) : (
          <div className="grid gap-3">
            {pastPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSender={plan.senderId === userId}
                recipientName={plan.inviteId ? inviteRecipientName[plan.inviteId] ?? null : null}
              />
            ))}
          </div>
        )}
      </section>

      {myVerdicts.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
            ⭐ Your places
          </h2>
          <p className="mb-3 text-xs text-[#c0a0b0]">
            Loved spots come back as 💞 Reminisce suggestions when you plan your next date.
          </p>
          <div className="grid gap-4">
            {likedPlaces.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-black text-[#5fa86b]">❤️ Loved ({likedPlaces.length})</p>
                <div className="grid gap-2">
                  {likedPlaces.map(({ venue, activity }) => (
                    <PlaceRow key={`l-${venue.id}`} venue={venue} activity={activity} />
                  ))}
                </div>
              </div>
            )}
            {dislikedPlaces.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-black text-[#c0708a]">👎 Not for us ({dislikedPlaces.length})</p>
                <div className="grid gap-2">
                  {dislikedPlaces.map(({ venue, activity }) => (
                    <PlaceRow key={`d-${venue.id}`} venue={venue} activity={activity} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
          🏠 Saved addresses
        </h2>
        <SavedAddresses initial={myAddresses as import("@/components/SavedAddresses").SavedAddress[]} />
      </section>
    </main>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border-2 border-[#ffd6e8] bg-white p-3 text-center">
      <div className="text-lg">{icon}</div>
      <div className="truncate text-sm font-black text-[#3a2530]" title={String(value)}>
        {value}
      </div>
      <div className="text-[10px] font-black uppercase tracking-wide text-[#c0a0b0]">{label}</div>
    </div>
  );
}

function PlanCard({
  plan,
  isSender,
  recipientName,
}: {
  plan: {
    id: string;
    selectedActivities: string;
    selectedDateLabel: string | null;
    selectedTimeLabel: string | null;
    selectedEntree: string | null;
    canceledAt: string | null;
  };
  isSender: boolean;
  recipientName: string | null;
}) {
  let activities: string[] = [];
  try { activities = JSON.parse(plan.selectedActivities) as string[]; } catch {}

  const canceled = plan.canceledAt !== null;
  const who = isSender
    ? recipientName ? `Date with ${recipientName}` : "You planned this"
    : "Planned for you";
  const when = [plan.selectedDateLabel, plan.selectedTimeLabel].filter(Boolean).join(" at ");

  return (
    <Link
      href={`/plan/${plan.id}`}
      className={`block rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4 transition hover:bg-[#fff7fb] ${canceled ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-[#3a2530]">
            {who}
            {canceled && (
              <span className="ml-2 rounded-full bg-[#f6eef2] px-2 py-0.5 align-middle text-[10px] font-black uppercase tracking-wide text-[#c0708a]">
                called off 💔
              </span>
            )}
          </p>
          {when && <p className="mt-0.5 text-sm text-[#8a6a78]">{when}</p>}
          {activities.length > 0 && (
            <p className="mt-0.5 text-xs text-[#c0a0b0]">
              {activities.join(" + ")}
              {plan.selectedEntree ? ` · ${plan.selectedEntree}` : ""}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-[#c0a0b0]">→</span>
      </div>
    </Link>
  );
}

function PlaceRow({ venue, activity }: { venue: Venue; activity: string | null }) {
  const icon = activity === "__entree__" ? "🍽️" : (ACTIVITY_ICONS[activity ?? ""] ?? "📍");
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-[#ffd6e8] bg-white p-3">
      <span className="text-lg">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-[#3a2530]">{venue.name}</p>
        <p className="truncate text-xs text-[#8a6a78]">{venue.address}</p>
      </div>
      <a
        href={`https://maps.google.com/?q=${venue.lat},${venue.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-[#f5f0ff] px-2.5 py-1.5 text-xs font-black text-[#7c5aa0] transition hover:bg-[#e7d9ff]"
      >
        Map
      </a>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

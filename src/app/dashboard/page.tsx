import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { invites, datePlans } from "@/lib/db/schema";
import { and, eq, ne, or, inArray, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { EnableNotifications } from "@/components/EnableNotifications";

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

      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
          Past dates
        </h2>
        {!completedPlans.length ? (
          <p className="text-sm text-[#c0a0b0]">No completed dates yet.</p>
        ) : (
          <div className="grid gap-3">
            {completedPlans.map((plan) => {
              let activities: string[] = [];
              try { activities = JSON.parse(plan.selectedActivities) as string[]; } catch {}

              const isSender = plan.senderId === userId;
              const recipientName = plan.inviteId ? inviteRecipientName[plan.inviteId] : null;

              const who = isSender
                ? recipientName ? `Date with ${recipientName}` : "You planned this"
                : "Planned for you";

              const when = [plan.selectedDateLabel, plan.selectedTimeLabel]
                .filter(Boolean)
                .join(" at ");

              return (
                <Link
                  key={plan.id}
                  href={`/plan/${plan.id}`}
                  className="block rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4 transition hover:bg-[#fff7fb]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-[#3a2530]">{who}</p>
                      {when && (
                        <p className="mt-0.5 text-sm text-[#8a6a78]">{when}</p>
                      )}
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
            })}
          </div>
        )}
      </section>
    </main>
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

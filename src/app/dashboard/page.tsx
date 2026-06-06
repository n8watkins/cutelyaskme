import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { invites, datePlans } from "@/lib/db/schema";
import { eq, or, desc } from "drizzle-orm";
import Link from "next/link";
import { CopyLinkButton } from "@/components/CopyLinkButton";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

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
                    <p className="font-black text-[#3a2530]">
                      {invite.recipientName}
                    </p>
                    <p className="truncate text-xs text-[#c0a0b0]">
                      {invite.recipientEmail}
                    </p>
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
              return (
                <Link
                  key={plan.id}
                  href={`/plan/${plan.id}`}
                  className="block rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4 transition hover:bg-[#fff7fb]"
                >
                  <p className="font-black text-[#3a2530]">
                    {plan.selectedDateLabel ?? "A date"}
                  </p>
                  <p className="mt-0.5 text-sm text-[#8a6a78]">
                    {activities.join(" + ")}
                    {plan.selectedEntree ? ` · ${plan.selectedEntree}` : ""}
                  </p>
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
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-black ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}

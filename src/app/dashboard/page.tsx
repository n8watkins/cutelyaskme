import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();

  const [{ data: sentInvites }, { data: myPlans }] = await Promise.all([
    admin
      .from("invites")
      .select("id, token, recipient_name, recipient_email, status, created_at")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("date_plans")
      .select(
        "id, selected_date_label, selected_entree, selected_activities, completed_at, sender_id, recipient_id",
      )
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }),
  ]);

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

      {/* Sent invites */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
          Sent invites
        </h2>
        {!sentInvites?.length ? (
          <p className="text-sm text-[#c0a0b0]">No invites yet.</p>
        ) : (
          <div className="grid gap-3">
            {sentInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4"
              >
                <div>
                  <p className="font-black text-[#3a2530]">
                    {invite.recipient_name}
                  </p>
                  <p className="text-xs text-[#c0a0b0]">
                    {invite.recipient_email}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={invite.status} />
                  {invite.status === "pending" && (
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          `${window.location.origin}/invite/${invite.token}`,
                        )
                      }
                      className="rounded-full border-2 border-[#ffd6e8] px-3 py-1 text-xs font-black text-[#8a6a78]"
                    >
                      Copy link
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past dates */}
      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
          Past dates
        </h2>
        {!myPlans?.length ? (
          <p className="text-sm text-[#c0a0b0]">No completed dates yet.</p>
        ) : (
          <div className="grid gap-3">
            {myPlans.map((plan) => (
              <Link
                key={plan.id}
                href={`/plan/${plan.id}`}
                className="block rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4 transition hover:bg-[#fff7fb]"
              >
                <p className="font-black text-[#3a2530]">
                  {plan.selected_date_label ?? "A date"}
                </p>
                <p className="mt-0.5 text-sm text-[#8a6a78]">
                  {(plan.selected_activities as string[]).join(" + ")}
                  {plan.selected_entree ? ` · ${plan.selected_entree}` : ""}
                </p>
              </Link>
            ))}
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

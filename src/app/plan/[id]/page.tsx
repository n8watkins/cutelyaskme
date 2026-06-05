import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { RatingWidget } from "@/components/RatingWidget";
import { SenderPlanningView } from "@/components/sender/SenderPlanningView";
import type { ItineraryJson } from "@/lib/supabase/types";

type PlanPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlanPage({ params }: PlanPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("date_plans")
    .select("*")
    .eq("id", id)
    .single();

  if (!plan) notFound();

  if (user && user.id !== plan.sender_id && user.id !== plan.recipient_id) {
    notFound();
  }

  const isSender = user?.id === plan.sender_id;

  // Sender sees planning view when plan isn't finalized
  if (isSender) {
    const { data: invite } = await admin
      .from("invites")
      .select("recipient_name")
      .eq("id", plan.invite_id ?? "")
      .single();

    return (
      <SenderPlanningView
        plan={{
          selectedDateLabel: plan.selected_date_label,
          selectedTimeLabel: plan.selected_time_label,
          selectedEntree: plan.selected_entree,
          selectedActivities: plan.selected_activities as string[],
          dressVibe: (plan as Record<string, unknown>).dress_vibe as string | null ?? null,
          recipientName: invite?.recipient_name ?? "her",
        }}
      />
    );
  }

  // Recipient / shared plan view
  const participantIds = [plan.sender_id, plan.recipient_id].filter(Boolean) as string[];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", participantIds);

  const nameMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.display_name]),
  );

  const { data: ratings } = await admin
    .from("date_ratings")
    .select("rater_id, score, note")
    .eq("plan_id", id);

  const userRating = ratings?.find((r) => r.rater_id === user?.id);
  const itinerary = plan.itinerary as ItineraryJson | null;

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
          <PlanRow icon="📅" label="Date" value={plan.selected_date_label ?? "—"} />
          <PlanRow icon="🕰️" label="Time" value={plan.selected_time_label ?? "—"} />
          <PlanRow
            icon="💌"
            label="Activities"
            value={(plan.selected_activities as string[]).join(" + ") || "—"}
          />
          <PlanRow icon="🍽️" label="Dinner" value={plan.selected_entree ?? "—"} />
        </dl>
        <div className="mt-4 flex gap-2 text-xs text-[#c0a0b0]">
          <span>Planned by {nameMap[plan.sender_id] ?? "someone special"}</span>
          {plan.recipient_id && (
            <>
              <span>·</span>
              <span>Picked by {nameMap[plan.recipient_id] ?? "them"}</span>
            </>
          )}
        </div>
      </div>

      {itinerary?.timeline && itinerary.timeline.length > 0 && (
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

      {itinerary?.tips && itinerary.tips.length > 0 && (
        <div className="mb-6 rounded-[24px] border-2 border-[#ffd6e8] bg-[#fff7fb] p-5">
          <h2 className="mb-2 font-black text-[#3a2530]">Pro tips 💡</h2>
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

      {user && (
        <div className="mt-8">
          <h2 className="mb-3 text-center font-black text-[#3a2530]">How did it go?</h2>
          <RatingWidget
            planId={id}
            existingRating={userRating ?? null}
            allRatings={ratings ?? []}
          />
        </div>
      )}
    </main>
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

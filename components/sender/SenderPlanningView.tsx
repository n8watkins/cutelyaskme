"use client";

import dynamic from "next/dynamic";
import type { Venue } from "@/lib/venues";
import { PRICE_LABELS } from "@/lib/venues";

const DateMap = dynamic(
  () => import("./DateMap").then((m) => m.DateMap),
  { ssr: false, loading: () => <div className="h-full w-full rounded-[20px] bg-[#ffd6e8]/30 animate-pulse" /> },
);

const DRESS_VIBE_LABELS: Record<string, string> = {
  casual: "🧢 Keep it casual",
  "casual-cute": "🌸 Casual but cute",
  "dress-up": "👗 Ready to dress up",
  "match-you": "✨ Match whatever",
};

type PlanData = {
  selectedDateLabel: string | null;
  selectedTimeLabel: string | null;
  selectedEntree: string | null;
  selectedActivities: string[];
  dressVibe: string | null;
  recipientName: string;
  selectedEntreeVenue: Venue | null;
  selectedActivityVenues: Record<string, Venue>;
};

export function SenderPlanningView({ plan }: { plan: PlanData }) {
  const mapStops: (Venue | null)[] = [
    ...plan.selectedActivities.map((a) => plan.selectedActivityVenues[a] ?? null),
    plan.selectedEntreeVenue ?? null,
  ];

  const hasAnyVenues = mapStops.some(Boolean);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-black text-[#3a2530]">
        Your date plan ✨
      </h1>
      <p className="mb-8 text-[#8a6a78]">
        Here&apos;s what {plan.recipientName} chose.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        {/* Left — picks + venues */}
        <div className="space-y-6">
          <section className="rounded-[24px] border-2 border-[#ffd6e8] bg-white p-5">
            <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
              What she picked
            </h2>
            <dl className="grid gap-3">
              <HerRow icon="📅" label="Date" value={plan.selectedDateLabel ?? "—"} />
              <HerRow icon="🕰️" label="Time" value={plan.selectedTimeLabel ?? "—"} />
              <HerRow icon="💌" label="Activities" value={plan.selectedActivities.join(" + ") || "—"} />
              <HerRow icon="🍽️" label="Food" value={plan.selectedEntree ?? "—"} />
              {plan.dressVibe && (
                <HerRow icon="👗" label="Her vibe" value={DRESS_VIBE_LABELS[plan.dressVibe] ?? plan.dressVibe} />
              )}
            </dl>
          </section>

          {hasAnyVenues && (
            <section className="rounded-[24px] border-2 border-[#ffd6e8] bg-white p-5">
              <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
                Her spots
              </h2>
              <div className="space-y-3">
                {plan.selectedActivities.map((activity) => {
                  const venue = plan.selectedActivityVenues[activity];
                  if (!venue) return null;
                  return <VenueRow key={activity} label={activity} venue={venue} />;
                })}
                {plan.selectedEntreeVenue && (
                  <VenueRow label={plan.selectedEntree ?? "Food"} venue={plan.selectedEntreeVenue} />
                )}
              </div>
            </section>
          )}
        </div>

        {/* Right — map */}
        <div>
          <div className="sticky top-4">
            <div className="h-[440px] overflow-hidden rounded-[20px] border-2 border-[#ffd6e8] shadow-sm">
              <DateMap stops={mapStops} />
            </div>
            {!hasAnyVenues && (
              <p className="mt-3 text-center text-sm text-[#c0a0b0]">
                No specific spots were picked — the itinerary below has the details.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HerRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#fff7fb] text-lg">
        {icon}
      </span>
      <div>
        <dt className="text-xs font-black uppercase tracking-[0.14em] text-[#c0a0b0]">{label}</dt>
        <dd className="font-black text-[#3a2530]">{value}</dd>
      </div>
    </div>
  );
}

function VenueRow({ label, venue }: { label: string; venue: Venue }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-[#ffd6e8] bg-[#fff7fb] p-3">
      <div className="flex-1">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#c0a0b0]">{label}</p>
        <p className="font-black text-[#3a2530]">{venue.name}</p>
        <p className="text-sm text-[#8a6a78]">{venue.address}</p>
      </div>
      <div className="shrink-0 text-right text-xs text-[#8a6a78]">
        {venue.rating > 0 && <div>★ {venue.rating.toFixed(1)}</div>}
        <div>{PRICE_LABELS[venue.priceLevel]}</div>
      </div>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  type MockVenue,
  NO_VENUE_ACTIVITIES,
  PRICE_LABELS,
  getVenuesForActivity,
  getVenuesForFood,
  suggestDressCode,
} from "@/lib/mock-venues";

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
};

type FinalizeMode = "surprise" | "deets" | null;

export function SenderPlanningView({ plan }: { plan: PlanData }) {
  // venue selection: key = activity/food label, value = chosen venue
  const [chosen, setChosen] = useState<Record<string, MockVenue>>({});
  const [order, setOrder] = useState<string[]>(() => buildInitialOrder(plan));
  const [finalizeMode, setFinalizeMode] = useState<FinalizeMode>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Venue options per slot
  const slots = useMemo(() => buildSlots(plan), [plan]);

  // Ordered stops for the map (nulls for unselected)
  const mapStops = useMemo(
    () => order.map((label) => chosen[label] ?? null),
    [order, chosen],
  );

  const allPicked = order.every((label) => {
    const slot = slots.find((s) => s.label === label);
    return slot?.venues.length === 0 || chosen[label]; // outdoor/no-venue slots auto-pass
  });

  const selectedVenues = order.map((label) => chosen[label]).filter(Boolean) as MockVenue[];
  const dressCode = suggestDressCode(selectedVenues, plan.dressVibe);

  function moveStop(index: number, dir: -1 | 1) {
    const next = [...order];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setOrder(next);
  }

  if (confirmed) {
    return <ConfirmedView mode={finalizeMode!} dressCode={dressCode} plan={plan} />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-black text-[#3a2530]">
        Plan the date ✨
      </h1>
      <p className="mb-8 text-[#8a6a78]">
        {plan.recipientName} picked the vibe. You pick the places.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        {/* Left — her picks + your venue choices */}
        <div className="space-y-6">
          {/* Her picks */}
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

          {/* Venue picker per slot */}
          <section>
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
              Pick your spots
            </h2>
            <div className="space-y-4">
              {slots.map((slot) => (
                <VenueSlot
                  key={slot.label}
                  slot={slot}
                  chosen={chosen[slot.label] ?? null}
                  onChoose={(v) => setChosen((c) => ({ ...c, [slot.label]: v }))}
                />
              ))}
            </div>
          </section>

          {/* Route builder */}
          <section className="rounded-[24px] border-2 border-[#ffd6e8] bg-white p-5">
            <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
              Order the evening
            </h2>
            <div className="space-y-2">
              {order.map((label, i) => {
                const venue = chosen[label];
                return (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-2xl border-2 border-[#ffd6e8] bg-[#fff7fb] p-3"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ff7aaa] text-sm font-black text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-[#3a2530]">
                        {venue ? venue.name : label}
                      </p>
                      {venue && (
                        <p className="truncate text-xs text-[#c0a0b0]">{venue.address}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveStop(i, -1)}
                        disabled={i === 0}
                        className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#ffd6e8] text-sm text-[#8a6a78] disabled:opacity-30"
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStop(i, 1)}
                        disabled={i === order.length - 1}
                        className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#ffd6e8] text-sm text-[#8a6a78] disabled:opacity-30"
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Dress code preview */}
          {allPicked && (
            <section className="rounded-[24px] border-2 border-[#e7d9ff] bg-white p-5">
              <h2 className="mb-1 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
                Dress code suggestion
              </h2>
              <p className="text-lg font-black text-[#3a2530]">{dressCode.code}</p>
              <p className="mt-1 text-sm text-[#8a6a78]">{dressCode.message}</p>
            </section>
          )}
        </div>

        {/* Right — map */}
        <div className="space-y-4">
          <div className="sticky top-4 space-y-4">
            <div className="h-[440px] overflow-hidden rounded-[20px] border-2 border-[#ffd6e8] shadow-sm">
              <DateMap stops={mapStops} />
            </div>

            {/* Finalize */}
            {allPicked && (
              <div className="rounded-[24px] border-2 border-[#ffd6e8] bg-white p-5">
                <h2 className="mb-3 font-black text-[#3a2530]">Ready to lock it in?</h2>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => { setFinalizeMode("surprise"); setConfirmed(true); }}
                    className="rounded-full bg-[#ff7aaa] py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] hover:brightness-105"
                  >
                    🎁 Surprise her — dress code only
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFinalizeMode("deets"); setConfirmed(true); }}
                    className="rounded-full border-2 border-[#ffd6e8] py-3 font-black text-[#8a6a78] hover:bg-[#fff7fb]"
                  >
                    📬 Send her the full plan
                  </button>
                </div>
              </div>
            )}

            {!allPicked && (
              <p className="text-center text-sm text-[#c0a0b0]">
                Pick a spot for each stop to unlock finalize
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

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

type Slot = {
  label: string;
  emoji: string;
  venues: MockVenue[];
  isOutdoor: boolean;
};

function VenueSlot({
  slot,
  chosen,
  onChoose,
}: {
  slot: Slot;
  chosen: MockVenue | null;
  onChoose: (v: MockVenue) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (slot.isOutdoor) {
    return (
      <div className="rounded-[20px] border-2 border-[#ffd6e8] bg-[#fff7fb] p-4">
        <p className="text-sm font-black text-[#8a6a78]">
          {slot.emoji} {slot.label} — no specific venue needed
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border-2 border-[#ffd6e8] bg-white p-4">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="font-black text-[#3a2530]">
            {slot.emoji} {slot.label}
          </p>
          {chosen ? (
            <p className="text-sm text-[#8a6a78]">
              ✓ {chosen.name} · {PRICE_LABELS[chosen.priceLevel]} · ⭐ {chosen.rating}
            </p>
          ) : (
            <p className="text-sm text-[#c0a0b0]">Tap to pick a spot</p>
          )}
        </div>
        <span className="text-[#c0a0b0]">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-3 grid gap-2">
          {slot.venues.map((venue) => {
            const isChosen = chosen?.id === venue.id;
            return (
              <button
                key={venue.id}
                type="button"
                onClick={() => { onChoose(venue); setExpanded(false); }}
                className={`flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition ${
                  isChosen
                    ? "border-[#ff7aaa] bg-[#fff7fb]"
                    : "border-[#ffd6e8] hover:bg-[#fff7fb]"
                }`}
              >
                <div className="flex-1">
                  <p className="font-black text-[#3a2530]">{venue.name}</p>
                  <p className="text-xs text-[#8a6a78]">{venue.address}</p>
                  <p className="mt-1 text-xs italic text-[#c0a0b0]">{venue.note}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-[#8a6a78]">
                  <div>⭐ {venue.rating}</div>
                  <div>{PRICE_LABELS[venue.priceLevel]}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConfirmedView({
  mode,
  dressCode,
  plan,
}: {
  mode: FinalizeMode;
  dressCode: { code: string; message: string };
  plan: PlanData;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 text-6xl">{mode === "surprise" ? "🎁" : "📬"}</div>
      <h1 className="text-3xl font-black text-[#3a2530]">
        {mode === "surprise" ? "You're set — she'll be surprised!" : "Plan sent!"}
      </h1>
      <p className="mt-2 text-[#8a6a78]">
        {mode === "surprise"
          ? `She'll get the dress code and time. The rest is your secret.`
          : `She'll get the full itinerary — restaurants, activities, and all.`}
      </p>

      <div className="mt-8 w-full rounded-[24px] border-2 border-[#ffd6e8] bg-white p-6 text-left">
        <p className="mb-1 text-xs font-black uppercase tracking-widest text-[#c0a0b0]">
          What she'll see
        </p>
        {mode === "surprise" ? (
          <>
            <p className="font-black text-[#3a2530]">📅 {plan.selectedDateLabel}</p>
            <p className="font-black text-[#3a2530]">🕰️ {plan.selectedTimeLabel}</p>
            <div className="mt-3 rounded-2xl bg-[#fff7fb] p-3">
              <p className="text-xs font-black uppercase tracking-widest text-[#c0a0b0]">Dress code</p>
              <p className="mt-1 font-black text-[#3a2530]">{dressCode.code}</p>
              <p className="text-sm text-[#8a6a78]">{dressCode.message}</p>
            </div>
          </>
        ) : (
          <p className="text-sm text-[#8a6a78]">
            Full itinerary with venues, times, and the dress code.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function buildInitialOrder(plan: PlanData): string[] {
  const stops: string[] = [];
  // Natural date order: first activity → dinner → second activity (or all activities then dinner)
  // Simple default: activities interleaved with dinner in the middle
  const acts = plan.selectedActivities;
  if (acts.length === 0) {
    if (plan.selectedEntree) stops.push(plan.selectedEntree);
    return stops;
  }
  stops.push(acts[0] ?? "");
  if (plan.selectedEntree) stops.push(plan.selectedEntree);
  if (acts[1]) stops.push(acts[1]);
  return stops.filter(Boolean);
}

function buildSlots(plan: PlanData): Slot[] {
  const ACTIVITY_EMOJI: Record<string, string> = {
    Movie: "🎞️", Arcade: "🕹️", Museum: "🏛️", Karaoke: "🎤",
    "Live music": "🎵", "Mini golf": "⛳", "Photo booth": "📸",
    Walk: "🌷", "Sunset view": "🌅", "Scenic drive": "🚗",
    Stargazing: "🌌", Coffee: "☕", Bookstore: "📚", Drinks: "🍹",
    "Board games": "🎲", "Farmers market": "🍓", "Night market": "🌙",
  };

  const slots: Slot[] = [];

  for (const activity of plan.selectedActivities) {
    const venues = getVenuesForActivity(activity);
    slots.push({
      label: activity,
      emoji: ACTIVITY_EMOJI[activity] ?? "✨",
      venues,
      isOutdoor: NO_VENUE_ACTIVITIES.has(activity) && venues.length === 0,
    });
  }

  if (plan.selectedEntree) {
    slots.push({
      label: plan.selectedEntree,
      emoji: "🍽️",
      venues: getVenuesForFood(plan.selectedEntree),
      isOutdoor: false,
    });
  }

  return slots;
}

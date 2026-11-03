"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Card,
  Chip,
  DateThread,
  MapPlaceholder,
  primaryClass,
  secondaryClass,
} from "@/components/proposal/ui";

type Place = { id: string; name: string; meta: string; address: string; tint: string; icon: string };
type Stop = { key: string; icon: string; label: string; time: string; places: Place[] };

const STOPS: Stop[] = [
  {
    key: "bookstore",
    icon: "📚",
    label: "Bookstore",
    time: "6:30 PM · 1 h",
    places: [
      { id: "b1", name: "Vroman's Bookstore", meta: "0.5 mi · $$ · ★ 4.8 (2.1k)", address: "695 E Colorado Blvd", tint: "bg-sunny", icon: "📚" },
      { id: "b2", name: "The Open Book", meta: "0.2 mi · $ · ★ 4.8 (311)", address: "300 E Colorado Blvd", tint: "bg-mist", icon: "📖" },
      { id: "b3", name: "Book Alley", meta: "0.9 mi · $ · ★ 4.7 (540)", address: "1252 E Colorado Blvd", tint: "bg-blush", icon: "📕" },
    ],
  },
  {
    key: "photo",
    icon: "📸",
    label: "Photo booth",
    time: "7:30 PM · 30 min",
    places: [
      { id: "p1", name: "Magic Photo Booth", meta: "0.4 mi · $ · ★ 4.9 (88)", address: "41 S Raymond Ave", tint: "bg-mist", icon: "📸" },
      { id: "p2", name: "Snap Studio Pasadena", meta: "1.1 mi · $$ · ★ 4.6 (120)", address: "88 N Lake Ave", tint: "bg-blush", icon: "🎞️" },
      { id: "p3", name: "Old Town Arcade Booth", meta: "0.3 mi · $ · ★ 4.4 (64)", address: "12 W Colorado Blvd", tint: "bg-sunny", icon: "🕹️" },
    ],
  },
  {
    key: "food",
    icon: "🍕",
    label: "Pizza",
    time: "8:00 PM · 1 h 15 min",
    places: [
      { id: "f1", name: "Pie Life Pizza", meta: "0.3 mi · $$ · ★ 4.7 (980)", address: "99 E Green St", tint: "bg-sunny", icon: "🍕" },
      { id: "f2", name: "Settebello", meta: "0.6 mi · $$ · ★ 4.6 (1.4k)", address: "625 E Colorado Blvd", tint: "bg-blush", icon: "🔥" },
      { id: "f3", name: "Mountain Mike's", meta: "2.0 mi · $ · ★ 4.3 (210)", address: "3415 E Colorado Blvd", tint: "bg-mist", icon: "🍕" },
    ],
  },
];

export function GuidedPlanner() {
  // Bookstore starts picked so the prototype opens mid-flow.
  const [picked, setPicked] = useState<Record<string, Place | null>>({ bookstore: STOPS[0].places[0], photo: null, food: null });
  const [shared, setShared] = useState<"share" | "surprise" | null>(null);
  const [showMap, setShowMap] = useState(false);
  const done = STOPS.filter((s) => picked[s.key]).length;
  const missing = STOPS.filter((s) => !picked[s.key]).map((s) => s.label);
  const ready = missing.length === 0;
  const step = shared ? "Shared" : done > 0 ? "Planned" : "Picked";

  const shareCard = (
    <Card className="border-lilac bg-mist">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-black">{shared ? "Shared with Sam ✓" : "Send it to Sam"}</h2>
        <p className="text-sm font-black text-lavender">
          {done} of {STOPS.length} spots
        </p>
      </div>
      {shared ? (
        <p role="status" className="mt-2 text-sm font-bold text-muted">
          {shared === "share"
            ? "Sam can see every stop now. The plan is locked so it stays the same for both of you."
            : "Sam sees the day and time now, and the rest when the date begins."}
        </p>
      ) : (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white" aria-hidden>
            <div
              className={`h-full rounded-full bg-lavender transition-all ${
                ["w-0", "w-1/3", "w-2/3", "w-full"][done]
              }`}
            />
          </div>
          <p className="mt-3 text-sm font-bold text-muted">
            {ready ? "Every stop has a spot. Sharing locks the plan." : `Still to pick: ${missing.join(", ")}.`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled={!ready} onClick={() => setShared("share")} className={primaryClass("sm")}>
              Share with Sam
            </button>
            <button type="button" disabled={!ready} onClick={() => setShared("surprise")} className={secondaryClass("sm")}>
              Keep it a surprise
            </button>
          </div>
        </>
      )}
    </Card>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 pb-36 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
      <Link href="/proposal/dashboard" className="inline-flex min-h-11 items-center text-sm font-black text-muted hover:text-ink">
        ← Your dates
      </Link>
      <div className="mt-1 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
        <div>
          <h1 className="text-3xl font-black sm:text-4xl">Plan your date with Sam</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip icon="📅">Sat, Nov 7</Chip>
            <Chip icon="🕰️">6:30 PM</Chip>
            <Chip icon="🧢">Keep it casual</Chip>
            <Chip icon="☀️">83° sunny</Chip>
          </div>
        </div>
        <div className="rounded-[20px] bg-white/80 p-3 ring-2 ring-petal">
          <DateThread current={step} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <p className="text-sm font-bold text-muted">
            Sam picked these. Choose a spot for each, near Old Pasadena.{" "}
            <span className="whitespace-nowrap">Sunset is 4:56 PM.</span>
          </p>
          <ol className="space-y-4">
            {STOPS.map((stop, index) => {
              const choice = picked[stop.key];
              return (
                <Card as="li" key={stop.key} className={choice ? "border-[#bfe5c8]" : ""}>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black ${
                        choice ? "bg-[#2f7a45] text-white" : "bg-blush text-pink-strong ring-2 ring-petal"
                      }`}
                    >
                      {choice ? "✓" : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-black">
                        <span aria-hidden>{stop.icon}</span> {stop.label}
                      </h2>
                      <p className="text-sm text-muted">{stop.time}</p>
                    </div>
                    {choice && (
                      <button
                        type="button"
                        onClick={() => {
                          setPicked((p) => ({ ...p, [stop.key]: null }));
                          setShared(null);
                        }}
                        disabled={shared !== null}
                        className="min-h-11 shrink-0 rounded-full px-3 text-sm font-black text-pink-strong underline underline-offset-4 disabled:hidden"
                        aria-label={`Change the spot for ${stop.label}`}
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {choice ? (
                    <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f1faf3] p-3">
                      <span aria-hidden className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl ${choice.tint}`}>
                        {choice.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-black">{choice.name}</p>
                        <p className="truncate text-sm text-muted">{choice.address}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-muted">Good fits nearby</p>
                      <ul className="mt-2 grid gap-2">
                        {stop.places.map((place) => (
                          <li key={place.id} className="flex items-center gap-3 rounded-2xl border-2 border-blush p-2.5">
                            <span aria-hidden className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl ${place.tint}`}>
                              {place.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-black">{place.name}</p>
                              <p className="truncate text-sm text-muted">{place.meta}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPicked((p) => ({ ...p, [stop.key]: place }))}
                              className={`${secondaryClass("sm")} shrink-0`}
                              aria-label={`Pick ${place.name} for ${stop.label}`}
                            >
                              Pick
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 flex flex-wrap items-center gap-x-1 text-sm font-bold text-muted">
                        More ways:
                        <button type="button" className="min-h-11 rounded-full px-2 font-black text-lavender underline underline-offset-4">Search</button>
                        <button type="button" className="min-h-11 rounded-full px-2 font-black text-lavender underline underline-offset-4">Drop a pin</button>
                        <button type="button" className="min-h-11 rounded-full px-2 font-black text-lavender underline underline-offset-4">Places you loved</button>
                      </p>
                    </>
                  )}
                </Card>
              );
            })}
          </ol>

          <details className="group rounded-[24px] border-2 border-petal bg-white">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-black">
              Fine-tune
              <span aria-hidden className="text-muted transition group-open:rotate-180">▾</span>
            </summary>
            <div className="grid gap-4 border-t-2 border-blush p-5 text-sm">
              <p className="text-muted">Start and pickup addresses, search area and range, time at each stop, and drive or walk for each leg.</p>
              <label className="grid gap-1 font-black">
                Pickup address
                <input className="min-h-11 rounded-2xl border-2 border-petal px-3 font-bold" placeholder="Where you pick Sam up" />
              </label>
              <label className="grid gap-1 font-black">
                Search near
                <input className="min-h-11 rounded-2xl border-2 border-petal px-3 font-bold" defaultValue="Old Pasadena, CA" />
              </label>
            </div>
          </details>
        </div>

        <aside className="order-first min-w-0 space-y-4 lg:order-none lg:sticky lg:top-16 lg:self-start" aria-label="Map and sharing">
          <div className={`overflow-hidden rounded-[24px] border-2 border-petal ${showMap ? "block" : "hidden"} aspect-[19/12] lg:block`}>
            <MapPlaceholder pins={done} />
          </div>
          <button
            type="button"
            onClick={() => setShowMap((m) => !m)}
            aria-expanded={showMap}
            className={`${secondaryClass("sm")} w-full lg:hidden`}
          >
            {showMap ? "Hide map" : "Show map"}
          </button>
          <div className="hidden lg:block">{shareCard}</div>
        </aside>
      </div>

      {/* Phone: the share bar is always in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-lilac bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur lg:hidden">
        {shared ? (
          <p role="status" className="py-2 text-center font-black text-lavender">
            {shared === "share" ? "Shared with Sam ✓" : "Surprise is set ✓"}
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-black">
                {done} of {STOPS.length} spots picked
              </p>
              <p className="truncate text-sm text-muted">{ready ? "Ready to send" : `Next: ${missing[0]}`}</p>
            </div>
            <button type="button" disabled={!ready} onClick={() => setShared("share")} className={primaryClass("sm")}>
              Share with Sam
            </button>
          </div>
        )}
      </div>
    </main>
  );
}


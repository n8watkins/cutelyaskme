"use client";

import { useState } from "react";
import type { Venue } from "@/lib/venues";
import { ACTIVITY_ICONS } from "@/lib/venues";

export type VerdictStatus = "liked" | "disliked" | "neutral";
export type VerdictStop = { activity: string; venue: Venue };

const OPTIONS: { value: VerdictStatus; emoji: string; label: string; on: string }[] = [
  { value: "disliked", emoji: "👎", label: "Nope", on: "border-[#ff7aaa] bg-[#ff7aaa]" },
  { value: "neutral", emoji: "😐", label: "Meh", on: "border-[#c0a0b0] bg-[#c0a0b0]" },
  { value: "liked", emoji: "👍", label: "Loved", on: "border-[#5fd97f] bg-[#5fd97f]" },
];

export function VenueVerdicts({
  planId,
  stops,
  initial,
}: {
  planId: string;
  stops: VerdictStop[];
  initial: Record<string, VerdictStatus>;
}) {
  const [verdicts, setVerdicts] = useState<Record<string, VerdictStatus>>(initial);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  async function setStatus(stop: VerdictStop, status: VerdictStatus) {
    const venueId = stop.venue.id;
    const prev = verdicts[venueId] ?? "neutral";
    if (prev === status) return;

    setVerdicts((p) => ({ ...p, [venueId]: status }));
    setPending((p) => ({ ...p, [venueId]: true }));

    try {
      const res = await fetch("/api/verdicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, activity: stop.activity, venue: stop.venue, status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setVerdicts((p) => ({ ...p, [venueId]: prev })); // revert on failure
    } finally {
      setPending((p) => ({ ...p, [venueId]: false }));
    }
  }

  if (stops.length === 0) return null;

  return (
    <div className="rounded-[24px] border-2 border-[#ffd6e8] bg-white/90 p-5">
      <h2 className="mb-1 text-center font-black text-[#3a2530]">Would you go back? 💘</h2>
      <p className="mb-4 text-center text-sm text-[#8a6a78]">
        Rate each spot — your favorites come back as suggestions next time.
      </p>

      <div className="grid gap-2">
        {stops.map((stop) => {
          const current = verdicts[stop.venue.id] ?? "neutral";
          const busy = pending[stop.venue.id] ?? false;
          const icon =
            stop.activity === "__entree__" ? "🍽️" : (ACTIVITY_ICONS[stop.activity] ?? "✨");

          return (
            <div
              key={stop.venue.id}
              className="flex items-center gap-3 rounded-2xl border-2 border-[#ffd6e8] bg-[#fff7fb] p-3"
            >
              <span className="text-xl">{icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-[#3a2530]">{stop.venue.name}</p>
                <p className="truncate text-xs text-[#8a6a78]">{stop.venue.address}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => void setStatus(stop, opt.value)}
                    disabled={busy}
                    aria-label={opt.label}
                    aria-pressed={current === opt.value}
                    className={`grid h-9 w-9 place-items-center rounded-full border-2 text-base transition disabled:opacity-50 ${
                      current === opt.value
                        ? opt.on
                        : "border-[#ffd6e8] opacity-60 hover:opacity-100"
                    }`}
                  >
                    {opt.emoji}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

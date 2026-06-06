"use client";

import { useState } from "react";
import type { Venue } from "@/lib/venues";
import { ACTIVITY_ICONS } from "@/lib/venues";

export type VerdictStop = { activity: string; venue: Venue };

export function VenueVerdicts({
  planId,
  stops,
  initial,
}: {
  planId: string;
  stops: VerdictStop[];
  initial: Record<string, boolean>;
}) {
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>(initial);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  async function swipe(stop: VerdictStop, liked: boolean) {
    const venueId = stop.venue.id;
    const prev = verdicts[venueId];
    // Tapping the active verdict again clears it.
    const next = prev === liked ? undefined : liked;

    setVerdicts((p) => {
      const n = { ...p };
      if (next === undefined) delete n[venueId];
      else n[venueId] = next;
      return n;
    });
    setPending((p) => ({ ...p, [venueId]: true }));

    try {
      if (next === undefined) {
        await fetch("/api/verdicts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueId }),
        });
      } else {
        await fetch("/api/verdicts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId, activity: stop.activity, venue: stop.venue, liked: next }),
        });
      }
    } catch {
      // Revert on failure.
      setVerdicts((p) => {
        const n = { ...p };
        if (prev === undefined) delete n[venueId];
        else n[venueId] = prev;
        return n;
      });
    } finally {
      setPending((p) => ({ ...p, [venueId]: false }));
    }
  }

  if (stops.length === 0) return null;

  return (
    <div className="rounded-[24px] border-2 border-[#ffd6e8] bg-white/90 p-5">
      <h2 className="mb-1 text-center font-black text-[#3a2530]">Would you go back? 💘</h2>
      <p className="mb-4 text-center text-sm text-[#8a6a78]">
        Swipe each spot — we&apos;ll recommend your favorites next time.
      </p>

      <div className="grid gap-2">
        {stops.map((stop) => {
          const v = verdicts[stop.venue.id];
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
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => void swipe(stop, false)}
                  disabled={busy}
                  aria-label="Wouldn't go back"
                  aria-pressed={v === false}
                  className={`grid h-9 w-9 place-items-center rounded-full border-2 text-lg transition disabled:opacity-50 ${
                    v === false
                      ? "border-[#ff7aaa] bg-[#ff7aaa]"
                      : "border-[#ffd6e8] hover:bg-[#ffd6e8]"
                  }`}
                >
                  👎
                </button>
                <button
                  type="button"
                  onClick={() => void swipe(stop, true)}
                  disabled={busy}
                  aria-label="Would go back"
                  aria-pressed={v === true}
                  className={`grid h-9 w-9 place-items-center rounded-full border-2 text-lg transition disabled:opacity-50 ${
                    v === true
                      ? "border-[#5fd97f] bg-[#5fd97f]"
                      : "border-[#ffd6e8] hover:bg-[#ffd6e8]"
                  }`}
                >
                  👍
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

// F3: the dashboard's one-time "How did your date go? 💘" pop-up.
//
// Shown once per plan: the dashboard only renders this when the server found
// no rating AND no verdicts from this user for the plan, and on top of that we
// keep a `ca:reviewPrompted:<planId>` localStorage flag — set the moment the
// modal opens, so dismissing counts as prompted and it never nags again on
// this device even if nothing was submitted.
//
// Flow: star rating (POST /api/ratings, same shape as RatingWidget) →
// Tinder-style verdict cards, one per visited venue (POST /api/verdicts, same
// payload as VenueVerdicts) → done state linking to the plan's keepsake.
// No venue/API fetches here — stops come from the plan row's saved JSON.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ACTIVITY_ICONS } from "@/lib/venues";
import type { VerdictStatus, VerdictStop } from "@/components/VenueVerdicts";

const PROMPTED_KEY_PREFIX = "ca:reviewPrompted:";

const VERDICT_OPTIONS: {
  value: VerdictStatus;
  emoji: string;
  label: string;
  exitX: number;
}[] = [
  { value: "disliked", emoji: "👎", label: "Nope", exitX: -240 },
  { value: "neutral", emoji: "😐", label: "Meh", exitX: 0 },
  { value: "liked", emoji: "👍", label: "Loved", exitX: 240 },
];

type Phase = "rate" | "swipe" | "done";

export function DateReviewModal({
  planId,
  title,
  stops,
}: {
  planId: string;
  /** "How did Tuesday's date go? 💘" — built server-side from the plan's date. */
  title: string;
  stops: VerdictStop[];
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("rate");

  // Star rating step.
  const [score, setScore] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verdict card stack.
  const [cardIndex, setCardIndex] = useState(0);
  const [exitX, setExitX] = useState(0);
  const [verdictBusy, setVerdictBusy] = useState(false);

  useEffect(() => {
    const key = `${PROMPTED_KEY_PREFIX}${planId}`;
    if (localStorage.getItem(key)) return;
    // Opening counts as prompted — dismissing must never re-prompt.
    localStorage.setItem(key, new Date().toISOString());
    Promise.resolve().then(() => setOpen(true));
  }, [planId]);

  if (!open) return null;

  function dismiss() {
    setOpen(false);
  }

  async function saveRating() {
    if (!score || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, score, note: note.trim() || null }),
      });
      if (!res.ok) throw new Error();
      setPhase(stops.length > 0 ? "swipe" : "done");
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function swipe(stop: VerdictStop, status: VerdictStatus) {
    if (verdictBusy) return;
    setVerdictBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/verdicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, activity: stop.activity, venue: stop.venue, status }),
      });
      if (!res.ok) throw new Error();
      setExitX(VERDICT_OPTIONS.find((o) => o.value === status)?.exitX ?? 0);
      if (cardIndex + 1 >= stops.length) {
        setPhase("done");
      } else {
        setCardIndex(cardIndex + 1);
      }
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setVerdictBusy(false);
    }
  }

  const stop = stops[cardIndex];

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-[#3a2530]/40 p-4 backdrop-blur-sm"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="relative w-full max-w-sm rounded-[24px] border-2 border-[#ffd6e8] bg-white p-5 shadow-[0_20px_60px_rgba(58,37,48,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-sm font-black text-[#c0a0b0] transition hover:bg-[#fff7fb] hover:text-[#3a2530]"
        >
          ✕
        </button>

        <h2 className="mb-1 pr-6 text-center text-lg font-black text-[#3a2530]">{title}</h2>

        {phase === "rate" && (
          <>
            <p className="mb-4 text-center text-sm text-[#8a6a78]">
              Give it a rating — just between us.
            </p>
            <div className="mb-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  className={`text-3xl transition ${n <= score ? "scale-110" : "opacity-40"}`}
                  aria-label={`Rate ${n} star${n !== 1 ? "s" : ""}`}
                >
                  ⭐
                </button>
              ))}
            </div>
            {score > 0 && (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A note about the night… (optional)"
                rows={2}
                className="mb-3 w-full resize-none rounded-2xl border-2 border-[#ffd6e8] bg-white px-4 py-3 text-sm text-[#3a2530] placeholder:text-[#c0a0b0] focus:border-[#ff7aaa] focus:outline-none"
              />
            )}
            {error && <p className="mb-2 text-center text-sm text-red-500">{error}</p>}
            <button
              type="button"
              onClick={() => void saveRating()}
              disabled={!score || saving}
              className="w-full rounded-full bg-[#ff7aaa] py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save rating →"}
            </button>
          </>
        )}

        {phase === "swipe" && stop && (
          <>
            <p className="mb-4 text-center text-sm text-[#8a6a78]">
              Would you go back? {cardIndex + 1} of {stops.length}
            </p>
            <div className="relative mb-4">
              {/* Peek of the next card, for the deck feel. */}
              {cardIndex + 1 < stops.length && (
                <div
                  aria-hidden
                  className="absolute inset-x-3 -bottom-2 h-full rounded-2xl border-2 border-[#ffd6e8] bg-[#fff7fb]"
                />
              )}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={stop.venue.id}
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: exitX, rotate: exitX / 16, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  className="relative rounded-2xl border-2 border-[#ffd6e8] bg-[#fff7fb] p-4 text-center"
                >
                  <div className="text-3xl">
                    {stop.activity === "__entree__"
                      ? "🍽️"
                      : (ACTIVITY_ICONS[stop.activity] ?? "✨")}
                  </div>
                  <p className="mt-1 truncate font-black text-[#3a2530]">{stop.venue.name}</p>
                  <p className="truncate text-xs text-[#8a6a78]">{stop.venue.address}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            {error && <p className="mb-2 text-center text-sm text-red-500">{error}</p>}
            <div className="flex justify-center gap-3">
              {VERDICT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => void swipe(stop, opt.value)}
                  disabled={verdictBusy}
                  aria-label={opt.label}
                  className="grid h-12 w-12 place-items-center rounded-full border-2 border-[#ffd6e8] bg-white text-xl shadow-sm transition hover:scale-110 hover:border-[#ff7aaa] disabled:opacity-50"
                >
                  {opt.emoji}
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "done" && (
          <div className="text-center">
            <div className="mb-2 text-4xl">💖</div>
            <p className="mb-4 text-sm text-[#8a6a78]">
              All saved — your favorites come back as suggestions next time.
            </p>
            <Link
              href={`/plan/${planId}`}
              className="block w-full rounded-full bg-[#ff7aaa] py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] hover:brightness-105"
            >
              write your keepsake →
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="mt-2 text-xs font-black text-[#c0a0b0] hover:text-[#8a6a78]"
            >
              maybe later
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

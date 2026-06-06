"use client";

import { useState } from "react";

type Rating = { raterId: string; score: number; note: string | null };

type RatingWidgetProps = {
  planId: string;
  existingRating: Rating | null;
  allRatings: Rating[];
};

export function RatingWidget({
  planId,
  existingRating,
  allRatings,
}: RatingWidgetProps) {
  const [score, setScore] = useState(existingRating?.score ?? 0);
  const [note, setNote] = useState(existingRating?.note ?? "");
  const [saved, setSaved] = useState(!!existingRating);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avgScore =
    allRatings.length > 0
      ? allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length
      : null;

  async function handleSave() {
    if (!score) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, score, note: note.trim() || null }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Couldn't save. Try again.");
    } else {
      setSaved(true);
    }
  }

  return (
    <div className="rounded-[24px] border-2 border-[#ffd6e8] bg-white p-5 text-center">
      {avgScore !== null && (
        <p className="mb-4 text-sm text-[#8a6a78]">
          Average rating:{" "}
          <strong className="text-[#3a2530]">{avgScore.toFixed(1)} / 5</strong>
        </p>
      )}
      <div className="mb-4 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => { setScore(n); setSaved(false); }}
            className={`text-3xl transition ${n <= score ? "scale-110" : "opacity-40"}`}
            aria-label={`Rate ${n} star${n !== 1 ? "s" : ""}`}
          >
            ⭐
          </button>
        ))}
      </div>
      {score > 0 && !saved && (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A note about tonight… (optional)"
            rows={2}
            className="mb-3 w-full resize-none rounded-2xl border-2 border-[#ffd6e8] bg-white px-4 py-3 text-sm text-[#3a2530] placeholder:text-[#c0a0b0] focus:border-[#ff7aaa] focus:outline-none"
          />
          {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="w-full rounded-full bg-[#ff7aaa] py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save rating"}
          </button>
        </>
      )}
      {saved && (
        <p className="text-sm font-black text-[#8a6a78]">Rating saved ✓</p>
      )}
    </div>
  );
}

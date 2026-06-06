"use client";

import { useState } from "react";

export function MemoryKeepsake({
  planId,
  initialNotes,
  initialPoem,
}: {
  planId: string;
  initialNotes: string;
  initialPoem: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [poem, setPoem] = useState<string | null>(initialPoem);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!notes.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, notes }),
      });
      if (!res.ok) {
        setError("Couldn't make your keepsake. Try again.");
        return;
      }
      const data = (await res.json()) as { poem: string | null; poemGenerated: boolean };
      if (data.poemGenerated && data.poem) setPoem(data.poem);
      else setError("Saved your notes, but the poem couldn't be written right now.");
    } catch {
      setError("Couldn't make your keepsake. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[24px] border-2 border-[#e7d9ff] bg-white/90 p-5">
      <h2 className="mb-1 text-center font-black text-[#3a2530]">Keepsake 💌</h2>
      <p className="mb-4 text-center text-sm text-[#8a6a78]">
        Jot down the highlights, the funny moments, what you loved — and we&apos;ll turn
        them into a little poem to look back on.
      </p>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="The way she laughed at the bookstore… that tiny dessert place… getting lost on the way home…"
        className="w-full resize-y rounded-2xl border-2 border-[#e7d9ff] bg-[#faf7ff] px-3 py-2 text-sm text-[#3a2530] placeholder:text-[#c0a0b0] outline-none focus:border-[#c7a6ff]"
      />

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading || !notes.trim()}
        className="mt-3 w-full rounded-full bg-[#c7a6ff] py-3 font-black text-white shadow-[0_8px_20px_rgba(199,166,255,0.32)] transition disabled:opacity-60 hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
      >
        {loading ? "Writing…" : poem ? "Rewrite our keepsake ✨" : "Write our keepsake ✨"}
      </button>

      {poem && (
        <div className="mt-4 rounded-2xl border-2 border-[#e7d9ff] bg-[#faf7ff] p-4">
          <p className="whitespace-pre-line text-center font-serif text-[15px] leading-relaxed text-[#3a2530]">
            {poem}
          </p>
        </div>
      )}
    </div>
  );
}

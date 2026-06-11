"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// F4: "Cancel this date" with an inline confirm step. Lives at the bottom of
// the sender's planner — unobtrusive until clicked, irreversible once confirmed.
export function CancelDateButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/plans/${planId}/cancel`, { method: "POST" });
    if (!res.ok) {
      setLoading(false);
      setError("Couldn't cancel. Try again.");
      return;
    }
    // Re-render the server page → it now shows the canceled state.
    router.refresh();
  }

  if (!confirming) {
    return (
      <div className="mt-10 text-center">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-xs font-black text-[#c0a0b0] underline underline-offset-4 transition hover:text-[#c0708a]"
        >
          Cancel this date
        </button>
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-[24px] border-2 border-[#ffd6e8] bg-[#fff7fb] p-5 text-center">
      <div className="mb-1 text-2xl">💔</div>
      <p className="font-black text-[#3a2530]">Call this date off?</p>
      <p className="mt-1 text-sm text-[#8a6a78]">
        This can&apos;t be undone — if the plan was shared, they&apos;ll get a gentle heads-up.
      </p>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-full border-2 border-[#ffd6e8] px-5 py-2 text-sm font-black text-[#8a6a78] disabled:opacity-60"
        >
          Keep the date
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="rounded-full bg-[#c0708a] px-5 py-2 text-sm font-black text-white disabled:opacity-60"
        >
          {loading ? "Canceling…" : "Yes, cancel it"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { sharePlan } from "@/lib/share";

type SharePlanButtonProps = {
  recipientName: string;
  selectedDateLabel: string;
  selectedTimeLabel: string;
  selectedEntree: string;
  selectedActivities: string[];
};

export function SharePlanButton(props: SharePlanButtonProps) {
  const [status, setStatus] = useState<string | null>(null);

  async function handleShare() {
    try {
      const result = await sharePlan(props);
      setStatus(
        result === "shared"
          ? "Share sheet opened. The plan is ready."
          : "Copied. Now text it before you lose your nerve.",
      );
    } catch {
      setStatus("Could not share yet. Try Copy plan instead.");
    }
  }

  async function handleCopy() {
    try {
      const { getPlanText } = await import("@/lib/share");
      await navigator.clipboard.writeText(getPlanText(props));
      setStatus("Copied. Now text it before you lose your nerve.");
    } catch {
      setStatus("Clipboard did not cooperate. Select the plan text manually.");
    }
  }

  return (
    <div className="relative grid gap-3">
      {status ? (
        <div
          className="absolute -top-16 left-1/2 z-10 w-max max-w-64 -translate-x-1/2 rounded-[22px] border-2 border-[#ffd6e8] bg-white px-4 py-3 text-center text-sm font-black leading-tight text-[#8a6a78] shadow-[0_12px_28px_rgba(255,122,170,0.2)] after:absolute after:bottom-[-7px] after:left-1/2 after:h-3 after:w-3 after:-translate-x-1/2 after:rotate-45 after:border-b-2 after:border-r-2 after:border-[#ffd6e8] after:bg-white"
          aria-live="polite"
        >
          {status}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleShare}
        className="min-h-14 rounded-full bg-[#ff7aaa] px-5 py-3 text-lg font-black text-white shadow-[0_14px_30px_rgba(255,122,170,0.32)] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
      >
        Send me the plan
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="min-h-14 rounded-full border-2 border-[#ffd6e8] bg-white px-5 py-3 font-black text-[#8a6a78] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
      >
        Copy plan
      </button>
    </div>
  );
}

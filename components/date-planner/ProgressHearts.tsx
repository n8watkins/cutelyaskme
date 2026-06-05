"use client";

import { cn } from "@/lib/utils";
import type { PlannerStep } from "./types";

const steps: PlannerStep[] = ["date", "time", "lineup", "entree", "dress", "summary"];

export function ProgressHearts({ currentStep }: { currentStep: PlannerStep }) {
  const currentIndex = steps.indexOf(currentStep);

  if (currentIndex === -1) {
    return null;
  }

  return (
    <div
      aria-label={`Planning step ${currentIndex + 1} of ${steps.length}`}
      className="mb-5 flex items-center justify-center gap-2"
    >
      {steps.map((step, index) => (
        <span
          key={step}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-full border text-sm font-black transition",
            index <= currentIndex
              ? "border-[#ff7aaa] bg-[#ff7aaa] text-white shadow-[0_8px_20px_rgba(255,122,170,0.35)]"
              : "border-[#ffd6e8] bg-white/70 text-[#c7a6ff]",
          )}
        >
          ♥
        </span>
      ))}
    </div>
  );
}

"use client";

import confetti from "canvas-confetti";
import type { EntreeOption } from "./types";
import {
  entreeIcons,
  entreeNotes,
  entreeOptions,
} from "@/lib/food-options";
import { OptionCard } from "./OptionCard";
import { StepCard } from "./StepCard";

type EntreeStepProps = {
  selectedEntree: EntreeOption | null;
  onSelectEntree: (entree: EntreeOption) => void;
  onNext: () => void;
  onBack: () => void;
};

export function EntreeStep({
  selectedEntree,
  onSelectEntree,
  onNext,
  onBack,
}: EntreeStepProps) {
  function chooseEntree(entree: EntreeOption) {
    onSelectEntree(entree);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (entree === "Surprise me" && !reduceMotion) {
      confetti({
        particleCount: 36,
        spread: 48,
        origin: { y: 0.78 },
        scalar: 0.72,
        colors: ["#ff7aaa", "#fff3d6", "#c7a6ff", "#b9e4ff"],
      });
    }
  }

  return (
    <StepCard
      stickerSrc="/assets/food-tray.svg"
      stickerAlt="Kawaii food tray"
      eyebrow="step four"
      title="Should we eat?"
      subtitle="Pick one food plan if the date needs a snacky little anchor. Dessert can be improvised later."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entreeOptions.map((entree) => (
          <OptionCard
            key={entree}
            title={entree}
            subtitle={entreeNotes[entree]}
            icon={entreeIcons[entree]}
            selected={selectedEntree === entree}
            onClick={() => chooseEntree(entree)}
            special={entree === "Surprise me"}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[0.8fr_1.2fr] gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-14 rounded-full border-2 border-[#ffd6e8] bg-white px-5 py-3 font-black text-[#8a6a78] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!selectedEntree}
          onClick={onNext}
          className="min-h-14 rounded-full bg-[#ff7aaa] px-5 py-3 font-black text-white shadow-[0_14px_30px_rgba(255,122,170,0.32)] outline-none transition disabled:cursor-not-allowed disabled:bg-[#ffd6e8] disabled:text-[#8a6a78] focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        >
          add the fun
        </button>
      </div>
    </StepCard>
  );
}

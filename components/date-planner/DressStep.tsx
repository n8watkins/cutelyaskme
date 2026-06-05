"use client";

import { StepCard } from "./StepCard";
import type { DressVibe } from "./types";

type DressStepProps = {
  selected: DressVibe | null;
  onSelect: (vibe: DressVibe) => void;
  onBack: () => void;
  onNext: () => void;
};

const OPTIONS: { vibe: DressVibe; emoji: string; label: string; note: string }[] = [
  {
    vibe: "casual",
    emoji: "🧢",
    label: "Keep it casual",
    note: "jeans, sneakers, zero stress",
  },
  {
    vibe: "casual-cute",
    emoji: "🌸",
    label: "Casual but cute",
    note: "put-together without trying too hard",
  },
  {
    vibe: "dress-up",
    emoji: "👗",
    label: "I love an excuse to dress up",
    note: "give me a reason and I'll use it",
  },
  {
    vibe: "match-you",
    emoji: "✨",
    label: "I'll match whatever you plan",
    note: "surprise me, I'll figure it out",
  },
];

export function DressStep({ selected, onSelect, onBack, onNext }: DressStepProps) {
  return (
    <StepCard
      stickerSrc="/assets/speech-heart.svg"
      stickerAlt="Speech bubble with heart"
      eyebrow="last thing"
      title="How do you like to dress for dates?"
      subtitle="This helps with the vibe. No wrong answers."
    >
      <div className="grid gap-3">
        {OPTIONS.map(({ vibe, emoji, label, note }) => {
          const isSelected = selected === vibe;
          return (
            <button
              key={vibe}
              type="button"
              onClick={() => onSelect(vibe)}
              className={`flex items-center gap-4 rounded-[22px] border-2 p-4 text-left outline-none transition focus-visible:ring-4 focus-visible:ring-[#ffd6e8] ${
                isSelected
                  ? "border-[#ff7aaa] bg-[#ff7aaa]"
                  : "border-[#ffd6e8] bg-white hover:bg-[#fff7fb]"
              }`}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#fff7fb] text-2xl shadow-inner">
                {emoji}
              </span>
              <div>
                <p className={`font-black ${isSelected ? "text-white" : "text-[#3a2530]"}`}>
                  {label}
                </p>
                <p className={`text-sm ${isSelected ? "text-white/80" : "text-[#8a6a78]"}`}>
                  {note}
                </p>
              </div>
              {isSelected && (
                <span className="ml-auto text-xl text-white">✓</span>
              )}
            </button>
          );
        })}
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
          disabled={!selected}
          onClick={onNext}
          className="min-h-14 rounded-full bg-[#ff7aaa] px-5 py-3 font-black text-white shadow-[0_14px_30px_rgba(255,122,170,0.32)] outline-none transition disabled:cursor-not-allowed disabled:bg-[#ffd6e8] disabled:text-[#8a6a78] focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        >
          {selected ? "Almost there →" : "pick one"}
        </button>
      </div>
    </StepCard>
  );
}

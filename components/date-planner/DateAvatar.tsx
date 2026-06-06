"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import type { PlannerStep } from "./types";

const avatarCopy: Record<PlannerStep, string> = {
  invite: "I am pretending to be calm.",
  accepted: "Okay wow. Great start.",
  date: "Cute Cal is taking this seriously.",
  time: "Pick whatever feels easiest.",
  lineup: "Two little moments. Keep it cute.",
  entree: "Food can be the finale.",
  dress: "No wrong answers here.",
  summary: "This plan is adorable.",
  confirmed: "They're gonna love this.",
};

type DateAvatarProps = {
  step: PlannerStep;
  avatarSrc: string | null;
  onAvatarChange: (src: string) => void;
};

export function DateAvatar({ step, avatarSrc, onAvatarChange }: DateAvatarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onAvatarChange(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <motion.aside
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed right-3 top-3 z-20 hidden max-w-[220px] items-start gap-2 sm:flex"
      aria-label="Date planner commentary"
    >
      <div className="relative rounded-[22px] border-2 border-[#ffd6e8] bg-white px-4 py-3 text-sm font-black leading-tight text-[#8a6a78] shadow-[0_14px_30px_rgba(255,122,170,0.18)] after:absolute after:right-[-7px] after:top-5 after:h-3 after:w-3 after:rotate-45 after:border-r-2 after:border-t-2 after:border-[#ffd6e8] after:bg-white">
        {avatarCopy[step]}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Click to change your photo"
        className="group relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#3a2530] bg-[#fff3d6] text-2xl shadow-[0_12px_24px_rgba(58,37,48,0.14)] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
      >
        {avatarSrc
          ? <img src={avatarSrc} alt="Your avatar" className="h-full w-full object-cover" />
          : <span aria-hidden>🙂</span>
        }
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 text-[10px] font-black text-white opacity-0 transition-opacity group-hover:opacity-100">
          change
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </motion.aside>
  );
}

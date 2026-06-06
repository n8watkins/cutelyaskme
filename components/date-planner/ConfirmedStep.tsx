"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { StepCard } from "./StepCard";

export function ConfirmedStep({ planId }: { planId: string }) {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#ff7aaa", "#ffd6e8", "#c7a6ff", "#b9e4ff", "#fff3d6"],
      });
    }
  }, []);

  return (
    <StepCard
      stickerSrc="/assets/sticker-burst.svg"
      stickerAlt="Celebration burst"
      eyebrow="it's official"
      title="It's a date! 🎉"
      subtitle="The plan is locked in. They're already planning the outfit."
    >
      <div className="grid gap-3">
        <motion.a
          href={`/plan/${planId}`}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="block min-h-14 w-full rounded-full bg-[#ff7aaa] px-6 py-4 text-center text-lg font-black text-white shadow-[0_14px_30px_rgba(255,122,170,0.32)] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        >
          See the plan ✨
        </motion.a>
        <motion.a
          href="/dashboard"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="block min-h-12 w-full rounded-full border-2 border-[#ffd6e8] bg-white px-6 py-3 text-center font-black text-[#8a6a78] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        >
          Go to dashboard
        </motion.a>
      </div>
    </StepCard>
  );
}

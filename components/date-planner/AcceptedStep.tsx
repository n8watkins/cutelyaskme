"use client";

import { motion } from "framer-motion";
import { StepCard } from "./StepCard";

export function AcceptedStep({ onNext }: { onNext: () => void }) {
  return (
    <StepCard
      stickerSrc="/assets/sticker-burst.svg"
      stickerAlt="Celebration sticker burst"
      eyebrow="tiny celebration"
      title="Yes? yes!"
      subtitle="That just made my whole day. Now let's pick the cute details."
    >
      <motion.button
        type="button"
        onClick={onNext}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="min-h-14 w-full rounded-full bg-[#3a2530] px-6 py-4 text-lg font-black text-white shadow-[0_14px_30px_rgba(58,37,48,0.2)] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
      >
        plan it →
      </motion.button>
    </StepCard>
  );
}

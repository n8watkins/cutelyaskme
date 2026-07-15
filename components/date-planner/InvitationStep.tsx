"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { EvasiveNoButton } from "./EvasiveNoButton";
import { StepCard } from "./StepCard";

type InvitationStepProps = {
  recipientName: string;
  noAttempts: number;
  onNoAttempt: () => void;
  onNoCommentary: (message: string) => void;
  onAccept: () => void;
  ready: boolean;
};

export function InvitationStep({
  recipientName,
  noAttempts,
  onNoAttempt,
  onNoCommentary,
  onAccept,
  ready,
}: InvitationStepProps) {
  const yesButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <StepCard
      stickerSrc="/assets/heart-envelope.svg"
      stickerAlt="Pastel heart envelope"
      eyebrow="tiny date delivery"
      title={`${recipientName}...`}
      subtitle="I made you a tiny little invitation."
    >
      <div className="rounded-[24px] bg-[#fff7fb]/80 p-4">
        <p className="text-balance text-3xl font-black leading-tight text-[#3a2530]">
          Will you go on a date with me?
        </p>
        <div className="relative mt-8 grid min-h-56 place-items-center">
          <motion.button
            ref={yesButtonRef}
            type="button"
            onClick={onAccept}
            disabled={!ready}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            className="min-h-20 min-w-44 rounded-full bg-[#ff7aaa] px-10 py-5 text-2xl font-black text-white shadow-[0_18px_38px_rgba(255,122,170,0.4)] outline-none transition disabled:cursor-wait disabled:opacity-70 focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
            animate={{
              scale: 1 + Math.min(noAttempts, 4) * 0.025,
              boxShadow:
                noAttempts > 0
                  ? "0 20px 44px rgba(255,122,170,0.5)"
                  : "0 18px 38px rgba(255,122,170,0.4)",
            }}
          >
            Yes! ♥
          </motion.button>
          <EvasiveNoButton
            attempts={noAttempts}
            yesButtonRef={yesButtonRef}
            onAttempt={onNoAttempt}
            onCommentary={onNoCommentary}
          />
        </div>
      </div>
    </StepCard>
  );
}

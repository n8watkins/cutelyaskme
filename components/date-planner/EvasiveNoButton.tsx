"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { noButtonLabels } from "@/lib/planner-copy";
import { cn } from "@/lib/utils";

type EvasiveNoButtonProps = {
  attempts: number;
  onAttempt: () => void;
};

export function EvasiveNoButton({ attempts, onAttempt }: EvasiveNoButtonProps) {
  const reduceMotion = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: -64, y: 30 });
  const [previousSide, setPreviousSide] = useState<"left" | "right">("left");
  const [bubbleText, setBubbleText] = useState<string>(noButtonLabels[0]);
  const [remainingLabels, setRemainingLabels] = useState<string[]>(
    noButtonLabels.slice(1),
  );

  function dodge() {
    onAttempt();

    setBubbleText((currentText) => {
      const pool = remainingLabels.length
        ? remainingLabels
        : noButtonLabels.filter((label) => label !== currentText);
      const nextText = pool[Math.floor(Math.random() * pool.length)] ?? noButtonLabels[0];
      setRemainingLabels(pool.filter((label) => label !== nextText));
      return nextText;
    });

    if (reduceMotion || typeof window === "undefined") {
      return;
    }

    const nextSide = previousSide === "left" ? "right" : "left";
    const direction = nextSide === "right" ? 1 : -1;
    const x = direction * (42 + Math.round(Math.random() * 28));
    const yBase = previousSide === "left" ? -34 : 34;
    const y = yBase + Math.round(Math.random() * 20 - 10);

    setPreviousSide(nextSide);
    setPosition({ x, y });
  }

  const scale = Math.max(0.86, 1 - attempts * 0.035);
  const bubbleOnRight = position.x >= 0;

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      initial={{ x: position.x, y: position.y }}
      animate={{ x: position.x, y: position.y, scale }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
    >
      <motion.div
        aria-hidden
        key={bubbleText}
        initial={{ opacity: 0, y: 5, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={cn(
          "absolute top-1/2 w-max max-w-52 -translate-y-1/2 rounded-[22px] border-2 border-[#ffd6e8] bg-white px-4 py-3 text-center text-sm font-black leading-tight text-[#8a6a78] shadow-[0_10px_22px_rgba(255,122,170,0.18)] after:absolute after:top-1/2 after:h-3 after:w-3 after:-translate-y-1/2 after:rotate-45 after:border-[#ffd6e8] after:bg-white",
          bubbleOnRight
            ? "left-[calc(100%+10px)] after:left-[-7px] after:border-b-2 after:border-l-2"
            : "right-[calc(100%+10px)] after:right-[-7px] after:border-r-2 after:border-t-2",
        )}
      >
        {bubbleText}
      </motion.div>
      <button
        ref={buttonRef}
        type="button"
        onPointerEnter={dodge}
        onTouchStart={(event) => {
          event.preventDefault();
          dodge();
        }}
        onClick={dodge}
        className="grid min-h-16 min-w-20 place-items-center rounded-full border-2 border-[#ffd6e8] bg-white px-6 py-4 text-xl font-black text-[#8a6a78] shadow-[0_12px_24px_rgba(255,122,170,0.18)] outline-none transition hover:border-[#ff7aaa] focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        aria-label="No"
      >
        No
      </button>
    </motion.div>
  );
}
